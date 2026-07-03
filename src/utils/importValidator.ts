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

  const sanitizedDays: ImportDay[] = [];
  const seenDayPositions = new Set<number>();

  days.forEach((day: unknown, di: number) => {
    if (typeof day !== 'object' || day === null) {
      errors.push(`Day ${di + 1}: must be an object`);
      return;
    }
    const d = day as Record<string, unknown>;

    let dayPosition = typeof d.dayPosition === 'number' ? d.dayPosition : NaN;
    if (typeof d.dayPosition !== 'number' || dayPosition < 1 || dayPosition > 7 || !Number.isInteger(dayPosition)) {
      errors.push(`Day ${di + 1}: dayPosition must be an integer 1–7`);
    } else if (seenDayPositions.has(dayPosition)) {
      errors.push(`Day ${di + 1}: duplicate dayPosition ${dayPosition} (already used by another day)`);
    } else {
      seenDayPositions.add(dayPosition);
    }

    let label: string;
    if (typeof d.label !== 'string') {
      warnings.push(`Day ${di + 1}: missing label, defaulting to "Day ${dayPosition}"`);
      label = `Day ${dayPosition}`;
    } else if (d.label.length > 50) {
      errors.push(`Day ${di + 1}: label must be 50 characters or fewer`);
      label = d.label.slice(0, 50);
    } else {
      label = d.label;
    }

    const isRestDay = !!d.isRestDay;
    const rawExercises = Array.isArray(d.exercises) ? d.exercises : [];
    const names = new Set<string>();
    const sanitizedExercises: ImportExercise[] = [];

    rawExercises.forEach((ex: unknown, ei: number) => {
      if (typeof ex !== 'object' || ex === null) {
        errors.push(`Day ${di + 1}, Exercise ${ei + 1}: must be object`);
        return;
      }
      const e = ex as Record<string, unknown>;

      let name = '';
      if (typeof e.name !== 'string' || !e.name) {
        errors.push(`Day ${di + 1}, Exercise ${ei + 1}: missing name`);
      } else if (e.name.length > 100) {
        errors.push(`Day ${di + 1}, Exercise ${ei + 1}: name must be 100 characters or fewer`);
      } else {
        name = e.name;
        if (names.has(name)) {
          warnings.push(`Day ${di + 1}: duplicate exercise name "${name}"`);
        }
        names.add(name);
      }

      const setType = VALID_SET_TYPES.includes(e.setType as string) ? (e.setType as ImportExercise['setType']) : null;
      if (!setType) {
        errors.push(`Day ${di + 1}, "${name || `Exercise ${ei + 1}`}": invalid setType "${e.setType}"`);
      }

      let weightUnit = e.weightUnit as ImportExercise['weightUnit'];
      if (!VALID_WEIGHT_UNITS.includes(weightUnit as string)) {
        warnings.push(`Day ${di + 1}, "${name}": invalid weightUnit, defaulting to "kg"`);
        weightUnit = 'kg';
      }

      let barType = e.barType as ImportExercise['barType'];
      if (!VALID_BAR_TYPES.includes(barType as string)) {
        warnings.push(`Day ${di + 1}, "${name}": invalid barType, defaulting to "none"`);
        barType = 'none';
      }

      const targetSets = typeof e.targetSets === 'number' ? e.targetSets : NaN;
      if (typeof e.targetSets !== 'number' || !Number.isInteger(targetSets) || targetSets < 1 || targetSets > 20) {
        errors.push(`Day ${di + 1}, "${name}": targetSets is required and must be an integer 1–20`);
      }

      let targetRepsMin = typeof e.targetRepsMin === 'number' ? e.targetRepsMin : null;
      if (targetRepsMin !== null && (targetRepsMin < 1 || targetRepsMin > 100)) {
        errors.push(`Day ${di + 1}, "${name}": targetRepsMin must be 1–100`);
      }
      let targetRepsMax = typeof e.targetRepsMax === 'number' ? e.targetRepsMax : null;
      if (targetRepsMax !== null && (targetRepsMax < 1 || targetRepsMax > 100)) {
        errors.push(`Day ${di + 1}, "${name}": targetRepsMax must be 1–100`);
      }
      const targetWeight = typeof e.targetWeight === 'number' ? e.targetWeight : null;
      if (targetWeight !== null && (targetWeight < 0 || targetWeight > 9999)) {
        errors.push(`Day ${di + 1}, "${name}": targetWeight must be 0–9999`);
      }
      let notes = typeof e.notes === 'string' ? e.notes : '';
      if (notes.length > 500) {
        warnings.push(`Day ${di + 1}, "${name}": notes truncated to 500 characters`);
        notes = notes.slice(0, 500);
      }

      const toFailure = !!e.toFailure;
      if (toFailure) {
        if (targetRepsMin !== null || targetRepsMax !== null) {
          warnings.push(`Day ${di + 1}, "${name}": toFailure=true, rep targets ignored`);
        }
        targetRepsMin = null;
        targetRepsMax = null;
      }

      // perSetTargets: each entry's setNumber must be within 1..targetSets and
      // its reps/weight must be finite numbers — otherwise buildExercises()
      // downstream would build a set from a garbage per-set override.
      let perSetTargets: ImportExercise['perSetTargets'];
      if (e.perSetTargets !== undefined) {
        if (!Array.isArray(e.perSetTargets)) {
          errors.push(`Day ${di + 1}, "${name}": perSetTargets must be an array`);
        } else {
          const validated: NonNullable<ImportExercise['perSetTargets']> = [];
          e.perSetTargets.forEach((pt: unknown, pi: number) => {
            if (typeof pt !== 'object' || pt === null) {
              errors.push(`Day ${di + 1}, "${name}": perSetTargets[${pi}] must be an object`);
              return;
            }
            const p = pt as Record<string, unknown>;
            const setNumber = p.setNumber;
            const ptReps    = p.targetReps;
            const ptWeight  = p.targetWeight;
            if (typeof setNumber !== 'number' || !Number.isInteger(setNumber) ||
                setNumber < 1 || (Number.isFinite(targetSets) && setNumber > targetSets)) {
              errors.push(`Day ${di + 1}, "${name}": perSetTargets[${pi}].setNumber must be an integer within 1–targetSets`);
              return;
            }
            if (typeof ptReps !== 'number' || !Number.isFinite(ptReps)) {
              errors.push(`Day ${di + 1}, "${name}": perSetTargets[${pi}].targetReps must be a number`);
              return;
            }
            if (typeof ptWeight !== 'number' || !Number.isFinite(ptWeight)) {
              errors.push(`Day ${di + 1}, "${name}": perSetTargets[${pi}].targetWeight must be a number`);
              return;
            }
            validated.push({ setNumber, targetReps: ptReps, targetWeight: ptWeight });
          });
          perSetTargets = validated;
        }
      }

      const order = typeof e.order === 'number' && Number.isFinite(e.order) ? e.order : ei;
      // barWeight is re-derived from barType downstream in planStore.importPlan()
      // (BAR_WEIGHTS[barType]); pass through a validated number here only as a
      // best-effort value, it isn't relied upon.
      const barWeight = typeof e.barWeight === 'number' && Number.isFinite(e.barWeight) ? e.barWeight : 0;
      sanitizedExercises.push({
        name, order, setType: (setType ?? 'standard') as ImportExercise['setType'],
        targetSets: Number.isFinite(targetSets) ? targetSets : 1,
        targetRepsMin, targetRepsMax, toFailure,
        targetWeight, weightUnit, barType, barWeight,
        notes: notes || undefined,
        perSetTargets,
      });
    });

    sanitizedDays.push({
      dayPosition: Number.isFinite(dayPosition) ? dayPosition : di + 1,
      label, isRestDay,
      exercises: sanitizedExercises,
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
      days: sanitizedDays,
    },
  };
}
