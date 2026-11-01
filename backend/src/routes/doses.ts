import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt } from 'drizzle-orm';
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
