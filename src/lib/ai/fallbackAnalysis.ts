import type {
  DistrictResult,
  IndicatorCode,
  ReplacementCandidate,
  ScenarioAnalysis,
  ScenarioResult,
} from "@/types/simulation";

const INDICATOR_LABELS: Record<IndicatorCode, string> = {
  T1: "разгрузка дорог",
  T2: "доступность общественного транспорта",
  E1: "озеленение",
  E2: "качество воздуха",
  S1: "школы и детские сады",
  S2: "поликлиники и первичная медпомощь",
  B1: "безопасность улиц",
  B2: "безопасность дорожного движения",
  C1: "надёжность ЖКХ",
  C2: "скорость решения обращений жителей",
};

const numberFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function getWeakestDistrict(districts: DistrictResult[]): DistrictResult | undefined {
  return districts.reduce<DistrictResult | undefined>((weakest, district) => {
    if (!weakest || district.scoreAfter < weakest.scoreAfter) {
      return district;
    }
    return weakest;
  }, undefined);
}

function getMostImprovedDistrict(
  districts: DistrictResult[],
): DistrictResult | undefined {
  return districts.reduce<DistrictResult | undefined>((best, district) => {
    if (!best || district.scoreDelta > best.scoreDelta) {
      return district;
    }
    return best;
  }, undefined);
}

function getCriticalIndicators(scenario: ScenarioResult): string[] {
  return scenario.districts.flatMap((district) =>
    (Object.entries(district.indicatorsAfter) as [IndicatorCode, number][])
      .filter(([, value]) => value < 40)
      .map(
        ([indicator, value]) =>
          `${district.name}: ${INDICATOR_LABELS[indicator]} (${formatNumber(value)})`,
      ),
  );
}

function describeChange(change: ReplacementCandidate["added"]): string {
  const district = change.districtName ? ` в районе ${change.districtName}` : "";
  return `${change.decision.measureId} «${change.measureName}»${district}`;
}

export function createFallbackAnalysis(
  scenario: ScenarioResult,
  candidate?: ReplacementCandidate,
): ScenarioAnalysis {
  if (!scenario.valid) {
    return {
      source: "fallback",
      summary: "Сценарий нельзя оценить, пока не исправлены ошибки выбора.",
      strengths: [],
      risks: scenario.errors,
      tradeoffs: [],
      recommendations: ["Исправьте указанные нарушения и повторите расчёт."],
    };
  }

  const weakestDistrict = getWeakestDistrict(scenario.districts);
  const mostImprovedDistrict = getMostImprovedDistrict(scenario.districts);
  const criticalIndicators = getCriticalIndicators(scenario);
  const strengths: string[] = [];
  const risks: string[] = [];
  const tradeoffs: string[] = [];
  const recommendations: string[] = [];

  if (scenario.scoreDelta > 0) {
    strengths.push(
      `Итоговый Score вырос на ${formatNumber(scenario.scoreDelta)} пункта.`,
    );
  }

  if (scenario.criticalAfter < scenario.criticalBefore) {
    strengths.push(
      `Количество критических показателей сократилось с ${scenario.criticalBefore} до ${scenario.criticalAfter}.`,
    );
  }

  if (mostImprovedDistrict && mostImprovedDistrict.scoreDelta > 0) {
    strengths.push(
      `Наибольший прирост получил район ${mostImprovedDistrict.name}: +${formatNumber(mostImprovedDistrict.scoreDelta)}.`,
    );
  }

  if (scenario.activatedSynergies.length > 0) {
    strengths.push(
      `Активированы синергии: ${scenario.activatedSynergies.join("; ")}.`,
    );
  }

  if (weakestDistrict) {
    risks.push(
      `Самым слабым остаётся район ${weakestDistrict.name} со Score ${formatNumber(weakestDistrict.scoreAfter)}.`,
    );
  }

  if (criticalIndicators.length > 0) {
    risks.push(
      `После реализации остаются критические показатели: ${criticalIndicators.join("; ")}.`,
    );
  }

  const decliningIndicators = scenario.districts.flatMap((district) =>
    (Object.entries(district.indicatorsAfter) as [IndicatorCode, number][])
      .filter(([code, value]) => value < district.indicatorsBefore[code])
      .map(([code, value]) =>
        `${district.name}: ${INDICATOR_LABELS[code]} снизился с ${formatNumber(district.indicatorsBefore[code])} до ${formatNumber(value)}`,
      ),
  );
  if (decliningIndicators.length > 0) {
    risks.push(`Снизились отдельные показатели: ${decliningIndicators.join("; ")}.`);
  }

  const decliningDistricts = scenario.districts.filter(
    (district) => district.scoreDelta < 0,
  );
  if (decliningDistricts.length > 0) {
    risks.push(
      `Ухудшение зафиксировано в районах: ${decliningDistricts.map((district) => district.name).join(", ")}.`,
    );
  }

  if (scenario.remainingBudget === 0) {
    tradeoffs.push("План использует весь доступный бюджет и не оставляет резерва.");
  } else {
    tradeoffs.push(
      `После выбранных мер остаётся ${scenario.remainingBudget} из 100 единиц бюджета.`,
    );
  }

  const districtMeasureCounts = new Map<string, number>();
  for (const contribution of scenario.contributions) {
    if (!contribution.districtName) continue;
    districtMeasureCounts.set(
      contribution.districtName,
      (districtMeasureCounts.get(contribution.districtName) ?? 0) + 1,
    );
  }
  const concentratedDistrict = [...districtMeasureCounts.entries()].find(
    ([, count]) => count >= 3,
  );
  if (concentratedDistrict) {
    const localDecisionCount = [...districtMeasureCounts.values()].reduce(
      (sum, count) => sum + count, 0,
    );
    tradeoffs.push(
      `${concentratedDistrict[1]} из ${localDecisionCount} районных решений сосредоточены в районе ${concentratedDistrict[0]}.`,
    );
  }

  const scoreDirection = scenario.scoreDelta > 0 ? "повышает" : scenario.scoreDelta < 0 ? "снижает" : "не меняет";
  let summary = `Сценарий ${scoreDirection} Astana Quality of Life Score с ${formatNumber(scenario.baselineScore)} до ${formatNumber(scenario.finalScore)}.`;

  if (candidate) {
    const removed = describeChange(candidate.removed);
    const added = describeChange(candidate.added);
    summary += ` Замена ${removed} на ${added} повышает результат до ${formatNumber(candidate.result.finalScore)}.`;
    recommendations.push(
      `Рассмотрите замену ${removed} на ${added}: прирост Score составит ${formatNumber(candidate.scoreGain)}.`,
    );

    if (candidate.weakestDistrictGain > 0) {
      recommendations.push(
        `При замене Score самого слабого района увеличится на ${formatNumber(candidate.weakestDistrictGain)}.`,
      );
    }

    if (candidate.removedCriticalCount > 0) {
      recommendations.push(
        `Замена дополнительно устраняет ${candidate.removedCriticalCount} критических показателя.`,
      );
    }
  } else {
    recommendations.push(
      "Запустите контрфактический поиск, чтобы проверить лучшую замену одного решения.",
    );
  }

  return {
    source: "fallback",
    summary,
    strengths,
    risks,
    tradeoffs,
    recommendations,
  };
}
