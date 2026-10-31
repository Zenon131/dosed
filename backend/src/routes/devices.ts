import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

interface TokenBody {
  push_token: string | null;
}

function getDeviceId(request: FastifyRequest): string | null {
  const deviceId = request.headers['x-device-id'];
  return typeof deviceId === 'string' ? deviceId : null;
}

function getUserId(request: FastifyRequest): string | null {
  const userId = request.headers['x-user-id'];
  return typeof userId === 'string' ? userId : null;
}

async function handleUpdateToken(app: any, request: FastifyRequest<{ Body: TokenBody }>, reply: FastifyReply) {
  const deviceId = getDeviceId(request);
  const userId = getUserId(request);
  
  if (!deviceId) {
    return reply.status(400).send({ error: 'x-device-id header required' });
  }
  if (!userId) {
    return reply.status(400).send({ error: 'x-user-id header required' });
  }

  const { push_token } = request.body;

  try {
    const existing = await app.db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.id, deviceId))
      .limit(1);

    if (existing.length === 0) {
      await app.db.insert(schema.devices).values({
        id: deviceId,
        user_id: userId,
        push_token,
        last_seen: new Date(),
      });
    } else {
      await app.db
        .update(schema.devices)
        .set({
          user_id: userId,
          push_token,
          last_seen: new Date(),
        })
        .where(eq(schema.devices.id, deviceId));
    }

    return { success: true };
  } catch (error) {
    app.logger.error({ err: error, deviceId }, 'Failed to update push token');
    return reply.status(500).send({ error: 'Internal server error' });
  }
}

export function register(app: App, fastify: FastifyInstance) {
  fastify.post('/api/devices/token', {
    schema: {
      description: 'Update the push token for the device',
      tags: ['devices'],
      body: {
        type: 'object',
        required: ['push_token'],
        properties: {
          push_token: { type: 'string', nullable: true },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
    handler: (request, reply) => handleUpdateToken(app, request, reply)
  });
}
