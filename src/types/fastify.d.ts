import { Payload } from '../auth/interfaces/payload.interface';

declare module 'fastify' {
  interface FastifyRequest {
    user?: Payload;
    merchant?: Payload;
  }
}
