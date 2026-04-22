import type { FastifyReply } from 'fastify';

type ErrorMessage = {
  message: string;
};

function sendError(reply: FastifyReply, statusCode: number, message: string) {
  return reply.code(statusCode).send({ message } satisfies ErrorMessage);
}

export function sendUnauthorized(reply: FastifyReply) {
  return sendError(reply, 401, 'Unauthorized');
}

export function sendNotFound(reply: FastifyReply, message: string) {
  return sendError(reply, 404, message);
}

export function sendBadRequest(reply: FastifyReply, message: string) {
  return sendError(reply, 400, message);
}

export function sendServerError(reply: FastifyReply, message: string) {
  return sendError(reply, 500, message);
}
