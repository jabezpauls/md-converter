import * as fastify from 'fastify';
import * as http from 'http';

interface ServerOptions {
    port?: number;
    host?: string;
    logger?: boolean;
}
declare function createServer(options?: ServerOptions): Promise<fastify.FastifyInstance<http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>, http.IncomingMessage, http.ServerResponse<http.IncomingMessage>, fastify.FastifyBaseLogger, fastify.FastifyTypeProviderDefault>>;
declare function startServer(options?: ServerOptions): Promise<void>;

export { type ServerOptions, createServer, startServer };
