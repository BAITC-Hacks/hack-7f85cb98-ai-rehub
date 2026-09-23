import {
  MODEL_VERSION, RULES, INDICATORS, CATEGORIES, DISTRICTS, MEASURES,
  SYNERGIES, INCOMPATIBILITIES,
} from './data.mjs';

export * from './data.mjs';

const measuresById = new Map(MEASURES.map(measure => [measure.id, measure]));
const districtsById = new Map(DISTRICTS.map(district => [district.id, district]));
const indicatorIds = new Set(INDICATORS.map(indicator => indicator.id));
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

/** Validate the final five decisions. Costs and effects always come from the catalog. */
export function validateDecisions(decisions) {
  const errors = [];
  const categoryCounts = Object.fromEntries(CATEGORIES.map(category => [category.id, 0]));
  let spent = 0;
  let costKnown = true;
  const selections = new Map();
  const error = (code, message, details = {}) => errors.push({code, message, ...details});
  if (!Array.isArray(decisions)) {
    error('INVALID_INPUT', 'Решения должны быть массивом.');
    return {valid: false, errors, budget: {limit: RULES.budget, spent: null, remaining: null},
      decisionCount: null, categoryCounts};
  }
  if (decisions.length !== RULES.decisionCount) {
    error('DECISION_COUNT', `Нужно выбрать ровно ${RULES.decisionCount} мероприятий.`,
      {expected: RULES.decisionCount, actual: decisions.length});
  }
  // Use an indexed loop so sparse arrays cannot bypass validation.
  for (let index = 0; index < decisions.length; index++) {
    const decision = decisions[index];
    const details = {decisionIndex: index};
    if (!isRecord(decision)) {
      costKnown = false;
      error('INVALID_DECISION', 'Каждое решение должно быть объектом.', details);
      continue;
    }
    const unexpected = Object.keys(decision).filter(key => !['measureId', 'districtId'].includes(key));
    if (unexpected.length) {
      error('INVALID_FIELDS', 'В решении разрешены только measureId и districtId.',
        {...details, fields: unexpected});
    }
    const measure = own(decision, 'measureId') && measuresById.get(decision.measureId);
    if (!measure) {
      costKnown = false;
      error('UNKNOWN_MEASURE', 'Неизвестное мероприятие.', details);
      continue;
    }
    spent += measure.cost;
    categoryCounts[measure.category]++;
    if (selections.has(measure.id)) {
      error('DUPLICATE_MEASURE', `Мероприятие ${measure.id} можно выбрать только один раз.`,
        {...details, measureIds: [measure.id]});
    } else {
      selections.set(measure.id, decision);
    }
    if (measure.scope === 'city') {
      if (own(decision, 'districtId')) {
        error('DISTRICT_NOT_ALLOWED', `Для городской меры ${measure.id} район не указывается.`, details);
      }
    } else if (!own(decision, 'districtId') || decision.districtId === null || decision.districtId === '') {
      error('DISTRICT_REQUIRED', `Для меры ${measure.id} выберите район.`, details);
    } else if (!districtsById.has(decision.districtId)) {
      error('UNKNOWN_DISTRICT', 'Неизвестный район.', details);
    }
  }
  for (const category of CATEGORIES) {
    if (categoryCounts[category.id] > RULES.maxPerCategory) {
      error('CATEGORY_LIMIT', `В направлении «${category.name}» допускается не более ${RULES.maxPerCategory} мер.`,
        {category: category.id, actual: categoryCounts[category.id]});
    }
  }
  if (spent > RULES.budget) {
    error('BUDGET_EXCEEDED', `Стоимость известных мероприятий ${spent} превышает бюджет ${RULES.budget}.`,
      {limit: RULES.budget, knownCost: spent});
  }
  for (const conflict of INCOMPATIBILITIES) {
    const [first, second] = conflict.measureIds.map(id => selections.get(id));
    if (!first || !second) continue;
    if (conflict.scope === 'global' || (districtsById.has(first.districtId)
      && first.districtId === second.districtId)) {
      error('INCOMPATIBLE_MEASURES', conflict.reason,
        {measureIds: [...conflict.measureIds], scope: conflict.scope});
    }
  }
  return {
    valid: errors.length === 0, errors,
    budget: {limit: RULES.budget, spent: costKnown ? spent : null,
      remaining: costKnown ? RULES.budget - spent : null},
    decisionCount: decisions.length, categoryCounts,
  };
}

