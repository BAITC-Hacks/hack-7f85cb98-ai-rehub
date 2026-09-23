# Передача TypeScript-движка интегратору

Финальная ветка роли: `feature/simulation-engine`. Общая база четырёх работников: `2c6a2e745f8fb512f901ed4f3a4440fcea255bc9`. Четыре ветки объединены; 72 TypeScript-теста и 74 reference-теста проходят, чистая установка, сборка, Node.js и браузерный импорт проверены. SHA и подробности — в [integration-report.md](integration-report.md). Frontend, API routes, общий README и OpenAI-интеграция принадлежат другим участникам команды.

## Публичный импорт

```ts
import {
  validateScenario, evaluateScenario, getBaseline, findBestReplacement,
  DISTRICTS, MEASURES, RULES, EXAMPLE_DECISIONS,
} from './src/domain/index.ts';
import type {ScenarioResult, AdvisorResult, Decision} from './src/types/simulation.ts';
```

ESM с явными расширениями `.ts`; в Next.js используйте сборщик и существующий alias проекта. Чистый runtime `src/data`, `src/domain`, `src/types` не использует Node, сеть, ключи или AI. Node >=22.18 нужен для автономного тестового запуска TS без отдельного транспилятора, а не браузеру.

```ts
const initial = getBaseline(); // Отдельная база, score около 52.55768.
const result = evaluateScenario(EXAMPLE_DECISIONS);
if (result.valid) {
  console.log(result.finalScore, result.totalCost, result.districts);
} else {
  console.error(result.errors); // finalScore и scoreDelta равны null.
}
const invalid = evaluateScenario([]); // Ровно5, пустой набор невалиден.
const advisor = findBestReplacement(EXAMPLE_DECISIONS); // Вход — decisions, не готовый result.
const best = advisor.bestByScore;
if (best) {
  console.log(best.removed.decision, best.added.decision, best.scoreGain);
  console.log(best.decisions, best.result.finalScore);
}
```

Проверяйте discriminant `valid` прежде численных полей. Валидатор принимает unknown и не доверяет присланным cost/effects/Score. Бюджет нечислимого ввода равен null. На сервере вызовите тот же evaluator заново, даже если клиент уже проверил план.

## Строгие правила

Одинаковые данные и бюджет100, ровно5 разных measureId, максимум2 каждого направления. У районных мер districtId обязателен; у M2/M6/M12/M14 поле отсутствует полностью. Все5 направлений доступны, покрывать все5 не обязательно. Ограничения, несовместимости, лаги и синергии — в каталоге.

Сначала сложение всех реализованных эффектов и фиксированных синергий, потом один clip каждого показателя в0..100. Штраф только за значения строго<40. Score не clip и не округляется; UI форматирует его отдельно.

| Сценарий | Стоимость | Score | Среднее | Критических |
| --- | ---: | ---: | ---: | ---: |
| Исходное состояние | — | 52.55768 | 56.8624 | 2 |
| M7 nura, M8 nura, M10 nura, M12, M5 saryarka | 95 | 56.54307 | 58.0776 | 0 |
| M2, M3 nura, M8 nura, M9 nura, M14 | 98 | 57.236735 | 58.5848 | 0 |

Допуск тестов1e-8. JavaScript number может содержать последние двоичные погрешности; это не повод округлять входы или промежуточные результаты.

## Советник

Запускайте поиск по кнопке. Он полностью перечисляет окрестность одной замены: удалить одно решение и добавить меру, отсутствующую во всём исходном наборе, с каждым допустимым районом. Остальные4 решения остаются. Перенос той же меры в другой район не считается заменой.

`topAlternatives` — максимум3 уникальных плана по Score. Победители `bestByScore`, `bestForWeakestDistrict`, `bestFastImpact` могут совпадать. Последняя стратегия предпочитает меньший lag новой меры; scoreGain может быть отрицательным. Не называйте отрицательный gain улучшением. Все варианты содержат полный проверенный результат и воспроизводятся evaluator.

Условия сортировки и ключ уникальности зафиксированы в `parallel-contract.md`. `evaluatedCandidates`/`validCandidates` — реальные счётчики. В локальном замере Node 24.19.0, macOS arm64, 10 запусков после прогрева: пример за 95 единиц — 165 вариантов / 101 допустимый, медиана 29.88 мс; пример за 98 единиц — 185 / 92, медиана 24.79 мс. Время зависит от устройства и нагрузки, это не гарантия.

Для первого примера лучшая замена — M5 в saryarka → M3 в nura: стоимость100, Score57.20556, gain+0.66249. У второго примера лучший сосед имеет Score57.225545, gain−0.01119: исходный план лучше всех допустимых одиночных замен.

## Числа для AI

Передавайте успешный ScenarioResult и, по запросу пользователя, AdvisorResult. AI объясняет численные факты, цену замены, пользу, риски и компромиссы. Новую альтернативу сначала считает код.

`contributions.fullEffects` — исходные эффекты; `realizedEffects` — после лага; `observedDistrictDeltas` — суммарные наблюдаемые изменения затронутых индикаторов в полном сценарии, включая другие меры. Это НЕ независимый вклад одной меры в Score. Синергии раскрываются отдельно. Минимум по районам, штрафы и clip делают Score нелинейным.

## Миграция старого контракта

Канонический API — новый `src/domain/index.ts`.

| Прежний вызов/поле | Новый вызов/поле |
| --- | --- |
| simulateScenario(decisions) | evaluateScenario(decisions) |
| validateDecisions(decisions) | validateScenario(decisions) |
| response.valid | result.valid |
| response.validation.budget.spent/remaining | result.totalCost/remainingBudget |
| response.validation.errors (объекты) | result.errorDetails; result.errors — строки |
| response.result.after.score | result.finalScore |
| response.result.delta.score | result.scoreDelta |
| response.result.districtChanges | result.districts |
| response.result.measureEffects | result.contributions |
| response.result.synergies | result.synergies |

Это документированное изменение структуры; механически переименовать импорт недостаточно. В уже опубликованном AI-каркасе сохранены IndicatorCode, Indicators, ScenarioAnalysis и DecisionChange; removed/added советника содержат `.decision`, `.measureName`, `.districtName?`. Его фикстурам потребуется дополнить новые поля; invalid-ветку нужно сузить перед обращением к числам.

## Проверка и включение в приложение

```sh
npm ci --ignore-scripts
npm run typecheck:engine
npm run test:engine
npm run test:legacy
npm run build:engine
npm run smoke:engine
npm run benchmark:engine
```

Автономный package.json нужен ветке движка. При объединении с приложением сохраните scripts/dependencies Next.js и добавьте команды движка; не заменяйте package.json приложения целиком. Типы живут в единственном src/types/simulation.ts; при конфликте сохраняйте discriminated union и nullable invalid-результаты. Чужие компоненты/API эта ветка не изменяет.

Старый ESM-модуль перенесён в `tests/reference/engine/` исключительно для регрессий. Приложение должно импортировать новый `src/domain/index.ts` или скомпилированный `dist/engine/domain/index.js`. Runtime src не импортирует reference; существует одна каноническая production-формула.

Браузерная проверка: после сборки `npm run smoke:browser:prepare`, затем локальный HTTP-сервер из корня и страница `/dist/smoke.html`. Она выполняет оба контрольных сценария и поиск замен без ключей/API.
