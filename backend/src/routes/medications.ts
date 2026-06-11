import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { randomUUID } from 'crypto';

interface CreateMedicationBody {
  name: string;
  dosage: string;
  frequency: 'once_daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'as_needed';
  times: string[];
  notes?: string | null;
  color: string;
}

interface UpdateMedicationBody {
  name?: string;
  dosage?: string;
  frequency?: 'once_daily' | 'twice_daily' | 'three_times_daily' | 'four_times_daily' | 'as_needed';
  times?: string[];
  notes?: string | null;
  color?: string;
}

const SAMPLE_MEDICATIONS = [
  {
    name: 'Vitamin D',
    dosage: '1000 IU',
    frequency: 'once_daily' as const,
    times: ['09:00'],
    color: '#FFD93D',
    notes: null,
  },
  {
    name: 'Ibuprofen',
    dosage: '200mg',
    frequency: 'as_needed' as const,
    times: [],
    color: '#FF6B6B',
    notes: null,
  },
  {
    name: 'Magnesium',
    dosage: '400mg',
    frequency: 'once_daily' as const,
    times: ['22:00'],
    color: '#6BCBFF',
    notes: null,
  },
];

function getDeviceId(request: FastifyRequest): string | null {
  const deviceId = request.headers['x-device-id'];
  return typeof deviceId === 'string' ? deviceId : null;
}

function parseMedication(med: any) {
  return {
    ...med,
    times: typeof med.times === 'string' ? JSON.parse(med.times) : med.times,
  };
}

export function register(app: App, fastify: FastifyInstance) {
  // GET /api/medications - List all medications with auto-seed
  fastify.get('/api/medications', {
    schema: {
      description: 'Get all medications for the device',
      tags: ['medications'],
      response: {
        200: {
          type: 'object',
          properties: {
            medications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  dosage: { type: 'string' },
                  frequency: { type: 'string', enum: ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed'] },
                  times: { type: 'array', items: { type: 'string' } },
                  notes: { type: 'string', nullable: true },
                  color: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      app.logger.warn('Missing x-device-id header');
      return reply.status(400).send({ error: 'x-device-id header required' });
    }

    app.logger.info({ deviceId }, 'Fetching medications');

    const existing = await app.db
      .select()
      .from(schema.medications)
      .where(eq(schema.medications.device_id, deviceId));

    if (existing.length === 0) {
      app.logger.info({ deviceId }, 'Auto-seeding medications for new device');
      const seedMeds = SAMPLE_MEDICATIONS.map((med) => ({
        id: randomUUID(),
        device_id: deviceId,
        name: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        times: JSON.stringify(med.times),
        notes: med.notes,
        color: med.color,
      }));
      await app.db.insert(schema.medications).values(seedMeds);
    }

    const meds = await app.db
      .select()
      .from(schema.medications)
      .where(eq(schema.medications.device_id, deviceId));

    app.logger.info({ deviceId, count: meds.length }, 'Medications retrieved');
    return { medications: meds.map(parseMedication) };
  });

  // POST /api/medications - Create new medication
  fastify.post('/api/medications', {
    schema: {
      description: 'Create a new medication',
      tags: ['medications'],
      body: {
        type: 'object',
        required: ['name', 'dosage', 'frequency', 'times', 'color'],
        properties: {
          name: { type: 'string' },
          dosage: { type: 'string' },
          frequency: { type: 'string', enum: ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed'] },
          times: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string', nullable: true },
          color: { type: 'string' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            dosage: { type: 'string' },
            frequency: { type: 'string' },
            times: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string', nullable: true },
            color: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: CreateMedicationBody }>, reply: FastifyReply) => {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      app.logger.warn('Missing x-device-id header');
      return reply.status(400).send({ error: 'x-device-id header required' });
    }

    const { name, dosage, frequency, times, notes, color } = request.body;
    app.logger.info({ deviceId, name }, 'Creating medication');

    const id = randomUUID();
    const [created] = await app.db
      .insert(schema.medications)
      .values({
        id,
        device_id: deviceId,
        name,
        dosage,
        frequency,
        times: JSON.stringify(times),
        notes: notes || null,
        color,
      })
      .returning();

    app.logger.info({ medicationId: id }, 'Medication created');
    return reply.status(201).send(parseMedication(created));
  });

  // GET /api/medications/:id - Get single medication
  fastify.get('/api/medications/:id', {
    schema: {
      description: 'Get a medication by ID',
      tags: ['medications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            dosage: { type: 'string' },
            frequency: { type: 'string' },
            times: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string', nullable: true },
            color: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
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
    app.logger.info({ deviceId, medicationId: id }, 'Fetching medication');

    const med = await app.db
      .select()
      .from(schema.medications)
      .where(and(eq(schema.medications.id, id), eq(schema.medications.device_id, deviceId)))
      .limit(1);

    if (med.length === 0) {
      app.logger.warn({ medicationId: id }, 'Medication not found');
      return reply.status(404).send({ error: 'Medication not found' });
    }

    return parseMedication(med[0]);
  });

  // PUT /api/medications/:id - Update medication
  fastify.put('/api/medications/:id', {
    schema: {
      description: 'Update a medication',
      tags: ['medications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          dosage: { type: 'string' },
          frequency: { type: 'string', enum: ['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed'] },
          times: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string', nullable: true },
          color: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            dosage: { type: 'string' },
            frequency: { type: 'string' },
            times: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string', nullable: true },
            color: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: UpdateMedicationBody }>, reply: FastifyReply) => {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      app.logger.warn('Missing x-device-id header');
      return reply.status(400).send({ error: 'x-device-id header required' });
    }

    const { id } = request.params;
    app.logger.info({ deviceId, medicationId: id }, 'Updating medication');

    const existing = await app.db
      .select()
      .from(schema.medications)
      .where(and(eq(schema.medications.id, id), eq(schema.medications.device_id, deviceId)))
      .limit(1);

    if (existing.length === 0) {
      app.logger.warn({ medicationId: id }, 'Medication not found');
      return reply.status(404).send({ error: 'Medication not found' });
    }

    const updateData: any = {};
    if (request.body.name !== undefined) updateData.name = request.body.name;
    if (request.body.dosage !== undefined) updateData.dosage = request.body.dosage;
    if (request.body.frequency !== undefined) updateData.frequency = request.body.frequency;
    if (request.body.times !== undefined) updateData.times = JSON.stringify(request.body.times);
    if (request.body.notes !== undefined) updateData.notes = request.body.notes;
    if (request.body.color !== undefined) updateData.color = request.body.color;

    const [updated] = await app.db
      .update(schema.medications)
      .set(updateData)
      .where(eq(schema.medications.id, id))
      .returning();

    app.logger.info({ medicationId: id }, 'Medication updated');
    return parseMedication(updated);
  });

  // DELETE /api/medications/:id - Delete medication
  fastify.delete('/api/medications/:id', {
    schema: {
      description: 'Delete a medication',
      tags: ['medications'],
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
    app.logger.info({ deviceId, medicationId: id }, 'Deleting medication');

    const existing = await app.db
      .select()
      .from(schema.medications)
      .where(and(eq(schema.medications.id, id), eq(schema.medications.device_id, deviceId)))
      .limit(1);

    if (existing.length === 0) {
      app.logger.warn({ medicationId: id }, 'Medication not found');
      return reply.status(404).send({ error: 'Medication not found' });
    }

    await app.db.delete(schema.medications).where(eq(schema.medications.id, id));

    app.logger.info({ medicationId: id }, 'Medication deleted');
    return { success: true };
  });
}
