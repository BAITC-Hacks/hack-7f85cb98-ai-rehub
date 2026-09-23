export const METRICS = {
  T1: { name: "Разгрузка дорог", short: "Дороги", direction: "transport" },
  T2: { name: "Доступность общественного транспорта", short: "Общ. транспорт", direction: "transport" },
  E1: { name: "Озеленение", short: "Озеленение", direction: "ecology" },
  E2: { name: "Качество воздуха", short: "Воздух", direction: "ecology" },
  S1: { name: "Школы и детсады", short: "Школы", direction: "social" },
  S2: { name: "Поликлиники и первичная медпомощь", short: "Медицина", direction: "social" },
  B1: { name: "Безопасность улиц", short: "Улицы", direction: "safety" },
  B2: { name: "Безопасность дорожного движения", short: "БДД", direction: "safety" },
  C1: { name: "Надёжность ЖКХ", short: "ЖКХ", direction: "services" },
  C2: { name: "Скорость решения обращений", short: "Обращения", direction: "services" }
};

export const METRIC_ORDER = Object.keys(METRICS);

export const WEIGHTS = {
  T1: 0.1, T2: 0.1, E1: 0.09, E2: 0.11, S1: 0.11,
  S2: 0.11, B1: 0.09, B2: 0.09, C1: 0.1, C2: 0.1
};

export const DIRECTIONS = {
  transport: { name: "Транспорт", icon: "↗", color: "#2667ff" },
  ecology: { name: "Экология", icon: "◒", color: "#00a878" },
  social: { name: "Соцсфера", icon: "+", color: "#8b5cf6" },
  safety: { name: "Безопасность", icon: "◇", color: "#f59e0b" },
  services: { name: "Сервисы", icon: "⌁", color: "#ef5da8" }
};

export const DISTRICTS = [
  {
    id: "yesil", name: "Есиль", population: 0.27,
    profile: "Пробки на мостах и переполненные школы",
    indicators: { T1: 45, T2: 62, E1: 68, E2: 72, S1: 48, S2: 55, B1: 78, B2: 60, C1: 75, C2: 70 }
  },
  {
    id: "almaty", name: "Алматы", population: 0.24,
    profile: "Старый ЖКХ и пробки",
    indicators: { T1: 40, T2: 75, E1: 50, E2: 55, S1: 60, S2: 65, B1: 62, B2: 52, C1: 50, C2: 60 }
  },
  {
    id: "saryarka", name: "Сарыарка", population: 0.2,
    profile: "Смог от частного сектора и слабое озеленение",
    indicators: { T1: 50, T2: 70, E1: 42, E2: 40, S1: 62, S2: 68, B1: 58, B2: 55, C1: 45, C2: 55 }
  },
  {
    id: "baikonur", name: "Байконур", population: 0.13,
    profile: "Сбалансированный район без ярких перекосов",
    indicators: { T1: 52, T2: 68, E1: 55, E2: 50, S1: 58, S2: 60, B1: 52, B2: 58, C1: 55, C2: 58 }
  },
  {
    id: "nura", name: "Нура", population: 0.16,
    profile: "Главный аутсайдер по соцсфере и транспорту",
    indicators: { T1: 55, T2: 40, E1: 45, E2: 65, S1: 38, S2: 35, B1: 55, B2: 50, C1: 60, C2: 50 }
  }
];

export const MEASURES = [
  { id: "M1", direction: "transport", name: "Выделенные полосы для автобусов", type: "district", cost: 18, lag: 2, effects: { T1: 6, T2: 9 } },
  { id: "M2", direction: "transport", name: "Умные светофоры", type: "city", cost: 22, lag: 2, effects: { T1: 4, B2: 3 } },
  { id: "M3", direction: "transport", name: "Линия ЛРТ / расширение", type: "district", cost: 30, lag: 4, effects: { T1: 16, T2: 20, E2: 4 } },
  { id: "M4", direction: "ecology", name: "Парк / сквер", type: "district", cost: 15, lag: 2, effects: { E1: 12, E2: 3, B1: 2 } },
  { id: "M5", direction: "ecology", name: "Перевод частного сектора на чистое топливо", type: "district", cost: 25, lag: 3, effects: { E2: 14, C1: 4 } },
  { id: "M6", direction: "ecology", name: "Городское озеленение и ветрозащитные полосы", type: "city", cost: 20, lag: 4, effects: { E1: 5, E2: 3 } },
  { id: "M7", direction: "social", name: "Школа + детсад", type: "district", cost: 24, lag: 3, effects: { S1: 16 } },
  { id: "M8", direction: "social", name: "Центр семейного здоровья / поликлиника", type: "district", cost: 20, lag: 3, effects: { S2: 14 } },
  { id: "M9", direction: "social", name: "Дворовые спорт-хабы", type: "district", cost: 10, lag: 1, effects: { S1: 3, S2: 3, B1: 3 } },
  { id: "M10", direction: "safety", name: "Освещение и камеры Safe City", type: "district", cost: 12, lag: 1, effects: { B1: 12, B2: 2 } },
  { id: "M11", direction: "safety", name: "Безопасные переходы и школьные зоны", type: "district", cost: 10, lag: 1, effects: { B2: 12, T1: -2 } },
  { id: "M12", direction: "services", name: "Единая цифровая платформа обращений", type: "city", cost: 14, lag: 1, effects: { C2: 5 } },
  { id: "M13", direction: "services", name: "Модернизация тепло- и водосетей", type: "district", cost: 28, lag: 4, effects: { C1: 18, E2: 2 } },
  { id: "M14", direction: "services", name: "Аварийные бригады ЖКХ + раннее оповещение", type: "city", cost: 16, lag: 1, effects: { C1: 5, C2: 2 } }
];

export const INCOMPATIBILITIES = [
  { pair: ["M1", "M3"], scope: "global", message: "M1 и M3 несовместимы: выберите BRT или ЛРТ." },
  { pair: ["M4", "M7"], scope: "district", message: "M4 и M7 конфликтуют за участок в одном районе." },
  { pair: ["M5", "M13"], scope: "district", message: "M5 и M13 дублируют программу в одном районе." }
];

export const SYNERGIES = [
  { pair: ["M1", "M2"], anchor: "M1", metric: "T1", bonus: 2 },
  { pair: ["M10", "M12"], anchor: "M10", metric: "B1", bonus: 2 },
  { pair: ["M5", "M6"], anchor: "M5", metric: "E2", bonus: 2 }
];

export const EXAMPLE_PLAN = [
  { measureId: "M7", districtId: "nura" },
  { measureId: "M8", districtId: "nura" },
  { measureId: "M10", districtId: "nura" },
  { measureId: "M12", districtId: null },
  { measureId: "M5", districtId: "saryarka" }
];
