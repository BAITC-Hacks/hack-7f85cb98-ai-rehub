import { DISTRICTS } from '../data/districts.ts';
import { INDICATORS, RULES } from '../data/rules.ts';
import type {
  BaselineResult, CriticalIndicator, DistrictId, DistrictSnapshot,
  IndicatorCode, IndicatorEffects, Indicators,
} from '../types/simulation.ts';

const indicatorIds = INDICATORS.map(indicator => indicator.id);
const knownIndicators = new Set<IndicatorCode>(indicatorIds);

function finite(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError('Indicator values and effects must be finite numbers.');
  }
  return value;
}

function checkedIndicators(indicators: Readonly<Indicators>): Indicators {
  if (indicators === null || typeof indicators !== 'object' || Array.isArray(indicators)) {
    throw new TypeError('A complete indicator object is required.');
  }
  for (const key of Object.keys(indicators)) {
    if (!knownIndicators.has(key as IndicatorCode)) throw new TypeError(`Unknown indicator: ${key}`);
  }
  return Object.fromEntries(indicatorIds.map(id => {
    const value = finite(indicators[id]);
    if (value < 0 || value > 100) throw new RangeError(`Indicator ${id} is outside 0..100.`);
    return [id, value];
  })) as Indicators;
}

export function clip(value: number, min = 0, max = 100): number {
  finite(value);
  finite(min);
  finite(max);
  if (min > max) throw new RangeError('Clip minimum exceeds maximum.');
  return Math.min(max, Math.max(min, value));
}

/** Sum every effect first. Clipping within the loop changes offsetting effects. */
export function applyIndicatorEffects(
  indicators: Readonly<Indicators>,
  effects: readonly Readonly<IndicatorEffects>[],
): Indicators {
  const values = checkedIndicators(indicators);
  if (!Array.isArray(effects)) throw new TypeError('Effects must be an array.');
  for (const effect of effects) {
    if (effect === null || typeof effect !== 'object' || Array.isArray(effect)) {
      throw new TypeError('Each effect must be an object.');
    }
    for (const [key, value] of Object.entries(effect)) {
      if (!knownIndicators.has(key as IndicatorCode)) throw new TypeError(`Unknown indicator: ${key}`);
      if (typeof value !== 'number') throw new TypeError('Indicator effects must be numbers.');
      values[key as IndicatorCode] += finite(value);
      finite(values[key as IndicatorCode]);
    }
  }
  for (const id of indicatorIds) values[id] = clip(values[id]);
  return values;
}

export function calculateDistrictScore(indicators: Readonly<Indicators>): number {
  const values = checkedIndicators(indicators);
  return INDICATORS.reduce((sum, indicator) => sum + indicator.weight * values[indicator.id], 0);
}

export function countCriticalIndicators(indicators: Readonly<Indicators>): number {
  const values = checkedIndicators(indicators);
  return indicatorIds.reduce((count, id) => count + Number(values[id] < RULES.criticalThreshold), 0);
}

/** Score an arbitrary complete snapshot using canonical district metadata and weights. */
export function evaluateIndicators(districts: readonly DistrictSnapshot[]): BaselineResult {
  if (!Array.isArray(districts) || districts.length !== DISTRICTS.length) {
    throw new TypeError('Exactly five district snapshots are required.');
  }
  const byId = new Map<DistrictId, DistrictSnapshot>();
  for (const district of districts) {
    if (!district || typeof district !== 'object' || Array.isArray(district)
      || !DISTRICTS.some(canonical => canonical.id === district.id)
      || byId.has(district.id)) {
      throw new TypeError('District IDs must be unique and canonical.');
    }
    byId.set(district.id, district);
  }

  const criticalIndicators: CriticalIndicator[] = [];
  const scoredDistricts = DISTRICTS.map(district => {
    const indicators = checkedIndicators(byId.get(district.id)!.indicators);
    for (const id of indicatorIds) {
      if (indicators[id] < RULES.criticalThreshold) {
        criticalIndicators.push({ districtId: district.id, indicatorId: id, value: indicators[id] });
      }
    }
    return {
      districtId: district.id,
      name: district.name,
      populationShare: district.populationShare,
      indicators,
      score: calculateDistrictScore(indicators),
    };
  });
  const cityAverage = scoredDistricts.reduce(
    (sum, district) => sum + district.populationShare * district.score, 0,
  );
  const weakestDistrictScore = Math.min(...scoredDistricts.map(district => district.score));
  const criticalCount = criticalIndicators.length;
  const scoreComponents = {
    average: RULES.averageWeight * cityAverage,
    weakest: RULES.weakestWeight * weakestDistrictScore,
    criticalPenalty: criticalCount === 0 ? 0 : -RULES.criticalPenalty * criticalCount,
  };
  return {
    score: scoreComponents.average + scoreComponents.weakest + scoreComponents.criticalPenalty,
    cityAverage,
    weakestDistrictScore,
    weakestDistrictIds: scoredDistricts.filter(district => district.score === weakestDistrictScore)
      .map(district => district.districtId),
    criticalCount,
    criticalIndicators,
    districts: scoredDistricts,
    scoreComponents,
  };
}