// Every reachable indicator is a multiple of 1/8: H=8, integer base/effects/bonuses.
// Integer arithmetic keeps the model exact; rounding belongs only in the UI.
const INDICATOR_SCALE = 8;
const DISTRICT_SCALE = INDICATOR_SCALE * 100;
const CITY_SCALE = DISTRICT_SCALE * 100;
const SCORE_SCALE = CITY_SCALE * 10;
function indicatorUnits(value, bounded = true) {
  if (typeof value !== 'number' || !Number.isFinite(value)
    || !Number.isSafeInteger(value * INDICATOR_SCALE)
    || (bounded && (value < 0 || value > 100))) {
    throw new TypeError('Показатели должны быть конечными числами с шагом 1/8 в диапазоне 0–100.');
  }
  return value * INDICATOR_SCALE;
}

/** Sum all effects, then clip once. Also used by the engine for fixed synergy bonuses. */
export function applyIndicatorEffects(indicators, effects) {
  if (!isRecord(indicators) || !Array.isArray(effects)
    || Object.keys(indicators).some(key => !indicatorIds.has(key))) {
    throw new TypeError('Некорректный набор показателей или эффектов.');
  }
  const units = Object.fromEntries(INDICATORS.map(({id}) => [id, indicatorUnits(indicators[id])]));
  for (const effect of effects) {
    if (!isRecord(effect)) throw new TypeError('Эффект должен быть объектом.');
    for (const [id, value] of Object.entries(effect)) {
      if (!indicatorIds.has(id)) throw new TypeError(`Неизвестный показатель: ${id}`);
      units[id] += indicatorUnits(value, false);
      if (!Number.isSafeInteger(units[id])) throw new RangeError('Слишком большой эффект.');
    }
  }
  return Object.fromEntries(INDICATORS.map(({id}) => [id,
    Math.max(0, Math.min(100 * INDICATOR_SCALE, units[id])) / INDICATOR_SCALE]));
}

/** Low-level evaluator of a complete five-district snapshot; not a scenario validator. */
export function evaluateIndicators(districts) {
  if (!Array.isArray(districts) || districts.length !== DISTRICTS.length
    || districts.some(d => !isRecord(d))
    || new Set(districts.map(d => d.id)).size !== DISTRICTS.length
    || districts.some(d => !districtsById.has(d.id))) {
    throw new TypeError('Ожидаются все пять районов с уникальными идентификаторами.');
  }
  const input = new Map(districts.map(d => [d.id, d]));
  const criticalIndicators = [];
  const districtUnits = [];
  const scoredDistricts = DISTRICTS.map(district => {
    const values = applyIndicatorEffects(input.get(district.id).indicators, []);
    let units = 0;
    for (const {id, weight} of INDICATORS) {
      units += indicatorUnits(values[id]) * Math.round(weight * 100);
      if (values[id] < RULES.criticalThreshold) {
        criticalIndicators.push({districtId: district.id, indicatorId: id, value: values[id]});
      }
    }
    districtUnits.push(units);
    return {id: district.id, name: district.name, populationShare: district.populationShare,
      indicators: values, score: units / DISTRICT_SCALE};
  });
  const averageUnits = districtUnits.reduce((sum, units, index) =>
    sum + units * Math.round(DISTRICTS[index].populationShare * 100), 0);
  const weakestUnits = Math.min(...districtUnits);
  const criticalCount = criticalIndicators.length;
  const averageNumerator = Math.round(RULES.averageWeight * 10) * averageUnits;
  const weakestNumerator = Math.round(RULES.weakestWeight * 10) * weakestUnits * 100;
  const penaltyNumerator = -RULES.criticalPenalty * criticalCount * SCORE_SCALE;
  return {
    districts: scoredDistricts,
    populationWeightedScore: averageUnits / CITY_SCALE,
    weakestDistrictScore: weakestUnits / DISTRICT_SCALE,
    weakestDistrictIds: scoredDistricts.filter((_, i) => districtUnits[i] === weakestUnits).map(d => d.id),
    criticalCount, criticalIndicators,
    score: (averageNumerator + weakestNumerator + penaltyNumerator) / SCORE_SCALE,
    scoreComponents: {average: averageNumerator / SCORE_SCALE, weakest: weakestNumerator / SCORE_SCALE,
      criticalPenalty: penaltyNumerator / SCORE_SCALE},
  };
}

