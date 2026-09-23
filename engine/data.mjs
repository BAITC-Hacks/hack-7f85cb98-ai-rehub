/** Canonical synthetic dataset supplied by the HackAlem AI task. */
const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
};

export const MODEL_VERSION = '1.0.0';

export const RULES = deepFreeze({
  budget: 100,
  decisionCount: 5,
  maxPerCategory: 2,
  horizonQuarters: 8,
  criticalThreshold: 40,
  criticalPenalty: 1,
  averageWeight: 0.7,
  weakestWeight: 0.3,
});

export const CATEGORIES = deepFreeze([
  { id: 'transport', name: 'Транспорт' },
  { id: 'ecology', name: 'Экология' },
  { id: 'social', name: 'Соцсфера' },
  { id: 'safety', name: 'Безопасность' },
  { id: 'services', name: 'Сервисы' },
]);

export const INDICATORS = deepFreeze([
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

export const DISTRICTS = deepFreeze([
  {
    id: 'yesil', name: 'Есиль', populationShare: 0.27,
    profile: 'Богатый, но с пробками на мостах и переполненными школами.',
    indicators: { T1: 45, T2: 62, E1: 68, E2: 72, S1: 48, S2: 55, B1: 78, B2: 60, C1: 75, C2: 70 },
  },
  {
    id: 'almaty', name: 'Алматы', populationShare: 0.24,
    profile: 'Старый ЖКХ и пробки.',
    indicators: { T1: 40, T2: 75, E1: 50, E2: 55, S1: 60, S2: 65, B1: 62, B2: 52, C1: 50, C2: 60 },
  },
  {
    id: 'saryarka', name: 'Сарыарка', populationShare: 0.20,
    profile: 'Смог от частного сектора, слабое озеленение.',
    indicators: { T1: 50, T2: 70, E1: 42, E2: 40, S1: 62, S2: 68, B1: 58, B2: 55, C1: 45, C2: 55 },
  },
  {
    id: 'baikonur', name: 'Байконур', populationShare: 0.13,
    profile: 'Середняк без ярких перекосов.',
    indicators: { T1: 52, T2: 68, E1: 55, E2: 50, S1: 58, S2: 60, B1: 52, B2: 58, C1: 55, C2: 58 },
  },
  {
    id: 'nura', name: 'Нура', populationShare: 0.16,
    profile: 'Главный «аутсайдер» по соцсфере и транспорту.',
    indicators: { T1: 55, T2: 40, E1: 45, E2: 65, S1: 38, S2: 35, B1: 55, B2: 50, C1: 60, C2: 50 },
  },
]);

export const MEASURES = deepFreeze([
  {
    id: 'M1', category: 'transport', name: 'Выделенные полосы для автобусов',
    scope: 'district', cost: 18, lagQuarters: 2, effects: { T1: 6, T2: 9 },
  },
  {
    id: 'M2', category: 'transport', name: 'Умные светофоры (адаптивное управление)',
    scope: 'city', cost: 22, lagQuarters: 2, effects: { T1: 4, B2: 3 },
  },
  {
    id: 'M3', category: 'transport', name: 'Линия ЛРТ / расширение',
    scope: 'district', cost: 30, lagQuarters: 4, effects: { T1: 16, T2: 20, E2: 4 },
  },
  {
    id: 'M4', category: 'ecology', name: 'Парк / сквер',
    scope: 'district', cost: 15, lagQuarters: 2, effects: { E1: 12, E2: 3, B1: 2 },
  },
  {
    id: 'M5', category: 'ecology', name: 'Перевод частного сектора на чистое топливо',
    scope: 'district', cost: 25, lagQuarters: 3, effects: { E2: 14, C1: 4 },
  },
  {
    id: 'M6', category: 'ecology', name: 'Городская программа озеленения и ветрозащитных полос',
    scope: 'city', cost: 20, lagQuarters: 4, effects: { E1: 5, E2: 3 },
  },
  {
    id: 'M7', category: 'social', name: 'Школа + детсад (модульное строительство)',
    scope: 'district', cost: 24, lagQuarters: 3, effects: { S1: 16 },
  },
  {
    id: 'M8', category: 'social', name: 'Центр семейного здоровья / поликлиника',
    scope: 'district', cost: 20, lagQuarters: 3, effects: { S2: 14 },
  },
  {
    id: 'M9', category: 'social', name: 'Дворовые спорт-хабы',
    scope: 'district', cost: 10, lagQuarters: 1, effects: { S1: 3, S2: 3, B1: 3 },
  },
  {
    id: 'M10', category: 'safety', name: 'Освещение и камеры (расширение Safe City)',
    scope: 'district', cost: 12, lagQuarters: 1, effects: { B1: 12, B2: 2 },
  },
  {
    id: 'M11', category: 'safety', name: 'Безопасные переходы и школьные зоны',
    scope: 'district', cost: 10, lagQuarters: 1, effects: { B2: 12, T1: -2 },
  },
  {
    id: 'M12', category: 'services', name: 'Единая цифровая платформа обращений',
    scope: 'city', cost: 14, lagQuarters: 1, effects: { C2: 5 },
  },
  {
    id: 'M13', category: 'services', name: 'Модернизация тепло- и водосетей',
    scope: 'district', cost: 28, lagQuarters: 4, effects: { C1: 18, E2: 2 },
  },
  {
    id: 'M14', category: 'services', name: 'Аварийные бригады ЖКХ + раннее оповещение',
    scope: 'city', cost: 16, lagQuarters: 1, effects: { C1: 5, C2: 2 },
  },
]);

export const SYNERGIES = deepFreeze([
  { id: 'M1+M2', measureIds: ['M1', 'M2'], targetMeasureId: 'M1', effects: { T1: 2 } },
  { id: 'M10+M12', measureIds: ['M10', 'M12'], targetMeasureId: 'M10', effects: { B1: 2 } },
  { id: 'M5+M6', measureIds: ['M5', 'M6'], targetMeasureId: 'M5', effects: { E2: 2 } },
]);

export const INCOMPATIBILITIES = deepFreeze([
  { measureIds: ['M1', 'M3'], scope: 'global', reason: 'Либо BRT, либо ЛРТ, в любом районе.' },
  { measureIds: ['M4', 'M7'], scope: 'same-district', reason: 'Конфликт за участок в одном районе.' },
  { measureIds: ['M5', 'M13'], scope: 'same-district', reason: 'Дублирование программы в одном районе.' },
]);

export const EXAMPLE_DECISIONS = deepFreeze([
  { measureId: 'M7', districtId: 'nura' },
  { measureId: 'M8', districtId: 'nura' },
  { measureId: 'M10', districtId: 'nura' },
  { measureId: 'M12' },
  { measureId: 'M5', districtId: 'saryarka' },
]);
