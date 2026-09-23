import { deltaTone, districtName, formatDelta, formatScore, type Language, t } from "../i18n";
import type { BaselineDistrict, DistrictResult } from "@/types/simulation";

type Props = { district: BaselineDistrict | DistrictResult; baseline: boolean; language: Language; weakest: boolean; selected: boolean; onSelect: () => void };

export default function DistrictCard({ district, baseline, language, weakest, selected, onSelect }: Props) {
  const before = "score" in district ? district.score : district.scoreBefore;
  const after = "scoreAfter" in district ? district.scoreAfter : null;
  const delta = "scoreDelta" in district ? district.scoreDelta : 0;
  return (
    <button type="button" className={`district-card ${selected ? "is-selected" : ""}`} aria-pressed={selected} aria-controls="district-detail" onClick={onSelect}>
      <span className="district-card-top"><strong>{districtName(language, district.districtId)}</strong><span className="selection-dot" aria-hidden="true">{selected ? "✓" : ""}</span></span>
      <span className="district-card-values"><span><small>{t(language, "before")}</small>{formatScore(language, before)}</span><span aria-hidden="true" className="district-arrow">→</span><span><small>{t(language, "after")}</small><b>{after === null ? "—" : formatScore(language, after)}</b></span></span>
      <span className="district-card-bottom"><span className={`delta delta-${baseline ? "neutral" : deltaTone(delta)}`}>{baseline ? "—" : formatDelta(language, delta)}</span>{weakest && <span className="district-weakest">{t(language, "weakest")}</span>}</span>
    </button>
  );
}
