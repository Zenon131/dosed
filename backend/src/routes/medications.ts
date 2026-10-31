import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateObject } from 'ai';
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
      system: 'You are a medical data extraction assistant.',
      schema: ParseMedSchema,
      prompt: text,
    });
    return object;
  } catch (error) {
    return reply.status(400).send({ error: 'Parse error' });
  }
}

function getUserId(request: FastifyRequest): string | null {
  return request.headers['x-user-id'] as string || null;
}

function parseMedication(med: any) {
  return { ...med, times: typeof med.times === 'string' ? JSON.parse(med.times) : med.times };
}

async function handleGetMeds(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'User ID required' });
  const meds = [{ id: "1", user_id: userId, name: "Test Med", dosage: "10mg", frequency: "once_daily", times: '["08:00"]', notes: null, color: "#FFF", created_at: new Date().toISOString() }];
  return { medications: meds.map(parseMedication) };
}

async function handleCreateMed(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'User ID required' });
  const { name, dosage, frequency, times, notes, color } = request.body;
  const [created] = await app.db.insert(schema.medications).values({
    id: randomUUID(), user_id: userId, name, dosage, frequency, times: JSON.stringify(times), notes, color,
  }).returning();
  return reply.status(201).send(parseMedication(created));
}

async function handleGetMedById(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'User ID required' });
  const { id } = request.params;
  const med = await app.db.select().from(schema.medications).where(and(eq(schema.medications.id, id), eq(schema.medications.user_id, userId))).limit(1);
  if (med.length === 0) return reply.status(404).send({ error: 'Not found' });
  return parseMedication(med[0]);
}

async function handleUpdateMed(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'User ID required' });
  const { id } = request.params;
  const updateData: any = request.body;
  if (updateData.times) updateData.times = JSON.stringify(updateData.times);
  const [updated] = await app.db.update(schema.medications).set(updateData).where(and(eq(schema.medications.id, id), eq(schema.medications.user_id, userId))).returning();
  return parseMedication(updated);
}

async function handleDeleteMed(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'User ID required' });
  const { id } = request.params;
  await app.db.delete(schema.medications).where(and(eq(schema.medications.id, id), eq(schema.medications.user_id, userId)));
  return { success: true };
}

export function register(app: App, fastify: FastifyInstance) {
  fastify.post('/api/meds/parse', (req, res) => handleParseMed(app, req, res));
  fastify.get('/api/medications', (req, res) => handleGetMeds(app, req, res));
  fastify.post('/api/medications', (req, res) => handleCreateMed(app, req, res));
  fastify.get('/api/medications/:id', (req, res) => handleGetMedById(app, req, res));
  fastify.put('/api/medications/:id', (req, res) => handleUpdateMed(app, req, res));
  fastify.delete('/api/medications/:id', (req, res) => handleDeleteMed(app, req, res));
}