import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

import type { App } from '../index.js';

interface SnarkBody {
  medication_name: string;
  context: 'missed' | 'due_now' | 'taken' | 'streak';
  minutes_late?: number;
}

interface GenerateSnarkBody {
  name?: string;
  medName: string;
  dosage?: string;
}

function getDeviceId(request: FastifyRequest): string | null {
  const deviceId = request.headers['x-device-id'];
  return typeof deviceId === 'string' ? deviceId : null;
}

export function register(app: App, fastify: FastifyInstance) {
  fastify.post('/api/snark', {
    schema: {
      description: 'Get a snarky reminder message from AI',
      tags: ['snark'],
      body: {
        type: 'object',
        required: ['medication_name', 'context'],
        properties: {
          medication_name: { type: 'string' },
          context: { type: 'string', enum: ['missed', 'due_now', 'taken', 'streak'] },
          minutes_late: { type: 'integer' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: SnarkBody }>, reply: FastifyReply) => {
    const deviceId = getDeviceId(request);
    if (!deviceId) {
      app.logger.warn('Missing x-device-id header');
      return reply.status(400).send({ error: 'x-device-id header required' });
    }

    const { medication_name, context, minutes_late } = request.body;
    app.logger.info({ deviceId, medication_name, context }, 'Generating snark');

    let userMessage = '';
    switch (context) {
      case 'missed':
        userMessage = `Generate a snarky missed-dose reminder for ${medication_name}. They are ${minutes_late ?? 'some'} minutes late.`;
        break;
      case 'due_now':
        userMessage = `Generate a playful due-now reminder for ${medication_name}.`;
        break;
      case 'taken':
        userMessage = `Generate a sarcastic congratulations for taking ${medication_name}.`;
        break;
      case 'streak':
        userMessage = `Generate a snarky hype message for maintaining a streak with ${medication_name}.`;
        break;
    }

    try {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: 'You are a snarky, witty, affectionate-mean medication reminder assistant. Generate ONE short snarky reminder line (max 140 characters). Be playful and lovingly roast the user. Never be cruel about health conditions. Keep it PG-13. Respond with ONLY the message, no quotes, no explanation.',
        messages: [{ role: 'user', content: userMessage }],
      });

      app.logger.info({ deviceId, medication_name }, 'Snark generated');
      return { message: result.text };
    } catch (error) {
      // Fallback for missing API key or test environments
      if ((error instanceof Error && error.message.includes('API key is missing')) || !process.env.OPENAI_API_KEY) {
        app.logger.warn({ medication_name, context }, 'OpenAI API key not available, using mock response');

        // Provide mock snarky responses for testing
        const mockResponses: Record<string, string> = {
          missed: `Oops! 💊 You're ${minutes_late ?? 'some'} minutes late with ${medication_name}. Time is medicine's best friend! ⏰`,
          due_now: `Rise and shine! It's ${medication_name} o'clock! Don't keep your body waiting. ✨`,
          taken: `Look at you! Actually took ${medication_name}! The medication gods are pleased. 🙌`,
          streak: `${medication_name} streak unlocked! You're basically a responsible adult now! 🏆`,
        };

        return { message: mockResponses[context] };
      }

      app.logger.error({ err: error, medication_name }, 'Failed to generate snark');
      throw error;
    }
  });

  // POST /api/snark/generate - Generate snarky notification text via OpenRouter
  fastify.post('/api/snark/generate', {
    schema: {
      description: 'Generate a snarky medication reminder notification',
      tags: ['snark'],
      body: {
        type: 'object',
        required: ['medName'],
        properties: {
          name: { type: 'string' },
          medName: { type: 'string' },
          dosage: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            body: { type: 'string' },
          },
        },
        400: { type: 'object', properties: { error: { type: 'string' } } },
        502: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest<{ Body: GenerateSnarkBody }>, reply: FastifyReply) => {
    const { name, medName, dosage } = request.body;

    // Validate required field
    if (!medName || medName.trim() === '') {
      app.logger.warn('Missing or empty medName');
      return reply.status(400).send({ error: 'medName is required' });
    }

    app.logger.info({ name, medName, dosage }, 'Generating snark notification');

    const systemPrompt = `You write one-line push-notification reminders for a medication app called Dosed. Tone: dry, sassy, mildly mocking, gen-Z-adjacent — like a friend who's tired of nagging you. Hard rules: ONE line only, max 120 characters, no emojis, no hashtags, no quotes around the output, no leading 'Reminder:' prefix. Always mention the med name. Mention the dosage if provided. Mention the user's first name if provided. Never give medical advice. Never apologize. Never explain. Output only the notification body text, nothing else.`;

    const userMessage = `Write a reminder. Name: ${name && name.trim() ? name : '(no name)'}. Med: ${medName}. Dosage: ${dosage && dosage.trim() ? dosage : '(unspecified)'}.`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://ntfcf7wm8qs8vs224ba78k6nrmxbz4hm.app.specular.dev',
          'X-Title': 'Dosed',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'openai/gpt-oss-20b',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.9,
          max_tokens: 80,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        app.logger.error({ status: response.status, medName }, 'OpenRouter API error');
        return reply.status(502).send({ error: 'snark_generation_failed' });
      }

      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const generatedText = data.choices?.[0]?.message?.content || '';

      // Strip whitespace and surrounding quotes
      let body = generatedText.trim();
      if ((body.startsWith('"') && body.endsWith('"')) || (body.startsWith("'") && body.endsWith("'"))) {
        body = body.slice(1, -1);
      }

      app.logger.info({ medName, bodyLength: body.length }, 'Snark notification generated');
      return { body };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        app.logger.warn({ medName }, 'Snark generation timeout');
        return reply.status(502).send({ error: 'snark_generation_failed' });
      }

      app.logger.error({ err: error, medName }, 'Failed to generate snark notification');
      return reply.status(502).send({ error: 'snark_generation_failed' });
    }
  });
}
