import { WorkoutSession, SessionExercise, SetLog } from '../types';

// ─── Builders ────────────────────────────────────────────────────────────────

let uid = 1;
const id = () => `mock-${uid++}`;

function set(n: number, reps: number, weight: number): SetLog {
  return {
    id: id(), setNumber: n, targetReps: reps, targetWeight: weight,
    actualReps: reps, actualRepsToFailure: null, actualWeight: weight,
    platesUsed: [], notes: '', isCompleted: true,
    completedAt: new Date().toISOString(),
  };
}

function ex(name: string, exId: string, order: number, sets: SetLog[]): SessionExercise {
  return {
    id: id(), exerciseId: exId, exerciseName: name,
    order, setType: 'repRange', weightUnit: 'kg',
    barType: 'barbell', barWeight: 20, isCompleted: true, sets,
  };
}

function session(
  dayOfMay: number,
  dayPosition: number,
  dayLabel: string,
  volume: number,
  exercises: SessionExercise[],
): WorkoutSession {
  const date = new Date(2026, 4, dayOfMay, 18, 30); // May 2026, 6:30 PM
  return {
    id: id(), planId: 'mock-plan', dayPosition, dayLabel,
    status: 'completed',
    startedAt: new Date(date.getTime() - 55 * 60_000).toISOString(),
    finishedAt: date.toISOString(),
    duration: 55, skipReason: null, sessionNote: null,
    totalVolume: volume, prsBreached: [], exercises,
  };
}

// ─── Push exercises ───────────────────────────────────────────────────────────

function pushDay(vol: number) {
  return [
    ex('Bench Press',      'bp',   1, [set(1,8,80), set(2,8,82.5), set(3,6,85),  set(4,6,85)]),
    ex('Overhead Press',   'ohp',  2, [set(1,8,50), set(2,8,50),   set(3,7,52.5)]),
    ex('Incline DB Press', 'idp',  3, [set(1,10,30),set(2,10,30),  set(3,9,32.5)]),
    ex('Tricep Pushdown',  'tpd',  4, [set(1,12,25),set(2,12,25),  set(3,12,27.5)]),
  ];
}
function pullDay() {
  return [
    ex('Pull-ups',         'pu',   1, [set(1,8,0),  set(2,7,0),   set(3,6,0),  set(4,6,0)]),
    ex('Barbell Row',      'bbr',  2, [set(1,8,70), set(2,8,72.5),set(3,7,75)]),
    ex('Face Pull',        'fp',   3, [set(1,15,20),set(2,15,20), set(3,15,20)]),
    ex('Bicep Curl',       'bc',   4, [set(1,12,18),set(2,11,18), set(3,10,20)]),
  ];
}
function legsDay() {
  return [
    ex('Back Squat',          'sq',  1, [set(1,5,100),set(2,5,102.5),set(3,5,105),set(4,4,107.5)]),
    ex('Romanian Deadlift',   'rdl', 2, [set(1,8,80), set(2,8,82.5), set(3,8,85)]),
    ex('Leg Press',           'lp',  3, [set(1,12,120),set(2,12,120),set(3,10,130)]),
    ex('Nordic Curl',         'nc',  4, [set(1,6,0),  set(2,5,0),   set(3,5,0)]),
  ];
}
function upperPushDay() {
  return [
    ex('Incline Bench',    'ib',   1, [set(1,8,70), set(2,8,72.5),set(3,7,75)]),
    ex('Arnold Press',     'ap',   2, [set(1,10,22.5),set(2,10,24),set(3,9,24)]),
    ex('Cable Fly',        'cf',   3, [set(1,12,15),set(2,12,15), set(3,12,17.5)]),
    ex('Skull Crushers',   'sc',   4, [set(1,10,30),set(2,10,32.5),set(3,9,32.5)]),
  ];
}
function upperPullDay() {
  return [
    ex('Lat Pulldown',     'lpd',  1, [set(1,10,65),set(2,10,67.5),set(3,9,70)]),
    ex('Seated Cable Row', 'scr',  2, [set(1,10,60),set(2,10,62.5),set(3,10,65)]),
    ex('Rear Delt Fly',    'rdf',  3, [set(1,15,12),set(2,15,12), set(3,15,14)]),
    ex('Hammer Curl',      'hc',   4, [set(1,12,18),set(2,12,18), set(3,11,20)]),
  ];
}
function lowerDay() {
  return [
    ex('Deadlift',         'dl',   1, [set(1,5,120),set(2,5,122.5),set(3,3,127.5)]),
    ex('Bulgarian Split Squat','bss',2,[set(1,8,40), set(2,8,42.5), set(3,7,42.5)]),
    ex('Leg Curl',         'lc',   3, [set(1,12,45),set(2,12,45), set(3,10,50)]),
    ex('Calf Raise',       'cr',   4, [set(1,15,60),set(2,15,65), set(3,15,65)]),
  ];
}

// ─── May 2026 sessions ────────────────────────────────────────────────────────
// Roughly 3–4x / week PPL-style, with realistic volume variation.

export const MOCK_CALENDAR_SESSIONS: WorkoutSession[] = [
  // Week 1 (May 1–3)
  session(1, 1, 'Push Day',       3180, pushDay(3180)),
  session(2, 2, 'Pull Day',       2640, pullDay()),
  session(3, 3, 'Leg Day',        3520, legsDay()),

  // Week 2 (May 5–10)
  session(5, 4, 'Upper Push',     2280, upperPushDay()),
  session(6, 5, 'Upper Pull',     2140, upperPullDay()),
  session(8, 1, 'Push Day',       2970, pushDay(2970)),
  session(9, 2, 'Pull Day',       2420, pullDay()),
  session(10, 3, 'Leg Day',       2880, legsDay()),

  // Week 3 (May 12–17) — current week, today is 11th
  session(12, 4, 'Upper Push',    1960, upperPushDay()),
  session(13, 5, 'Upper Pull',    2310, upperPullDay()),
  session(15, 1, 'Push Day',      3400, pushDay(3400)),  // high volume PR week
  session(16, 6, 'Lower Day',     3060, lowerDay()),
  session(17, 3, 'Leg Day',       1820, legsDay()),       // deload feel

  // Week 4 (May 19–24)
  session(19, 2, 'Pull Day',      2750, pullDay()),
  session(20, 4, 'Upper Push',    2450, upperPushDay()),
  session(22, 5, 'Upper Pull',    2200, upperPullDay()),
  session(23, 1, 'Push Day',      2680, pushDay(2680)),
  session(24, 6, 'Lower Day',     2900, lowerDay()),

  // Week 5 (May 26–31)
  session(26, 3, 'Leg Day',       3150, legsDay()),
  session(27, 2, 'Pull Day',      2580, pullDay()),
  session(29, 1, 'Push Day',      2840, pushDay(2840)),
  session(30, 5, 'Upper Pull',    2070, upperPullDay()),
];
