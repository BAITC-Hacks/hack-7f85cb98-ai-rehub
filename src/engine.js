import {
  DIRECTIONS,
  DISTRICTS,
  INCOMPATIBILITIES,
  MEASURES,
  METRIC_ORDER,
  METRICS,
  SYNERGIES,
  WEIGHTS
} from "./data.js";

export const BUDGET = 100;
export const HORIZON = 8;

const measureById = new Map(MEASURES.map((measure) => [measure.id, measure]));
const districtById = new Map(DISTRICTS.map((district) => [district.id, district]));
const round = (number, precision = 2) => Number(number.toFixed(precision));
const clip = (number) => Math.max(0, Math.min(100, number));

export function districtScore(indicators) {
  return METRIC_ORDER.reduce((total, metric) => total + indicators[metric] * WEIGHTS[metric], 0);
}

export function scoreCity(districtResults) {
  const cityAverage = districtResults.reduce(
    (total, district) => total + district.population * district.afterScore,
    0
  );
  const weakestScore = Math.min(...districtResults.map((district) => district.afterScore));
  const criticalCount = districtResults.reduce(
    (count, district) => count + METRIC_ORDER.filter((metric) => district.after[metric] < 40).length,
    0
  );
  return {
    cityAverage,
    weakestScore,
    criticalCount,
    score: 0.7 * cityAverage + 0.3 * weakestScore - criticalCount
  };
}

export function validatePlan(decisions) {
  const errors = [];
  const normalized = Array.isArray(decisions) ? decisions : [];
  const measures = normalized.map((decision) => measureById.get(decision.measureId)).filter(Boolean);

  if (normalized.length !== 5) {
    errors.push(normalized.length < 5
      ? `Добавьте ещё ${5 - normalized.length} ${pluralize(5 - normalized.length, "решение", "решения", "решений")}.`
      : "Можно выбрать ровно 5 решений.");
  }

  const ids = normalized.map((decision) => decision.measureId);
  if (new Set(ids).size !== ids.length) errors.push("Каждое мероприятие можно выбрать только один раз.");
  if (measures.length !== normalized.length) errors.push("В плане есть неизвестное мероприятие.");

  normalized.forEach((decision) => {
    const measure = measureById.get(decision.measureId);
    if (!measure) return;
    if (measure.type === "district" && !districtById.has(decision.districtId)) {
      errors.push(`${measure.id}: выберите район.`);
    }
    if (measure.type === "city" && decision.districtId) {
      errors.push(`${measure.id}: городская мера не должна иметь район.`);
    }
  });

  const totalCost = measures.reduce((total, measure) => total + measure.cost, 0);
  if (totalCost > BUDGET) errors.push(`Бюджет превышен на ${totalCost - BUDGET} ед.`);

  const directionCounts = measures.reduce((counts, measure) => {
    counts[measure.direction] = (counts[measure.direction] || 0) + 1;
    return counts;
  }, {});
  Object.entries(directionCounts).forEach(([direction, count]) => {
    if (count > 2) errors.push(`${DIRECTIONS[direction].name}: допускается не более двух мер.`);
  });

  INCOMPATIBILITIES.forEach((conflict) => {
    const first = normalized.find((decision) => decision.measureId === conflict.pair[0]);
    const second = normalized.find((decision) => decision.measureId === conflict.pair[1]);
    if (!first || !second) return;
    if (conflict.scope === "global" || first.districtId === second.districtId) errors.push(conflict.message);
  });

  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)],
    totalCost,
    budgetLeft: BUDGET - totalCost,
    directionCounts
  };
}

