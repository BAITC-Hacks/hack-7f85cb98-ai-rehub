import { INCOMPATIBILITIES, MEASURES, METRICS } from "./data.js";

export type Language = "ru" | "kk" | "en";

export const languageLabels: Record<Language, string> = { ru: "Русский", kk: "Қазақша", en: "English" };

const copy = {
  ru: {
    workspaceTitle: "План развития Астаны", workspaceIntro: "Пять решений сегодня — качество жизни через 8 кварталов.", planStep: "01 / Соберите план", resultStep: "02 / Оцените результат", exploreDistricts: "Выберите район, чтобы сравнить все показатели.", indicator: "Показатель", change: "Изменение", scaleNote: "Шкала 0–100. Чем выше, тем лучше. Критический уровень — ниже 40.", allIndicators: "Все показатели", changedOnly: "Только изменения", districtScore: "Score района", districtDetails: "Показатели района {district}", noChangedIndicators: "В этом районе показатели не изменились.", baselineView: "Исходные данные. Рассчитайте план, чтобы увидеть изменения.", chooseDistrict: "Выберите район", scoreExplanation: "Astana Quality of Life Score", scoreHint: "Учитывает среднее по городу, слабейший район и критические показатели.", scoreChange: "к базовому Score", resultsLink: "К результатам", planLink: "К решениям", exceeded: "Превышение", perHundred: "из 100", criticalAfter: "После сценария", rulesLabel: "Правила сценария", selectedDistrict: "Выбран", roundedNote: "Значения округлены до сотых. Изменение рассчитано по точным данным.", saveFailed: "Не удалось сохранить план в браузере.",
    appName: "Аким на 5 часов", appSubtitle: "HackAlem AI · сценарий города", horizon: "Горизонт: 8 кварталов",
    theme: "Тема", light: "Светлая", dark: "Тёмная", language: "Язык", save: "Сохранить план", saved: "План сохранён", loadExample: "Загрузить пример", reset: "Сбросить",
    baseline: "Базовый Score", withoutDecisions: "без решений", budget: "Бюджет", remaining: "осталось", decisions: "Решения", directions: "категории", plan: "Ваши решения", uniqueFive: "ровно 5 уникальных", edit: "Изменить", emptySlot: "Выберите мероприятие", measure: "Мероприятие", district: "Район", citywide: "Весь город", cityMeasure: "Применяется ко всем 5 районам", lag: "лаг", quarter: "кв.", costUnit: "ед.", calculate: "Рассчитать сценарий", rules: "До 100 бюджета · не более 2 решений одной категории · район нужен только районным мерам.", valid: "План корректен: 5 решений, ограничения соблюдены.", addMore: "Выберите ещё решений: {count}.", exactlyFive: "Нужно ровно 5 решений.", duplicate: "Каждое мероприятие можно выбрать только один раз.", unknown: "В плане есть неизвестное мероприятие.", selectDistrict: "Выберите район для {id}.", noDistrict: "У городской меры {id} не должно быть района.", overBudget: "Бюджет превышен на {count} ед.", directionLimit: "Не более двух мер в направлении «{name}».", conflict: "Меры {first} и {second} несовместимы.",
    result: "Результат сценария", ready: "Расчёт готов", pending: "Рассчитайте план, чтобы увидеть результат", cityScore: "Score города", growth: "улучшение", weakest: "Слабый район", critical: "Критические", criticalNote: "значения ниже 40", analysisState: "Состояние анализа", localAnalysis: "Локальный анализ", aiAnalysis: "AI-анализ", analysisLoading: "Анализ обновляется…", aiOnlyExplains: "ИИ не меняет расчёт", whatChanges: "Что изменится по районам", before: "До", after: "После", indicators: "10 показателей", criticalMetric: "критический", noChanges: "Без изменений", bestReplacement: "Лучшая замена", advisorIntro: "Один шаг с наибольшим ростом без нарушения правил", findReplacement: "Найти лучшую замену", finding: "Ищем замену…", yourPlan: "Ваш план", replacementPlan: "План с заменой", remove: "Убрать", add: "добавить", benefit: "Выгода", risk: "Риск", compromise: "Компромисс", applyReplacement: "Применить замену", noReplacement: "Допустимой замены с ростом Score нет.", advisorPrompt: "Рассчитайте сценарий, затем найдите лучшую замену.", changesOnlyOne: "Меняется только одно решение", gainDistrict: "Больше всего выигрывает район {district}: +{value}.", stillWeakest: "{district} остаётся слабейшим районом.", budgetTradeoff: "Бюджет увеличивается на {value} ед.", districtTradeoff: "Район {district} теряет {value} балла.", focusTradeoff: "Меняется приоритет направления.", resultExplanation: "Объяснение результата", strength: "Сильная сторона", recommendation: "Рекомендация", retry: "Повторить", aiError: "Пояснение ИИ временно недоступно. Показан локальный анализ.", analysisEmpty: "Объяснение появится после расчёта.", analysisWait: "Анализируем готовые результаты…", footer: "Расчёт определяет результат. ИИ только объясняет готовые факты.", strongestText: "Наибольший прирост получил район {district}: +{value} балла. Главный вклад: {metric} (+{metricValue}).", riskText: "Слабейший район — {district} ({value}). Критических значений после мер: {critical}.", recommendationText: "Активных синергий: {count}. Проверьте меры для усиления слабейшего района с учётом бюджета и ограничений."
  },
  kk: {
    workspaceTitle: "Астананы дамыту жоспары", workspaceIntro: "Бүгінгі бес шешім — 8 тоқсаннан кейінгі өмір сапасы.", planStep: "01 / Жоспар құрыңыз", resultStep: "02 / Нәтижені бағалаңыз", exploreDistricts: "Барлық көрсеткішті салыстыру үшін ауданды таңдаңыз.", indicator: "Көрсеткіш", change: "Өзгеріс", scaleNote: "Шкала 0–100. Жоғары болғаны жақсы. 40-тан төмен — өте төмен деңгей.", allIndicators: "Барлық көрсеткіш", changedOnly: "Тек өзгерістер", districtScore: "Аудан Score-ы", districtDetails: "{district} ауданының көрсеткіштері", noChangedIndicators: "Бұл ауданда көрсеткіштер өзгерген жоқ.", baselineView: "Бастапқы деректер. Өзгерістерді көру үшін жоспарды есептеңіз.", chooseDistrict: "Ауданды таңдаңыз", scoreExplanation: "Astana Quality of Life Score", scoreHint: "Қаланың орташа мәнін, ең әлсіз ауданды және өте төмен көрсеткіштерді ескереді.", scoreChange: "бастапқы Score-ға", resultsLink: "Нәтижелерге", planLink: "Шешімдерге", exceeded: "Артық шығын", perHundred: "100-ден", criticalAfter: "Сценарийден кейін", rulesLabel: "Сценарий ережелері", selectedDistrict: "Таңдалды", roundedNote: "Мәндер жүздікке дейін дөңгелектелген. Өзгеріс дәл деректерден есептелген.", saveFailed: "Жоспарды браузерде сақтау мүмкін болмады.",
    appName: "5 сағатқа әкім", appSubtitle: "HackAlem AI · қала сценарийі", horizon: "Көкжиек: 8 тоқсан",
    theme: "Тақырып", light: "Ашық", dark: "Қараңғы", language: "Тіл", save: "Жоспарды сақтау", saved: "Жоспар сақталды", loadExample: "Үлгіні жүктеу", reset: "Тазалау",
    baseline: "Бастапқы Score", withoutDecisions: "шешімдерсіз", budget: "Бюджет", remaining: "қалды", decisions: "Шешімдер", directions: "бағыт", plan: "Сіздің жоспарыңыз", uniqueFive: "5 түрлі шешім", edit: "Өзгерту", emptySlot: "Іс-шараны таңдаңыз", measure: "Іс-шара", district: "Аудан", citywide: "Бүкіл қала", cityMeasure: "Барлық 5 ауданға қолданылады", lag: "кешігу", quarter: "тоқ.", costUnit: "бірл.", calculate: "Сценарийді есептеу", rules: "Бюджет 100-ден аспайды · бір бағытта 2 шарадан артық емес · аудандық шараға аудан қажет.", valid: "Жоспар дұрыс: 5 шешім, барлық шектеу сақталған.", addMore: "Тағы {count} шешім таңдаңыз.", exactlyFive: "Дәл 5 шешім қажет.", duplicate: "Әр іс-шараны тек бір рет таңдауға болады.", unknown: "Жоспарда белгісіз іс-шара бар.", selectDistrict: "{id} үшін ауданды таңдаңыз.", noDistrict: "{id} қалалық шарасына аудан таңдалмайды.", overBudget: "Бюджет {count} бірлікке асты.", directionLimit: "«{name}» бағытында екі шарадан артық болмайды.", conflict: "{first} және {second} шаралары үйлеспейді.",
    result: "Сценарий нәтижесі", ready: "Есеп дайын", pending: "Нәтижені көру үшін жоспарды есептеңіз", cityScore: "Қала Score-ы", growth: "өсім", weakest: "Әлсіз аудан", critical: "Өте төмен", criticalNote: "40-тан төмен мәндер", analysisState: "Талдау күйі", localAnalysis: "Жергілікті талдау", aiAnalysis: "AI талдауы", analysisLoading: "Талдау жаңаруда…", aiOnlyExplains: "AI есепке әсер етпейді", whatChanges: "Аудандардағы өзгерістер", before: "Дейін", after: "Кейін", indicators: "10 көрсеткіш", criticalMetric: "өте төмен", noChanges: "Өзгеріс жоқ", bestReplacement: "Үздік ауыстыру", advisorIntro: "Ережені бұзбайтын ең тиімді бір қадам", findReplacement: "Үздік ауыстыруды табу", finding: "Ізделуде…", yourPlan: "Сіздің жоспарыңыз", replacementPlan: "Жаңа жоспар", remove: "Алып тастау", add: "қосу", benefit: "Пайда", risk: "Тәуекел", compromise: "Ымыра", applyReplacement: "Ауыстыруды қолдану", noReplacement: "Score өсіретін жарамды ауыстыру жоқ.", advisorPrompt: "Сценарийді есептеп, үздік ауыстыруды іздеңіз.", changesOnlyOne: "Бір ғана шешім өзгереді", gainDistrict: "Ең көп өсім {district} ауданында: +{value}.", stillWeakest: "{district} ең әлсіз аудан болып қалады.", budgetTradeoff: "Бюджет {value} бірлікке өседі.", districtTradeoff: "{district} ауданы {value} балл жоғалтады.", focusTradeoff: "Бағыт басымдығы өзгереді.", resultExplanation: "Нәтиже түсіндірмесі", strength: "Күшті жағы", recommendation: "Ұсыныс", retry: "Қайталау", aiError: "AI түсіндірмесі уақытша қолжетімсіз. Жергілікті талдау көрсетілді.", analysisEmpty: "Түсіндірме есептен кейін пайда болады.", analysisWait: "Дайын нәтижелер талдануда…", footer: "Нәтижені код есептейді. AI дайын деректерді ғана түсіндіреді.", strongestText: "Ең үлкен өсім {district} ауданында: +{value} балл. Негізгі үлес: {metric} (+{metricValue}).", riskText: "Ең әлсіз аудан — {district} ({value}). Шаралардан кейінгі өте төмен мәндер: {critical}.", recommendationText: "Белсенді синергия саны: {count}. Бюджет пен шектеулерді ескеріп, әлсіз ауданды күшейтетін шараларды қараңыз."
  },
  en: {
    workspaceTitle: "Astana development plan", workspaceIntro: "Five decisions today. Quality of life in 8 quarters.", planStep: "01 / Build your plan", resultStep: "02 / Explore the outcome", exploreDistricts: "Select a district to compare every indicator.", indicator: "Indicator", change: "Change", scaleNote: "Scale 0–100. Higher is better. Below 40 is critical.", allIndicators: "All indicators", changedOnly: "Changes only", districtScore: "District Score", districtDetails: "{district} district indicators", noChangedIndicators: "No indicators changed in this district.", baselineView: "Baseline data. Calculate your plan to see the changes.", chooseDistrict: "Choose a district", scoreExplanation: "Astana Quality of Life Score", scoreHint: "Includes the city average, the weakest district and critical indicators.", scoreChange: "vs. baseline Score", resultsLink: "View results", planLink: "Edit decisions", exceeded: "Over budget", perHundred: "out of 100", criticalAfter: "After the scenario", rulesLabel: "Scenario rules", selectedDistrict: "Selected", roundedNote: "Values are rounded to two decimals. Changes use the unrounded data.", saveFailed: "The plan could not be saved in this browser.",
    appName: "Mayor for 5 Hours", appSubtitle: "HackAlem AI · city scenario", horizon: "Horizon: 8 quarters",
    theme: "Theme", light: "Light", dark: "Dark", language: "Language", save: "Save plan", saved: "Plan saved", loadExample: "Load example", reset: "Reset",
    baseline: "Baseline Score", withoutDecisions: "before decisions", budget: "Budget", remaining: "left", decisions: "Decisions", directions: "directions", plan: "Your plan", uniqueFive: "exactly 5 unique", edit: "Edit", emptySlot: "Choose a measure", measure: "Measure", district: "District", citywide: "Citywide", cityMeasure: "Applies to all 5 districts", lag: "lag", quarter: "qtr", costUnit: "units", calculate: "Calculate scenario", rules: "Budget ≤ 100 · no more than 2 measures per direction · district required for district measures.", valid: "Valid plan: 5 decisions and all limits met.", addMore: "Choose {count} more decisions.", exactlyFive: "Choose exactly 5 decisions.", duplicate: "Each measure can be selected only once.", unknown: "The plan contains an unknown measure.", selectDistrict: "Choose a district for {id}.", noDistrict: "Citywide measure {id} cannot have a district.", overBudget: "Budget exceeded by {count} units.", directionLimit: "At most two measures in {name}.", conflict: "Measures {first} and {second} are incompatible.",
    result: "Scenario result", ready: "Calculation ready", pending: "Calculate a plan to see results", cityScore: "City Score", growth: "improvement", weakest: "Weakest district", critical: "Critical", criticalNote: "values below 40", analysisState: "Analysis status", localAnalysis: "Local analysis", aiAnalysis: "AI analysis", analysisLoading: "Updating analysis…", aiOnlyExplains: "AI does not change results", whatChanges: "District changes", before: "Before", after: "After", indicators: "10 indicators", criticalMetric: "critical", noChanges: "No change", bestReplacement: "Best replacement", advisorIntro: "The strongest one-step gain within the rules", findReplacement: "Find best replacement", finding: "Finding replacement…", yourPlan: "Your plan", replacementPlan: "Replacement plan", remove: "Remove", add: "add", benefit: "Benefit", risk: "Risk", compromise: "Trade-off", applyReplacement: "Apply replacement", noReplacement: "No valid replacement improves the Score.", advisorPrompt: "Calculate the scenario, then find a better replacement.", changesOnlyOne: "Only one decision changes", gainDistrict: "The largest gain is in {district}: +{value}.", stillWeakest: "{district} remains the weakest district.", budgetTradeoff: "Budget rises by {value} units.", districtTradeoff: "{district} loses {value} points.", focusTradeoff: "The policy focus changes.", resultExplanation: "Result explanation", strength: "Strength", recommendation: "Recommendation", retry: "Retry", aiError: "AI explanation is temporarily unavailable. Showing local analysis.", analysisEmpty: "An explanation appears after calculation.", analysisWait: "Analyzing calculated results…", footer: "Code calculates every result. AI only explains the facts.", strongestText: "The largest gain is in {district}: +{value} points. Main contribution: {metric} (+{metricValue}).", riskText: "The weakest district is {district} ({value}). Critical values after measures: {critical}.", recommendationText: "Active synergies: {count}. Consider measures that strengthen the weakest district within the budget and direction limits."
  }
} as const;

