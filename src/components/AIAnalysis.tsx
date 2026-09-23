import { type Language, t } from "../i18n";
import type { ScenarioAnalysis } from "@/types/simulation";

type Props = { analysis: ScenarioAnalysis | null; loading: boolean; mode: string; error: string | null; language: Language; onRetry: () => void };

export default function AIAnalysis({ analysis, loading, mode, error, language, onRetry }: Props) {
  const sections = analysis ? [
    { label: t(language, "strength"), icon: "↑", tone: "good", facts: analysis.strengths },
    { label: t(language, "risk"), icon: "!", tone: "warn", facts: analysis.risks },
    { label: t(language, "compromise"), icon: "↔", tone: "blue", facts: analysis.tradeoffs },
    { label: t(language, "recommendation"), icon: "→", tone: "blue", facts: analysis.recommendations },
  ] : [];
  return (
    <section className="analysis-panel" aria-labelledby="analysis-title" aria-busy={loading}>
      <div className="panel-heading analysis-heading"><h2 id="analysis-title">{t(language, "resultExplanation")}</h2><span className="status-pill status-blue">{mode}</span></div>
      {loading && <p role="status">{t(language, "analysisWait")}</p>}
      {analysis ? <>
        <p>{analysis.summary}</p>
        <div className="analysis-facts">{sections.filter((section) => section.facts.length > 0).map((section) => <div key={section.label}><span className={`fact-icon fact-${section.tone}`}>{section.icon}</span><p><strong>{section.label}</strong>{section.facts.map((fact, index) => <small key={index}>{fact}</small>)}</p></div>)}</div>
        {error && <div className="ai-error" role="alert">{language === "ru" ? error : t(language, "aiError")} <button onClick={onRetry}>{t(language, "retry")}</button></div>}
        {!error && analysis.source === "fallback" && !loading && language === "ru" && <button className="button button-outline" onClick={onRetry}>{t(language, "retry")}</button>}
      </> : !loading && <div className="panel-empty">{t(language, "analysisEmpty")}</div>}
    </section>
  );
}
