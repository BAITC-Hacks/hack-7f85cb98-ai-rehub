import { DIRECTIONS, DISTRICTS, EXAMPLE_PLAN, MEASURES, METRICS } from "./data.js";
import { findBestReplacementMock } from "./advisor.mock.js";
import {
  BUDGET,
  buildFallbackAnalysis,
  calculateScenario,
  formatNumber,
  scoreCity,
  districtScore,
  toAnalysisPayload,
  validatePlan
} from "./engine.js";

const state = {
  decisions: [],
  filter: "all",
  search: "",
  result: null,
  advisor: null,
  savedScenarios: []
};

const elements = Object.fromEntries(
  [
    "filter-tabs", "measure-search", "measure-grid", "selected-list", "budget-spent",
    "budget-left", "budget-fill", "decision-count", "direction-count", "validation-box",
    "validation-dot", "validation-summary", "run-simulation", "load-example", "reset-plan",
    "baseline-score", "results", "result-score", "score-ring", "score-verdict", "score-summary",
    "score-delta", "critical-count", "analysis-mode", "ai-analysis", "district-chart",
    "metric-district", "metric-grid", "save-scenario", "comparison", "comparison-body",
    "header-decisions", "header-budget", "baseline-districts", "find-replacement", "advisor",
    "advisor-loading", "advisor-comparison", "advisor-current-score", "advisor-current-budget",
    "advisor-current-weakest", "advisor-current-measures", "advisor-remove", "advisor-add",
    "advisor-slot", "advisor-candidate-score", "advisor-gain", "advisor-candidate-budget",
    "advisor-candidate-critical", "advisor-candidate-measures", "advisor-win", "advisor-risk",
    "advisor-tradeoff", "apply-replacement"
  ].map((id) => [id, document.getElementById(id)])
);

initialize();

function initialize() {
  const baselineDistricts = DISTRICTS.map((district) => ({
    ...district,
    after: district.indicators,
    afterScore: districtScore(district.indicators)
  }));
  elements["baseline-score"].textContent = formatNumber(scoreCity(baselineDistricts).score);
  renderBaselineDistricts();
  renderFilters();
  renderBuilder();
  bindEvents();
}

function bindEvents() {
  elements["measure-search"].addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLocaleLowerCase("ru");
    renderMeasures();
  });
  elements["run-simulation"].addEventListener("click", runSimulation);
  elements["load-example"].addEventListener("click", () => {
    state.decisions = EXAMPLE_PLAN.map((decision) => ({ ...decision }));
    clearResult();
    renderBuilder();
  });
  elements["reset-plan"].addEventListener("click", () => {
    state.decisions = [];
    clearResult();
    renderBuilder();
  });
  elements["metric-district"].addEventListener("change", renderMetrics);
  elements["save-scenario"].addEventListener("click", saveScenario);
  elements["find-replacement"].addEventListener("click", runAdvisor);
  elements["apply-replacement"].addEventListener("click", applyAdvisorReplacement);
}

function renderBaselineDistricts() {
  elements["baseline-districts"].innerHTML = DISTRICTS.map((district) => {
    const score = districtScore(district.indicators);
    const critical = Object.entries(district.indicators).filter(([, value]) => value < 40);
    return `
      <details class="baseline-card ${critical.length ? "has-critical" : ""}">
        <summary>
          <div><strong>${district.name}</strong><small>${district.profile}</small></div>
          <span><b>${formatNumber(score)}</b><small>Score</small></span>
        </summary>
        <div class="baseline-metrics">
          ${Object.entries(METRICS).map(([metric, meta]) => {
            const value = district.indicators[metric];
            return `<div class="baseline-metric ${value < 40 ? "is-critical" : ""}"><span>${meta.short}</span><strong>${formatNumber(value, 0)}</strong>${value < 40 ? "<em>критический</em>" : ""}</div>`;
          }).join("")}
        </div>
      </details>`;
  }).join("");
}

function renderFilters() {
  const tabs = [{ id: "all", name: "Все" }, ...Object.entries(DIRECTIONS).map(([id, value]) => ({ id, name: value.name }))];
  elements["filter-tabs"].innerHTML = tabs.map((tab) => `
    <button class="filter-tab ${state.filter === tab.id ? "is-active" : ""}" data-filter="${tab.id}" role="tab" aria-selected="${state.filter === tab.id}">
      ${tab.name}
    </button>`).join("");
  elements["filter-tabs"].querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      renderFilters();
      renderMeasures();
    });
  });
}

