import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { randomUUID } from 'crypto';

interface CreateDoseBody {
  medication_id: string;
  scheduled_time?: string;
}

function getDeviceId(request: FastifyRequest): string | null {
  const deviceId = request.headers['x-device-id'];
  return typeof deviceId === 'string' ? deviceId : null;
}

function parseDoseLog(log: any) {
  return {
    id: log.id,
    medication_id: log.medication_id,
    scheduled_time: log.scheduled_time,
    taken_at: log.taken_at,
    created_at: log.created_at,
  };
}

export function register(app: App, fastify: FastifyInstance) {
  // POST /api/doses - Create dose log
  fastify.post('/api/doses', {
    schema: {
      description: 'Log a dose of medication',
      tags: ['doses'],
      body: {
        type: 'object',
        required: ['medication_id'],
        properties: {
          medication_id: { type: 'string' },
          scheduled_time: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            medication_id: { type: 'string' },
            scheduled_time: { type: 'string', nullable: true },
            taken_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateDoseBody }>, reply: FastifyReply) => {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      app.logger.warn('Missing x-device-id header');
      return reply.status(400).send({ error: 'x-device-id header required' });
    }

    const { medication_id, scheduled_time } = request.body;
    app.logger.info({ deviceId, medicationId: medication_id }, 'Creating dose log');

    const med = await app.db
      .select()
      .from(schema.medications)
      .where(and(eq(schema.medications.id, medication_id), eq(schema.medications.device_id, deviceId)))
      .limit(1);

    if (med.length === 0) {
      app.logger.warn({ medicationId: medication_id }, 'Medication not found');
      return reply.status(404).send({ error: 'Medication not found' });
    }

    const id = randomUUID();
    const [created] = await app.db
      .insert(schema.dose_logs)
      .values({
        id,
        device_id: deviceId,
        medication_id,
        scheduled_time: scheduled_time || null,
      })
      .returning();

    app.logger.info({ doseId: id, medicationId: medication_id }, 'Dose logged');
    return reply.status(201).send(parseDoseLog(created));
  });

  // GET /api/doses/today - Get today's doses
  fastify.get('/api/doses/today', {
    schema: {
      description: 'Get doses for a specific date',
      tags: ['doses'],
      querystring: {
        type: 'object',
        required: ['date'],
        properties: {
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            doses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  medication_id: { type: 'string' },
                  scheduled_time: { type: 'string', nullable: true },
                  taken_at: { type: 'string', format: 'date-time' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { date: string } }>, reply: FastifyReply) => {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      app.logger.warn('Missing x-device-id header');
      return reply.status(400).send({ error: 'x-device-id header required' });
    }

    const { date } = request.query;
    app.logger.info({ deviceId, date }, 'Fetching doses for date');

    const startOfDay = new Date(`${date}T00:00:00Z`);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const doses = await app.db
      .select()
      .from(schema.dose_logs)
      .where(
        and(
          eq(schema.dose_logs.device_id, deviceId),
          gte(schema.dose_logs.taken_at, startOfDay),
          lt(schema.dose_logs.taken_at, endOfDay)
        )
      );

    app.logger.info({ deviceId, date, count: doses.length }, 'Doses retrieved');
    return { doses: doses.map(parseDoseLog) };
  });

  // DELETE /api/doses/:id - Delete dose log
  fastify.delete('/api/doses/:id', {
    schema: {
      description: 'Delete a dose log',
      tags: ['doses'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      app.logger.warn('Missing x-device-id header');
      return reply.status(400).send({ error: 'x-device-id header required' });
    }

    const { id } = request.params;
    app.logger.info({ deviceId, doseId: id }, 'Deleting dose log');

    const existing = await app.db
      .select()
      .from(schema.dose_logs)
      .where(and(eq(schema.dose_logs.id, id), eq(schema.dose_logs.device_id, deviceId)))
      .limit(1);

    if (existing.length === 0) {
      app.logger.warn({ doseId: id }, 'Dose log not found');
      return reply.status(404).send({ error: 'Dose log not found' });
    }

    await app.db.delete(schema.dose_logs).where(eq(schema.dose_logs.id, id));

    app.logger.info({ doseId: id }, 'Dose log deleted');
    return { success: true };
  });
}
