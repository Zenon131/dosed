import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lt, lte, ne } from 'drizzle-orm';
import * as schema from '../db/schema/schema.js';
import type { App } from '../index.js';

function getDeviceId(request: FastifyRequest): string | null {
  const deviceId = request.headers['x-device-id'];
  return typeof deviceId === 'string' ? deviceId : null;
}

export function register(app: App, fastify: FastifyInstance) {
  fastify.get('/api/stats', {
    schema: {
      description: 'Get medication adherence stats for past 7 days',
      tags: ['stats'],
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
            days: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  taken: { type: 'integer' },
                  expected: { type: 'integer' },
                },
              },
            },
            current_streak: { type: 'integer' },
            total_taken_7d: { type: 'integer' },
            total_expected_7d: { type: 'integer' },
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
    app.logger.info({ deviceId, date }, 'Calculating stats');

    const today = new Date(date);
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      dates.push(d);
    }

    const meds = await app.db
      .select()
      .from(schema.medications)
      .where(and(eq(schema.medications.device_id, deviceId), ne(schema.medications.frequency, 'as_needed')));

    const doses = await app.db
      .select()
      .from(schema.dose_logs)
      .where(eq(schema.dose_logs.device_id, deviceId));

    const days = dates.map((dayDate) => {
      const dateStr = dayDate.toISOString().split('T')[0];
      const endOfDay = new Date(dayDate);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      // Expected: sum of times.length for meds created on or before this day
      let expected = 0;
      meds.forEach((med) => {
        if (new Date(med.created_at) <= endOfDay) {
          const times = JSON.parse(med.times as string);
          expected += times.length;
        }
      });

      // Taken: count dose_logs within this day's boundaries
      const taken = doses.filter((dose) => {
        const doseDate = new Date(dose.taken_at);
        return doseDate >= dayDate && doseDate < endOfDay;
      }).length;

      return { date: dateStr, taken, expected };
    });

    // Calculate streak
    let current_streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].taken >= days[i].expected) {
        current_streak++;
      } else {
        break;
      }
    }

    const total_taken_7d = days.reduce((sum, d) => sum + d.taken, 0);
    const total_expected_7d = days.reduce((sum, d) => sum + d.expected, 0);

    app.logger.info({ deviceId, streak: current_streak, total_taken_7d }, 'Stats calculated');
    return {
      days,
      current_streak,
      total_taken_7d,
      total_expected_7d,
    };
  });
}
