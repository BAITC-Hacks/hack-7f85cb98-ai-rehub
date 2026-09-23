# Контракт расчётного движка v1.0.0

Экспорты доступны из `engine/index.mjs`, реализация — чистый синхронный ESM без внешних зависимостей. Все подписи, ограничения, цены и эффекты UI берёт из экспортируемых `RULES`, `CATEGORIES`, `INDICATORS`, `DISTRICTS`, `MEASURES`, `SYNERGIES`, `INCOMPATIBILITIES`; версия — `MODEL_VERSION`.

## Вход

`simulateScenario(decisions)` и `validateDecisions(decisions)` принимают массив объектов:

```json
[
  {"measureId":"M7","districtId":"nura"},
  {"measureId":"M8","districtId":"nura"},
  {"measureId":"M10","districtId":"nura"},
  {"measureId":"M12"},
  {"measureId":"M5","districtId":"saryarka"}
]
```

Районы: `yesil`, `almaty`, `saryarka`, `baikonur`, `nura`. Направления: `transport`, `ecology`, `social`, `safety`, `services`. Меры: `M1`–`M14`, регистр значим. Городские меры `M2`, `M6`, `M12`, `M14` не принимают поле `districtId`, даже со значением `null` или `undefined`. Остальным мерам нужен существующий район.

Допустимы только поля `measureId` и `districtId`. Ровно 5 уникальных `measureId`, не более 2 каждого направления, сумма стоимости не выше 100 и отсутствие несовместимостей. Не требуется выбирать все пять направлений. Пустой выбор — невалидный сценарий; для исходных данных используется отдельный `getBaseline()`.

## Валидация

`validateDecisions()` возвращает:

```ts
{
  valid: boolean;
  errors: Array<{code: string; message: string; [detail: string]: unknown}>;
  budget: {limit: 100; spent: number | null; remaining: number | null};
  decisionCount: number | null;
  categoryCounts: Record<'transport' | 'ecology' | 'social' | 'safety' | 'services', number>;
}
```

Возвращаются все найденные ошибки. `decisionIndex` в деталях — индекс с нуля. Если цена хотя бы одного решения неизвестна из-за неверного формата или ID, `spent` и `remaining` равны `null`; это не нулевая стоимость. При известных ценах невалидного сценария сумма включает все переданные меры, в том числе повторы, а остаток может быть отрицательным.

| Код | Причина |
| --- | --- |
| `INVALID_INPUT` | Вместо массива пришёл другой тип |
| `DECISION_COUNT` | Количество решений отличается от 5 |
| `INVALID_DECISION` | Элемент не является обычным объектом решения |
| `INVALID_FIELDS` | Есть поля кроме `measureId` и `districtId` |
| `UNKNOWN_MEASURE` | Нет собственного поля `measureId` либо ID неизвестен |
| `DUPLICATE_MEASURE` | Мера повторяется, даже в другом районе |
| `DISTRICT_NOT_ALLOWED` | Район передан для городской меры |
| `DISTRICT_REQUIRED` | Районная мера без района, с `null` или пустой строкой |
| `UNKNOWN_DISTRICT` | Неизвестный район |
| `CATEGORY_LIMIT` | Более 2 мер одного направления |
| `BUDGET_EXCEEDED` | Стоимость известных мер превышает 100 |
| `INCOMPATIBLE_MEASURES` | Нарушена глобальная или районная несовместимость |

Промежуточный выбор из 1–4 мер закономерно даёт `DECISION_COUNT`. UI может показывать бюджет и остальные ошибки во время выбора, а отправку финального сценария разрешать только при `valid === true`.

## Результат симуляции

Ответ — объединение двух вариантов. Всегда сначала проверяйте `valid`:

```ts
type Response =
  | {valid: false; validation: Validation; result: null}
  | {valid: true; validation: Validation; result: SimulationResult};
```

У невалидного сценария нет рассчитанного Score. Не заменяйте `null` исходным Score и не передавайте ошибочный сценарий в AI как рассчитанный.

Поля `SimulationResult`:

