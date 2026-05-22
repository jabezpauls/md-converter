import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { convertRoutes } from './routes/convert.js';
import { healthRoutes } from './routes/health.js';
import { pdfTransformer } from '../core/transformers/index.js';

export interface ServerOptions {
  port?: number;
  host?: string;
  logger?: boolean;
}

export async function createServer(options: ServerOptions = {}) {
  const { logger = true } = options;

  const fastify = Fastify({ logger });

  // Register plugins
  await fastify.register(cors, { origin: true });
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  // Register routes
  await fastify.register(healthRoutes, { prefix: '/api/v1' });
  await fastify.register(convertRoutes, { prefix: '/api/v1' });

  fastify.addHook('onClose', async () => {
    await pdfTransformer.dispose();
  });

  // Root endpoint
  fastify.get('/', async () => {
    return {
      name: 'md-convert',
      version: '1.0.0',
      description: 'Markdown to DOCX/PDF/TXT/HTML converter API',
      endpoints: {
        health: '/api/v1/health',
        formats: '/api/v1/formats',
        convert: 'POST /api/v1/convert',
        convertFile: 'POST /api/v1/convert/file',
      },
    };
  });

  return fastify;
}

export async function startServer(options: ServerOptions = {}): Promise<void> {
  const { port = 3000, host = '0.0.0.0' } = options;

  const server = await createServer(options);

  try {
    await server.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Start server if this is the main module
const isMainModule = process.argv[1]?.includes('server');
if (isMainModule) {
  const port = parseInt(process.env.PORT || '3000', 10);
  const host = process.env.HOST || '0.0.0.0';
  startServer({ port, host });
}
