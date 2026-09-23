"use client";

import { useEffect, useRef, useState } from "react";
import AdvisorComparison from "../components/AdvisorComparison";
import AIAnalysis from "../components/AIAnalysis";
import BudgetBar from "../components/BudgetBar";
import DecisionSlot from "../components/DecisionSlot";
import DistrictComparison from "../components/DistrictComparison";
import ScenarioSummary from "../components/ScenarioSummary";
import { DISTRICTS, EXAMPLE_DECISIONS, MEASURES, evaluateScenario, findBestReplacement, getBaseline, validateScenario } from "@/domain";
import { createFallbackAnalysis } from "@/lib/ai/fallbackAnalysis";
import { useScenarioAnalysis } from "@/lib/ai/useScenarioAnalysis";
import { languageLabels, localAnalysis, localizedValidation, t, type Language } from "../i18n";
import type { AdvisorResult, Decision, ValidScenarioResult } from "@/types/simulation";

type Theme = "light" | "dark";
const emptyPlan = (): Decision[] => Array.from({ length: 5 }, () => ({ measureId: "" }));
const examplePlan = (): Decision[] => EXAMPLE_DECISIONS.map((decision) => ({ ...decision }));
const baseline = getBaseline();
const evaluatedExample = evaluateScenario(EXAMPLE_DECISIONS);
const exampleResult = evaluatedExample.valid ? evaluatedExample : null;
const exampleAdvisor = findBestReplacement(EXAMPLE_DECISIONS);

function restoreDecisions(value: unknown): Decision[] | null {
  if (!Array.isArray(value) || value.length !== 5) return null;
  const restored: Decision[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.measureId !== "string") return null;
    if (item.districtId != null && typeof item.districtId !== "string") return null;
    restored.push(item.districtId == null ? { measureId: item.measureId } : { measureId: item.measureId, districtId: item.districtId });
  }
  return restored;
}

