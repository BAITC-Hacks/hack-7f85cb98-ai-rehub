# Parallel engine contract v2.0.0

Старт четырёх ролей: одна база feature/simulation-engine, созданная как потомок 382ef6950414a7a8f66fb1dee0d8e048f0ce83ec. BASE_SHA сообщается после публикации и не записывается внутрь собственного коммита. Авторитетные типы — `src/types/simulation.ts`. Изменять их и конфигурацию может только главная задача. Разработчики не создают свои копии типов, данных или формулы.

## Runtime и проверки

Канонический runtime после сведения — чистые TypeScript-функции `src/domain/*.ts`, данные `src/data/*.ts`. ESM; относительные импорты явно заканчиваются `.ts`, типы импортируются через `import type`. Код `src/` не импортирует Node, сеть или SDK AI. Это совместимо со сборкой TypeScript в Next.js; UI/API коллеги в ветку не переносим.

Тесты используют **node:test** и **node:assert/strict**, не Vitest. Node >=22.18 запускает TS через встроенное удаление типов; этот тестовый способ не меняет браузерную совместимость чистого runtime. После `npm install`:

- `npm run typecheck:engine` — строгий TS, exactOptionalPropertyTypes.
- `npm run test:engine` — все доставленные TS-тесты.
- `node scripts/test-engine.mjs tests/engine/data.test.ts` — одна роль (путь можно заменить).
- `npm run test:legacy` — прежние 74 теста reference.

В стартовом коммите ещё нет TS-реализаций и тестов функций: общий TS test runner намеренно завершится NOT_IMPLEMENTED/exit2, если `.test.ts` не найдены. Это не ошибка настройки и не успешный тест нового движка. Типы проверяются отдельно. Пока зависимости соседней роли не доставлены, её отсутствие нужно честно отметить; mock-тест не является интеграционной проверкой. Финальный root package.json при интеграции приложения будет согласован с AI-разработчиком; не заменять его Next scripts этим автономным package.json.

## Владение и экспорт данных

Все каталоги — глубоко readonly + runtime deep freeze, независимые от входа. Имя типа/полей см. simulation.ts. Числа исходного датасета неизменны.

- DATA: `src/data/districts.ts` экспортирует `DISTRICTS: DeepReadonly<District[]>`.
- DATA: `src/data/measures.ts` экспортирует `MEASURES: DeepReadonly<Measure[]>`.
- DATA: `src/data/rules.ts` экспортирует `MODEL_VERSION = '2.0.0'`, `RULES: DeepReadonly<Rules>`, `CATEGORIES`, `INDICATORS`, `SYNERGIES`, `INCOMPATIBILITIES`, `EXAMPLE_DECISIONS`, `SECOND_EXAMPLE_DECISIONS`. Типы остальных коллекций — DeepReadonly<Category[]/Indicator[]/Synergy[]/Incompatibility[]/Decision[]>.
- Первый пример: M7 nura, M8 nura, M10 nura, M12, M5 saryarka.
- Второй: M2, M3 nura, M8 nura, M9 nura, M14.

ID районов: yesil/almaty/saryarka/baikonur/nura. Категории: transport/ecology/social/safety/services. Индикаторы: T1,T2,E1,E2,S1,S2,B1,B2,C1,C2. Меры имеют `lagQuarters`, `effects`, `scope`, `category`, `cost`, `id`, `name` (как в старом каталоге). Синергии имеют `measureIds`, `targetMeasureId`, `effects`; конфликты — scope global/same-district.

## Валидатор

`src/domain/validateScenario.ts`: `validateScenario(input: unknown): ValidationResult`.

Вход — массив `{measureId, districtId?}`. Только эти собственные поля разрешены; цена/эффекты/Score от клиента отклоняются. Городская мера не имеет districtId, включая собственное undefined/null. Районная требует известный ID. Ровно 5 разных мер, максимум2 одного направления, cost<=100, конфликты по датасету. Не требовать все5 направлений. Неизвестные/повреждённые элементы, sparse arrays, null, числа не должны приводить к необработанным исключениям.

Выход включает `valid`, `errors: string[]`, `errorDetails: ValidationError[]`, `totalCost`, `remainingBudget`, `decisionCount`, `categoryCounts`, `decisions`. `errors` соответствуют message из details. Если стоимость нельзя вычислить, обе бюджетные величины null. При valid:false decisions=[]; при true — новый канонически отсортированный массив пяти решений без чужих ссылок. Порядок ошибки не зависит от мер; индекс детали может соответствовать позиции входа. При сравнении множества ошибок индексы игнорируются.

Коды: INVALID_INPUT, INVALID_DECISION, INVALID_FIELDS, UNKNOWN_MEASURE, UNKNOWN_DISTRICT, DISTRICT_REQUIRED, DISTRICT_NOT_ALLOWED, DECISION_COUNT, DUPLICATE_MEASURE, CATEGORY_LIMIT, BUDGET_EXCEEDED, INCOMPATIBLE_MEASURES. Возвращайте все определимые нарушения без выдуманных конфликтов неизвестных данных.

## Оценка

`src/domain/evaluateScenario.ts`: `evaluateScenario(input: unknown): ScenarioResult`, `getBaseline(): BaselineResult`.