function renderBuilder() {
  renderMeasures();
  renderPlan();
  renderStatus();
}

function renderMeasures() {
  const counts = getDirectionCounts();
  const selectedIds = new Set(state.decisions.map((decision) => decision.measureId));
  const measures = MEASURES.filter((measure) => {
    const matchesFilter = state.filter === "all" || measure.direction === state.filter;
    const haystack = `${measure.id} ${measure.name} ${DIRECTIONS[measure.direction].name}`.toLocaleLowerCase("ru");
    return matchesFilter && haystack.includes(state.search);
  });

  elements["measure-grid"].innerHTML = measures.length ? measures.map((measure) => {
    const selected = selectedIds.has(measure.id);
    const directionFull = counts[measure.direction] >= 2;
    const planFull = state.decisions.length >= 5;
    const disabled = !selected && (directionFull || planFull);
    const effects = Object.entries(measure.effects)
      .map(([metric, value]) => `${METRICS[metric].short} ${value > 0 ? "+" : ""}${value}`)
      .join(" · ");
    return `
      <article class="measure-card ${selected ? "is-selected" : ""} ${disabled ? "is-disabled" : ""}" style="--accent:${DIRECTIONS[measure.direction].color}">
        <div class="measure-topline">
          <span class="measure-code">${measure.id}</span>
          <span class="measure-direction">${DIRECTIONS[measure.direction].icon} ${DIRECTIONS[measure.direction].name}</span>
        </div>
        <h3>${measure.name}</h3>
        <p class="measure-effects">${effects}</p>
        <div class="measure-meta">
          <span>${measure.type === "city" ? "Весь город" : "Один район"}</span>
          <span>Лаг ${measure.lag} кв.</span>
        </div>
        <div class="measure-footer">
          <strong>${measure.cost} <small>ед.</small></strong>
          <button class="add-button" type="button" data-measure="${measure.id}" ${disabled ? "disabled" : ""} aria-label="${selected ? "Удалить" : "Добавить"} ${measure.name}">
            ${selected ? "Удалить" : "Добавить"}
          </button>
        </div>
      </article>`;
  }).join("") : `<div class="empty-search">По этому запросу ничего не найдено.</div>`;

  elements["measure-grid"].querySelectorAll("[data-measure]").forEach((button) => {
    button.addEventListener("click", () => toggleMeasure(button.dataset.measure));
  });
}

function toggleMeasure(measureId) {
  const existingIndex = state.decisions.findIndex((decision) => decision.measureId === measureId);
  if (existingIndex >= 0) {
    state.decisions.splice(existingIndex, 1);
  } else {
    const measure = MEASURES.find((item) => item.id === measureId);
    if (!measure || state.decisions.length >= 5) return;
    state.decisions.push({ measureId, districtId: measure.type === "city" ? null : "" });
  }
  clearResult();
  renderBuilder();
}

function renderPlan() {
  const slots = Array.from({ length: 5 }, (_, index) => state.decisions[index] || null);
  elements["selected-list"].innerHTML = slots.map((decision, index) => {
    if (!decision) return `<li class="empty-slot"><span>${index + 1}</span><p>Добавьте решение из каталога</p></li>`;
    const measure = MEASURES.find((item) => item.id === decision.measureId);
    const districtSelect = measure.type === "district" ? `
      <label class="district-select-label">Район
        <select data-district-for="${measure.id}" aria-label="Район для ${measure.name}">
          <option value="">Выберите район</option>
          ${DISTRICTS.map((district) => `<option value="${district.id}" ${decision.districtId === district.id ? "selected" : ""}>${district.name}</option>`).join("")}
        </select>
      </label>` : `<span class="city-label">Все 5 районов</span>`;
    return `
      <li class="selected-item" style="--accent:${DIRECTIONS[measure.direction].color}">
        <span class="slot-number">${index + 1}</span>
        <div class="selected-main">
          <div class="selected-title"><strong>${measure.id}</strong><span>${measure.name}</span></div>
          <div class="selected-controls">${districtSelect}<b>${measure.cost} ед.</b></div>
        </div>
        <button class="remove-button" data-remove="${measure.id}" type="button" aria-label="Удалить ${measure.name}">×</button>
      </li>`;
  }).join("");

  elements["selected-list"].querySelectorAll("[data-remove]").forEach((button) => {
    button.addEventListener("click", () => toggleMeasure(button.dataset.remove));
  });
  elements["selected-list"].querySelectorAll("[data-district-for]").forEach((select) => {
    select.addEventListener("change", () => {
      const decision = state.decisions.find((item) => item.measureId === select.dataset.districtFor);
      decision.districtId = select.value;
      clearResult();
      renderBuilder();
    });
  });
}

