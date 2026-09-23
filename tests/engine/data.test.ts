import assert from 'node:assert/strict';
import test from 'node:test';
import { DISTRICTS } from '../../src/data/districts.ts';
import { MEASURES } from '../../src/data/measures.ts';
import {
  CATEGORIES,
  EXAMPLE_DECISIONS,
  INCOMPATIBILITIES,
  INDICATORS,
  MODEL_VERSION,
  RULES,
  SECOND_EXAMPLE_DECISIONS,
  SYNERGIES,
} from '../../src/data/rules.ts';

const indicatorIds = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'] as const;

// Transcribed independently from dataset-ru.txt. Do not derive this oracle from runtime exports.
const sourceIndicators = [
  { id: 'T1', name: 'Разгрузка дорог', category: 'transport', weight: 0.10 },
  { id: 'T2', name: 'Доступность общественного транспорта', category: 'transport', weight: 0.10 },
  { id: 'E1', name: 'Озеленение', category: 'ecology', weight: 0.09 },
  { id: 'E2', name: 'Качество воздуха', category: 'ecology', weight: 0.11 },
  { id: 'S1', name: 'Школы и детсады', category: 'social', weight: 0.11 },
  { id: 'S2', name: 'Поликлиники и первичная медпомощь', category: 'social', weight: 0.11 },
  { id: 'B1', name: 'Безопасность улиц', category: 'safety', weight: 0.09 },
  { id: 'B2', name: 'Безопасность дорожного движения', category: 'safety', weight: 0.09 },
  { id: 'C1', name: 'Надёжность ЖКХ', category: 'services', weight: 0.10 },
  { id: 'C2', name: 'Скорость решения обращений жителей', category: 'services', weight: 0.10 },
];

const sourceDistricts = [
  { id: 'yesil', name: 'Есиль', populationShare: 0.27, profile: 'Богатый, но с пробками на мостах и переполненными школами.', indicators: { T1: 45, T2: 62, E1: 68, E2: 72, S1: 48, S2: 55, B1: 78, B2: 60, C1: 75, C2: 70 } },
  { id: 'almaty', name: 'Алматы', populationShare: 0.24, profile: 'Старый ЖКХ и пробки.', indicators: { T1: 40, T2: 75, E1: 50, E2: 55, S1: 60, S2: 65, B1: 62, B2: 52, C1: 50, C2: 60 } },
  { id: 'saryarka', name: 'Сарыарка', populationShare: 0.20, profile: 'Смог от частного сектора, слабое озеленение.', indicators: { T1: 50, T2: 70, E1: 42, E2: 40, S1: 62, S2: 68, B1: 58, B2: 55, C1: 45, C2: 55 } },
  { id: 'baikonur', name: 'Байконур', populationShare: 0.13, profile: 'Середняк без ярких перекосов.', indicators: { T1: 52, T2: 68, E1: 55, E2: 50, S1: 58, S2: 60, B1: 52, B2: 58, C1: 55, C2: 58 } },
  { id: 'nura', name: 'Нура', populationShare: 0.16, profile: 'Главный «аутсайдер» по соцсфере и транспорту.', indicators: { T1: 55, T2: 40, E1: 45, E2: 65, S1: 38, S2: 35, B1: 55, B2: 50, C1: 60, C2: 50 } },
];

