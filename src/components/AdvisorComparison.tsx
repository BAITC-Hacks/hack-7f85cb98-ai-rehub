import { districtName, formatDelta, formatScore, measureName, type Language, t } from "../i18n";

type Props = { current: any | null; advisor: any | null; loading: boolean; searched: boolean; language: Language; onFind: () => void; onApply: () => void };

export default function AdvisorComparison({ current, advisor, loading, searched, language, onFind, onApply }: Props) {
  const candidate = advisor?.scoreGain >= 0.005 ? advisor.candidate : null;
  const compromise = advisor?.compromise;
  const tradeoff = compromise?.kind === "district"
    ? t(language, "districtTradeoff", { district: districtName(language, current?.districts.find((district: any) => district.name === compromise.district)?.id || compromise.district), value: formatScore(language, Math.abs(compromise.delta)) })
    : compromise?.kind === "budget" ? t(language, "budgetTradeoff", { value: formatScore(language, compromise.delta, 0) }) : t(language, "focusTradeoff");

  return (
    <section className="advisor-panel" aria-labelledby="advisor-title">
      <div className="panel-heading"><div><h2 id="advisor-title">{t(language, "bestReplacement")}</h2><p>{t(language, "advisorIntro")}</p></div><button className="button button-outline" onClick={onFind} disabled={!current || loading}>{loading ? t(language, "finding") : t(language, "findReplacement")}</button></div>
      {advisor && candidate ? <>
        <div className="advisor-plans">
          <div className="advisor-plan"><span>{t(language, "yourPlan")}</span><strong>{formatScore(language, current.score)}</strong><small>{advisor.replacement.removed.measureId} · {measureName(language, advisor.replacement.removed.measureId)}</small><small>{advisor.replacement.removed.districtId ? districtName(language, advisor.replacement.removed.districtId) : t(language, "citywide")}</small></div>
          <div className="advisor-swap"><strong>{t(language, "remove")} {advisor.replacement.removed.measureId} → {t(language, "add")} {advisor.replacement.added.measureId}</strong><span>{formatDelta(language, advisor.scoreGain)}</span><small>Score</small></div>
          <div className="advisor-plan advisor-plan-new"><span>{t(language, "replacementPlan")}</span><strong>{formatScore(language, candidate.score)}</strong><small>{advisor.replacement.added.measureId} · {measureName(language, advisor.replacement.added.measureId)}</small><small>{advisor.replacement.added.districtId ? districtName(language, advisor.replacement.added.districtId) : t(language, "citywide")}</small></div>
        </div>
        <div className="advisor-facts"><div><span className="fact-icon fact-good">↑</span><p><strong>{t(language, "benefit")}</strong><small>{t(language, "gainDistrict", { district: districtName(language, advisor.winner.id), value: formatScore(language, advisor.winner.delta) })}</small></p></div><div><span className="fact-icon fact-warn">!</span><p><strong>{t(language, "risk")}</strong><small>{t(language, "stillWeakest", { district: districtName(language, candidate.weakestDistrict.id) })}</small></p></div><div><span className="fact-icon fact-blue">↔</span><p><strong>{t(language, "compromise")}</strong><small>{tradeoff}</small></p></div></div>
        <button className="button button-deep advisor-apply" onClick={onApply}>{t(language, "applyReplacement")}</button>
      </> : <div className="panel-empty">{loading ? t(language, "finding") : searched ? t(language, "noReplacement") : t(language, "advisorPrompt")}</div>}
    </section>
  );
}
