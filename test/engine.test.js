import test from "node:test";
import assert from "node:assert/strict";

import { EXAMPLE_PLAN } from "../src/data.js";
import { calculateScenario, validatePlan } from "../src/engine.js";
import { findBestReplacementMock } from "../src/advisor.mock.js";

test("базовый Score равен контрольному значению 52,56", () => {
  const result = calculateScenario(EXAMPLE_PLAN);
  assert.equal(result.roundedBaselineScore, 52.56);
});

test("контрольный сценарий валиден, стоит 95 и даёт около 56,54", () => {
  const validation = validatePlan(EXAMPLE_PLAN);
  const result = calculateScenario(EXAMPLE_PLAN);
  assert.equal(validation.valid, true);
  assert.equal(validation.totalCost, 95);
  assert.ok(Math.abs(result.roundedScore - 56.54) <= 0.02, `получено ${result.roundedScore}`);
  assert.equal(result.activeSynergies.length, 1);
});

test("валидатор запрещает превышение бюджета и более двух мер направления", () => {
  const plan = [
    { measureId: "M1", districtId: "yesil" },
    { measureId: "M2", districtId: null },
    { measureId: "M3", districtId: "nura" },
    { measureId: "M7", districtId: "nura" },
    { measureId: "M13", districtId: "almaty" }
  ];
  const validation = validatePlan(plan);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes("Бюджет превышен")));
  assert.ok(validation.errors.some((error) => error.includes("Транспорт")));
  assert.ok(validation.errors.some((error) => error.includes("M1 и M3")));
});

test("M4 и M7 разрешены в разных районах и запрещены в одном", () => {
  const base = [
    { measureId: "M4", districtId: "yesil" },
    { measureId: "M7", districtId: "nura" },
    { measureId: "M10", districtId: "almaty" },
    { measureId: "M12", districtId: null },
    { measureId: "M14", districtId: null }
  ];
  assert.equal(validatePlan(base).valid, true);
  assert.equal(validatePlan(base.map((item) => item.measureId === "M7" ? { ...item, districtId: "yesil" } : item)).valid, false);
});

test("второй контрольный сценарий даёт около 57,24", () => {
  const plan = [
    { measureId: "M2", districtId: null },
    { measureId: "M3", districtId: "nura" },
    { measureId: "M8", districtId: "nura" },
    { measureId: "M9", districtId: "nura" },
    { measureId: "M14", districtId: null }
  ];
  const result = calculateScenario(plan);
  assert.equal(result.totalCost, 98);
  assert.ok(Math.abs(result.roundedScore - 57.24) <= 0.02, `получено ${result.roundedScore}`);
});

test("советник меняет ровно один слот и возвращает валидный лучший вариант", () => {
  const advisor = findBestReplacementMock(EXAMPLE_PLAN);
  assert.ok(advisor);
  assert.equal(validatePlan(advisor.decisions).valid, true);
  assert.equal(advisor.decisions.filter((decision, index) => decision.measureId !== EXAMPLE_PLAN[index].measureId).length, 1);
  assert.ok(advisor.candidate.score >= advisor.current.score);
});