const sourceMeasures = [
  { id: 'M1', category: 'transport', name: 'Выделенные полосы для автобусов', scope: 'district', cost: 18, lagQuarters: 2, effects: { T1: 6, T2: 9 } },
  { id: 'M2', category: 'transport', name: 'Умные светофоры (адаптивное управление)', scope: 'city', cost: 22, lagQuarters: 2, effects: { T1: 4, B2: 3 } },
  { id: 'M3', category: 'transport', name: 'Линия ЛРТ / расширение', scope: 'district', cost: 30, lagQuarters: 4, effects: { T1: 16, T2: 20, E2: 4 } },
  { id: 'M4', category: 'ecology', name: 'Парк / сквер', scope: 'district', cost: 15, lagQuarters: 2, effects: { E1: 12, E2: 3, B1: 2 } },
  { id: 'M5', category: 'ecology', name: 'Перевод частного сектора на чистое топливо', scope: 'district', cost: 25, lagQuarters: 3, effects: { E2: 14, C1: 4 } },
  { id: 'M6', category: 'ecology', name: 'Городская программа озеленения и ветрозащитных полос', scope: 'city', cost: 20, lagQuarters: 4, effects: { E1: 5, E2: 3 } },
  { id: 'M7', category: 'social', name: 'Школа + детсад (модульное строительство)', scope: 'district', cost: 24, lagQuarters: 3, effects: { S1: 16 } },
  { id: 'M8', category: 'social', name: 'Центр семейного здоровья / поликлиника', scope: 'district', cost: 20, lagQuarters: 3, effects: { S2: 14 } },
  { id: 'M9', category: 'social', name: 'Дворовые спорт-хабы', scope: 'district', cost: 10, lagQuarters: 1, effects: { S1: 3, S2: 3, B1: 3 } },
  { id: 'M10', category: 'safety', name: 'Освещение и камеры (расширение Safe City)', scope: 'district', cost: 12, lagQuarters: 1, effects: { B1: 12, B2: 2 } },
  { id: 'M11', category: 'safety', name: 'Безопасные переходы и школьные зоны', scope: 'district', cost: 10, lagQuarters: 1, effects: { B2: 12, T1: -2 } },
  { id: 'M12', category: 'services', name: 'Единая цифровая платформа обращений', scope: 'city', cost: 14, lagQuarters: 1, effects: { C2: 5 } },
  { id: 'M13', category: 'services', name: 'Модернизация тепло- и водосетей', scope: 'district', cost: 28, lagQuarters: 4, effects: { C1: 18, E2: 2 } },
  { id: 'M14', category: 'services', name: 'Аварийные бригады ЖКХ + раннее оповещение', scope: 'city', cost: 16, lagQuarters: 1, effects: { C1: 5, C2: 2 } },
];

const sourceCategories = [
  { id: 'transport', name: 'Транспорт' },
  { id: 'ecology', name: 'Экология' },
  { id: 'social', name: 'Соцсфера' },
  { id: 'safety', name: 'Безопасность' },
  { id: 'services', name: 'Сервисы' },
];

const sourceSynergies = [
  { id: 'M1+M2', measureIds: ['M1', 'M2'], targetMeasureId: 'M1', effects: { T1: 2 } },
  { id: 'M10+M12', measureIds: ['M10', 'M12'], targetMeasureId: 'M10', effects: { B1: 2 } },
  { id: 'M5+M6', measureIds: ['M5', 'M6'], targetMeasureId: 'M5', effects: { E2: 2 } },
];

const sourceIncompatibilities = [
  { measureIds: ['M1', 'M3'], scope: 'global', reason: 'Либо BRT, либо ЛРТ, в любом районе.' },
  { measureIds: ['M4', 'M7'], scope: 'same-district', reason: 'Конфликт за участок в одном районе.' },
  { measureIds: ['M5', 'M13'], scope: 'same-district', reason: 'Дублирование программы в одном районе.' },
];

const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);
const idsAreUnique = (values: readonly { id: string }[]) => assert.equal(new Set(values.map(({ id }) => id)).size, values.length);
const allFiniteNumbers = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFiniteNumbers);
  if (value && typeof value === 'object') return Object.values(value).every(allFiniteNumbers);
  return true;
};

test('catalogs exactly match the independently transcribed source values', () => {
  assert.equal(MODEL_VERSION, '2.0.0');
  assert.deepEqual(CATEGORIES, sourceCategories);
  assert.deepEqual(INDICATORS, sourceIndicators);
  assert.deepEqual(DISTRICTS, sourceDistricts);
  assert.deepEqual(MEASURES, sourceMeasures);
  assert.deepEqual(SYNERGIES, sourceSynergies);
  assert.deepEqual(INCOMPATIBILITIES, sourceIncompatibilities);
  assert.deepEqual(RULES, {
    budget: 100, decisionCount: 5, maxPerCategory: 2, horizonQuarters: 8,
    criticalThreshold: 40, criticalPenalty: 1, averageWeight: 0.7, weakestWeight: 0.3,
  });
  assert.deepEqual(EXAMPLE_DECISIONS, [
    { measureId: 'M7', districtId: 'nura' }, { measureId: 'M8', districtId: 'nura' },
    { measureId: 'M10', districtId: 'nura' }, { measureId: 'M12' },
    { measureId: 'M5', districtId: 'saryarka' },
  ]);
  assert.deepEqual(SECOND_EXAMPLE_DECISIONS, [
    { measureId: 'M2' }, { measureId: 'M3', districtId: 'nura' },
    { measureId: 'M8', districtId: 'nura' }, { measureId: 'M9', districtId: 'nura' },
    { measureId: 'M14' },
  ]);
});