| Поле | Содержимое |
| --- | --- |
| `modelVersion` | Версия данных и модели |
| `baseline` | Полная оценка исходного состояния |
| `after` | Полная оценка после мер и синергий |
| `delta` | Изменения Score, среднего, минимума, числа критических показателей и компонент Score |
| `districtChanges` | Районы с `scoreBefore`, `scoreAfter`, `scoreDelta` и для каждого показателя `{before, after, delta}` |
| `measureEffects` | Меры с ценой, направлением, областью действия, лагом, `realizedFraction`, `districtIds` и эффектами до ограничения показателей |
| `synergies` | Применённые бонусы: `id`, `measureIds`, `districtId`, `effects` |
| `warnings` | Оставшиеся критические показатели и фактические снижения показателей |

`baseline` и `after` имеют одну структуру:

```ts
{
  districts: Array<{
    id: string; name: string; populationShare: number;
    indicators: Record<string, number>; score: number;
  }>;
  populationWeightedScore: number;
  weakestDistrictScore: number;
  weakestDistrictIds: string[]; // Все районы при равенстве минимума.
  criticalCount: number;
  criticalIndicators: Array<{districtId: string; indicatorId: string; value: number}>;
  score: number;
  scoreComponents: {average: number; weakest: number; criticalPenalty: number};
}
```

`scoreComponents.average = 0.7 × populationWeightedScore`, `weakest = 0.3 × weakestDistrictScore`, `criticalPenalty = −criticalCount`. Их сумма равна Score. `delta` содержит поля `score`, `populationWeightedScore`, `weakestDistrictScore`, `criticalCount`, `scoreComponents`. Цена и остаток находятся в `response.validation.budget`, а не в `result`.

Коды предупреждений: `CRITICAL_INDICATOR` с `districtId`, `indicatorId`, `value`; `INDICATOR_DECREASE` с `districtId`, `indicatorId`, `before`, `after`, `delta`. Предупреждение не делает валидный сценарий невалидным.

## Числа и границы модели

Эффект каждой меры умножается на `(8 − lagQuarters) / 8`; городская мера действует на все районы при однократной оплате. Синергии добавляются отдельно без лагового коэффициента. Все эффекты суммируются до единственного ограничения показателя в `[0, 100]`. Штраф учитывает только значения **строго меньше 40**. Score отдельно не ограничивается, поэтому отрицательные значения допустимы моделью.

Вычисления не округляются до двух знаков. UI форматирует готовые значения, например `score.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2})`. `measureEffects` нельзя складывать как вклады в итоговый Score: это эффекты показателей до ограничения, а Score нелинеен. `synergies` в них не включены. Для сравнения используйте готовые изменения или пересчёт альтернативного полного сценария.

Контрольный пример: бюджет 95, baseline 52.55768, итог 56.54307. Источник коэффициентов — предоставленный пользователем синтетический датасет; это не прогноз фактического развития города.

## Граница frontend, backend и AI

Frontend импортирует модуль и рисует результаты. Backend независимо вызывает `simulateScenario()` для реального входящего массива; не доверяет присланным клиентом Score, стоимости, бюджету или эффектам. Возможный будущий маршрут `POST /api/simulate` может принимать `{decisions: [...]}` и передавать `body.decisions` движку. **HTTP-маршрут в этом модуле не реализован.**

AI получает успешный ответ, включая исходные и конечные показатели, бюджет, изменения, эффекты, синергии и предупреждения. Он объясняет сильные стороны, риски и компромиссы. Все численные утверждения берутся из результата движка; AI не вычисляет новый Score. Если предлагается замена мероприятий, её сначала проверяет и рассчитывает движок. Интеграция OpenAI и fallback-анализ — задача разработчика № 3; здесь они не реализованы.

`getBaseline()` предназначен для исходного экрана. Экспорты `applyIndicatorEffects()` и `evaluateIndicators()` — низкоуровневые функции модели и тестов, не пользовательские точки расчёта сценария: они не проверяют бюджет и набор мер. Некорректные снимки или значения могут вызывать `TypeError`/`RangeError`. `evaluateIndicators()` требует все пять уникальных районов; показатели — конечные значения от 0 до 100 с шагом 1/8. Для внешнего пользовательского ввода используйте `simulateScenario()`.
