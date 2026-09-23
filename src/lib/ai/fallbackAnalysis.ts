import { findBestReplacement, RULES } from "@/domain";
import type {
  DistrictResult,
  IndicatorCode,
  ReplacementCandidate,
  ScenarioAnalysis,
  ScenarioResult,
} from "@/types/simulation";

export const INDICATOR_LABELS: Record<IndicatorCode, string> = {
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

function getCriticalIndicators(scenario: ScenarioResult): { text: string; value: number }[] {
  return scenario.districts.flatMap((district) =>
    (Object.entries(district.indicatorsAfter) as [IndicatorCode, number][])
      .filter(([, value]) => value < RULES.criticalThreshold)
      .map(([indicator, value]) => ({
        text: `${district.name}: ${INDICATOR_LABELS[indicator]} (${formatNumber(value)})`,
        value,
      })),
  ).sort((a, b) => a.value - b.value);
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
      risks: scenario.errors.slice(0, 5),
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
      `После реализации остаются критические показатели: ${criticalIndicators.slice(0, 3).map(({ text }) => text).join("; ")}${criticalIndicators.length > 3 ? `; другие критические показатели: ${criticalIndicators.length - 3}` : ""}.`,
    );
  }

  const decliningIndicators = scenario.districts.flatMap((district) =>
    (Object.entries(district.indicatorsAfter) as [IndicatorCode, number][])
      .filter(([code, value]) => value < district.indicatorsBefore[code])
      .map(([code, value]) =>
        `${district.name}: показатель «${INDICATOR_LABELS[code]}» снизился с ${formatNumber(district.indicatorsBefore[code])} до ${formatNumber(value)}`,
      ),
  );
  if (decliningIndicators.length > 0) {
    risks.push(`Снизились отдельные показатели: ${decliningIndicators.slice(0, 3).join("; ")}${decliningIndicators.length > 3 ? `; ещё ${decliningIndicators.length - 3}` : ""}.`);
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
      `После выбранных мер остаётся ${scenario.remainingBudget} из ${RULES.budget} единиц бюджета.`,
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
    const direction = candidate.scoreGain > 0 ? "повышает" : candidate.scoreGain < 0 ? "снижает" : "не меняет";
    summary += candidate.scoreGain === 0
      ? ` Замена ${removed} на ${added} не меняет результат: ${formatNumber(candidate.result.finalScore)}.`
      : ` Замена ${removed} на ${added} ${direction} результат до ${formatNumber(candidate.result.finalScore)}.`;
    recommendations.push(candidate.scoreGain === 0
      ? `Замена ${removed} на ${added} оставляет Score без изменений.`
      : `Замена ${removed} на ${added}: ${candidate.scoreGain > 0 ? "прирост" : "снижение"} Score на ${formatNumber(Math.abs(candidate.scoreGain))}.`);

    if (candidate.scoreGain <= 0) {
      const advisor = findBestReplacement(scenario.decisions);
      // Evaluation fixtures may use a different district snapshot. A search on
      // the production catalog cannot prove anything about that other dataset.
      const sameSnapshot = advisor.current.valid && advisor.current.districts.every((district) => {
        const supplied = scenario.districts.find(({ districtId }) => districtId === district.districtId);
        return supplied && (Object.keys(district.indicatorsBefore) as IndicatorCode[]).every((id) =>
          supplied.indicatorsBefore[id] === district.indicatorsBefore[id] &&
          supplied.indicatorsAfter[id] === district.indicatorsAfter[id]);
      });
      if (sameSnapshot && (!advisor.bestByScore || advisor.bestByScore.scoreGain <= 0)) {
        recommendations.push("Улучшение одной заменой не найдено. Это не доказывает глобальную оптимальность плана.");
      }
    }

    if (candidate.weakestDistrictGain > 0) {
      recommendations.push(
        `При замене минимальный районный Score увеличится на ${formatNumber(candidate.weakestDistrictGain)}.`,
      );
    } else if (candidate.weakestDistrictGain < 0) {
      recommendations.push(`При замене минимальный районный Score снизится на ${formatNumber(Math.abs(candidate.weakestDistrictGain))}.`);
    }

    if (candidate.removedCriticalCount > 0) {
      recommendations.push(
        `Замена дополнительно устраняет ${candidate.removedCriticalCount} критических показателя.`,
      );
    } else if (candidate.removedCriticalCount < 0) {
      recommendations.push(`Замена увеличивает число критических показателей на ${Math.abs(candidate.removedCriticalCount)}.`);
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
