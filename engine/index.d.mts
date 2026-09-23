/** Public types for index.mjs, including its deeply frozen data exports. */
export type CategoryId = 'transport' | 'ecology' | 'social' | 'safety' | 'services';
export type DistrictId = 'yesil' | 'almaty' | 'saryarka' | 'baikonur' | 'nura';
export type IndicatorId = 'T1' | 'T2' | 'E1' | 'E2' | 'S1' | 'S2' | 'B1' | 'B2' | 'C1' | 'C2';
export type MeasureId = 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7'
  | 'M8' | 'M9' | 'M10' | 'M11' | 'M12' | 'M13' | 'M14';
export type CityMeasureId = 'M2' | 'M6' | 'M12' | 'M14';
export type DistrictMeasureId = Exclude<MeasureId, CityMeasureId>;
export type MeasureScope = 'district' | 'city';
export type ConflictScope = 'global' | 'same-district';
export type SynergyId = 'M1+M2' | 'M10+M12' | 'M5+M6';
export type IndicatorValues = Record<IndicatorId, number>;
export type IndicatorEffects = Partial<IndicatorValues>;
export type CategoryCounts = Record<CategoryId, number>;

export type DeepReadonly<T> = T extends object
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T;

/** City measures omit districtId entirely; district measures require a known district. */
export type Decision =
  | { readonly measureId: CityMeasureId; readonly districtId?: never }
  | { readonly measureId: DistrictMeasureId; readonly districtId: DistrictId };

export interface Category {
  readonly id: CategoryId;
  readonly name: string;
}

export interface Indicator {
  readonly id: IndicatorId;
  readonly name: string;
  readonly category: CategoryId;
  readonly weight: number;
}

export interface District {
  readonly id: DistrictId;
  readonly name: string;
  readonly populationShare: number;
  readonly profile: string;
  readonly indicators: Readonly<IndicatorValues>;
}

interface MeasureCommon {
  readonly category: CategoryId;
  readonly name: string;
  readonly cost: number;
  readonly lagQuarters: number;
  /** Full effects, before the lag factor is applied. */
  readonly effects: Readonly<IndicatorEffects>;
}

export type Measure = MeasureCommon & (
  | { readonly id: CityMeasureId; readonly scope: 'city' }
  | { readonly id: DistrictMeasureId; readonly scope: 'district' }
);

export interface Synergy {
  readonly id: SynergyId;
  readonly measureIds: readonly [MeasureId, MeasureId];
  readonly targetMeasureId: DistrictMeasureId;
  /** Fixed bonuses, not scaled by lag. */
  readonly effects: Readonly<IndicatorEffects>;
}

export interface Incompatibility {
  readonly measureIds: readonly [MeasureId, MeasureId];
  readonly scope: ConflictScope;
  readonly reason: string;
}

export const MODEL_VERSION: '1.0.0';
export const RULES: {
  readonly budget: 100;
  readonly decisionCount: 5;
  readonly maxPerCategory: 2;
  readonly horizonQuarters: 8;
  readonly criticalThreshold: 40;
  readonly criticalPenalty: 1;
  readonly averageWeight: 0.7;
  readonly weakestWeight: 0.3;
};
export const CATEGORIES: readonly Category[];
export const INDICATORS: readonly Indicator[];
export const DISTRICTS: readonly District[];
export const MEASURES: readonly Measure[];
export const SYNERGIES: readonly Synergy[];
export const INCOMPATIBILITIES: readonly Incompatibility[];
export const EXAMPLE_DECISIONS: readonly Decision[];

export type ValidationError = { message: string } & (
  | { code: 'INVALID_INPUT' }
  | { code: 'DECISION_COUNT'; expected: 5; actual: number }
  | { code: 'INVALID_DECISION'; decisionIndex: number }
  | { code: 'INVALID_FIELDS'; decisionIndex: number; fields: string[] }
  | { code: 'UNKNOWN_MEASURE'; decisionIndex: number }
  | { code: 'DUPLICATE_MEASURE'; decisionIndex: number; measureIds: [MeasureId] }
  | { code: 'DISTRICT_NOT_ALLOWED'; decisionIndex: number }
  | { code: 'DISTRICT_REQUIRED'; decisionIndex: number }
  | { code: 'UNKNOWN_DISTRICT'; decisionIndex: number }
  | { code: 'CATEGORY_LIMIT'; category: CategoryId; actual: number }
  | { code: 'BUDGET_EXCEEDED'; limit: 100; knownCost: number }
  | { code: 'INCOMPATIBLE_MEASURES'; measureIds: [MeasureId, MeasureId]; scope: ConflictScope }
);
export type ValidationErrorCode = ValidationError['code'];

