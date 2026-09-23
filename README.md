# Аким на 5 часов — AI-симулятор управления городом

Хакатонный прототип: команда выбирает городские меры, расчётный движок считает бюджет, показатели и итоговый Astana Quality of Life Score. AI-слой объясняет уже рассчитанный сценарий и проверенную замену одного решения.

## Запуск

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Откройте `http://localhost:3000`. В `.env.local` можно указать `OPENAI_API_KEY` и `OPENAI_MODEL`. Ключ хранится только на сервере. Без ключа `/api/analyze` работает через локальный fallback. Ключ ChatGPT Pro не заменяет ключ OpenAI API: это отдельный сервис с собственной оплатой.

На Windows вместо `cp` используйте `Copy-Item .env.example .env.local`.

## Контракт интеграции

Основной серверный запрос передаёт только пять решений. Маршрут сам вызывает `simulateScenario()` из `engine/index.mjs`, проверяет бюджет и правила, затем передаёт рассчитанный результат AI. Числа, присланные клиентом дополнительно к `decisions`, не используются. AI не считает Score и не выбирает меры самостоятельно.

```ts
const response = await fetch("/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ decisions: [
    { measureId: "M7", districtId: "nura" },
    { measureId: "M8", districtId: "nura" },
    { measureId: "M10", districtId: "nura" },
    { measureId: "M12" },
    { measureId: "M5", districtId: "saryarka" },
  ] }),
});
const analysis: ScenarioAnalysis = await response.json();
```

Успешный ответ имеет поля `source`, `summary`, `strengths`, `risks`, `tradeoffs`, `recommendations`. `source` показывает `openai` или `fallback`. Неверный JSON и невалидный набор решений возвращают HTTP 400; при ошибке выбора ответ содержит `validation.errors` и бюджет. Для ранее созданного интерфейса также пока поддерживается запрос `{ scenario, candidate? }` по типам `src/types/simulation.ts`; эти клиентские результаты сервер не пересчитывает.

Для клиентского экрана используйте `useScenarioAnalysis` из `src/lib/ai/useScenarioAnalysis.ts`:

```tsx
const { analysis, loading, error, retry } = useScenarioAnalysis(scenario, candidate);
<AIAnalysis analysis={analysis} loading={loading} />
```

Передавайте в хук только рассчитанный `scenario`, а после поиска замены — также `candidate`. Хук отменяет устаревшие запросы при смене сценария. `error` содержит короткое пользовательское сообщение, а `retry()` повторяет запрос. Даже при сетевой ошибке `analysis` содержит локальный fallback; при обычном серверном fallback ошибки нет. Пока результат не рассчитан, передайте `null` вместо `scenario`.

Маршрут: `src/app/api/analyze/route.ts`. Серверный OpenAI-анализ: `src/lib/ai/analyze.ts`. Детерминированное объяснение: `src/lib/ai/fallbackAnalysis.ts`. Примеры двух сценариев: `src/lib/ai/__fixtures__/scenarioFixtures.ts`.

OpenAI Responses API вызывается со структурированным ответом. Если API недоступен, ответ пустой или содержит непроверенные цифры, используется fallback. Все числовые показатели интерфейс должен показывать непосредственно из результата расчётного движка. Модель получает готовые данные, поэтому обучение модели на районном датасете не требуется.

## Проверка

```bash
npm test
node --test engine/test/*.test.mjs
npm run lint
npx tsc --noEmit
npm run build
```

Тесты покрывают официальный сценарий из датасета (95 единиц, Score 56.54307), второй допустимый сценарий (61 единица), превышение бюджета, объяснение результата, контрфактическую замену, отсутствие ключа, успешный структурированный ответ и ошибки OpenAI. Для реального вызова OpenAI нужен действующий `OPENAI_API_KEY`; автоматические тесты используют имитацию ответа API и не расходуют деньги.

## Границы ответственности

Расчётный движок находится в `engine/`, AI/API-интеграция — в `src/lib/ai/` и `src/app/api/analyze/`. При запросе `{ decisions }` сервер пересчитывает сценарий из районного датасета. Старый запрос `{ scenario, candidate? }` сохранён для совместимости с текущим клиентским хуком и не считается доверенным при публичном использовании; интерфейсу нужно перейти на отправку решений.
