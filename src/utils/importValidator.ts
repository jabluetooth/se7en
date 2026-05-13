import { ImportPlan, ImportDay, ImportExercise } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  plan?: ImportPlan;
}

const VALID_SET_TYPES = ['standard', 'repRange', 'toFailure', 'superset', 'dropSet', 'pyramid', 'progressive'];
const VALID_WEIGHT_UNITS = ['kg', 'lb', 'plates', 'bodyweight'];
const VALID_BAR_TYPES = ['barbell', 'ezbar', 'smith', 'dumbbell', 'custom', 'none'];

export function validateImportJSON(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return { valid: false, errors: ['Root must be a JSON object'], warnings };
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.planName !== 'string' || !obj.planName) {
    errors.push('Missing required field: planName');
  } else if (obj.planName.length > 100) {
    errors.push('planName must be 100 characters or fewer');
  }

  if (typeof obj.splitType === 'string' && obj.splitType.length > 50) {
    errors.push('splitType must be 50 characters or fewer');
  }

  if (!Array.isArray(obj.days)) {
    errors.push('Missing required field: days (must be array)');
    return { valid: false, errors, warnings };
  }

  const days = obj.days as unknown[];
  if (days.length === 0 || days.length > 7) {
    errors.push('days must contain 1–7 entries');
  }

  days.forEach((day: unknown, di: number) => {
    if (typeof day !== 'object' || day === null) {
      errors.push(`Day ${di + 1}: must be an object`);
      return;
    }
    const d = day as Record<string, unknown>;
    if (typeof d.dayPosition !== 'number' || d.dayPosition < 1 || d.dayPosition > 7) {
      errors.push(`Day ${di + 1}: dayPosition must be 1–7`);
    }
    if (typeof d.label !== 'string') {
      warnings.push(`Day ${di + 1}: missing label, defaulting to "Day ${d.dayPosition}"`);
      d.label = `Day ${d.dayPosition}`;
    } else if (d.label.length > 50) {
      errors.push(`Day ${di + 1}: label must be 50 characters or fewer`);
    }

    if (!Array.isArray(d.exercises)) {
      d.exercises = [];
    }
    const names = new Set<string>();
    (d.exercises as unknown[]).forEach((ex: unknown, ei: number) => {
      if (typeof ex !== 'object' || ex === null) {
        errors.push(`Day ${di + 1}, Exercise ${ei + 1}: must be object`);
        return;
      }
      const e = ex as Record<string, unknown>;
      if (typeof e.name !== 'string' || !e.name) {
        errors.push(`Day ${di + 1}, Exercise ${ei + 1}: missing name`);
      } else if (e.name.length > 100) {
        errors.push(`Day ${di + 1}, Exercise ${ei + 1}: name must be 100 characters or fewer`);
      }
      if (names.has(e.name as string)) {
        warnings.push(`Day ${di + 1}: duplicate exercise name "${e.name}"`);
      }
      names.add(e.name as string);
      if (!VALID_SET_TYPES.includes(e.setType as string)) {
        errors.push(`Day ${di + 1}, "${e.name}": invalid setType "${e.setType}"`);
      }
      if (!VALID_WEIGHT_UNITS.includes(e.weightUnit as string)) {
        warnings.push(`Day ${di + 1}, "${e.name}": invalid weightUnit, defaulting to "kg"`);
        e.weightUnit = 'kg';
      }
      if (!VALID_BAR_TYPES.includes(e.barType as string)) {
        warnings.push(`Day ${di + 1}, "${e.name}": invalid barType, defaulting to "none"`);
        e.barType = 'none';
      }
      if (typeof e.targetSets === 'number' && (e.targetSets < 1 || e.targetSets > 20)) {
        errors.push(`Day ${di + 1}, "${e.name}": targetSets must be 1–20`);
      }
      if (typeof e.targetRepsMin === 'number' && (e.targetRepsMin < 1 || e.targetRepsMin > 100)) {
        errors.push(`Day ${di + 1}, "${e.name}": targetRepsMin must be 1–100`);
      }
      if (typeof e.targetRepsMax === 'number' && (e.targetRepsMax < 1 || e.targetRepsMax > 100)) {
        errors.push(`Day ${di + 1}, "${e.name}": targetRepsMax must be 1–100`);
      }
      if (typeof e.targetWeight === 'number' && (e.targetWeight < 0 || e.targetWeight > 9999)) {
        errors.push(`Day ${di + 1}, "${e.name}": targetWeight must be 0–9999`);
      }
      if (typeof e.notes === 'string' && e.notes.length > 500) {
        warnings.push(`Day ${di + 1}, "${e.name}": notes truncated to 500 characters`);
        e.notes = (e.notes as string).slice(0, 500);
      }
      if (e.toFailure && (e.targetRepsMin !== null || e.targetRepsMax !== null)) {
        warnings.push(`Day ${di + 1}, "${e.name}": toFailure=true, rep targets ignored`);
        e.targetRepsMin = null;
        e.targetRepsMax = null;
      }
    });
  });

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  return {
    valid: true,
    errors,
    warnings,
    plan: {
      planName: obj.planName as string,
      splitType: (obj.splitType as string) ?? 'Custom',
      days: obj.days as ImportDay[],
    },
  };
}