function renderStatus() {
  const validation = validatePlan(state.decisions);
  const counts = getDirectionCounts();
  const directionCount = Object.keys(counts).length;
  const spent = validation.totalCost;
  const budgetLeft = BUDGET - spent;

  elements["budget-spent"].textContent = spent;
  elements["budget-left"].textContent = budgetLeft;
  elements["budget-left"].parentElement.classList.toggle("is-danger", budgetLeft < 0);
  elements["budget-fill"].style.width = `${Math.min(100, spent)}%`;
  elements["budget-fill"].classList.toggle("is-danger", spent > BUDGET);
  elements["decision-count"].textContent = state.decisions.length;
  elements["direction-count"].textContent = directionCount;
  elements["header-decisions"].textContent = `${state.decisions.length}/5`;
  elements["header-budget"].textContent = `${spent}/100`;
  elements["header-budget"].classList.toggle("is-danger", spent > BUDGET);
  elements["run-simulation"].disabled = !validation.valid;
  elements["validation-dot"].classList.toggle("is-valid", validation.valid);
  elements["validation-summary"].textContent = validation.valid ? "Готово к расчёту" : validation.errors[0];

  if (validation.valid) {
    elements["validation-box"].className = "validation-box is-valid";
    elements["validation-box"].innerHTML = `<strong>Сценарий валиден</strong><span>Все ограничения соблюдены.</span>`;
  } else {
    elements["validation-box"].className = "validation-box";
    elements["validation-box"].innerHTML = validation.errors.slice(0, 3).map((error) => `<span>• ${error}</span>`).join("");
  }
}

async function runSimulation() {
  let result;
  try {
    result = calculateScenario(state.decisions);
  } catch (error) {
    renderStatus();
    return;
  }
  state.result = result;
  renderResult(result);
  elements.results.hidden = false;
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
  await renderAnalysis(result);
}

function renderResult(result) {
  const score = result.roundedScore;
  const delta = result.delta;
  elements["result-score"].textContent = formatNumber(score);
  elements["score-ring"].style.setProperty("--score", `${Math.max(0, Math.min(100, score)) * 3.6}deg`);
  elements["score-verdict"].textContent = delta >= 4 ? "Заметное улучшение" : delta > 0 ? "Умеренное улучшение" : "Сценарий требует пересмотра";
  elements["score-summary"].textContent = `Средний городской балл — ${formatNumber(result.cityAverage)}, слабейший район — ${result.weakestDistrict.name}.`;
  elements["score-delta"].textContent = `${delta >= 0 ? "+" : ""}${formatNumber(delta)} к базе`;
  elements["score-delta"].classList.toggle("is-negative", delta < 0);
  elements["critical-count"].textContent = `Критических значений: ${result.criticalCount}`;

  elements["district-chart"].innerHTML = result.districts.map((district) => `
    <div class="district-row">
      <div class="district-label"><strong>${district.name}</strong><small>${district.profile}</small></div>
      <div class="bars">
        <div class="bar-row"><span>до</span><div><i style="width:${district.beforeScore}%"></i></div><b>${formatNumber(district.beforeScore)}</b></div>
        <div class="bar-row after"><span>после</span><div><i style="width:${district.afterScore}%"></i></div><b>${formatNumber(district.afterScore)}</b></div>
      </div>
      <span class="district-delta">+${formatNumber(district.delta)}</span>
    </div>`).join("");

  elements["metric-district"].innerHTML = result.districts.map((district) => `
    <option value="${district.id}" ${district.id === result.weakestDistrict.id ? "selected" : ""}>${district.name}</option>`).join("");
  renderMetrics();
}

