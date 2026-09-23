import type { Category, DeepReadonly, Decision, Indicator, Incompatibility, Rules, Synergy } from '../types/simulation.ts';

function freezeRecursively(value: object, seen: WeakSet<object>): void {
  if (seen.has(value)) return;
  seen.add(value);
  for (const child of Object.values(value)) {
    if (child !== null && typeof child === 'object') freezeRecursively(child, seen);
  }
  Object.freeze(value);
}

export function deepFreezeCatalog<T>(value: T): DeepReadonly<T> {
  if (value !== null && typeof value === 'object') freezeRecursively(value, new WeakSet<object>());
  return value as DeepReadonly<T>;
}

export const MODEL_VERSION = '2.0.0';

export const RULES: DeepReadonly<Rules> = deepFreezeCatalog({
  budget: 100,
  decisionCount: 5,
  maxPerCategory: 2,
  horizonQuarters: 8,
  criticalThreshold: 40,
  criticalPenalty: 1,
  averageWeight: 0.7,
  weakestWeight: 0.3,
});

export const CATEGORIES: DeepReadonly<Category[]> = deepFreezeCatalog([
  { id: 'transport', name: 'Транспорт' },
  { id: 'ecology', name: 'Экология' },
  { id: 'social', name: 'Соцсфера' },
  { id: 'safety', name: 'Безопасность' },
  { id: 'services', name: 'Сервисы' },
]);

export const INDICATORS: DeepReadonly<Indicator[]> = deepFreezeCatalog([
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
]);

export const SYNERGIES: DeepReadonly<Synergy[]> = deepFreezeCatalog([
  { id: 'M1+M2', measureIds: ['M1', 'M2'], targetMeasureId: 'M1', effects: { T1: 2 } },
  { id: 'M10+M12', measureIds: ['M10', 'M12'], targetMeasureId: 'M10', effects: { B1: 2 } },
  { id: 'M5+M6', measureIds: ['M5', 'M6'], targetMeasureId: 'M5', effects: { E2: 2 } },
]);

export const INCOMPATIBILITIES: DeepReadonly<Incompatibility[]> = deepFreezeCatalog([
  { measureIds: ['M1', 'M3'], scope: 'global', reason: 'Либо BRT, либо ЛРТ, в любом районе.' },
  { measureIds: ['M4', 'M7'], scope: 'same-district', reason: 'Конфликт за участок в одном районе.' },
  { measureIds: ['M5', 'M13'], scope: 'same-district', reason: 'Дублирование программы в одном районе.' },
]);

export const EXAMPLE_DECISIONS: DeepReadonly<Decision[]> = deepFreezeCatalog([
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
]);

export const SECOND_EXAMPLE_DECISIONS: DeepReadonly<Decision[]> = deepFreezeCatalog([
  { measureId: 'M2' },
  { measureId: 'M3', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M9', districtId: 'nura' },
  { measureId: 'M14' },
]);
