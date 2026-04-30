import { PlateCalcResult } from '../types';

export function calculatePlates(
  targetWeight: number,
  barWeight: number,
  availablePlates: number[],
): PlateCalcResult {
  const sorted = [...availablePlates].sort((a, b) => b - a);
  const perSideTarget = (targetWeight - barWeight) / 2;

  if (perSideTarget <= 0) {
    return { platesPerSide: [], totalAchieved: barWeight, warning: targetWeight !== barWeight };
  }

  let remaining = perSideTarget;
  const platesPerSide: number[] = [];

  for (const plate of sorted) {
    while (remaining >= plate - 0.001) {
      platesPerSide.push(plate);
      remaining -= plate;
    }
  }

  const totalAchieved = barWeight + platesPerSide.reduce((sum, p) => sum + p, 0) * 2;
  const warning = Math.abs(totalAchieved - targetWeight) > 0.01;

  return { platesPerSide, totalAchieved, warning };
}
