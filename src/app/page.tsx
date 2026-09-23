"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdvisorComparison from "../components/AdvisorComparison";
import AIAnalysis from "../components/AIAnalysis";
import BudgetBar from "../components/BudgetBar";
import DecisionSlot from "../components/DecisionSlot";
import DistrictComparison from "../components/DistrictComparison";
import ScenarioSummary from "../components/ScenarioSummary";
import { DISTRICTS, EXAMPLE_PLAN, MEASURES } from "../data.js";
import { calculateScenario, districtScore, validatePlan } from "../engine.js";
import { findBestReplacementMock } from "../advisor.mock.js";
import { languageLabels, localAnalysis, localizedValidation, t, type Language } from "../i18n";

type Decision = { measureId: string; districtId: string | null };
type Theme = "light" | "dark";

const emptyPlan = (): Decision[] => Array.from({ length: 5 }, () => ({ measureId: "", districtId: null }));
const examplePlan = (): Decision[] => EXAMPLE_PLAN.map((decision: Decision) => ({ ...decision }));
const exampleResult = calculateScenario(EXAMPLE_PLAN);
const exampleAdvisor = findBestReplacementMock(EXAMPLE_PLAN);

export default function SimulatorPage() {
  const [decisions, setDecisions] = useState<Decision[]>(examplePlan);
  const [result, setResult] = useState<any>(exampleResult);
  const [advisor, setAdvisor] = useState<any>(exampleAdvisor);
  const [analysis, setAnalysis] = useState<any>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorSearched, setAdvisorSearched] = useState(true);
  const [language, setLanguage] = useState<Language>("ru");
  const [theme, setTheme] = useState<Theme>("light");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const scenarioRevision = useRef(0);
  const analysisController = useRef<AbortController | null>(null);

  useEffect(() => () => analysisController.current?.abort(), []);

  useEffect(() => {
    try {
      const storedLanguage = localStorage.getItem("akim-language");
      const storedTheme = localStorage.getItem("akim-theme");
      const storedPlan = localStorage.getItem("akim-saved-plan");
      if (storedLanguage === "ru" || storedLanguage === "kk" || storedLanguage === "en") setLanguage(storedLanguage);
      if (storedTheme === "light" || storedTheme === "dark") setTheme(storedTheme);
      if (storedPlan) {
        const saved = JSON.parse(storedPlan);
        if (Array.isArray(saved.decisions) && saved.decisions.length === 5) {
          const restored = saved.decisions.map((item: Decision) => ({ measureId: item.measureId || "", districtId: item.districtId || null }));
          setDecisions(restored);
          if (validatePlan(restored).valid) {
            setResult(calculateScenario(restored));
            setAdvisor(null);
            setAdvisorSearched(false);
          } else {
            setResult(null);
            setAdvisor(null);
            setAdvisorSearched(false);
          }
          if (typeof saved.savedAt === "string") setSavedAt(saved.savedAt);
        }
      }
    } catch { /* Invalid local data never blocks the simulator. */ }
    setPreferencesLoaded(true);
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
  const validation = validatePlan(activeDecisions);
  const spent = activeDecisions.reduce((total, decision) => total + (MEASURES.find((item) => item.id === decision.measureId)?.cost || 0), 0);
  const directionCount = new Set(activeDecisions.map((decision) => MEASURES.find((item) => item.id === decision.measureId)?.direction).filter(Boolean)).size;
  const baselineDistricts = useMemo(() => DISTRICTS.map((district) => ({ ...district, score: districtScore(district.indicators) })), []);
  const districtsToShow = result?.districts || baselineDistricts;
  const visibleAnalysis = result ? language === "ru" && analysis ? analysis : localAnalysis(language, result) : null;
  const analysisMode = language === "ru" && analysis?.mode ? analysis.mode : t(language, "localAnalysis");
  const visibleAnalysisLoading = language === "ru" && analysisLoading;

  function invalidateRequests() {
    scenarioRevision.current += 1;
    analysisController.current?.abort();
    analysisController.current = null;
    setAnalysisLoading(false);
    setAnalysisError(false);
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
    setAnalysis(null);
    setSavedAt(null);
  }

  function loadExample() {
    invalidateRequests();
    setDecisions(examplePlan());
    setResult(exampleResult);
    setAdvisor(exampleAdvisor);
    setAdvisorSearched(true);
    setAnalysis(null);
    setSavedAt(null);
    clearSavedPlan();
  }

  function reset() {
    invalidateRequests();
    setDecisions(emptyPlan());
    setResult(null);
    setAdvisor(null);
    setAdvisorSearched(false);
    setAnalysis(null);
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

  async function requestAnalysis(nextResult: any) {
    analysisController.current?.abort();
    const endpoint = (window as any).AKIM_AI_ENDPOINT;
    if (!endpoint || language !== "ru") {
      setAnalysis(null);
      setAnalysisLoading(false);
      setAnalysisError(false);
      return;
    }
    setAnalysisLoading(true);
    setAnalysisError(false);
    setAnalysis(null);
    const controller = new AbortController();
    analysisController.current = controller;
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...nextResult, language }), signal: controller.signal });
      if (!response.ok) throw new Error("analysis unavailable");
      const nextAnalysis = await response.json();
      if (!controller.signal.aborted) setAnalysis(nextAnalysis);
    } catch {
      if (!controller.signal.aborted) setAnalysisError(true);
    } finally {
      if (!controller.signal.aborted) setAnalysisLoading(false);
    }
  }

  function calculate() {
    if (!validation.valid) return;
    invalidateRequests();
    const next = calculateScenario(activeDecisions);
    setResult(next);
    setAdvisor(null);
    setAdvisorSearched(false);
    requestAnalysis(next);
    requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ block: "start" }));
  }

  async function findReplacement() {
    if (!result) return;
    const revision = scenarioRevision.current;
    setAdvisorLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (revision !== scenarioRevision.current) return;
    setAdvisor(findBestReplacementMock(activeDecisions));
    setAdvisorSearched(true);
    setAdvisorLoading(false);
  }

  function applyReplacement() {
    if (!advisor) return;
    invalidateRequests();
    setDecisions(advisor.decisions.map((decision: Decision) => ({ ...decision })));
    setResult(advisor.candidate);
    setAdvisor(null);
    setAdvisorSearched(false);
    setSavedAt(null);
    requestAnalysis(advisor.candidate);
    requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ block: "start" }));
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
          <div className={`validation-note ${validation.valid ? "is-valid" : "is-invalid"}`} role="status"><span aria-hidden="true">{validation.valid ? "✓" : "!"}</span><p>{validation.valid ? t(language, "valid") : localizedValidation(language, validation.errors, activeDecisions, spent)}</p></div>
          <button className="button button-primary calculate-button" disabled={!validation.valid} onClick={calculate}>{t(language, "calculate")}</button>
          <details className="rules-note"><summary>{t(language, "rulesLabel")}</summary><p>{t(language, "rules")}</p></details>
          <div className="plan-actions"><button type="button" onClick={loadExample}>{t(language, "loadExample")}</button><button type="button" onClick={reset}>{t(language, "reset")}</button></div>
        </aside>

        <div className="results-area">
          <ScenarioSummary result={result} baselineScore={exampleResult.baselineScore} spent={spent} language={language} analysisLoading={visibleAnalysisLoading} analysisMode={analysisMode} />
          <DistrictComparison districts={districtsToShow} baseline={!result} language={language} weakestId={result?.weakestDistrict.id} />
          <div className="insight-grid"><AdvisorComparison current={result} advisor={advisor} loading={advisorLoading} searched={advisorSearched} language={language} onFind={findReplacement} onApply={applyReplacement} /><AIAnalysis analysis={visibleAnalysis} loading={visibleAnalysisLoading} mode={analysisMode} error={analysisError && language === "ru"} language={language} onRetry={() => result && requestAnalysis(result)} /></div>
        </div>
      </main>
      <footer className="simulator-footer">{t(language, "footer")}</footer>
    </div>
  );
}