export interface KnownBudget {
  limit: 100;
  spent: number;
  remaining: number;
}

export type Budget = KnownBudget | {
  limit: 100;
  /** Unknown when an input item or measure cannot be resolved. */
  spent: null;
  remaining: null;
};

export interface ValidValidation {
  valid: true;
  errors: [];
  budget: KnownBudget;
  decisionCount: 5;
  categoryCounts: CategoryCounts;
}

export interface InvalidValidation {
  valid: false;
  errors: ValidationError[];
  budget: Budget;
  /** Null only when the submitted input is not an array. */
  decisionCount: number | null;
  categoryCounts: CategoryCounts;
}

export type ValidationResult = ValidValidation | InvalidValidation;

/** Validate an untrusted final selection; this does not calculate a scenario Score. */
export function validateDecisions(decisions: unknown): ValidationResult;

/** Sum all effects and clip once. Values must be finite multiples of 1/8. */
export function applyIndicatorEffects(
  indicators: Readonly<IndicatorValues>,
  effects: readonly Readonly<IndicatorEffects>[],
): IndicatorValues;

/** Only id and indicators are consumed; catalog population shares remain authoritative. */
export interface DistrictSnapshot {
  readonly id: DistrictId;
  readonly indicators: Readonly<IndicatorValues>;
}

export interface ScoredDistrict {
  id: DistrictId;
  name: string;
  populationShare: number;
  indicators: IndicatorValues;
  score: number;
}

export interface CriticalIndicator {
  districtId: DistrictId;
  indicatorId: IndicatorId;
  value: number;
}

export interface ScoreComponents {
  average: number;
  weakest: number;
  /** Signed penalty component; non-positive in an absolute evaluation. */
  criticalPenalty: number;
}

export interface EvaluationResult {
  districts: ScoredDistrict[];
  populationWeightedScore: number;
  weakestDistrictScore: number;
  weakestDistrictIds: DistrictId[];
  criticalCount: number;
  criticalIndicators: CriticalIndicator[];
  score: number;
  scoreComponents: ScoreComponents;
}

/** Evaluate all five unique districts; throws TypeError for malformed snapshots. */
export function evaluateIndicators(districts: readonly DistrictSnapshot[]): EvaluationResult;

/** Return a fresh baseline calculation; an empty submitted scenario remains invalid. */
export function getBaseline(): EvaluationResult;

export interface IndicatorChange {
  before: number;
  after: number;
  delta: number;
}

export interface DistrictChange {
  districtId: DistrictId;
  name: string;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  indicators: Record<IndicatorId, IndicatorChange>;
}

interface RealizedMeasureCommon {
  name: string;
  category: CategoryId;
  cost: number;
  lagQuarters: number;
  realizedFraction: number;
  districtIds: DistrictId[];
  /** Lag-scaled effects before aggregate clipping; fixed synergy bonuses are separate. */
  effects: IndicatorEffects;
}

export type RealizedMeasure = RealizedMeasureCommon & (
  | { measureId: CityMeasureId; scope: 'city' }
  | { measureId: DistrictMeasureId; scope: 'district' }
);

export interface AppliedSynergy {
  id: SynergyId;
  measureIds: [MeasureId, MeasureId];
  districtId: DistrictId;
  effects: IndicatorEffects;
}

export interface ScenarioDelta {
  score: number;
  populationWeightedScore: number;
  weakestDistrictScore: number;
  criticalCount: number;
  /** Changes in the signed Score components, including changes in the penalty. */
  scoreComponents: ScoreComponents;
}

export type ScenarioWarning =
  | ({ code: 'CRITICAL_INDICATOR'; message: string } & CriticalIndicator)
  | ({ code: 'INDICATOR_DECREASE'; message: string; districtId: DistrictId;
      indicatorId: IndicatorId } & IndicatorChange);

export interface ScenarioResult {
  modelVersion: '1.0.0';
  baseline: EvaluationResult;
  after: EvaluationResult;
  delta: ScenarioDelta;
  districtChanges: DistrictChange[];
  measureEffects: RealizedMeasure[];
  synergies: AppliedSynergy[];
  warnings: ScenarioWarning[];
}

export type SimulationResult =
  | { valid: true; validation: ValidValidation; result: ScenarioResult }
  | { valid: false; validation: InvalidValidation; result: null };

/** Validate untrusted input, then calculate the scenario using only catalog data. */
export function simulateScenario(decisions: unknown): SimulationResult;
