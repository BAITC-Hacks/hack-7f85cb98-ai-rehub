import type {
  DistrictResult,
  Indicators,
  ReplacementCandidate,
  ScenarioResult,
} from "@/types/simulation";

const baseline: Record<string, Indicators> = {
  yesil: { T1: 45, T2: 62, E1: 68, E2: 72, S1: 48, S2: 55, B1: 78, B2: 60, C1: 75, C2: 70 },
  almaty: { T1: 40, T2: 75, E1: 50, E2: 55, S1: 60, S2: 65, B1: 62, B2: 52, C1: 50, C2: 60 },
  saryarka: { T1: 50, T2: 70, E1: 42, E2: 40, S1: 62, S2: 68, B1: 58, B2: 55, C1: 45, C2: 55 },
  baikonur: { T1: 52, T2: 68, E1: 55, E2: 50, S1: 58, S2: 60, B1: 52, B2: 58, C1: 55, C2: 58 },
  nura: { T1: 55, T2: 40, E1: 45, E2: 65, S1: 38, S2: 35, B1: 55, B2: 50, C1: 60, C2: 50 },
};

function district(
  districtId: string,
  name: string,
  scoreBefore: number,
  scoreAfter: number,
  indicatorsAfter: Indicators,
): DistrictResult {
  return {
    districtId,
    name,
    scoreBefore,
    scoreAfter,
    scoreDelta: scoreAfter - scoreBefore,
    indicatorsBefore: { ...baseline[districtId] },
    indicatorsAfter,
  };
}

export const currentScenarioFixture: ScenarioResult = {
  valid: true,
  errors: [],
  totalCost: 95,
  remainingBudget: 5,
  baselineScore: 52.55768,
  finalScore: 56.54307,
  scoreDelta: 3.98539,
  criticalBefore: 2,
  criticalAfter: 0,
  districts: [
    district("yesil", "Есиль", 62.99, 63.4275, { ...baseline.yesil, C2: 74.375 }),
    district("almaty", "Алматы", 57.06, 57.4975, { ...baseline.almaty, C2: 64.375 }),
    district("saryarka", "Сарыарка", 54.65, 56.3, { ...baseline.saryarka, E2: 48.75, C1: 47.5, C2: 59.375 }),
    district("baikonur", "Байконур", 56.63, 57.0675, { ...baseline.baikonur, C2: 62.375 }),
    district("nura", "Нура", 49.18, 52.9625, {
      ...baseline.nura,
      S1: 48,
      S2: 43.75,
      B1: 67.5,
      B2: 51.75,
      C2: 54.375,
    }),
  ],
  contributions: [
    { measureId: "M7", measureName: "Школа и детский сад", districtName: "Нура", affectedIndicators: ["S1"] },
    { measureId: "M8", measureName: "Центр семейного здоровья", districtName: "Нура", affectedIndicators: ["S2"] },
    { measureId: "M10", measureName: "Освещение и камеры", districtName: "Нура", affectedIndicators: ["B1", "B2"] },
    { measureId: "M12", measureName: "Единая платформа обращений", affectedIndicators: ["C2"] },
    { measureId: "M5", measureName: "Перевод частного сектора на чистое топливо", districtName: "Сарыарка", affectedIndicators: ["E2", "C1"] },
  ],
  activatedSynergies: ["M10 + M12: B1 +2 в районе Нура"],
};

export const replacementScenarioFixture: ScenarioResult = {
  ...currentScenarioFixture,
  totalCost: 100,
  remainingBudget: 0,
  finalScore: 57.20556,
  scoreDelta: 4.64788,
  districts: [
    currentScenarioFixture.districts[0],
    currentScenarioFixture.districts[1],
    district("saryarka", "Сарыарка", 54.65, 55.0875, { ...baseline.saryarka, C2: 59.375 }),
    currentScenarioFixture.districts[3],
    district("nura", "Нура", 49.18, 54.9825, {
      ...baseline.nura,
      T1: 63,
      T2: 50,
      E2: 67,
      S1: 48,
      S2: 43.75,
      B1: 67.5,
      B2: 51.75,
      C2: 54.375,
    }),
  ],
  contributions: [
    ...currentScenarioFixture.contributions.filter(({ measureId }) => measureId !== "M5"),
    { measureId: "M3", measureName: "Линия ЛРТ / расширение", districtName: "Нура", affectedIndicators: ["T1", "T2", "E2"] },
  ],
};

export const replacementCandidateFixture: ReplacementCandidate = {
  removed: {
    decision: { measureId: "M5", districtId: "saryarka" },
    measureName: "Перевод частного сектора на чистое топливо",
    districtName: "Сарыарка",
  },
  added: {
    decision: { measureId: "M3", districtId: "nura" },
    measureName: "Линия ЛРТ / расширение",
    districtName: "Нура",
  },
  result: replacementScenarioFixture,
  scoreGain: 0.66249,
  weakestDistrictGain: 2.02,
  removedCriticalCount: 0,
};