/** The empty selection is a baseline only; it is never a valid submitted scenario. */
export function getBaseline() {
  return evaluateIndicators(DISTRICTS);
}

const difference = (after, before) =>
  (Math.round(after * SCORE_SCALE) - Math.round(before * SCORE_SCALE)) / SCORE_SCALE;

/** Pure synchronous API shared by browser, backend and AI integration. */
export function simulateScenario(decisions) {
  const validation = validateDecisions(decisions);
  if (!validation.valid) return {valid: false, validation, result: null};
  const selected = new Map(decisions.map(decision => [decision.measureId, decision]));
  const effectsByDistrict = new Map(DISTRICTS.map(district => [district.id, []]));
  const measureEffects = [];
  // Catalog order makes results independent of the order of user decisions.
  for (const measure of MEASURES) {
    const decision = selected.get(measure.id);
    if (!decision) continue;
    const realizedFraction = (RULES.horizonQuarters - measure.lagQuarters) / RULES.horizonQuarters;
    const effects = Object.fromEntries(Object.entries(measure.effects)
      .map(([id, value]) => [id, value * realizedFraction]));
    const districtIds = measure.scope === 'city' ? DISTRICTS.map(d => d.id) : [decision.districtId];
    for (const id of districtIds) effectsByDistrict.get(id).push(effects);
    measureEffects.push({measureId: measure.id, name: measure.name, category: measure.category,
      scope: measure.scope, cost: measure.cost, lagQuarters: measure.lagQuarters,
      realizedFraction, districtIds, effects});
  }
  const synergies = [];
  for (const synergy of SYNERGIES) {
    if (!synergy.measureIds.every(id => selected.has(id))) continue;
    const districtId = selected.get(synergy.targetMeasureId).districtId;
    effectsByDistrict.get(districtId).push(synergy.effects);
    synergies.push({id: synergy.id, measureIds: [...synergy.measureIds], districtId,
      effects: {...synergy.effects}});
  }
  const baseline = getBaseline();
  const after = evaluateIndicators(DISTRICTS.map(district => ({...district,
    indicators: applyIndicatorEffects(district.indicators, effectsByDistrict.get(district.id))})));
  const districtChanges = after.districts.map((district, index) => {
    const before = baseline.districts[index];
    return {districtId: district.id, name: district.name,
      scoreBefore: before.score, scoreAfter: district.score, scoreDelta: difference(district.score, before.score),
      indicators: Object.fromEntries(INDICATORS.map(({id}) => [id,
        {before: before.indicators[id], after: district.indicators[id],
          delta: difference(district.indicators[id], before.indicators[id])}]))};
  });
  const delta = {
    score: difference(after.score, baseline.score),
    populationWeightedScore: difference(after.populationWeightedScore, baseline.populationWeightedScore),
    weakestDistrictScore: difference(after.weakestDistrictScore, baseline.weakestDistrictScore),
    criticalCount: after.criticalCount - baseline.criticalCount,
    scoreComponents: Object.fromEntries(['average', 'weakest', 'criticalPenalty'].map(key =>
      [key, difference(after.scoreComponents[key], baseline.scoreComponents[key])])),
  };
  const warnings = [];
  for (const critical of after.criticalIndicators) {
    warnings.push({code: 'CRITICAL_INDICATOR', message: 'Показатель остаётся ниже критического порога.', ...critical});
  }
  for (const district of districtChanges) {
    for (const [indicatorId, change] of Object.entries(district.indicators)) {
      if (change.delta < 0) warnings.push({code: 'INDICATOR_DECREASE',
        message: 'Сценарий снижает показатель.', districtId: district.districtId, indicatorId, ...change});
    }
  }
  return {valid: true, validation, result: {
    modelVersion: MODEL_VERSION, baseline, after, delta, districtChanges,
    measureEffects, synergies, warnings,
  }};
}
