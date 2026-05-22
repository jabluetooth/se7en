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

// ─── Permissions ───────────────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('coach-daily', {
      name:       'Daily Coach Tip',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Schedule ─────────────────────────────────────────────────────────────────
// Cancels any previous coach reminder before scheduling a new one so there's
// always exactly one notification at the chosen time.

const COACH_IDENTIFIER = 'se7en-coach-daily';

export async function scheduleDailyCoachReminder(hour = 8, minute = 0): Promise<boolean> {
  const granted = await requestNotificationPermissions();
  if (!granted) return false;

  // Cancel the previous reminder (ignore errors if none exists)
  await Notifications.cancelScheduledNotificationAsync(COACH_IDENTIFIER).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: COACH_IDENTIFIER,
    content: {
      title: 'Your coach has a tip 💪',
      body:  'Open Se7en to see your personalised training insight for today.',
      sound: false,
    },
    trigger: {
      type:    Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
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