test('IDs, references, weights, shares, costs, lags, and numeric values are valid', () => {
  idsAreUnique(CATEGORIES);
  idsAreUnique(INDICATORS);
  idsAreUnique(DISTRICTS);
  idsAreUnique(MEASURES);
  idsAreUnique(SYNERGIES);
  assert.equal(new Set(sourceDistricts.map(({ id }) => id)).size, 5);
  assert.equal(new Set(sourceMeasures.map(({ id }) => id)).size, 14);
  close(INDICATORS.reduce((sum, indicator) => sum + indicator.weight, 0), 1);
  close(DISTRICTS.reduce((sum, district) => sum + district.populationShare, 0), 1);

  const categoryIds = new Set(CATEGORIES.map(({ id }) => id));
  const indicatorIdSet = new Set<string>(indicatorIds);
  const measureIds = new Set(MEASURES.map(({ id }) => id));
  assert.ok(INDICATORS.every(({ category }) => categoryIds.has(category)));
  for (const district of DISTRICTS) assert.deepEqual(Object.keys(district.indicators).sort(), [...indicatorIds].sort());
  for (const measure of MEASURES) {
    assert.ok(categoryIds.has(measure.category));
    assert.ok(measure.cost > 0);
    assert.ok(Number.isInteger(measure.lagQuarters) && measure.lagQuarters >= 0 && measure.lagQuarters <= RULES.horizonQuarters);
    assert.ok(Object.keys(measure.effects).every((id) => indicatorIdSet.has(id)));
  }
  for (const synergy of SYNERGIES) {
    assert.ok(synergy.measureIds.every((id) => measureIds.has(id)));
    assert.ok(measureIds.has(synergy.targetMeasureId));
    assert.ok(synergy.measureIds.includes(synergy.targetMeasureId));
    assert.ok(Object.keys(synergy.effects).every((id) => indicatorIdSet.has(id)));
    assert.equal(MEASURES.find(({ id }) => id === synergy.targetMeasureId)?.scope, 'district');
  }
  for (const incompatibility of INCOMPATIBILITIES) {
    assert.ok(incompatibility.measureIds.every((id) => measureIds.has(id)));
    assert.notEqual(incompatibility.measureIds[0], incompatibility.measureIds[1]);
  }
  assert.ok(allFiniteNumbers({ RULES, CATEGORIES, INDICATORS, DISTRICTS, MEASURES, SYNERGIES, INCOMPATIBILITIES, EXAMPLE_DECISIONS, SECOND_EXAMPLE_DECISIONS }));
});

test('independent source calculation reproduces the published baseline', () => {
  const weights = [0.10, 0.10, 0.09, 0.11, 0.11, 0.11, 0.09, 0.09, 0.10, 0.10];
  const districtScores = sourceDistricts.map(({ indicators }) =>
    indicatorIds.reduce((total, id, index) => total + indicators[id] * weights[index], 0));
  const expectedDistrictScores = [62.99, 57.06, 54.65, 56.63, 49.18];
  districtScores.forEach((value, index) => close(value, expectedDistrictScores[index]));

  const average = sourceDistricts.reduce((total, district, index) => total + district.populationShare * districtScores[index], 0);
  const critical = sourceDistricts.reduce((total, district) =>
    total + Object.values(district.indicators).filter((value) => value < 40).length, 0);
  close(average, 56.8624);
  assert.equal(critical, 2);
  close(0.7 * average + 0.3 * Math.min(...districtScores) - critical, 52.55768);
});

test('nested catalog mutation is rejected without changing catalog values', () => {
  const originalIndicator = DISTRICTS[0].indicators.T1;
  const originalEffect = MEASURES[10].effects.T1;
  const originalSynergyMeasure = SYNERGIES[0].measureIds[0];
  assert.throws(() => { (DISTRICTS[0].indicators as { T1: number }).T1 = 999; }, TypeError);
  assert.throws(() => { (MEASURES[10].effects as { T1: number }).T1 = 999; }, TypeError);
  assert.throws(() => { (SYNERGIES[0].measureIds as unknown as string[])[0] = 'M14'; }, TypeError);
  assert.throws(() => { (RULES as { budget: number }).budget = 0; }, TypeError);
  assert.throws(() => { (CATEGORIES as unknown as { id: string }[]).push({ id: 'other' }); }, TypeError);
  assert.equal(DISTRICTS[0].indicators.T1, originalIndicator);
  assert.equal(MEASURES[10].effects.T1, originalEffect);
  assert.equal(SYNERGIES[0].measureIds[0], originalSynergyMeasure);
  assert.ok(Object.isFrozen(DISTRICTS) && Object.isFrozen(DISTRICTS[0]) && Object.isFrozen(DISTRICTS[0].indicators));
  assert.ok(Object.isFrozen(MEASURES) && Object.isFrozen(MEASURES[10].effects));
  assert.ok(Object.isFrozen(SYNERGIES[0].measureIds));
});
