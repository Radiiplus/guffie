import Fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import fastifyStatic from '@fastify/static';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = Fastify({ logger: true });

server.register(fastifyStatic, {
  root: path.join(__dirname, 'gf'),
  prefix: '/',
});

server.setNotFoundHandler((request, reply) => {
  reply.type('text/html').sendFile('index.html');
});

const port = process.env.PORT ? Number(process.env.PORT) : 4444;
const host = process.env.HOST || '0.0.0.0';

server.listen({ port, host }).then(() => {
  server.log.info(`Frontend server running at http://${host}:${port}`);
}).catch((err) => {
  server.log.error(err);
  process.exit(1);
});
