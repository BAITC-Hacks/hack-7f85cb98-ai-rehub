import { deltaTone, districtName, formatDelta, formatScore, type Language, t } from "../i18n";

type Props = { district: any; baseline: boolean; language: Language; weakest: boolean; selected: boolean; onSelect: () => void };

export default function DistrictCard({ district, baseline, language, weakest, selected, onSelect }: Props) {
  const before = baseline ? district.score : district.beforeScore;
  return (
    <button type="button" className={`district-card ${selected ? "is-selected" : ""}`} aria-pressed={selected} aria-controls="district-detail" onClick={onSelect}>
      <span className="district-card-top"><strong>{districtName(language, district.id)}</strong><span className="selection-dot" aria-hidden="true">{selected ? "✓" : ""}</span></span>
      <span className="district-card-values"><span><small>{t(language, "before")}</small>{formatScore(language, before)}</span><span aria-hidden="true" className="district-arrow">→</span><span><small>{t(language, "after")}</small><b>{baseline ? "—" : formatScore(language, district.afterScore)}</b></span></span>
      <span className="district-card-bottom"><span className={`delta delta-${baseline ? "neutral" : deltaTone(district.delta)}`}>{baseline ? "—" : formatDelta(language, district.delta)}</span>{weakest && <span className="district-weakest">{t(language, "weakest")}</span>}</span>
    </button>
  );
}