export type CopyKey = keyof typeof copy.ru;

export function t(language: Language, key: CopyKey, values: Record<string, string | number> = {}) {
  let value: string = copy[language][key];
  for (const [name, replacement] of Object.entries(values)) value = value.replaceAll(`{${name}}`, String(replacement));
  return value;
}

const measureNames: Record<Language, Record<string, string>> = {
  ru: { M1: "Выделенные полосы для автобусов", M2: "Умные светофоры", M3: "Линия ЛРТ / расширение", M4: "Парк / сквер", M5: "Перевод частного сектора на чистое топливо", M6: "Городское озеленение и ветрозащитные полосы", M7: "Школа + детсад", M8: "Центр семейного здоровья / поликлиника", M9: "Дворовые спорт-хабы", M10: "Освещение и камеры Safe City", M11: "Безопасные переходы и школьные зоны", M12: "Единая цифровая платформа обращений", M13: "Модернизация тепло- и водосетей", M14: "Аварийные бригады ЖКХ + раннее оповещение" },
  kk: { M1: "Автобустарға арналған арнайы жолақтар", M2: "Ақылды бағдаршамдар", M3: "ЖРТ желісі / кеңейту", M4: "Саябақ / шағын саябақ", M5: "Жеке секторды таза отынға көшіру", M6: "Қалалық көгалдандыру және желден қорғайтын белдеулер", M7: "Мектеп + балабақша", M8: "Отбасылық денсаулық орталығы / емхана", M9: "Аула спорт алаңдары", M10: "Safe City жарығы мен камералары", M11: "Қауіпсіз өткелдер және мектеп аймақтары", M12: "Өтініштерге арналған бірыңғай цифрлық платформа", M13: "Жылу және су желілерін жаңғырту", M14: "Коммуналдық апат бригадалары + ерте ескерту" },
  en: { M1: "Dedicated bus lanes", M2: "Smart traffic lights", M3: "LRT line / expansion", M4: "Park / public square", M5: "Switch private homes to clean fuel", M6: "City greening and windbreaks", M7: "School + kindergarten", M8: "Family health center / clinic", M9: "Neighborhood sports hubs", M10: "Safe City lighting and cameras", M11: "Safe crossings and school zones", M12: "Unified digital request platform", M13: "Upgrade heat and water networks", M14: "Utility response teams + early warning" }
};

