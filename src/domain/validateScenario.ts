import { DISTRICTS } from '../data/districts.ts';
import { MEASURES } from '../data/measures.ts';
import { CATEGORIES, INCOMPATIBILITIES, RULES } from '../data/rules.ts';
import type {
  CategoryId, Decision, DistrictId, MeasureId, ValidationError,
  ValidationResult,
} from '../types/simulation.ts';

const measures = new Map<string, (typeof MEASURES)[number]>(
  MEASURES.map(measure => [measure.id, measure] as const),
);
const districts = new Set<string>(DISTRICTS.map(district => district.id));
const own = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function decisionKey(decision: Decision): string {
  return `${decision.measureId}:${decision.districtId ?? ''}`;
}

function compareAscii(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Validate untrusted runtime input. The catalog is the only source for prices and rules. */
export function validateScenario(input: unknown): ValidationResult {
  const errorDetails: ValidationError[] = [];
  const add = (detail: ValidationError): void => { errorDetails.push(detail); };
  const categoryCounts = Object.fromEntries(
    CATEGORIES.map(category => [category.id, 0]),
  ) as Record<CategoryId, number>;

  if (!Array.isArray(input)) {
    add({ code: 'INVALID_INPUT', message: 'Решения должны быть массивом.' });
    return {
      valid: false, errors: errorDetails.map(error => error.message),
      errorDetails, totalCost: null, remainingBudget: null,
      decisionCount: null, categoryCounts, decisions: [],
    };
  }

  if (input.length !== RULES.decisionCount) {
    add({
      code: 'DECISION_COUNT',
      message: `Нужно выбрать ровно ${RULES.decisionCount} мероприятий.`,
      expected: RULES.decisionCount, actual: input.length,
    });
  }

  let knownCost = 0;
  let costComplete = true;
  const occurrences = new Map<MeasureId, Array<{ index: number; districtId?: DistrictId }>>();
  const canonical: Decision[] = [];

  // An indexed loop also visits holes in sparse arrays.
  for (let index = 0; index < input.length; index++) {
    const item: unknown = input[index];
    if (!isRecord(item)) {
      costComplete = false;
      add({
        code: 'INVALID_DECISION',
        message: 'Каждое решение должно быть объектом.',
        decisionIndex: index,
      });
      continue;
    }

    const fields = Reflect.ownKeys(item)
      .filter(key => key !== 'measureId' && key !== 'districtId')
      .map(String).sort(compareAscii);
    if (fields.length) {
      add({
        code: 'INVALID_FIELDS',
        message: 'В решении разрешены только measureId и districtId.',
        decisionIndex: index, fields,
      });
    }

    const measureId = own(item, 'measureId') ? item.measureId : undefined;
    const measure = typeof measureId === 'string' ? measures.get(measureId) : undefined;
    if (!measure) {
      costComplete = false;
      add({
        code: 'UNKNOWN_MEASURE',
        message: 'Неизвестное мероприятие.',
        decisionIndex: index,
      });
      continue;
    }

    knownCost += measure.cost;
    categoryCounts[measure.category]++;
    const districtValue = own(item, 'districtId') ? item.districtId : undefined;
    let districtId: DistrictId | undefined;

    if (measure.scope === 'city') {
      if (own(item, 'districtId')) {
        add({
          code: 'DISTRICT_NOT_ALLOWED',
          message: `Для городской меры ${measure.id} район не указывается.`,
          decisionIndex: index,
        });
      }
    } else if (districtValue === undefined || districtValue === null || districtValue === '') {
      add({
        code: 'DISTRICT_REQUIRED',
        message: `Для меры ${measure.id} выберите район.`,
        decisionIndex: index,
      });
    } else if (typeof districtValue !== 'string' || !districts.has(districtValue)) {
      add({
        code: 'UNKNOWN_DISTRICT',
        message: `Для меры ${measure.id} указан неизвестный район.`,
        decisionIndex: index,
      });
    } else {
      districtId = districtValue as DistrictId;
    }

    const entries = occurrences.get(measure.id) ?? [];
    entries.push(districtId === undefined ? { index } : { index, districtId });
    occurrences.set(measure.id, entries);
    canonical.push(districtId === undefined
      ? { measureId: measure.id }
      : { measureId: measure.id, districtId });
  }

  for (const [measureId, entries] of occurrences) {
    if (entries.length > 1) {
      add({
        code: 'DUPLICATE_MEASURE',
        message: `Мероприятие ${measureId} можно выбрать только один раз.`,
        measureIds: [measureId],
      });
    }
  }
  for (const category of CATEGORIES) {
    const actual = categoryCounts[category.id];
    if (actual > RULES.maxPerCategory) {
      add({
        code: 'CATEGORY_LIMIT',
        message: `В направлении «${category.name}» допускается не более ${RULES.maxPerCategory} мер.`,
        category: category.id, actual,
      });
    }
  }
  if (knownCost > RULES.budget) {
    add({
      code: 'BUDGET_EXCEEDED',
      message: `Стоимость известных мероприятий ${knownCost} превышает бюджет ${RULES.budget}.`,
      knownCost, limit: RULES.budget,
    });
  }

  for (const conflict of INCOMPATIBILITIES) {
    const first = occurrences.get(conflict.measureIds[0]);
    const second = occurrences.get(conflict.measureIds[1]);
    if (!first || !second) continue;
    // A duplicated local selection has no unambiguous district for a conflict.
    const incompatible = conflict.scope === 'global'
      || (first.length === 1 && second.length === 1
        && first[0].districtId !== undefined
        && first[0].districtId === second[0].districtId);
    if (incompatible) {
      add({
        code: 'INCOMPATIBLE_MEASURES',
        message: conflict.reason,
        measureIds: [...conflict.measureIds], scope: conflict.scope,
      });
    }
  }

  errorDetails.sort((a, b) =>
    compareAscii(a.code, b.code)
    || compareAscii(a.measureIds?.join(',') ?? '', b.measureIds?.join(',') ?? '')
    || compareAscii(a.category ?? '', b.category ?? '')
    || compareAscii(a.message, b.message)
    || (a.decisionIndex ?? -1) - (b.decisionIndex ?? -1));
  const errors = errorDetails.map(error => error.message);
  const totalCost = costComplete ? knownCost : null;
  const remainingBudget = costComplete ? RULES.budget - knownCost : null;
  if (errorDetails.length) {
    return {
      valid: false, errors, errorDetails, totalCost, remainingBudget,
      decisionCount: input.length, categoryCounts, decisions: [],
    };
  }
  canonical.sort((a, b) => compareAscii(decisionKey(a), decisionKey(b)));
  return {
    valid: true, errors, errorDetails, totalCost: knownCost,
    remainingBudget: RULES.budget - knownCost, decisionCount: input.length,
    categoryCounts, decisions: canonical,
  };
}
