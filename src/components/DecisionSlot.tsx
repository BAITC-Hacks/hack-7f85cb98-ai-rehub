import { directionName, districtName, measureName, type Language, t } from "../i18n";
import type { Decision, DeepReadonly, District, Measure } from "@/types/simulation";

type Props = { index: number; decision: Decision; measures: DeepReadonly<Measure[]>; districts: DeepReadonly<District[]>; disabledMeasureIds: string[]; language: Language; onChange: (index: number, decision: Decision) => void };

export default function DecisionSlot({ index, decision, measures, districts, disabledMeasureIds, language, onChange }: Props) {
  const measure = measures.find((item) => item.id === decision.measureId);
  const district = districts.find((item) => item.id === decision.districtId);

  function changeMeasure(measureId: string) {
    const nextMeasure = measures.find((item) => item.id === measureId);
    onChange(index, nextMeasure?.scope === "district" ? { measureId, districtId: "" } : { measureId });
  }

  return (
    <details className={`plan-decision ${measure ? "is-filled" : ""}`}>
      <summary>
        <span className="plan-decision-code">{measure?.id || String(index + 1).padStart(2, "0")}</span>
        <span className="plan-decision-copy"><strong>{measure ? measureName(language, measure.id) : t(language, "emptySlot")}</strong><small>{measure ? `${directionName(language, measure.category)} · ${district ? districtName(language, district.id) : measure.scope === "city" ? t(language, "citywide") : t(language, "chooseDistrict")}` : t(language, "uniqueFive")}</small></span>
        <span className="plan-decision-cost">{measure?.cost ?? "—"}<small>{t(language, "costUnit")}</small></span>
        <span className="plan-decision-edit" aria-hidden="true">{t(language, "edit")}</span>
      </summary>
      <div className="plan-decision-fields">
        <label><span>{t(language, "measure")}</span><select aria-label={`${t(language, "measure")} ${index + 1}`} value={decision.measureId} onChange={(event) => changeMeasure(event.target.value)}><option value="">{t(language, "emptySlot")}</option>{measures.map((item) => <option key={item.id} value={item.id} disabled={disabledMeasureIds.includes(item.id) && item.id !== decision.measureId}>{item.id} · {measureName(language, item.id)} · {item.cost} {t(language, "costUnit")}</option>)}</select></label>
        {measure?.scope === "district" && <label><span>{t(language, "district")}</span><select aria-label={`${t(language, "district")} ${index + 1}`} value={decision.districtId || ""} onChange={(event) => onChange(index, { ...decision, districtId: event.target.value })}><option value="">{t(language, "district")}</option>{districts.map((item) => <option key={item.id} value={item.id}>{districtName(language, item.id)}</option>)}</select></label>}
        {measure?.scope === "city" && <p>{t(language, "cityMeasure")}</p>}
        {measure && <p>{t(language, "lag")}: {measure.lagQuarters} {t(language, "quarter")}</p>}
      </div>
    </details>
  );
}