export function calculateScenario(decisions) {
  const validation = validatePlan(decisions);
  if (!validation.valid) {
    const error = new Error(validation.errors.join(" "));
    error.validation = validation;
    throw error;
  }

  const afterByDistrict = Object.fromEntries(
    DISTRICTS.map((district) => [district.id, { ...district.indicators }])
  );

  decisions.forEach((decision) => {
    const measure = measureById.get(decision.measureId);
    const targetIds = measure.type === "city" ? DISTRICTS.map((district) => district.id) : [decision.districtId];
    const realizedShare = (HORIZON - measure.lag) / HORIZON;
    targetIds.forEach((districtId) => {
      Object.entries(measure.effects).forEach(([metric, fullEffect]) => {
        afterByDistrict[districtId][metric] += fullEffect * realizedShare;
      });
    });
  });

  const activeSynergies = [];
  SYNERGIES.forEach((synergy) => {
    const hasPair = synergy.pair.every((id) => decisions.some((decision) => decision.measureId === id));
    if (!hasPair) return;
    const anchorDecision = decisions.find((decision) => decision.measureId === synergy.anchor);
    afterByDistrict[anchorDecision.districtId][synergy.metric] += synergy.bonus;
    activeSynergies.push({ ...synergy, districtId: anchorDecision.districtId });
  });

  const districtResults = DISTRICTS.map((district) => {
    const before = { ...district.indicators };
    const after = Object.fromEntries(
      METRIC_ORDER.map((metric) => [metric, clip(afterByDistrict[district.id][metric])])
    );
    const beforeScore = districtScore(before);
    const afterScore = districtScore(after);
    return {
      ...district,
      before,
      after,
      beforeScore,
      afterScore,
      delta: afterScore - beforeScore,
      metricDeltas: Object.fromEntries(METRIC_ORDER.map((metric) => [metric, after[metric] - before[metric]]))
    };
  });

  const final = scoreCity(districtResults);
  const baselineDistricts = DISTRICTS.map((district) => ({
    ...district,
    before: district.indicators,
    after: district.indicators,
    beforeScore: districtScore(district.indicators),
    afterScore: districtScore(district.indicators)
  }));
  const baseline = scoreCity(baselineDistricts);
  const weakestDistrict = [...districtResults].sort((a, b) => a.afterScore - b.afterScore)[0];
  const strongestGain = [...districtResults].sort((a, b) => b.delta - a.delta)[0];

  return {
    score: final.score,
    roundedScore: round(final.score),
    baselineScore: baseline.score,
    roundedBaselineScore: round(baseline.score),
    delta: final.score - baseline.score,
    cityAverage: final.cityAverage,
    weakestScore: final.weakestScore,
    criticalCount: final.criticalCount,
    weakestDistrict,
    strongestGain,
    districts: districtResults,
    activeSynergies,
    decisions: decisions.map((decision) => ({
      ...decision,
      measure: measureById.get(decision.measureId),
      district: decision.districtId ? districtById.get(decision.districtId) : null
    })),
    totalCost: validation.totalCost,
    budgetLeft: validation.budgetLeft
  };
}

export function buildFallbackAnalysis(result) {
  const topMetric = Object.entries(result.strongestGain.metricDeltas)
    .sort(([, a], [, b]) => b - a)
    .find(([, delta]) => delta > 0);
  const synergyText = result.activeSynergies.length
    ? `Сработало синергий: ${result.activeSynergies.length}.`
    : "Синергии не активированы.";
  const criticalText = result.criticalCount === 0
    ? "Критических значений ниже 40 не осталось."
    : `После мер осталось критических значений: ${result.criticalCount}.`;

  return {
    mode: "Локальное объяснение · без API",
    strengths: `Наибольший прирост получил район ${result.strongestGain.name}: +${formatNumber(result.strongestGain.delta)} балла. ${topMetric ? `Главный вклад — «${METRICS[topMetric[0]].name}» (+${formatNumber(topMetric[1])}).` : "Изменения распределены по нескольким показателям."}`,
    risks: `Слабейшим остаётся район ${result.weakestDistrict.name} с результатом ${formatNumber(result.weakestDistrict.afterScore)}. ${criticalText}`,
    recommendation: `${synergyText} При следующей итерации проверьте меры, которые адресно усиливают слабейший район, не нарушая лимит двух мер на направление.`
  };
}

export function toAnalysisPayload(result) {
  return {
    score: round(result.score, 4),
    baselineScore: round(result.baselineScore, 4),
    delta: round(result.delta, 4),
    totalCost: result.totalCost,
    budgetLeft: result.budgetLeft,
    criticalCount: result.criticalCount,
    activeSynergies: result.activeSynergies.map((synergy) => ({
      pair: synergy.pair,
      metric: synergy.metric,
      bonus: synergy.bonus,
      districtId: synergy.districtId
    })),
    decisions: result.decisions.map((decision) => ({
      measureId: decision.measureId,
      measureName: decision.measure.name,
      district: decision.district?.name || "Весь город",
      cost: decision.measure.cost,
      lag: decision.measure.lag
    })),
    districts: result.districts.map((district) => ({
      id: district.id,
      name: district.name,
      beforeScore: round(district.beforeScore, 4),
      afterScore: round(district.afterScore, 4),
      delta: round(district.delta, 4),
      metricDeltas: Object.fromEntries(
        Object.entries(district.metricDeltas).map(([metric, delta]) => [metric, round(delta, 4)])
      )
    }))
  };
}

export function formatNumber(number, precision = 2) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(number);
}

function pluralize(number, one, few, many) {
  const mod10 = number % 10;
  const mod100 = number % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