const districtNames: Record<Language, Record<string, string>> = {
  ru: { yesil: "Есиль", almaty: "Алматы", saryarka: "Сарыарка", baikonur: "Байконур", nura: "Нура" },
  kk: { yesil: "Есіл", almaty: "Алматы", saryarka: "Сарыарқа", baikonur: "Байқоңыр", nura: "Нұра" },
  en: { yesil: "Yesil", almaty: "Almaty", saryarka: "Saryarka", baikonur: "Baikonur", nura: "Nura" }
};

const districtProfiles: Record<Language, Record<string, string>> = {
  ru: { yesil: "Пробки на мостах и переполненные школы", almaty: "Старый ЖКХ и пробки", saryarka: "Смог и слабое озеленение", baikonur: "Сбалансированный район", nura: "Слабые соцсфера и транспорт" },
  kk: { yesil: "Көпірдегі кептеліс және толы мектептер", almaty: "Ескі ТКШ және кептеліс", saryarka: "Түтін және көгалдың аздығы", baikonur: "Теңгерімді аудан", nura: "Әлеуметтік сала мен көлік әлсіз" },
  en: { yesil: "Bridge traffic and crowded schools", almaty: "Aging utilities and traffic", saryarka: "Smog and limited greenery", baikonur: "Balanced district", nura: "Weak social services and transport" }
};

