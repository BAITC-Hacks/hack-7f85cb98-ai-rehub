import { deltaTone, districtName, formatDelta, formatScore, type Language, t } from "../i18n";

type Props = { result: any | null; baselineScore: number; spent: number; language: Language; analysisLoading: boolean; analysisMode: string };

export default function ScenarioSummary({ result, baselineScore, spent, language, analysisLoading, analysisMode }: Props) {
  const remaining = result?.budgetLeft ?? 100 - spent;
  return (
    <section className="scenario-summary" id="results" aria-labelledby="scenario-title">
      <div className="result-heading"><div><span className="eyebrow">{t(language, "resultStep")}</span><h2 id="scenario-title">{t(language, "result")}</h2></div><span className={`status-pill ${result ? "status-good" : "status-amber"}`}>{result ? t(language, "ready") : t(language, "pending")}</span></div>
      <div className="summary-grid">
        <div className="score-block"><span className="stat-label">{t(language, "scoreExplanation")}</span><div className="score-line"><div><small>{t(language, "before")}</small><span>{formatScore(language, baselineScore)}</span></div><b aria-hidden="true">→</b><div><small>{t(language, "after")}</small><strong>{result ? formatScore(language, result.score) : "—"}</strong></div></div><div className="score-growth"><span className={`delta delta-${result ? deltaTone(result.delta) : "neutral"}`}>{result ? formatDelta(language, result.delta) : "—"}</span><span>{t(language, "scoreChange")}</span></div><p>{t(language, "scoreHint")}</p></div>
        <div className="summary-stats">
          <div className="score-stat"><span className="stat-label">{t(language, "budget")}</span><strong className={remaining < 0 ? "text-danger" : ""}>{result?.totalCost ?? spent}<small> / 100</small></strong><span>{remaining < 0 ? t(language, "overBudget", { count: Math.abs(remaining) }) : `${t(language, "remaining")} ${remaining} ${t(language, "costUnit")}`}</span></div>
          <div className="score-stat"><span className="stat-label">{t(language, "weakest")}</span><strong>{result ? districtName(language, result.weakestDistrict.id) : "—"}</strong><span>{result ? `${formatScore(language, result.weakestDistrict.afterScore)} · ${t(language, "districtScore")}` : t(language, "criticalAfter")}</span></div>
          <div className="score-stat"><span className="stat-label">{t(language, "critical")}</span><strong className={result?.criticalCount > 0 ? "text-danger" : ""}>{result?.criticalCount ?? "—"}</strong><span>{t(language, "criticalNote")}</span></div>
        </div>
      </div>
      <div className="result-footnote"><span>{t(language, "horizon")}</span><span>{analysisLoading ? t(language, "analysisLoading") : analysisMode} · {t(language, "aiOnlyExplains")}</span><a href="#plan">{t(language, "planLink")} ↑</a></div>
    </section>
  );
}
