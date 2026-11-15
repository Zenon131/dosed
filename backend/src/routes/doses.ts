import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt, count } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { randomUUID } from 'crypto';

interface CreateDoseBody {
  id?: string;
  medication_id: string;
  scheduled_time?: string | null;
  taken_at?: string;
}

function getUserId(request: FastifyRequest): string | null {
  return (request.headers['x-user-id'] as string) || (request.headers['x-device-id'] as string) || null;
}

function parseDoseLog(log: any) {
  return {
    id: log.id,
    medication_id: log.medication_id,
    scheduled_time: log.scheduled_time,
    taken_at: log.taken_at instanceof Date ? log.taken_at.toISOString() : log.taken_at,
    created_at: log.created_at instanceof Date ? log.created_at.toISOString() : log.created_at,
  };
}

// Helper to calculate 7-day adherence
async function checkAndSendAdherenceWarning(app: App, userId: string) {
  const allMeds = await app.db
    .select()
    .from(schema.medications)
    .where(eq(schema.medications.user_id, userId));

  const now = new Date();
  let totalExpected = 0;
  let totalTaken = 0;

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    for (const med of allMeds) {
      if (med.frequency === 'as_needed') continue;
      const createdDate = med.created_at instanceof Date 
        ? med.created_at.toISOString().slice(0, 10) 
        : String(med.created_at).slice(0, 10);
      
      if (createdDate <= dateStr) {
        // Map frequency to count (assuming these constants match frontend)
        const counts: Record<string, number> = { 'once_daily': 1, 'twice_daily': 2, 'three_times_daily': 3, 'four_times_daily': 4 };
        totalExpected += counts[med.frequency as string] || 0;
      }
    }

    const takenCountResult = await app.db
      .select({ count: count() })
      .from(schema.dose_logs)
      .where(
        and(
          eq(schema.dose_logs.user_id, userId),
          gte(schema.dose_logs.taken_at, new Date(dateStr)),
          lt(schema.dose_logs.taken_at, new Date(new Date(dateStr).getTime() + 86400000))
        )
      );
    totalTaken += takenCountResult[0].count;
  }

  const rate = totalExpected > 0 ? totalTaken / totalExpected : 1;

  if (rate < 0.5) {
    const devices = await app.db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.user_id, userId));

    const pushPromises = devices
      .filter(d => d.push_token)
      .map(device => fetch('https://exp.exponent.dev/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: device.push_token,
          title: '⚠️ Adherence Warning',
          body: `Your 7-day adherence is only ${Math.round(rate * 100)}%. Even I'm disappointed in you.`,
          data: { type: 'adherence_warning' },
        }),
      }));
    await Promise.all(pushPromises);
  }
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/doses - Create dose log
  fastify.post('/api/doses', async (request: FastifyRequest<{ Body: CreateDoseBody }>, reply: FastifyReply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(400).send({ error: 'x-user-id header required' });
    }

    const { id: bodyId, medication_id, scheduled_time, taken_at } = request.body;

    const med = await app.db
      .select()
      .from(schema.medications)
      .where(and(eq(schema.medications.id, medication_id), eq(schema.medications.user_id, userId)))
      .limit(1);

    if (med.length === 0) {
      return reply.status(404).send({ error: 'Medication not found' });
    }

    const id = bodyId || randomUUID();
    const [created] = await app.db
      .insert(schema.dose_logs)
      .values({
        id,
        user_id: userId,
        medication_id,
        scheduled_time: scheduled_time || null,
        ...(taken_at ? { taken_at: new Date(taken_at) } : {}),
      })
      .returning();

    // Trigger adherence check in background
    checkAndSendAdherenceWarning(app, userId).catch(err => console.error('Adherence warning error:', err));

    return reply.status(201).send(parseDoseLog(created));
  });


  // GET /api/doses/today - Get doses for a specific date (or all doses if no date provided)
  fastify.get('/api/doses/today', async (request: FastifyRequest<{ Querystring: { date?: string } }>, reply: FastifyReply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(400).send({ error: 'x-user-id header required' });
    }

    const { date } = request.query;
    if (!date) {
      const doses = await app.db
        .select()
        .from(schema.dose_logs)
        .where(eq(schema.dose_logs.user_id, userId));
      return { doses: doses.map(parseDoseLog) };
    }

    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const doses = await app.db
      .select()
      .from(schema.dose_logs)
      .where(
        and(
          eq(schema.dose_logs.user_id, userId),
          gte(schema.dose_logs.taken_at, startOfDay),
          lt(schema.dose_logs.taken_at, endOfDay)
        )
      );

    return { doses: doses.map(parseDoseLog) };
  });

  // DELETE /api/doses/:id - Delete dose log
  fastify.delete('/api/doses/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(400).send({ error: 'x-user-id header required' });
    }

    const { id } = request.params;
    await app.db.delete(schema.dose_logs).where(and(eq(schema.dose_logs.id, id), eq(schema.dose_logs.user_id, userId)));
    return { success: true };
  });
}
