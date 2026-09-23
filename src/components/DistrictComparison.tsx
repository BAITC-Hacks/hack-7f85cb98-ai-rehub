"use client";

import { useState } from "react";
import { INDICATORS, RULES } from "@/domain";
import type { BaselineDistrict, DistrictResult } from "@/types/simulation";
import { deltaTone, directionName, districtName, districtProfile, formatDelta, formatScore, metricLabel, t, type Language } from "../i18n";
import DistrictCard from "./DistrictCard";

type Props = { districts: (BaselineDistrict | DistrictResult)[]; baseline: boolean; weakestIds: readonly string[]; language: Language };

export default function DistrictComparison({ districts, baseline, weakestIds, language }: Props) {
  const [selectedId, setSelectedId] = useState(weakestIds[0] || districts[0].districtId);
  const [changedOnly, setChangedOnly] = useState(false);
  const selected = districts.find((district) => district.districtId === selectedId) || districts[0];
  const before = "indicators" in selected ? selected.indicators : selected.indicatorsBefore;
  const after = "indicatorsAfter" in selected ? selected.indicatorsAfter : null;
  const deltas = "indicatorDeltas" in selected ? selected.indicatorDeltas : null;
  const metrics = INDICATORS.filter(({ id }) => baseline || !changedOnly || (deltas && deltas[id] !== 0));

  return (
    <section className="district-section" id="districts" aria-labelledby="districts-title">
      <div className="section-header"><div><h2 id="districts-title">{t(language, "whatChanges")}</h2><p>{t(language, "exploreDistricts")}</p></div><span className="section-count">05</span></div>
      <div className="district-grid" role="group" aria-label={t(language, "chooseDistrict")}>
        {districts.map((district) => <DistrictCard key={district.districtId} district={district} baseline={baseline} language={language} weakest={weakestIds.includes(district.districtId)} selected={selected.districtId === district.districtId} onSelect={() => setSelectedId(district.districtId)} />)}
      </div>
      <div className="district-detail" id="district-detail" role="region" aria-label={t(language, "districtDetails", { district: districtName(language, selected.districtId) })}>
        <div className="detail-heading"><div><h3>{districtName(language, selected.districtId)} <span>· {t(language, "indicators")}</span></h3><p>{districtProfile(language, selected.districtId)}</p></div><div className="segmented-control" role="group" aria-label={t(language, "indicators")}><button type="button" aria-pressed={!changedOnly || baseline} onClick={() => setChangedOnly(false)}>{t(language, "allIndicators")}</button><button type="button" aria-pressed={changedOnly && !baseline} disabled={baseline} onClick={() => setChangedOnly(true)}>{t(language, "changedOnly")}</button></div></div>
        {baseline && <p className="baseline-notice">{t(language, "baselineView")}</p>}
        <div className="scale-note"><span>{t(language, "scaleNote")}</span><span className="metric-legend"><span><i className="legend-before" />{t(language, "before")}</span>{!baseline && <span><i className="legend-after" />{t(language, "after")}</span>}</span></div>
        <table className="metrics-table">
          <caption className="sr-only">{t(language, "districtDetails", { district: districtName(language, selected.districtId) })}</caption>
          <colgroup><col className="metric-name-col" /><col className="metric-number-col" /><col className="metric-number-col" /><col className="metric-delta-col" /></colgroup>
          <thead><tr><th scope="col">{t(language, "indicator")}</th><th scope="col">{t(language, "before")}</th><th scope="col">{t(language, "after")}</th><th scope="col">{t(language, "change")}</th></tr></thead>
          <tbody>{metrics.map((metric) => {
            const id = metric.id;
            const current = after ? after[id] : before[id];
            const delta = deltas?.[id] ?? 0;
            const critical = current < RULES.criticalThreshold;
            return <tr key={id} className={critical ? "is-critical" : ""}>
              <th scope="row"><span className="metric-title"><span className={`metric-code direction-${metric.category}`}>{id}</span><span>{metricLabel(language, id)}<small>{directionName(language, metric.category)}{critical && <em> · {t(language, "criticalMetric")}</em>}</small></span></span><span className="metric-track" aria-hidden="true"><span style={{ width: `${current}%` }} /><i style={{ left: `${before[id]}%` }} /></span></th>
              <td className={`metric-before ${before[id] < RULES.criticalThreshold ? "text-danger" : ""}`}>{formatScore(language, before[id])}{before[id] < RULES.criticalThreshold && <span className="sr-only"> {t(language, "criticalMetric")}</span>}</td>
              <td className="metric-after">{after ? formatScore(language, after[id]) : "—"}</td>
              <td><span className={`delta delta-${deltaTone(delta)}`}>{baseline ? "—" : formatDelta(language, delta)}</span></td>
            </tr>;
          })}</tbody>
        </table>
        {!metrics.length && <p className="panel-empty">{t(language, "noChangedIndicators")}</p>}
        <p className="rounding-note">{t(language, "roundedNote")}</p>
      </div>
    </section>
  );
}
