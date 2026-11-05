import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

function getUserId(request: FastifyRequest): string | null {
  const userId = request.headers['x-user-id'];
  return typeof userId === 'string' ? userId : null;
}

async function handleGetUser(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  
  const [user] = await app.db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) {
    return reply.status(404).send({ error: 'User not found' });
  }
  
  return user;
}

async function handleUpdateUser(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  
  const { full_name, avatar_url, caregiver_email } = request.body;
  
  const existing = await app.db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (existing.length === 0) {
    const [created] = await app.db
      .insert(schema.users)
      .values({
        id: userId,
        email: `${userId}@dosed.app`,
        full_name: full_name ?? 'Jonathan',
        avatar_url: avatar_url ?? null,
        caregiver_email: caregiver_email ?? null,
      })
      .returning();
    return created;
  }

  const updateData: any = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
  if (caregiver_email !== undefined) updateData.caregiver_email = caregiver_email;
  
  const [updated] = await app.db.update(schema.users).set(updateData).where(eq(schema.users.id, userId)).returning();
  return updated;
}

async function handleDeleteUser(app: any, request: any, reply: any) {
  const userId = getUserId(request);
  if (!userId) return reply.status(400).send({ error: 'x-user-id header required' });
  
  await app.db.delete(schema.users).where(eq(schema.users.id, userId));
  return { success: true };
}

export function register(app: App, fastify: FastifyInstance) {
  const getOptions = {
    schema: {
      description: 'Get current user profile',
      tags: ['user'],
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            full_name: { type: 'string', nullable: true },
            avatar_url: { type: 'string', nullable: true },
            caregiver_email: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };
  fastify.get('/api/user', getOptions, (request, reply) => handleGetUser(app, request, reply));

  const updateOptions = {
    schema: {
      description: 'Update user profile',
      tags: ['user'],
      body: {
        type: 'object',
        properties: {
          full_name: { type: 'string' },
          avatar_url: { type: 'string' },
          caregiver_email: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            full_name: { type: 'string', nullable: true },
            avatar_url: { type: 'string', nullable: true },
            caregiver_email: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };
  fastify.put('/api/user', updateOptions, (request, reply) => handleUpdateUser(app, request, reply));

  const deleteOptions = {
    schema: {
      description: 'Delete user account',
      tags: ['user'],
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  };
  fastify.delete('/api/user', deleteOptions, (request, reply) => handleDeleteUser(app, request, reply));
}
