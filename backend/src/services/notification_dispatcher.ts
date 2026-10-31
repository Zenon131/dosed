import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { generateText } from 'ai';
import { openrouter } from '../utils/ai.js';

export async function dispatchDueNotifications(app: App) {
  app.logger.info('Checking for due notifications...');

  // 1. Find all medications that have scheduled times
  const allMeds = await app.db.select().from(schema.medications);
  
  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;

  for (const med of allMeds) {
    const times = JSON.parse(med.times as string);
    if (times.includes(currentTime)) {
      app.logger.info({ medName: med.name, userId: med.user_id }, 'Medication dose due now!');

      // 2. Fetch all devices for this user to send push notifications
      const devices = await app.db
        .select()
        .from(schema.devices)
        .where(eq(schema.devices.user_id, med.user_id));

      if (devices.length === 0) {
        app.logger.warn({ userId: med.user_id }, 'No devices found for user, skipping');
        continue;
      }

      // 3. Contextual AI Generation (Once per medication, not per device)
      const logs = await app.db
        .select()
        .from(schema.dose_logs)
        .where(eq(schema.dose_logs.medication_id, med.id));

      try {
        const { text } = await generateText({
          model: openrouter('gpt-4o-mini'),
          system: 'You are a snarky, witty medication reminder. You know the user is due for their dose RIGHT NOW. Be playful, a bit mean, but affectionate. Keep it under 120 chars. No emojis.',
          prompt: `The user is due for ${med.name} (${med.dosage}). Context: They have taken ${logs.length} doses of this in the past. Write a push notification body.`,
        });

        // 4. Send Push Notifications to all registered devices
        const pushPromises = devices
          .filter(d => d.push_token)
          .map(device => fetch('https://exp.exponent.dev/push/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: device.push_token,
              title: `💊 ${med.name}`,
              body: text,
              data: { medicationId: med.id },
            }),
          }));

        await Promise.all(pushPromises);
        app.logger.info({ medName: med.name, deviceCount: devices.length }, 'Push notifications sent successfully');
      } catch (error) {
        app.logger.error({ err: error, medName: med.name }, 'Failed to send AI notification');
      }
    }
  }
}