`src/domain/indicatorMath.ts`: чистые helper-экспорты `clip(value:number,min?:number,max?:number):number` (defaults0,100), `applyIndicatorEffects(indicators:Readonly<Indicators>, effects:readonly Readonly<IndicatorEffects>[]):Indicators`, `calculateDistrictScore(indicators:Readonly<Indicators>):number`, `countCriticalIndicators(indicators:Readonly<Indicators>):number`, `evaluateIndicators(districts:readonly DistrictSnapshot[]):BaselineResult`. Последняя использует канонические population shares и все5 district ID. Дополнительные внутренние helper разрешены. Math helpers поддерживают конечные десятичные 39.999/40/40.001, без требования шага1/8 к test-only данным. Некорректные низкоуровневые значения можно отвергать TypeError; внешние decisions обрабатывает валидатор.

Все эффекты лагируются, складываются с фиксированными синергиями, затем каждый индикатор clip один раз. Строго `<40`, никакого раннего округления или clipping итогового Score. Не менять формулу.

ScenarioResult — discriminated union. valid:true имеет числовые finalScore/scoreDelta/criticalAfter и полные результаты. valid:false имеет finalScore=null, scoreDelta=null, criticalAfter=null, after-метрики=null и пустые районы/contributions/synergies. baseline-метрики доступны как факты неизменной базы, а не оценка невалидного сценария. Это намеренное уточнение упрощённого PDF-типа. `getBaseline()` — отдельная функция; [] не становится допустимым сценарием.

Полная структура зафиксирована в simulation.ts: бюджеты, исходные/конечные cityAverage и weakestDistrictScore, criticalIndicators, scoreComponents, districts до/после. `criticalPenalty` в компонентах — отрицательное число. `activatedSynergies` — ID (`M1+M2`, `M10+M12`, `M5+M6`); подробности — `synergies`.

Contributions содержат `fullEffects` (каталог), `realizedEffects` (после лага), `observedDistrictDeltas` (наблюдаемое общее изменение затронутых индикаторов целевого района в полном сценарии). Последнее включает совместный эффект всех мер и синергий и НЕ приписывается одной мере. Синергии отдельны. Это не слагаемые итогового Score; не делать ложную аддитивную атрибуцию.

## Советник

`src/domain/findBestReplacement.ts`: `findBestReplacement(current: unknown): AdvisorResult`.

Всегда переоценивает массив decisions общим evaluateScenario; готовому result от клиента не доверяет. Для invalid current возвращает current с ошибками, topAlternatives=[], нулевые счётчики, без победителей.

Перебирает каждый удаляемый слот и каждую меру, отсутствующую во всём исходном наборе; районную — по всем5 районам, городскую — один раз без района. Четыре других решения сохраняет. Смена района той же меры, возвращение удалённой меры и глобальная оптимизация не входят в одну замену.

Ключ решения: `${measureId}:${districtId ?? ''}`; ключ набора — отсортированные ASCII-лексикографически ключи, соединённые `|`. Не использовать localeCompare как зависимый от locale tie-break. `decisions` результата отсортированы тем же способом. Допустимые кандидаты проходят общий валидатор и evaluator. `evaluatedCandidates` считает сырые варианты, поданные валидатору (включая невалидные), `validCandidates` — уникальные допустимые. Время выполнения измерять снаружи, не включать nondeterministic time в ответ.

Сортировки:
1. topAlternatives (до3 уникальных) и bestByScore: finalScore desc, criticalAfter asc, key asc.
2. bestForWeakestDistrict: weakestDistrictGain desc, finalScore desc, key asc.
3. bestFastImpact: addedLagQuarters asc, finalScore desc, key asc.

Победители могут совпадать. Отрицательные и нулевые gain не скрывать. weakestDistrictGain = новый min(D)-исходный min(D), не изменение фиксированного района. removedCriticalCount = beforeCount-afterCount, может быть отрицательным.

Для совместимости с уже существующим AI-потребителем `removed` и `added` имеют форму **DecisionChange** `{decision, measureName, districtName?}`. Сырые решения находятся в `.decision`. Это документированное уточнение PDF, где поля были непосредственно Decision. Candidate также содержит key, decisions (полные5), addedLagQuarters и valid result. `ScenarioAnalysis` сохранён для существующего AI-кода.

## Регрессии и совместимость

База: score52.55768, average56.8624, Ncrit2; D62.99/57.06/54.65/56.63/49.18.
Первый пример: cost95, score56.54307, avg58.0776, crit0.
Второй: cost98, score57.236735, avg58.5848, crit0.
Допуск тестов1e-8. Округление только в UI.

Старый engine/ в стартовом коммите сохранён как reference для переноса. Работники его не редактируют и новый src runtime его не импортирует. До финальной передачи главная задача переведёт старые потребители на новый API либо создаст тонкий адаптер; не оставит две расходящиеся production-формулы. Общий barrel `src/domain/index.ts` и интеграционные tests/simulation.test.ts добавляет главная задача после реализации модулей. Не добавляем фиктивные успешные функции-заглушки.

## Итог интеграции

Четыре реализации сведены в feature/simulation-engine. Публичный barrel — src/domain/index.ts; legacy перенесён в tests/reference/engine и не импортируется runtime. Добавлены lockfile, build:engine и smoke:engine; установка из чистой копии — npm ci --ignore-scripts. Старое описание стартового коммита выше относится к BASE_SHA, не к итоговой готовности.
