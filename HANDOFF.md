# Frontend / UX handoff

> Исторический handoff ветки `frontend` (75b17e0). В объединённой версии временный JS-движок и mock удалены; интерфейс подключён к `src/domain/index.ts` и `useScenarioAnalysis`. Актуальные контракты и запуск — в [README](README.md), итог проверки — в [отчёте интеграции](docs/integration-report.md). Исходное описание ниже сохранено для истории вклада.

## Временная зависимость

`src/advisor.mock.js` — единственный временный адаптер. Он перебирает допустимые замены одной меры через существующие `validatePlan()` и `calculateScenario()`. При интеграции замените импорт `findBestReplacementMock` в `src/app.js` на общий `findBestReplacement`, сохранив контракт ниже.

```js
{
  current: ScenarioResult,
  candidate: ScenarioResult,
  decisions: Decision[],
  replacement: {
    slotIndex: number,
    removed: ResolvedDecision,
    added: ResolvedDecision
  },
  scoreGain: number,
  winner: { id: string, name: string, delta: number },
  compromise:
    | { kind: "district", district: string, delta: number }
    | { kind: "budget", delta: number }
    | { kind: "focus", direction: string }
}
```

AI-блок ожидает готовые поля `strengths`, `risks`, `recommendation`; числа в браузере языковой моделью не вычисляются.

## Ручная проверка за 2 минуты

1. Открыть исходные карточки Нуры и увидеть критические S1/S2.
2. Нажать «Загрузить пример»: бюджет 95/100, решения 5/5, набор валиден.
3. Рассчитать: Score 52,56 → 56,54, critical count 0.
4. Нажать «Найти лучшую замену»: увидеть конкретное «убрать → добавить», два Score и три факта.
5. Применить замену: обновляется ровно один слот, результат скрывается до нового расчёта.
6. При недоступном AI-анализе результат остаётся, показывается штатный локальный анализ и «Повторить».
7. Проверить ширины 1366×768 и 390 px; горизонтального скролла быть не должно.

## Созданные UI-блоки

- постоянно видимый Budget / 5 decisions status;
- исходные DistrictCard в disclosure;
- пять decision slots и каталог;
- ScenarioSummary и district before/after;
- AdvisorComparison с применением одной замены;
- AIAnalysis с loading, OpenAI, local и retry состояниями.
