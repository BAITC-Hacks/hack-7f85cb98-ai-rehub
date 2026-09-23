import { districtName, formatDelta, formatScore, measureName, type Language, t } from "../i18n";
import type { ReplacementCandidate, ValidScenarioResult } from "@/types/simulation";

type Props = { current: ValidScenarioResult | null; advisor: ReplacementCandidate | null; loading: boolean; searched: boolean; language: Language; onFind: () => void; onApply: () => void };

export default function AdvisorComparison({ current, advisor, loading, searched, language, onFind, onApply }: Props) {
  const candidate = advisor?.result;
  const districtChanges = candidate && current ? candidate.districts.map((district) => ({
    id: district.districtId,
    delta: district.scoreAfter - (current.districts.find((item) => item.districtId === district.districtId)?.scoreAfter ?? district.scoreBefore),
  })).sort((a, b) => b.delta - a.delta) : [];
  const winner = districtChanges[0];
  const loser = districtChanges.at(-1);
  const budgetDelta = candidate && current ? candidate.totalCost - current.totalCost : 0;
  const tradeoff = loser && loser.delta < 0
    ? t(language, "districtTradeoff", { district: districtName(language, loser.id), value: formatScore(language, -loser.delta) })
    : `${t(language, "budget")}: ${formatDelta(language, budgetDelta)} ${t(language, "costUnit")}`;

  return (
    <section className="advisor-panel" aria-labelledby="advisor-title">
      <div className="panel-heading"><div><h2 id="advisor-title">{t(language, "bestReplacement")}</h2><p>{t(language, "advisorIntro")}</p></div><button className="button button-outline" onClick={onFind} disabled={!current || loading}>{loading ? t(language, "finding") : t(language, "findReplacement")}</button></div>
      {advisor && candidate && current ? <>
        {advisor.scoreGain <= 0 && <p role="status">{t(language, "noReplacement")}</p>}
        <div className="advisor-plans">
          <div className="advisor-plan"><span>{t(language, "yourPlan")}</span><strong>{formatScore(language, current.finalScore)}</strong><small>{advisor.removed.decision.measureId} · {measureName(language, advisor.removed.decision.measureId)}</small><small>{advisor.removed.decision.districtId ? districtName(language, advisor.removed.decision.districtId) : t(language, "citywide")}</small></div>
          <div className="advisor-swap"><strong>{t(language, "remove")} {advisor.removed.decision.measureId} → {t(language, "add")} {advisor.added.decision.measureId}</strong><span style={{ color: advisor.scoreGain < 0 ? "var(--red)" : undefined }}>{formatDelta(language, advisor.scoreGain)}</span><small>Score</small></div>
          <div className="advisor-plan advisor-plan-new"><span>{t(language, "replacementPlan")}</span><strong>{formatScore(language, candidate.finalScore)}</strong><small>{advisor.added.decision.measureId} · {measureName(language, advisor.added.decision.measureId)}</small><small>{advisor.added.decision.districtId ? districtName(language, advisor.added.decision.districtId) : t(language, "citywide")}</small></div>
        </div>
        <div className="advisor-facts"><div><span className="fact-icon fact-good">↕</span><p><strong>{t(language, "change")}</strong><small>{winner ? `${districtName(language, winner.id)}: ${formatDelta(language, winner.delta)}` : t(language, "noChanges")}</small></p></div><div><span className="fact-icon fact-warn">!</span><p><strong>{t(language, "weakest")}</strong><small>{candidate.weakestDistrictIds.map((id) => districtName(language, id)).join(", ")} · {formatScore(language, candidate.weakestDistrictScoreAfter)}</small></p></div><div><span className="fact-icon fact-blue">↔</span><p><strong>{t(language, "compromise")}</strong><small>{tradeoff}</small></p></div></div>
        <button className="button button-deep advisor-apply" onClick={onApply}>{t(language, "applyReplacement")}</button>
      </> : <div className="panel-empty">{loading ? t(language, "finding") : searched ? t(language, "noReplacement") : t(language, "advisorPrompt")}</div>}
    </section>
  );
}