function renderMetrics() {
  if (!state.result) return;
  const district = state.result.districts.find((item) => item.id === elements["metric-district"].value) || state.result.districts[0];
  elements["metric-grid"].innerHTML = Object.entries(METRICS).map(([metric, meta]) => {
    const delta = district.metricDeltas[metric];
    const critical = district.after[metric] < 40;
    return `
      <div class="metric-card ${delta > 0 ? "has-gain" : delta < 0 ? "has-loss" : ""} ${critical ? "is-critical" : ""}">
        <div><span>${metric}</span><small>${meta.short}</small></div>
        <strong>${formatNumber(district.after[metric], 1)}</strong>
        <em>${critical ? "критический · " : ""}${delta > 0 ? "+" : ""}${formatNumber(delta, 1)}</em>
      </div>`;
  }).join("");
}

async function renderAnalysis(result) {
  elements["analysis-mode"].textContent = "AI получает только готовые числа";
  elements["ai-analysis"].innerHTML = `<div class="analysis-loading"><i></i><span>Формируем объяснение результата…</span></div>`;
  const fallback = { ...buildFallbackAnalysis(result), mode: "Локальный анализ" };
  let analysis = fallback;
  let remoteFailed = false;

  const endpoint = window.AKIM_AI_ENDPOINT;
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toAnalysisPayload(result))
      });
      if (!response.ok) throw new Error(`AI API: ${response.status}`);
      const data = await response.json();
      if (!data.strengths || !data.risks || !data.recommendation) throw new Error("Некорректный ответ AI API");
      analysis = { ...data, mode: "OpenAI · объяснение готового расчёта" };
    } catch (error) {
      analysis = fallback;
      remoteFailed = true;
    }
  }

  elements["analysis-mode"].textContent = analysis.mode;
  elements["ai-analysis"].innerHTML = `
    ${remoteFailed ? `<div class="analysis-notice">Сервис объяснений временно недоступен. Показан локальный анализ. <button type="button" data-retry-analysis>Повторить</button></div>` : ""}
    <div class="analysis-point"><span class="analysis-label strength">Сильная сторона</span><p>${escapeHtml(analysis.strengths)}</p></div>
    <div class="analysis-point"><span class="analysis-label risk">Риск</span><p>${escapeHtml(analysis.risks)}</p></div>
    <div class="analysis-point"><span class="analysis-label recommendation">Рекомендация</span><p>${escapeHtml(analysis.recommendation)}</p></div>`;
  elements["ai-analysis"].querySelector("[data-retry-analysis]")?.addEventListener("click", () => renderAnalysis(result));
}

async function runAdvisor() {
  if (!state.result) return;
  elements.advisor.hidden = false;
  elements["advisor-loading"].hidden = false;
  elements["advisor-comparison"].hidden = true;
  elements["find-replacement"].disabled = true;
  elements["find-replacement"].textContent = "Ищем замену…";
  elements.advisor.scrollIntoView({ behavior: "smooth", block: "start" });

  await new Promise((resolve) => setTimeout(resolve, 250));
  state.advisor = findBestReplacementMock(state.decisions);
  renderAdvisor();
  elements["advisor-loading"].hidden = true;
  elements["advisor-comparison"].hidden = false;
  elements["find-replacement"].disabled = false;
  elements["find-replacement"].textContent = "Обновить лучшую замену";
}

