export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(401, message);
  }
}

export class ConflictError extends AppError {
  constructor(
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(409, message);
  }
}

/**
 * The request was well-formed but could not be acted on.
 *
 * Used for a calendar URL that parses but cannot be used — a feed that
 * answers with a login page, for instance.
 */
export class UnprocessableEntityError extends AppError {
  constructor(message: string) {
    super(422, message);
  }
}
