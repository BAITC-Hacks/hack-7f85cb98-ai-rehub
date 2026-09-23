import { type Language, t } from "../i18n";

type Props = { analysis: any; loading: boolean; mode: string; error: boolean; language: Language; onRetry: () => void };

export default function AIAnalysis({ analysis, loading, mode, error, language, onRetry }: Props) {
  return (
    <section className="analysis-panel" aria-labelledby="analysis-title">
      <div className="panel-heading analysis-heading"><h2 id="analysis-title">{t(language, "resultExplanation")}</h2><span className="status-pill status-blue">{mode}</span></div>
      {loading ? <div className="panel-empty">{t(language, "analysisWait")}</div> : analysis ? <>
        <div className="analysis-facts"><div><span className="fact-icon fact-good">↑</span><p><strong>{t(language, "strength")}</strong><small>{analysis.strengths}</small></p></div><div><span className="fact-icon fact-warn">!</span><p><strong>{t(language, "risk")}</strong><small>{analysis.risks}</small></p></div><div><span className="fact-icon fact-blue">↔</span><p><strong>{t(language, "recommendation")}</strong><small>{analysis.recommendation}</small></p></div></div>
        {error && <div className="ai-error">{t(language, "aiError")} <button onClick={onRetry}>{t(language, "retry")}</button></div>}
      </> : <div className="panel-empty">{t(language, "analysisEmpty")}</div>}
    </section>
  );
}