export default function SimulatorPage() {
  const [decisions, setDecisions] = useState<Decision[]>(examplePlan);
  const [result, setResult] = useState<ValidScenarioResult | null>(exampleResult);
  const [advisor, setAdvisor] = useState<AdvisorResult | null>(exampleAdvisor);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorSearched, setAdvisorSearched] = useState(true);
  const [language, setLanguage] = useState<Language>("ru");
  const [theme, setTheme] = useState<Theme>("light");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const scenarioRevision = useRef(0);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const storedLanguage = localStorage.getItem("akim-language");
        const storedTheme = localStorage.getItem("akim-theme");
        const storedPlan = localStorage.getItem("akim-saved-plan");
        if (storedLanguage === "ru" || storedLanguage === "kk" || storedLanguage === "en") setLanguage(storedLanguage);
        if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
        if (storedPlan) {
          const saved: unknown = JSON.parse(storedPlan);
          if (saved && typeof saved === "object" && "decisions" in saved) {
            const restored = restoreDecisions(saved.decisions);
            if (restored) {
              const evaluated = evaluateScenario(restored.filter((item) => item.measureId));
              setDecisions(restored);
              setResult(evaluated.valid ? evaluated : null);
              setAdvisor(null);
              setAdvisorSearched(false);
              if ("savedAt" in saved && typeof saved.savedAt === "string" && Number.isFinite(Date.parse(saved.savedAt))) setSavedAt(saved.savedAt);
            }
          }
        }
      } catch { /* Invalid local data never blocks the simulator. */ }
      setPreferencesLoaded(true);
    });
    return () => { cancelled = true; scenarioRevision.current += 1; };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.lang = language;
    document.title = t(language, "appName");
    try { localStorage.setItem("akim-language", language); } catch { /* Preferences still work without storage. */ }
  }, [language, preferencesLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("akim-theme", theme); } catch { /* Preferences still work without storage. */ }
  }, [theme, preferencesLoaded]);

  const activeDecisions = decisions.filter((decision) => decision.measureId);
  const validation = validateScenario(activeDecisions);
  const spent = validation.totalCost ?? activeDecisions.reduce((total, decision) => total + (MEASURES.find((item) => item.id === decision.measureId)?.cost ?? 0), 0);
  const directionCount = new Set(activeDecisions.map((decision) => MEASURES.find((item) => item.id === decision.measureId)?.category).filter(Boolean)).size;
  const bestCandidate = advisor?.bestByScore;
  const ai = useScenarioAnalysis(preferencesLoaded && language === "ru" ? result : null, bestCandidate);
  const districtsToShow = result?.districts ?? baseline.districts;
  const visibleAnalysis = result
    ? language === "ru" ? ai.analysis ?? createFallbackAnalysis(result, bestCandidate) : localAnalysis(language, result, bestCandidate)
    : null;
  const analysisMode = visibleAnalysis?.source === "openai" ? "OpenAI" : t(language, "localAnalysis");
  const visibleAnalysisLoading = language === "ru" && ai.loading;

  function invalidateRequests() {
    scenarioRevision.current += 1;
    setAdvisorLoading(false);
    setSaveError(false);
  }

  function clearSavedPlan() {
    try { localStorage.removeItem("akim-saved-plan"); } catch { setSaveError(true); }
  }

  function updateDecision(index: number, decision: Decision) {
    invalidateRequests();
    setDecisions((current) => current.map((item, itemIndex) => itemIndex === index ? decision : item));
    setResult(null);
    setAdvisor(null);
    setAdvisorSearched(false);
    setSavedAt(null);
  }

  function loadExample() {
    invalidateRequests();
    setDecisions(examplePlan());
    setResult(exampleResult);
    setAdvisor(exampleAdvisor);
    setAdvisorSearched(true);
    setSavedAt(null);
    clearSavedPlan();
  }

  function reset() {
    invalidateRequests();
    setDecisions(emptyPlan());
    setResult(null);
    setAdvisor(null);
    setAdvisorSearched(false);
    setSavedAt(null);
    clearSavedPlan();
  }

  function savePlan() {
    const timestamp = new Date().toISOString();
    try {
      localStorage.setItem("akim-saved-plan", JSON.stringify({ decisions, savedAt: timestamp }));
      setSavedAt(timestamp);
      setSaveError(false);
    } catch { setSaveError(true); }
  }

  function calculate() {
    if (!validation.valid) return;
    invalidateRequests();
    const next = evaluateScenario(validation.decisions);
    setResult(next.valid ? next : null);
    setAdvisor(null);
    setAdvisorSearched(false);
    requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ block: "start" }));
  }

  async function findReplacement() {
    if (!result) return;
    const revision = scenarioRevision.current;
    const currentDecisions = result.decisions;
    setAdvisorLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (revision !== scenarioRevision.current) return;
    setAdvisor(findBestReplacement(currentDecisions));
    setAdvisorSearched(true);
    setAdvisorLoading(false);
  }

  function applyReplacement() {
    if (!bestCandidate) return;
    invalidateRequests();
    const removed = bestCandidate.removed.decision;
    setDecisions((current) => current.map((decision) =>
      decision.measureId === removed.measureId && decision.districtId === removed.districtId
        ? { ...bestCandidate.added.decision } : decision));
    setResult(null);
    setAdvisor(null);
    setAdvisorSearched(false);
    setSavedAt(null);
    requestAnimationFrame(() => document.getElementById("plan")?.scrollIntoView({ block: "start" }));
  }

  return (
    <div className="simulator-shell">
      <header className="simulator-topbar">
        <div className="topbar-brand"><span className="brand-mark">A5</span><span><strong>{t(language, "appName")}</strong><small>{t(language, "appSubtitle")}</small></span></div>
        <div className="topbar-controls"><span className={`status-pill ${result ? "status-good" : "status-amber"}`}>{result ? t(language, "ready") : t(language, "pending")}</span><span className="topbar-horizon">{t(language, "horizon")}</span><label className="control-select"><span className="sr-only">{t(language, "language")}</span><select aria-label={t(language, "language")} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>{(["ru", "kk", "en"] as Language[]).map((item) => <option key={item} value={item}>{languageLabels[item]}</option>)}</select></label><button className="theme-switch" type="button" aria-label={`${t(language, "theme")}: ${theme === "light" ? t(language, "dark") : t(language, "light")}`} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? t(language, "dark") : t(language, "light")}</button><button className="topbar-save" type="button" onClick={savePlan}>{savedAt ? `${t(language, "saved")} ${new Date(savedAt).toLocaleTimeString(language === "en" ? "en-US" : language === "kk" ? "kk-KZ" : "ru-RU", { hour: "2-digit", minute: "2-digit" })}` : t(language, "save")}</button></div>
      </header>

      <div className="workspace-intro"><div><h1>{t(language, "workspaceTitle")}</h1><p>{t(language, "workspaceIntro")}</p></div><nav aria-label={t(language, "appName")}><a href="#plan">{t(language, "planLink")} <span aria-hidden="true">↗</span></a><a href="#results">{t(language, "resultsLink")} <span aria-hidden="true">↗</span></a></nav></div>
      {saveError && <p className="save-error" role="alert">{t(language, "saveFailed")}</p>}

      <main className="simulator-workspace">
        <aside className="plan-panel" id="plan" aria-labelledby="plan-title">
          <div className="plan-heading"><span className="eyebrow">{t(language, "planStep")}</span><h2 id="plan-title">{t(language, "plan")}</h2><p>{t(language, "uniqueFive")}</p></div>
          <BudgetBar spent={spent} decisionCount={activeDecisions.length} directionCount={directionCount} language={language} />
          <div className="panel-divider" />
          <div className="plan-decision-list">{decisions.map((decision, index) => <DecisionSlot key={index} index={index} decision={decision} measures={MEASURES} districts={DISTRICTS} disabledMeasureIds={activeDecisions.map((item) => item.measureId)} language={language} onChange={updateDecision} />)}</div>
          <div className={`validation-note ${validation.valid ? "is-valid" : "is-invalid"}`} role="status"><span aria-hidden="true">{validation.valid ? "✓" : "!"}</span>{validation.valid ? <p>{t(language, "valid")}</p> : <ul>{localizedValidation(language, validation, activeDecisions).map((message, index) => <li key={index}>{message}</li>)}</ul>}</div>
          <button className="button button-primary calculate-button" disabled={!validation.valid} onClick={calculate}>{t(language, "calculate")}</button>
          <details className="rules-note"><summary>{t(language, "rulesLabel")}</summary><p>{t(language, "rules")}</p></details>
          <div className="plan-actions"><button type="button" onClick={loadExample}>{t(language, "loadExample")}</button><button type="button" onClick={reset}>{t(language, "reset")}</button></div>
        </aside>

        <div className="results-area">
          <ScenarioSummary result={result} baselineScore={baseline.score} spent={spent} language={language} analysisLoading={visibleAnalysisLoading} analysisMode={analysisMode} />
          <DistrictComparison districts={districtsToShow} baseline={!result} language={language} weakestIds={result?.weakestDistrictIds ?? baseline.weakestDistrictIds} />
          <div className="insight-grid"><AdvisorComparison current={result} advisor={bestCandidate ?? null} loading={advisorLoading} searched={advisorSearched} language={language} onFind={findReplacement} onApply={applyReplacement} /><AIAnalysis analysis={visibleAnalysis} loading={visibleAnalysisLoading} mode={analysisMode} error={language === "ru" ? ai.error : null} language={language} onRetry={ai.retry} /></div>
        </div>
      </main>
      <footer className="simulator-footer">{t(language, "footer")}</footer>
    </div>
  );
}
