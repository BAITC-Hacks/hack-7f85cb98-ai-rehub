import { type Language, t } from "../i18n";

type Props = { spent: number; decisionCount: number; directionCount: number; language: Language };

export default function BudgetBar({ spent, decisionCount, directionCount, language }: Props) {
  return (
    <div className="budget-overview" aria-label={t(language, "plan")}>
      <div className="budget-heading"><span>{t(language, "budget")}</span><strong className={spent > 100 ? "text-danger" : ""}>{spent}<small> / 100</small></strong></div>
      <progress className={spent > 100 ? "is-over" : ""} max={100} value={Math.min(spent, 100)} aria-label={t(language, "budget")} />
      <div className="budget-caption"><span className={spent > 100 ? "text-danger" : ""}>{spent > 100 ? t(language, "overBudget", { count: spent - 100 }) : `${t(language, "remaining")} ${100 - spent} ${t(language, "costUnit")}`}</span><span>{directionCount} {t(language, "directions")}</span></div>
      <div className="decision-progress"><span>{t(language, "decisions")} <b>{decisionCount} / 5</b></span><div aria-hidden="true">{Array.from({ length: 5 }, (_, index) => <i key={index} className={index < decisionCount ? "is-filled" : ""} />)}</div></div>
    </div>
  );
}
