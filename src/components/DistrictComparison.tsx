"use client";

import { useState } from "react";
import { METRICS } from "../data.js";
import { deltaTone, directionName, districtName, districtProfile, formatDelta, formatScore, metricLabel, t, type Language } from "../i18n";
import DistrictCard from "./DistrictCard";

type Props = { districts: any[]; baseline: boolean; weakestId?: string; language: Language };

export default function DistrictComparison({ districts, baseline, weakestId, language }: Props) {
  const [selectedId, setSelectedId] = useState(weakestId || districts[0].id);
  const [changedOnly, setChangedOnly] = useState(false);
  const selected = districts.find((district) => district.id === selectedId) || districts[0];
  const before = baseline ? selected.indicators : selected.before;
  const after = baseline ? null : selected.after;
  const metrics = Object.entries(METRICS).filter(([id]) => baseline || !changedOnly || Math.abs(selected.metricDeltas[id]) >= 0.005);

  return (
    <section className="district-section" id="districts" aria-labelledby="districts-title">
      <div className="section-header"><div><h2 id="districts-title">{t(language, "whatChanges")}</h2><p>{t(language, "exploreDistricts")}</p></div><span className="section-count">05</span></div>
      <div className="district-grid" role="group" aria-label={t(language, "chooseDistrict")}>
        {districts.map((district) => <DistrictCard key={district.id} district={district} baseline={baseline} language={language} weakest={weakestId === district.id} selected={selected.id === district.id} onSelect={() => setSelectedId(district.id)} />)}
      </div>
      <div className="district-detail" id="district-detail" role="region" aria-label={t(language, "districtDetails", { district: districtName(language, selected.id) })}>
        <div className="detail-heading"><div><h3>{districtName(language, selected.id)} <span>· {t(language, "indicators")}</span></h3><p>{districtProfile(language, selected.id)}</p></div><div className="segmented-control" role="group" aria-label={t(language, "indicators")}><button type="button" aria-pressed={!changedOnly || baseline} onClick={() => setChangedOnly(false)}>{t(language, "allIndicators")}</button><button type="button" aria-pressed={changedOnly && !baseline} disabled={baseline} onClick={() => setChangedOnly(true)}>{t(language, "changedOnly")}</button></div></div>
        {baseline && <p className="baseline-notice">{t(language, "baselineView")}</p>}
        <div className="scale-note"><span>{t(language, "scaleNote")}</span><span className="metric-legend"><span><i className="legend-before" />{t(language, "before")}</span>{!baseline && <span><i className="legend-after" />{t(language, "after")}</span>}</span></div>
        <table className="metrics-table">
          <caption className="sr-only">{t(language, "districtDetails", { district: districtName(language, selected.id) })}</caption>
          <colgroup><col className="metric-name-col" /><col className="metric-number-col" /><col className="metric-number-col" /><col className="metric-delta-col" /></colgroup>
          <thead><tr><th scope="col">{t(language, "indicator")}</th><th scope="col">{t(language, "before")}</th><th scope="col">{t(language, "after")}</th><th scope="col">{t(language, "change")}</th></tr></thead>
          <tbody>{metrics.map(([id, metric]) => {
            const current = after ? after[id] : before[id];
            const delta = baseline ? 0 : selected.metricDeltas[id];
            const critical = current < 40;
            return <tr key={id} className={critical ? "is-critical" : ""}>
              <th scope="row"><span className="metric-title"><span className={`metric-code direction-${metric.direction}`}>{id}</span><span>{metricLabel(language, id)}<small>{directionName(language, metric.direction)}{critical && <em> · {t(language, "criticalMetric")}</em>}</small></span></span><span className="metric-track" aria-hidden="true"><span style={{ width: `${current}%` }} /><i style={{ left: `${before[id]}%` }} /></span></th>
              <td className={`metric-before ${before[id] < 40 ? "text-danger" : ""}`}>{formatScore(language, before[id])}{before[id] < 40 && <span className="sr-only"> {t(language, "criticalMetric")}</span>}</td>
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
