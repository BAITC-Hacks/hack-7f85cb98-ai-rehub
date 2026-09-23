import { DISTRICTS } from '../data/districts.ts';
import { MEASURES } from '../data/measures.ts';
import { MODEL_VERSION, RULES, SYNERGIES, INDICATORS } from '../data/rules.ts';
import { validateScenario } from './validateScenario.ts';
import { applyIndicatorEffects, evaluateIndicators } from './indicatorMath.ts';
import type {
  AppliedSynergy, BaselineResult, Decision, DistrictId, DistrictResult,
  IndicatorCode, IndicatorEffects, MeasureContribution, MeasureId, ScenarioResult,
} from '../types/simulation.ts';

const indicatorIds = INDICATORS.map(indicator => indicator.id);

/** A separate baseline display never makes an empty selection a valid scenario. */
export function getBaseline(): BaselineResult {
  return evaluateIndicators(DISTRICTS.map(district => ({
    id: district.id,
    indicators: district.indicators,
  })));
}

function copiedEffects(effects: Readonly<IndicatorEffects>, multiplier = 1): IndicatorEffects {
  const result: IndicatorEffects = {};
  for (const id of indicatorIds) {
    const value = effects[id];
    if (value !== undefined) result[id] = value * multiplier;
  }
  return result;
}

function indicatorDeltas(after: Readonly<Record<IndicatorCode, number>>,
  before: Readonly<Record<IndicatorCode, number>>): Record<IndicatorCode, number> {
  return Object.fromEntries(indicatorIds.map(id => [id, after[id] - before[id]])) as Record<IndicatorCode, number>;
}

export function evaluateScenario(input: unknown): ScenarioResult {
  const validation = validateScenario(input);
  const baseline = getBaseline();
  const common = {
    modelVersion: MODEL_VERSION,
    errors: validation.errors,
    errorDetails: validation.errorDetails,
    baselineScore: baseline.score,
    criticalBefore: baseline.criticalCount,
    cityAverageBefore: baseline.cityAverage,
    weakestDistrictScoreBefore: baseline.weakestDistrictScore,
    criticalIndicatorsBefore: baseline.criticalIndicators,
    scoreComponentsBefore: baseline.scoreComponents,
  };

  if (!validation.valid) {
    return {
      ...common,
      valid: false,
      decisions: [],
      totalCost: validation.totalCost,
      remainingBudget: validation.remainingBudget,
      finalScore: null,
      scoreDelta: null,
      criticalAfter: null,
      cityAverageAfter: null,
      weakestDistrictScoreAfter: null,
      weakestDistrictIds: [],
      criticalIndicatorsAfter: [],
      districts: [],
      contributions: [],
      activatedSynergies: [],
      synergies: [],
      scoreComponentsAfter: null,
    };
  }

  const decisions: Decision[] = validation.decisions.map(decision => ({ ...decision }));
  const selected = new Map<MeasureId, Decision>(decisions.map(decision =>
    [decision.measureId as MeasureId, decision]));
  const effectsByDistrict = new Map<DistrictId, IndicatorEffects[]>(
    DISTRICTS.map(district => [district.id, []]));
  const contributions: MeasureContribution[] = [];

  // Catalog order is stable, so decision permutations yield identical JSON.
  for (const measure of MEASURES) {
    const decision = selected.get(measure.id);
    if (!decision) continue;
    const realizedFraction = (RULES.horizonQuarters - measure.lagQuarters) / RULES.horizonQuarters;
    const targetDistrictIds: DistrictId[] = measure.scope === 'city'
      ? DISTRICTS.map(district => district.id)
      : [decision.districtId as DistrictId];
    const realizedEffects = copiedEffects(measure.effects, realizedFraction);
    for (const districtId of targetDistrictIds) {
      effectsByDistrict.get(districtId)!.push(realizedEffects);
    }
    const contribution: MeasureContribution = {
      measureId: measure.id,
      measureName: measure.name,
      affectedIndicators: indicatorIds.filter(id => measure.effects[id] !== undefined),
      scope: measure.scope,
      category: measure.category,
      cost: measure.cost,
      lagQuarters: measure.lagQuarters,
      realizedFraction,
      targetDistrictIds: [...targetDistrictIds],
      fullEffects: copiedEffects(measure.effects),
      realizedEffects: copiedEffects(realizedEffects),
      observedDistrictDeltas: [],
    };
    if (measure.scope === 'district') {
      contribution.districtName = DISTRICTS.find(district => district.id === targetDistrictIds[0])!.name;
    }
    contributions.push(contribution);
  }

  const synergies: AppliedSynergy[] = [];
  for (const synergy of SYNERGIES) {
    if (!synergy.measureIds.every(id => selected.has(id))) continue;
    const districtId = selected.get(synergy.targetMeasureId)!.districtId as DistrictId;
    const effects = copiedEffects(synergy.effects);
    effectsByDistrict.get(districtId)!.push(effects);
    synergies.push({
      id: synergy.id,
      measureIds: [...synergy.measureIds] as [MeasureId, MeasureId],
      districtId,
      effects: copiedEffects(effects),
    });
  }

  const after = evaluateIndicators(DISTRICTS.map(district => ({
    id: district.id,
    indicators: applyIndicatorEffects(district.indicators, effectsByDistrict.get(district.id)!),
  })));
  const districts: DistrictResult[] = after.districts.map((district, index) => {
    const before = baseline.districts[index]!;
    return {
      districtId: district.districtId,
      name: district.name,
      populationShare: district.populationShare,
      scoreBefore: before.score,
      scoreAfter: district.score,
      scoreDelta: district.score - before.score,
      indicatorsBefore: { ...before.indicators },
      indicatorsAfter: { ...district.indicators },
      indicatorDeltas: indicatorDeltas(district.indicators, before.indicators),
    };
  });
  const changesByDistrict = new Map(districts.map(district => [district.districtId, district]));
  for (const contribution of contributions) {
    contribution.observedDistrictDeltas = contribution.targetDistrictIds.map(districtId => {
      const changes = changesByDistrict.get(districtId)!.indicatorDeltas;
      const observed: IndicatorEffects = {};
      for (const id of contribution.affectedIndicators) observed[id] = changes[id];
      return { districtId, indicatorDeltas: observed };
    });
  }

  return {
    ...common,
    valid: true,
    decisions,
    totalCost: validation.totalCost,
    remainingBudget: validation.remainingBudget,
    finalScore: after.score,
    scoreDelta: after.score - baseline.score,
    criticalAfter: after.criticalCount,
    cityAverageAfter: after.cityAverage,
    weakestDistrictScoreAfter: after.weakestDistrictScore,
    weakestDistrictIds: after.weakestDistrictIds,
    criticalIndicatorsAfter: after.criticalIndicators,
    districts,
    contributions,
    activatedSynergies: synergies.map(synergy => synergy.id),
    synergies,
    scoreComponentsAfter: after.scoreComponents,
  };
}
