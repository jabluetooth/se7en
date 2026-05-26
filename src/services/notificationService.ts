import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── Notification appearance ───────────────────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
  }),
});

// ─── Android channel setup ─────────────────────────────────────────────────────

async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Promise.all([
    Notifications.setNotificationChannelAsync('coach-daily', {
      name:             'Daily Coach Tip',
      importance:       Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
    }),
    Notifications.setNotificationChannelAsync('se7en-pr', {
      name:             'Personal Records',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 100],
      enableLights:     true,
      lightColor:       '#FFA500',
    }),
    Notifications.setNotificationChannelAsync('se7en-rest', {
      name:             'Rest Timer',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 300, 100, 300],
    }),
    Notifications.setNotificationChannelAsync('se7en-workout-reminder', {
      name:             'Workout Reminders',
      importance:       Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
    }),
    Notifications.setNotificationChannelAsync('se7en-cycle', {
      name:             'Cycle Complete',
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 100, 100, 300],
      enableLights:     true,
      lightColor:       '#FFA500',
    }),
  ]);
}

// ─── Permissions ───────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  await ensureChannels();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function hasPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// Build a trigger that supports channelId on Android (TIME_INTERVAL 1s ≈ immediate)
function androidTrigger(channelId: string, seconds = 1): Notifications.NotificationTriggerInput {
  if (Platform.OS === 'android') {
    return {
      type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      channelId,
    } as Notifications.NotificationTriggerInput;
  }
  return null;
}

// ─── Coach daily reminder ──────────────────────────────────────────────────────

const COACH_IDENTIFIER = 'se7en-coach-daily';

export async function scheduleDailyCoachReminder(hour = 8, minute = 0): Promise<boolean> {
  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  await Notifications.cancelScheduledNotificationAsync(COACH_IDENTIFIER).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: COACH_IDENTIFIER,
    content: {
      title: 'Your coach has a tip 💪',
      body:  'Open Se7en to see your personalised training insight for today.',
      sound: false,
    },
    trigger: Platform.OS === 'android'
      ? {
          type:      Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
          channelId: 'coach-daily',
        } as Notifications.NotificationTriggerInput
      : {
          type:   Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        } as Notifications.NotificationTriggerInput,
  });

  return true;
}

export async function cancelDailyCoachReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(COACH_IDENTIFIER).catch(() => {});
}

export async function isDailyReminderScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some(n => n.identifier === COACH_IDENTIFIER);
}

// ─── 🏆 PR notification ────────────────────────────────────────────────────────
// Fire once per exercise when a personal record is broken at session end.

export async function notifyNewPR(
  exerciseName: string,
  heaviestWeight: number,
  mostReps: number,
  unit: string,
): Promise<void> {
  if (!(await hasPermission())) return;

  const bodyParts: string[] = [];
  if (unit !== 'bodyweight' && heaviestWeight > 0) bodyParts.push(`${heaviestWeight}${unit}`);
  if (mostReps > 0) bodyParts.push(`${mostReps} reps`);
  const body = bodyParts.length ? bodyParts.join(' × ') : 'New personal best!';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🏆 New PR — ${exerciseName}`,
      body,
      sound: true,
      data:  { type: 'pr', exerciseName },
    },
    trigger: androidTrigger('se7en-pr'),
  });
}

// ─── ⏱ Rest-over notification ──────────────────────────────────────────────────
// Scheduled when the rest timer starts; cancelled on skip; fires when time is up.
// Useful when the user backgrounds the app during rest.

export async function scheduleRestOverNotification(
  exerciseName: string,
  nextSetNum:   number,
  seconds:      number,
): Promise<string> {
  if (!(await hasPermission())) return '';

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏱ Rest complete — back to work!',
      body:  `Set ${nextSetNum} of ${exerciseName} is next.`,
      sound: true,
      data:  { type: 'rest-over', exerciseName },
    },
    trigger: Platform.OS === 'android'
      ? {
          type:      Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds:   Math.max(1, seconds),
          channelId: 'se7en-rest',
        } as Notifications.NotificationTriggerInput
      : {
          type:    Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, seconds),
        } as Notifications.NotificationTriggerInput,
  });

  return id;
}

export async function cancelRestOverNotification(id: string): Promise<void> {
  if (!id) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// ─── 💪 Workout reminder ───────────────────────────────────────────────────────
// Scheduled per-day at a specific calendar date + hour/minute.
// Identifier format: se7en-workout-{planId}-{slotIndex}

const WORKOUT_PREFIX = 'se7en-workout-';

export async function scheduleWorkoutReminder(
  identifier: string,
  dayLabel:   string,
  date:       Date,
  hour   = 7,
  minute = 0,
): Promise<boolean> {
  if (!(await hasPermission())) return false;

  const fireAt = new Date(date);
  fireAt.setHours(hour, minute, 0, 0);
  if (fireAt.getTime() <= Date.now()) return false;

  const notifId = `${WORKOUT_PREFIX}${identifier}`;
  await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: notifId,
    content: {
      title: `💪 ${dayLabel} today`,
      body:  "You've got a workout lined up — let's get it done.",
      sound: false,
      data:  { type: 'workout-reminder', dayLabel },
    },
    trigger: Platform.OS === 'android'
      ? {
          type:      Notifications.SchedulableTriggerInputTypes.DATE,
          date:      fireAt,
          channelId: 'se7en-workout-reminder',
        } as Notifications.NotificationTriggerInput
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
        } as Notifications.NotificationTriggerInput,
  });

  return true;
}

export async function cancelWorkoutReminders(): Promise<void> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all
      .filter(n => n.identifier.startsWith(WORKOUT_PREFIX))
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {})),
  );
}

// ─── 🔁 Cycle complete notification ───────────────────────────────────────────
// Fired from finishSession() when every non-rest day in the current cycle
// has at least one completed session.

export async function notifyCycleComplete(
  totalVolume:   number,
  totalSessions: number,
): Promise<void> {
  if (!(await hasPermission())) return;

  const volPart = totalVolume > 0
    ? ` ${totalVolume.toLocaleString()} kg lifted,`
    : '';
  const body = `${totalSessions} session${totalSessions !== 1 ? 's' : ''},${volPart} full cycle done. Keep the momentum going!`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔁 Cycle complete — great work!',
      body,
      sound: true,
      data:  { type: 'cycle-complete' },
    },
    trigger: androidTrigger('se7en-cycle'),
  });
}
