import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Medication } from '@/types/meds';
import { logError } from '@/utils/errorLogger';

// Set the foreground handler ONCE at module load
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowAlert: true,
  }),
});

async function registerPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    });
    console.log('[Notifications] Expo Push Token:', token.data);
    
    const backendUrl = Constants.expoConfig?.extra?.backendUrl;
    if (!backendUrl) throw new Error('backendUrl not configured');

    // Note: In a real app, we'd get the deviceId from UserContext or storage
    // For now, we assume it's sent in the header via a wrapper or handled by the API
    const storage = await import('./storage');
    const deviceId = await storage.getDeviceId();

    await fetch(`${backendUrl}/api/devices/token`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-device-id': deviceId || 'unknown', 
      },
      body: JSON.stringify({ push_token: token.data }),
    });

    return token.data;
  } catch (err) {
    logError(err, { context: 'notifications.registerPushToken' });
    return null;
  }
}

export async function ensurePermissionsAndChannel(): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.log('[Notifications] Web platform — skipping permissions');
    return false;
  }
  try {
    console.log('[Notifications] ensurePermissionsAndChannel');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('med-reminders', {
        name: 'Medication Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
      });
      console.log('[Notifications] Android channel created');
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      console.log('[Notifications] Requesting permissions');
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowSound: true,
          allowBadge: true,
        },
      });
      finalStatus = status;
    }

    const granted = finalStatus === 'granted';
    console.log('[Notifications] Permission status:', finalStatus, 'granted:', granted);
    if (granted) {
      await registerPushToken();
    }
    return granted;
  } catch (err) {
    logError(err, { context: 'notifications.ensurePermissionsAndChannel' });
    return false;
  }
}

export async function cancelMedNotifications(medicationId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    console.log('[Notifications] cancelMedNotifications for med:', medicationId);
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled.filter(
      (n) => n.content.data?.medicationId === medicationId
    );
    await Promise.all(toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    console.log('[Notifications] Cancelled', toCancel.length, 'notifications for med:', medicationId);
  } catch (err) {
    logError(err, { context: 'notifications.cancelMedNotifications', medicationId });
  }
}

export async function cancelAllMedNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    console.log('[Notifications] cancelAllMedNotifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('[Notifications] All scheduled notifications cancelled');
  } catch (err) {
    logError(err, { context: 'notifications.cancelAllMedNotifications' });
  }
}

/**
 * Fetches an AI-generated snarky notification body from the backend.
 * Throws on any error — caller is responsible for falling back.
 */
async function fetchSnarkBody(name: string, medName: string, dosage: string): Promise<string> {
  const backendUrl = Constants.expoConfig?.extra?.backendUrl as string | undefined;
  if (!backendUrl) {
    throw new Error('[Notifications] backendUrl not configured in app.json extra');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  console.log('[Notifications] fetchSnarkBody — POST /api/snark/generate for med:', medName);

  try {
    const response = await fetch(`${backendUrl}/api/snark/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, medName, dosage }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`[Notifications] /api/snark/generate returned ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json() as { body?: string };
    const body = (data.body ?? '').trim();

    if (!body) {
      throw new Error('[Notifications] /api/snark/generate returned empty body');
    }

    console.log('[Notifications] fetchSnarkBody — received snark for med:', medName);
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Offline fallback: picks a random snarky body from hardcoded templates.
 */
function pickSnarkyBody(name: string, medName: string, dosage: string): string {
  const n = name || 'you';
  const dose = dosage ? ` (${dosage})` : '';

  const templates = [
    `Hey ${n}, your${dose} ${medName} isn't going to take itself.`,
    `${n}, the pills are calling. Answer.`,
    `Don't make me come over there, ${n}. Take your ${medName}.`,
    `${n}, this is your ${medName} reminder. Yes, again.`,
    `Time for ${medName}. Resistance is futile, ${n}.`,
    `Skipping doesn't make you tough, ${n}. Take the ${medName}.`,
    `${n}, ${medName} o'clock. Move it.`,
    `Tick tock, ${n}. ${medName} time.`,
    `Your future self thanks you for taking ${medName}, ${n}.`,
    `Pop quiz, ${n}: did you take your ${medName}? Correct answer: do it now.`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

export async function scheduleMedNotifications(
  med: Medication,
  userName: string | null
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    console.log('[Notifications] scheduleMedNotifications for med:', med.name, 'times:', med.times);

    // Always cancel existing notifications for this med first
    await cancelMedNotifications(med.id);

    // Skip as-needed meds or meds with no times
    if (med.frequency === 'as_needed' || !med.times || med.times.length === 0) {
      console.log('[Notifications] Skipping as-needed or no-times med:', med.name);
      return;
    }

    const name = userName ?? 'you';
    const dosage = med.dosage ?? '';

    // Fetch a unique snark body for each scheduled time in parallel
    console.log('[Notifications] Fetching snark bodies for', med.times.length, 'scheduled time(s)');
    const snarkResults = await Promise.allSettled(
      med.times.map(() => fetchSnarkBody(name, med.name, dosage))
    );

    for (let i = 0; i < med.times.length; i++) {
      const timeStr = med.times[i];
      try {
        const parts = timeStr.split(':');
        const hour = parseInt(parts[0], 10);
        const minute = parseInt(parts[1], 10);

        if (isNaN(hour) || isNaN(minute)) {
          console.warn('[Notifications] Invalid time format:', timeStr);
          continue;
        }

        const snarkResult = snarkResults[i];
        let body: string;
        if (snarkResult.status === 'fulfilled') {
          body = snarkResult.value;
          console.log('[Notifications] Using AI snark for', med.name, 'at', timeStr);
        } else {
          console.error('[Notifications] fetchSnarkBody failed, using fallback:', snarkResult.reason);
          body = pickSnarkyBody(name, med.name, dosage);
          console.log('[Notifications] Using fallback snark for', med.name, 'at', timeStr);
        }

        const content: Notifications.NotificationContentInput = {
          title: `Time for ${med.name}`,
          body,
          data: { medicationId: med.id, scheduledTime: timeStr },
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: 'med-reminders' } : {}),
        };

        const trigger: Notifications.DailyTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        };

        const id = await Notifications.scheduleNotificationAsync({ content, trigger });
        console.log('[Notifications] Scheduled daily notification', id, 'for', med.name, 'at', timeStr);
      } catch (err) {
        logError(err, { context: 'notifications.scheduleMedNotifications.single', medId: med.id, timeStr });
      }
    }
  } catch (err) {
    logError(err, { context: 'notifications.scheduleMedNotifications', medId: med.id });
  }
}

export async function rescheduleAll(
  meds: Medication[],
  userName: string | null
): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    console.log('[Notifications] rescheduleAll for', meds.length, 'meds');
    await cancelAllMedNotifications();
    await Promise.all(meds.map((med) => scheduleMedNotifications(med, userName)));
    console.log('[Notifications] rescheduleAll complete');
  } catch (err) {
    logError(err, { context: 'notifications.rescheduleAll' });
  }
}
