import { eq, and, gte } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { generateText } from 'ai';
import { openrouter } from '../utils/ai.js';

export async function dispatchDueNotifications(app: App) {
  app.logger.info('Checking for due notifications...');

  const allMeds = await app.db.select().from(schema.medications);
  
  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${currentHour}:${currentMinute}`;

  for (const med of allMeds) {
    const times = JSON.parse(med.times as string);
    
    // 1. Check for primary due notifications
    if (times.includes(currentTime)) {
      await sendPush(app, med, 'primary');
    }

    // 2. Check for 15-minute follow-up reminders
    // Calculate the time 15 minutes ago to see if it matches a scheduled dose
    const fifteenMinsAgo = new Date(now.getTime() - 15 * 60 * 1000);
    const prevHour = String(fifteenMinsAgo.getHours()).padStart(2, '0');
    const prevMinute = String(fifteenMinsAgo.getMinutes()).padStart(2, '0');
    const prevTime = `${prevHour}:${prevMinute}`;

    if (times.includes(prevTime)) {
      // Check if this specific dose was already taken today
      const today = now.toISOString().slice(0, 10);
      const doseTaken = await app.db
        .select()
        .from(schema.dose_logs)
        .where(
          and(
            eq(schema.dose_logs.medication_id, med.id),
            eq(schema.dose_logs.scheduled_time, prevTime),
            gte(schema.dose_logs.taken_at, new Date(today))
          )
        )
        .limit(1);

      if (doseTaken.length === 0) {
        app.logger.info({ medName: med.name, userId: med.user_id }, 'Sending 15m follow-up reminder!');
        await sendPush(app, med, 'followup');
      }
    }
  }
}

async function sendPush(app: App, med: any, type: 'primary' | 'followup') {
  const devices = await app.db
    .select()
    .from(schema.devices)
    .where(eq(schema.devices.user_id, med.user_id));

  if (devices.length === 0) return;

  const logs = await app.db
    .select()
    .from(schema.dose_logs)
    .where(eq(schema.dose_logs.medication_id, med.id));

  try {
    const systemPrompt = type === 'primary' 
      ? 'You are a snarky, witty medication reminder. You know the user is due for their dose RIGHT NOW. Be playful, a bit mean, but affectionate. Keep it under 120 chars. No emojis.'
      : 'You are a savage medication reminder. The user has IGNORED their reminder for 15 minutes. Be significantly meaner, more disappointed, and a bit more aggressive, but still a bit affectionate. Keep it under 120 chars. No emojis.';

    const { text } = await generateText({
      model: openrouter('gpt-4o-mini'),
      system: systemPrompt,
      prompt: `The user is due for ${med.name} (${med.dosage}). Context: They have taken ${logs.length} doses of this in the past. ${type === 'followup' ? 'They already ignored the first notification.' : ''} Write a push notification body.`,
    });

    const pushPromises = devices
      .filter(d => d.push_token)
      .map(device => fetch('https://exp.exponent.dev/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: device.push_token,
          title: type === 'primary' ? `💊 ${med.name}` : `⚠️ ${med.name} OVERDUE`,
          body: text,
          data: { medicationId: med.id },
        }),
      }));

    await Promise.all(pushPromises);
  } catch (error) {
    app.logger.error({ err: error, medName: med.name }, 'Failed to send AI notification');
  }
}