function renderAdvisor() {
  const advisor = state.advisor;
  if (!advisor) {
    elements["advisor-comparison"].innerHTML = `<div class="advisor-empty">Допустимая замена не найдена.</div>`;
    return;
  }
  const current = advisor.current;
  const candidate = advisor.candidate;
  const removed = advisor.replacement.removed;
  const added = advisor.replacement.added;

  elements["advisor-current-score"].textContent = formatNumber(current.score);
  elements["advisor-current-budget"].textContent = `${current.totalCost}/100`;
  elements["advisor-current-weakest"].textContent = `${current.weakestDistrict.name} · ${formatNumber(current.weakestDistrict.afterScore)}`;
  elements["advisor-current-measures"].textContent = current.decisions.map((item) => item.measureId).join(" · ");
  elements["advisor-remove"].textContent = `${removed.measureId} ${removed.measure.name}`;
  elements["advisor-add"].textContent = `${added.measureId} ${added.measure.name}${added.district ? ` · ${added.district.name}` : " · город"}`;
  elements["advisor-slot"].textContent = `Меняется только слот ${advisor.replacement.slotIndex + 1}`;
  elements["advisor-candidate-score"].textContent = formatNumber(candidate.score);
  elements["advisor-gain"].textContent = `${advisor.scoreGain >= 0 ? "+" : ""}${formatNumber(advisor.scoreGain)} к текущему`;
  elements["advisor-candidate-budget"].textContent = `${candidate.totalCost}/100`;
  elements["advisor-candidate-critical"].textContent = candidate.criticalCount;
  elements["advisor-candidate-measures"].textContent = candidate.decisions.map((item) => item.measureId).join(" · ");
  elements["advisor-win"].textContent = `${advisor.winner.name}: ${advisor.winner.delta >= 0 ? "+" : ""}${formatNumber(advisor.winner.delta)}`;
  elements["advisor-risk"].textContent = candidate.weakestDistrict.name === current.weakestDistrict.name
    ? `${candidate.weakestDistrict.name} остаётся слабейшим`
    : `Слабейший район: ${candidate.weakestDistrict.name}`;
  elements["advisor-tradeoff"].textContent = formatCompromise(advisor.compromise);
}

function formatCompromise(compromise) {
  if (compromise.kind === "district") return `${compromise.district}: ${formatNumber(compromise.delta)}`;
  if (compromise.kind === "budget") return `Бюджет выше на ${formatNumber(compromise.delta, 0)} ед.`;
  return `Фокус смещён на «${DIRECTIONS[compromise.direction].name}»`;
}

function applyAdvisorReplacement() {
  if (!state.advisor) return;
  state.decisions = state.advisor.decisions.map((decision) => ({ ...decision }));
  state.result = null;
  state.advisor = null;
  elements.results.hidden = true;
  elements.advisor.hidden = true;
  renderBuilder();
  document.querySelector(".builder-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveScenario() {
  if (!state.result) return;
  const key = state.result.decisions.map((decision) => `${decision.measureId}:${decision.districtId || "city"}`).sort().join("|");
  if (state.savedScenarios.some((scenario) => scenario.key === key)) return;
  if (state.savedScenarios.length >= 3) state.savedScenarios.shift();
  state.savedScenarios.push({
    key,
    name: `Сценарий ${state.savedScenarios.length + 1}`,
    result: state.result,
    decisions: state.decisions.map((decision) => ({ ...decision }))
  });
  renderComparison();
}

function renderComparison() {
  elements.comparison.hidden = state.savedScenarios.length === 0;
  elements["comparison-body"].innerHTML = state.savedScenarios.map((scenario, index) => `
    <tr>
      <td><strong>${scenario.name}</strong><small>${scenario.result.decisions.map((decision) => decision.measureId).join(" · ")}</small></td>
      <td class="table-score">${formatNumber(scenario.result.score)}</td>
      <td class="table-delta">+${formatNumber(scenario.result.delta)}</td>
      <td>${scenario.result.totalCost} / 100</td>
      <td>${scenario.result.weakestDistrict.name}<small>${formatNumber(scenario.result.weakestDistrict.afterScore)}</small></td>
      <td><button class="table-button" data-restore="${index}" type="button">Открыть</button><button class="table-button danger" data-delete="${index}" type="button">×</button></td>
    </tr>`).join("");
  elements["comparison-body"].querySelectorAll("[data-restore]").forEach((button) => {
    button.addEventListener("click", () => {
      const scenario = state.savedScenarios[Number(button.dataset.restore)];
      state.decisions = scenario.decisions.map((decision) => ({ ...decision }));
      state.result = scenario.result;
      renderBuilder();
      renderResult(state.result);
      renderAnalysis(state.result);
      elements.results.hidden = false;
      elements.results.scrollIntoView({ behavior: "smooth" });
    });
  });
  elements["comparison-body"].querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      state.savedScenarios.splice(Number(button.dataset.delete), 1);
      renderComparison();
    });
  });
}

function clearResult() {
  state.result = null;
  state.advisor = null;
  elements.results.hidden = true;
  elements.advisor.hidden = true;
}

function getDirectionCounts() {
  return state.decisions.reduce((counts, decision) => {
    const measure = MEASURES.find((item) => item.id === decision.measureId);
    if (measure) counts[measure.direction] = (counts[measure.direction] || 0) + 1;
    return counts;
  }, {});
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}
