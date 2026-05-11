// ─── Settings ────────────────────────────────────────────────────────────────
export type WeightUnit = 'kg' | 'lb' | 'plates' | 'bodyweight';
export type Theme = 'dark' | 'light';
export type BackupFrequency = 'daily' | 'weekly';

export interface Settings {
  availablePlates: number[];
  theme: Theme;
  autoBackup: boolean;
  backupFrequency: BackupFrequency;
  lastBackupDate: string | null;
  activePlanId: string | null;
  currentDayPosition: number; // 1–7
  createdAt: string;
}

// ─── Onboarding Profile ───────────────────────────────────────────────────────
export type UserGoal = 'muscle' | 'strength' | 'weightloss' | 'general';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type EquipmentType = 'full_gym' | 'home_gym' | 'bodyweight';

export interface UserProfile {
  goal: UserGoal;
  experience: ExperienceLevel;
  daysPerWeek: number;
  equipment: EquipmentType;
}

// ─── Exercise Library ─────────────────────────────────────────────────────────
export interface ExerciseLibraryItem {
  id: string;
  name: string;
  muscleGroup: string;
  muscleTags?: string[];
  equipment: EquipmentType | 'any';
  defaultSets: number;
  defaultRepsMin: number;
  defaultRepsMax: number;
  defaultWeight: number;
  defaultUnit: 'kg' | 'lb' | 'bodyweight';
  barType: BarType;
  setType: SetType;
}

// ─── Plan Templates ───────────────────────────────────────────────────────────
export interface PlanTemplateExercise {
  exerciseId: string;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeight: number | null;
  weightUnit: WeightUnit;
  barType: BarType;
  toFailure: boolean;
  setType: SetType;
  notes: string;
}

export interface PlanTemplateDay {
  dayPosition: number;
  label: string;
  isRestDay: boolean;
  exercises: PlanTemplateExercise[];
}

export interface PlanTemplate {
  id: string;
  name: string;
  splitType: string;
  description: string;
  tags: {
    experience: ExperienceLevel[];
    goal: UserGoal[];
    daysPerWeek: number;
    equipment: EquipmentType[];
  };
  days: PlanTemplateDay[];
}

// ─── Set Types ────────────────────────────────────────────────────────────────
export type SetType =
  | 'standard'
  | 'repRange'
  | 'toFailure'
  | 'superset'
  | 'dropSet'
  | 'pyramid'
  | 'progressive';

export type BarType = 'barbell' | 'ezbar' | 'smith' | 'dumbbell' | 'custom' | 'none';

// ─── Plan / Template ──────────────────────────────────────────────────────────
export interface PerSetTarget {
  setNumber: number;
  targetReps: number;
  targetWeight: number;
}

export interface Exercise {
  id: string;
  name: string;
  order: number;
  setType: SetType;
  supersetGroup: string | null;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  toFailure: boolean;
  targetWeight: number | null;
  weightUnit: WeightUnit;
  barType: BarType;
  barWeight: number;
  perSetTargets: PerSetTarget[] | null;
  notes: string;
  createdAt: string;
  muscleTags?: string[]; // body-part labels e.g. ['Chest','Triceps']
}

export interface WorkoutDay {
  id: string;
  dayPosition: number; // 1–7
  label: string;
  isRestDay: boolean;
  exercises: Exercise[];
}

export interface WorkoutPlan {
  id: string;
  name: string;
  splitType: string;
  description: string;
  createdAt: string;
  isActive: boolean;
  days: WorkoutDay[];
}

// ─── Session / Log ────────────────────────────────────────────────────────────
export type SessionStatus = 'completed' | 'missed' | 'partial';
export type SkipReason = 'Sick' | 'Travel' | 'Rest' | 'Other';

export interface SetLog {
  id: string;
  setNumber: number;
  targetReps: number | null;
  targetWeight: number | null;
  actualReps: number;
  actualRepsToFailure: number | null;
  actualWeight: number | null;
  platesUsed: number[];
  notes: string;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface SessionExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  order: number;
  setType: SetType;
  weightUnit: WeightUnit;
  barType: BarType;
  barWeight: number;
  isCompleted: boolean;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  planId: string;
  dayPosition: number;
  dayLabel: string;
  status: SessionStatus;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number; // minutes
  skipReason: SkipReason | null;
  sessionNote: string | null;
  totalVolume: number;
  prsBreached: string[];
  exercises: SessionExercise[];
}

// ─── Personal Records ─────────────────────────────────────────────────────────
export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  heaviestWeight: number;
  heaviestWeightDate: string;
  mostReps: number;
  mostRepsDate: string;
  highestVolume: number;
  highestVolumeDate: string;
  updatedAt: string;
}

// ─── Backup ───────────────────────────────────────────────────────────────────
export interface Backup {
  id: string;
  createdAt: string;
  type: 'auto' | 'manual';
  storageUrl: string;
  sizeBytes: number;
}

// ─── Plate Calculator ─────────────────────────────────────────────────────────
export interface PlateCalcResult {
  platesPerSide: number[];
  totalAchieved: number;
  warning: boolean;
}

// ─── Import JSON Schema ───────────────────────────────────────────────────────
export interface ImportExercise {
  name: string;
  order: number;
  setType: SetType;
  targetSets: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  toFailure: boolean;
  targetWeight: number | null;
  weightUnit: WeightUnit;
  barType: BarType;
  barWeight: number;
  notes?: string;
  perSetTargets?: PerSetTarget[];
}

export interface ImportDay {
  dayPosition: number;
  label: string;
  isRestDay: boolean;
  exercises: ImportExercise[];
}

export interface ImportPlan {
  planName: string;
  splitType: string;
  days: ImportDay[];
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface ExerciseHistoryPoint {
  date: string;
  weight: number;
  reps: number;
  volume: number;
  sessionId: string;
}

export interface ExerciseAnalytics {
  exerciseName: string;
  history: ExerciseHistoryPoint[];
  allTimeMaxWeight: number;
  allTimeMaxReps: number;
  allTimeMaxVolume: number;
}
