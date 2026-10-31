import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateText, generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';
import { randomUUID } from 'crypto';

const ParseMedSchema = z.object({
  name: z.string(),
  dosage: z.string(),
  frequency: z.enum(['once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'as_needed']),
  times: z.array(z.string()),
  notes: z.string().nullable(),
});

async function handleParseMed(app: any, request: any, reply: any) {
  const { text } = request.body;
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      system: 'You are a medical data extraction assistant. Parse the user input into a structured medication object. Map frequency to: once_daily, twice_daily, three_times_daily, four_times_daily, or as_needed. Ensure times are in HH:MM 24h format. If times are not specified but frequency is, provide sensible defaults (e.g., once_daily -> 08:00).',
      schema: ParseMedSchema,
      prompt: text,
    });
    return object;
  } catch (error) {
    app.logger.error({ err: error, text }, 'Failed to parse medication');
    return reply.status(400).send({ error: 'Could not parse medication info' });
  }
}

function getUserId(request: FastifyRequest): string | null {
  // BRIDGE: Use x-user-id until the frontend is flipped to Neon Auth JWTs
  const userId = request.headers['x-user-id'];
  return typeof userId === 'string' ? userId : null;
}

function parseMedication(med: any) {
  return {
    ...med,
    times: typeof med.times === 'string' ? JSON.parse(med.times) : med.times,
  };
}

const SAMPLE_MEDICATIONS = [
  { name: 'Vitamin D', dosage: '1000 IU', frequency: 'once_daily' as const, times: ['09:00'], color: '#FFD93D', notes: null },
  { name: 'Ibuprofen', dosage: '200mg', frequency: 'as_needed' as const, times: [], color: '#FF6B6B', notes: null },
  { name: 'Magnesium', dosage: '400mg', frequency: 'once_daily' as const, times: ['22:00'], color: '#6BCBFF', notes: null },
];

async function handleGetMeds(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  const existing = await app.db.select().from(schema.medications).where(eq(schema.medications.user_id, userId));
  if (existing.length === 0) {
    const seedMeds = SAMPLE_MEDICATIONS.map(med => ({
      id: randomUUID(),
      user_id: userId,
      ...med,
      times: JSON.stringify(med.times),
    }));
    await app.db.insert(schema.medications).values(seedMeds);
  }
  const meds = await app.db.select().from(schema.medications).where(eq(schema.medications.user_id, userId));
  return { medications: meds.map(parseMedication) };
}

async function handleCreateMed(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  const { name, dosage, frequency, times, notes, color } = request.body;
  const id = randomUUID();
  const [created] = await app.db.insert(schema.medications).values({
    id, user_id: userId, name, dosage, frequency, times: JSON.stringify(times), notes: notes || null, color,
  }).returning();
  return reply.status(201).send(parseMedication(created));
}

async function handleGetMedById(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  const { id } = request.params;
  const med = await app.db.select().from(schema.medications).where(and(eq(schema.medications.id, id), eq(schema.medications.user_id, userId))).limit(1);
  if (med.length === 0) return reply.status(404).send({ error: 'Medication not found' });
  return parseMedication(med[0]);
}

async function handleUpdateMed(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  const { id } = request.params;
  const existing = await app.db.select().from(schema.medications).where(and(eq(schema.medications.id, id), eq(schema.medications.user_id, userId))).limit(1);
  if (existing.length === 0) return reply.status(404).send({ error: 'Medication not found' });
  const updateData: any = {};
  if (request.body.name !== undefined) updateData.name = request.body.name;
  if (request.body.dosage !== undefined) updateData.dosage = request.body.dosage;
  if (request.body.frequency !== undefined) updateData.frequency = request.body.frequency;
  if (request.body.times !== undefined) updateData.times = JSON.stringify(request.body.times);
  if (request.body.notes !== undefined) updateData.notes = request.body.notes;
  if (request.body.color !== undefined) updateData.color = request.body.color;
  const [updated] = await app.db.update(schema.medications).set(updateData).where(eq(schema.medications.id, id)).returning();
  return parseMedication(updated);
}

async function handleDeleteMed(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  const { id } = request.params;
  const existing = await app.db.select().from(schema.medications).where(and(eq(schema.medications.id, id), eq(schema.medications.user_id, userId))).limit(1);
  if (existing.length === 0) return reply.status(404).send({ error: 'Medication not found' });
  await app.db.delete(schema.medications).where(eq(schema.medications.id, id));
  return { success: true };
}

export function register(app: App, fastify: FastifyInstance) {
  const parseOptions = {
    schema: {
      description: 'Parse natural language medication info',
      tags: ['medications'],
      body: {
        type: 'object',
        required: ['text'],
        properties: { text: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            dosage: { type: 'string' },
            frequency: { type: 'string' },
            times: { type: 'array', items: { type: 'string' } },
            notes: { type: 'string', nullable: true },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };
  fastify.post('/api/meds/parse', parseOptions, (request, reply) => handleParseMed(app, request, reply));

  const getMedsOptions = {
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
  };
  fastify.get('/api/medications', getMedsOptions, (request, reply) => handleGetMeds(app, request, reply));

  const createMedOptions = {
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
  };
  fastify.post('/api/medications', createMedOptions, (request, reply) => handleCreateMed(app, request, reply));

  const getMedByIdOptions = {
    schema: {
      description: 'Get a medication by ID',
      tags: ['medications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
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
  };
  fastify.get('/api/medications/:id', getMedByIdOptions, (request, reply) => handleGetMedById(app, request, reply));

  const updateMedOptions = {
    schema: {
      description: 'Update a medication',
      tags: ['medications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
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
        404: { type: 'object', properties: { error: 'H Medication not found' } },
      },
    },
  };
  fastify.put('/api/medications/:id', updateMedOptions, (request, reply) => handleUpdateMed(app, request, reply));

  const deleteMedOptions = {
    schema: {
      description: 'Delete a medication',
      tags: ['medications'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };
  fastify.delete('/api/medications/:id', deleteMedOptions, (request, reply) => handleDeleteMed(app, request, reply));
}
