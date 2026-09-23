export type IndicatorCode =
  | "T1"
  | "T2"
  | "E1"
  | "E2"
  | "S1"
  | "S2"
  | "B1"
  | "B2"
  | "C1"
  | "C2";

export type Indicators = Record<IndicatorCode, number>;

export type Decision = {
  measureId: string;
  districtId?: string;
};

export type DistrictResult = {
  districtId: string;
  name: string;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  indicatorsBefore: Indicators;
  indicatorsAfter: Indicators;
};

export type MeasureContribution = {
  measureId: string;
  measureName: string;
  districtName?: string;
  affectedIndicators: IndicatorCode[];
};

export type ScenarioResult = {
  valid: boolean;
  errors: string[];
  totalCost: number;
  remainingBudget: number;
  baselineScore: number;
  finalScore: number;
  scoreDelta: number;
  criticalBefore: number;
  criticalAfter: number;
  districts: DistrictResult[];
  contributions: MeasureContribution[];
  activatedSynergies: string[];
};

export type DecisionChange = {
  decision: Decision;
  measureName: string;
  districtName?: string;
};

export type ReplacementCandidate = {
  removed: DecisionChange;
  added: DecisionChange;
  result: ScenarioResult;
  scoreGain: number;
  weakestDistrictGain: number;
  removedCriticalCount: number;
};

export type ScenarioAnalysis = {
  source: "openai" | "fallback";
  summary: string;
  strengths: string[];
  risks: string[];
  tradeoffs: string[];
  recommendations: string[];
};