const directionNames: Record<Language, Record<string, string>> = {
  ru: { transport: "Транспорт", ecology: "Экология", social: "Соцсфера", safety: "Безопасность", services: "Сервисы" },
  kk: { transport: "Көлік", ecology: "Экология", social: "Әлеуметтік сала", safety: "Қауіпсіздік", services: "Қызметтер" },
  en: { transport: "Transport", ecology: "Ecology", social: "Social", safety: "Safety", services: "Services" }
};

const metricNames: Record<Language, Record<string, string>> = {
  ru: Object.fromEntries(Object.entries(METRICS).map(([id, metric]: [string, any]) => [id, metric.short])),
  kk: { T1: "Жолдар", T2: "Қоғамдық көлік", E1: "Көгалдандыру", E2: "Ауа", S1: "Мектептер", S2: "Медицина", B1: "Көшелер", B2: "Жол қауіпсіздігі", C1: "ТКШ", C2: "Өтініштер" },
  en: { T1: "Roads", T2: "Public transport", E1: "Greening", E2: "Air", S1: "Schools", S2: "Healthcare", B1: "Streets", B2: "Road safety", C1: "Utilities", C2: "Requests" }
};

export const measureName = (language: Language, id: string) => measureNames[language][id] || id;
export const districtName = (language: Language, id: string) => districtNames[language][id] || id;
export const districtProfile = (language: Language, id: string) => districtProfiles[language][id] || "";
export const directionName = (language: Language, id: string) => directionNames[language][id] || id;
export const metricName = (language: Language, id: string) => metricNames[language][id] || id;
export const formatScore = (language: Language, value: number, digits = 2) => new Intl.NumberFormat(language === "en" ? "en-US" : language === "kk" ? "kk-KZ" : "ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

export const deltaTone = (value: number) => Math.abs(value) < 0.005 ? "neutral" : value > 0 ? "positive" : "negative";
export const formatDelta = (language: Language, value: number) => deltaTone(value) === "neutral" ? formatScore(language, 0) : `${value > 0 ? "+" : "−"}${formatScore(language, Math.abs(value))}`;

const metricLabels: Record<Language, Record<string, string>> = {
  ru: Object.fromEntries(Object.entries(METRICS).map(([id, metric]: [string, any]) => [id, metric.name])),
  kk: { T1: "Жолдардағы кептелісті азайту", T2: "Қоғамдық көліктің қолжетімділігі", E1: "Көгалдандыру", E2: "Ауа сапасы", S1: "Мектептер мен балабақшалар", S2: "Емханалар және алғашқы медициналық көмек", B1: "Көше қауіпсіздігі", B2: "Жол қозғалысының қауіпсіздігі", C1: "ТКШ сенімділігі", C2: "Өтініштерді шешу жылдамдығы" },
  en: { T1: "Road congestion relief", T2: "Public transport access", E1: "Green spaces", E2: "Air quality", S1: "Schools and kindergartens", S2: "Clinics and primary healthcare", B1: "Street safety", B2: "Road safety", C1: "Utility reliability", C2: "Request resolution speed" }
};
export const metricLabel = (language: Language, id: string) => metricLabels[language][id] || id;

export function localizedValidation(language: Language, errors: string[], decisions: { measureId: string; districtId: string | null }[], totalCost: number) {
  if (language === "ru") return errors[0] || t(language, "valid");
  if (decisions.length < 5) return t(language, "addMore", { count: 5 - decisions.length });
  if (decisions.length > 5) return t(language, "exactlyFive");
  if (new Set(decisions.map((item) => item.measureId)).size < decisions.length) return t(language, "duplicate");
  const measureIds = new Set(MEASURES.map((measure: any) => measure.id));
  if (decisions.some((item) => !measureIds.has(item.measureId))) return t(language, "unknown");
  const districtIds = new Set(Object.keys(districtNames.ru));
  const districtMeasures = new Set(MEASURES.filter((measure: any) => measure.type === "district").map((measure: any) => measure.id));
  for (const decision of decisions) {
    if (districtMeasures.has(decision.measureId) && !districtIds.has(decision.districtId || "")) return t(language, "selectDistrict", { id: decision.measureId });
    if (!districtMeasures.has(decision.measureId) && decision.districtId) return t(language, "noDistrict", { id: decision.measureId });
  }
  if (totalCost > 100) return t(language, "overBudget", { count: totalCost - 100 });
  const countByDirection: Record<string, number> = {};
  const directionByMeasure: Record<string, string> = Object.fromEntries(MEASURES.map((measure: any) => [measure.id, measure.direction]));
  for (const decision of decisions) countByDirection[directionByMeasure[decision.measureId]] = (countByDirection[directionByMeasure[decision.measureId]] || 0) + 1;
  const over = Object.keys(countByDirection).find((direction) => countByDirection[direction] > 2);
  if (over) return t(language, "directionLimit", { name: directionName(language, over) });
  const conflict = INCOMPATIBILITIES.find((item: any) => {
    const first = decisions.find((decision) => decision.measureId === item.pair[0]);
    const second = decisions.find((decision) => decision.measureId === item.pair[1]);
    return first && second && (item.scope === "global" || first.districtId === second.districtId);
  });
  if (conflict) return t(language, "conflict", { first: conflict.pair[0], second: conflict.pair[1] });
  return errors[0] || t(language, "valid");
}

export function localAnalysis(language: Language, result: any) {
  const topMetric = Object.entries(result.strongestGain.metricDeltas as Record<string, number>).sort((a, b) => b[1] - a[1])[0];
  return {
    mode: t(language, "localAnalysis"),
    strengths: t(language, "strongestText", { district: districtName(language, result.strongestGain.id), value: formatScore(language, result.strongestGain.delta), metric: metricName(language, topMetric[0]), metricValue: formatScore(language, topMetric[1], 1) }),
    risks: t(language, "riskText", { district: districtName(language, result.weakestDistrict.id), value: formatScore(language, result.weakestDistrict.afterScore), critical: result.criticalCount }),
    recommendation: t(language, "recommendationText", { count: result.activeSynergies.length })
  };
}
