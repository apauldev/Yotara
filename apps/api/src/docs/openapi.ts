import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance, FastifySchema, RouteOptions } from 'fastify';

type OpenApiJsonContent = {
  example?: unknown;
};

type OpenApiResponse = {
  content?: Record<string, OpenApiJsonContent>;
};

type OpenApiOperation = {
  responses?: Record<string, OpenApiResponse>;
  requestBody?: {
    content?: Record<string, OpenApiJsonContent>;
  };
};

type OpenApiPathRecord = Record<
  string,
  Partial<Record<'get' | 'post' | 'patch' | 'delete', OpenApiOperation>>
>;

const taskSchema = {
  $id: 'Task',
  type: 'object',
  required: ['id', 'title', 'status', 'priority', 'completed', 'order', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: 'string' },
    status: {
      type: 'string',
      enum: ['inbox', 'today', 'upcoming', 'done', 'archived'],
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    completed: { type: 'boolean' },
    dueDate: { type: 'string', format: 'date' },
    simpleMode: { type: 'boolean' },
    bucket: {
      type: 'string',
      enum: ['personal-sanctuary', 'deep-work', 'home', 'health'],
    },
    projectId: { type: 'string' },
    assigneeId: { type: 'string' },
    parentTaskId: { type: 'string' },
    labels: {
      type: 'array',
      items: { type: 'string' },
    },
    order: { type: 'integer' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
} as const;

const createTaskSchema = {
  $id: 'CreateTaskDto',
  type: 'object',
  required: ['title'],
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    status: {
      type: 'string',
      enum: ['inbox', 'today', 'upcoming', 'done', 'archived'],
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    dueDate: { type: 'string', format: 'date' },
    simpleMode: { type: 'boolean' },
    bucket: {
      type: 'string',
      enum: ['personal-sanctuary', 'deep-work', 'home', 'health'],
    },
    projectId: { type: 'string' },
    parentTaskId: { type: 'string' },
    labels: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  additionalProperties: false,
} as const;

const updateTaskSchema = {
  $id: 'UpdateTaskDto',
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    status: {
      type: 'string',
      enum: ['inbox', 'today', 'upcoming', 'done', 'archived'],
    },
    priority: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
    dueDate: { type: 'string', format: 'date' },
    simpleMode: { type: 'boolean' },
    bucket: {
      type: 'string',
      enum: ['personal-sanctuary', 'deep-work', 'home', 'health'],
    },
    projectId: { type: 'string' },
    parentTaskId: { type: 'string' },
    labels: {
      type: 'array',
      items: { type: 'string' },
    },
    completed: { type: 'boolean' },
    order: { type: 'integer' },
  },
  additionalProperties: false,
} as const;

const paginationMetaSchema = {
  $id: 'PaginationMeta',
  type: 'object',
  required: ['total', 'page', 'pageSize', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
  properties: {
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1 },
    totalPages: { type: 'integer', minimum: 0 },
    hasNextPage: { type: 'boolean' },
    hasPreviousPage: { type: 'boolean' },
  },
} as const;

const paginatedTasksResponseSchema = {
  $id: 'PaginatedTasksResponse',
  type: 'object',
  required: ['data', 'meta'],
  properties: {
    data: {
      type: 'array',
      items: { $ref: 'Task#' },
    },
    meta: { $ref: 'PaginationMeta#' },
  },
} as const;

const userSchema = {
  $id: 'User',
  type: 'object',
  required: ['id', 'email', 'name', 'createdAt'],
  properties: {
    id: { type: 'string' },
    email: { type: 'string', format: 'email' },
    name: { type: 'string' },
    avatarUrl: { type: 'string', format: 'uri' },
    image: { anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] },
    emailVerified: { type: 'boolean' },
    workspaceMode: {
      anyOf: [{ type: 'string', enum: ['personal', 'team'] }, { type: 'null' }],
    },
    onboardingCompleted: { type: 'boolean' },
    createdAt: {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'integer' }],
    },
    updatedAt: {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'integer' }],
    },
  },
} as const;

const apiErrorSchema = {
  $id: 'ApiError',
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string' },
  },
} as const;

const sessionSchema = {
  $id: 'Session',
  type: 'object',
  required: ['id', 'userId', 'expiresAt', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string' },
    userId: { type: 'string' },
    expiresAt: {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'integer' }],
    },
    createdAt: {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'integer' }],
    },
    updatedAt: {
      anyOf: [{ type: 'string', format: 'date-time' }, { type: 'integer' }],
    },
    token: { type: 'string' },
    ipAddress: { type: 'string' },
    userAgent: { type: 'string' },
  },
} as const;

const meResponseSchema = {
  $id: 'MeResponse',
  type: 'object',
  required: ['user'],
  properties: {
    user: { $ref: 'User#' },
  },
} as const;

const updateProfileSchema = {
  $id: 'UpdateProfile',
  type: 'object',
  properties: {
    workspaceMode: {
      type: 'string',
      enum: ['personal', 'team'],
    },
    onboardingCompleted: { type: 'boolean' },
  },
  additionalProperties: false,
} as const;

const authSessionResponseSchema = {
  $id: 'AuthSessionResponse',
  type: 'object',
  required: ['session', 'user'],
  properties: {
    session: {
      anyOf: [{ $ref: 'Session#' }, { type: 'null' }],
    },
    user: {
      anyOf: [{ $ref: 'User#' }, { type: 'null' }],
    },
  },
} as const;

const authCredentialsSchema = {
  $id: 'AuthCredentials',
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const authSignUpSchema = {
  $id: 'AuthSignUp',
  type: 'object',
  required: ['email', 'password', 'name'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string' },
    name: { type: 'string' },
  },
  additionalProperties: false,
} as const;

const authUserResponseSchema = {
  $id: 'AuthUserResponse',
  type: 'object',
  required: ['user'],
  properties: {
    user: { $ref: 'User#' },
  },
} as const;

const authSignOutResponseSchema = {
  $id: 'AuthSignOutResponse',
  type: 'object',
  properties: {
    success: { type: 'boolean' },
  },
  additionalProperties: true,
} as const;

const authErrorSchema = {
  $id: 'AuthError',
  type: 'object',
  required: ['message'],
  properties: {
    message: { type: 'string' },
    code: { type: 'string' },
    status: { type: 'integer' },
  },
  additionalProperties: true,
} as const;

const sharedSchemas = [
  taskSchema,
  createTaskSchema,
  updateTaskSchema,
  paginationMetaSchema,
  paginatedTasksResponseSchema,
  userSchema,
  apiErrorSchema,
  sessionSchema,
  meResponseSchema,
  updateProfileSchema,
  authSessionResponseSchema,
  authCredentialsSchema,
  authSignUpSchema,
  authUserResponseSchema,
  authSignOutResponseSchema,
  authErrorSchema,
] as const;

export const examples = {
  apiInfo: {
    name: 'Yotara API',
    version: '0.1.0',
  },
  health: {
    status: 'ok',
    timestamp: '2026-03-16T12:00:00.000Z',
  },
  task: {
    id: '9fd8141d-e282-43b8-96d5-a19e6b6f0c8f',
    title: 'Write API docs',
    description: 'Document every route with OpenAPI',
    status: 'today',
    priority: 'high',
    completed: false,
    dueDate: '2026-03-18',
    order: 0,
    createdAt: '2026-03-16T12:00:00.000Z',
    updatedAt: '2026-03-16T12:00:00.000Z',
  },
  createTask: {
    title: 'Write API docs',
    description: 'Document every route with OpenAPI',
    status: 'today',
    priority: 'high',
    dueDate: '2026-03-18',
  },
  updateTask: {
    completed: true,
    status: 'done',
  },
  paginatedTasks: {
    data: [
      {
        id: '9fd8141d-e282-43b8-96d5-a19e6b6f0c8f',
        title: 'Write API docs',
        description: 'Document every route with OpenAPI',
        status: 'today',
        priority: 'high',
        completed: false,
        dueDate: '2026-03-18',
        order: 0,
        createdAt: '2026-03-16T12:00:00.000Z',
        updatedAt: '2026-03-16T12:00:00.000Z',
      },
    ],
    meta: {
      total: 1,
      page: 1,
      pageSize: 50,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  },
  me: {
    user: {
      id: 'user_123',
      email: 'demo@example.com',
      name: 'Demo User',
      createdAt: '2026-03-16T12:00:00.000Z',
    },
  },
  apiError: (message: string) => ({ message }),
  authSignUp: {
    email: 'demo@example.com',
    password: 'Password123!',
    name: 'Demo User',
  },
  authSignIn: {
    email: 'demo@example.com',
    password: 'Password123!',
  },
  authUser: {
    user: {
      id: 'user_123',
      email: 'demo@example.com',
      name: 'Demo User',
      emailVerified: false,
      image: null,
      createdAt: 1773652800000,
      updatedAt: 1773652800000,
    },
  },
  authSession: {
    session: {
      id: 'session_123',
      userId: 'user_123',
      expiresAt: 1774257600000,
      createdAt: 1773652800000,
      updatedAt: 1773652800000,
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
    user: {
      id: 'user_123',
      email: 'demo@example.com',
      name: 'Demo User',
      emailVerified: false,
      image: null,
      createdAt: 1773652800000,
      updatedAt: 1773652800000,
    },
  },
  authSignOut: {
    success: true,
  },
  authError: {
    message: 'Invalid email or password',
    code: 'INVALID_CREDENTIALS',
    status: 401,
  },
} as const;

export const authCookieSecurity = [{ cookieAuth: [] }] as const;

export function errorResponseSchema(
  description: string,
  message: string,
): {
  description: string;
  content: { 'application/json': { schema: { $ref: string }; example: { message: string } } };
} {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: 'ApiError#' },
        example: examples.apiError(message),
      },
    },
  };
}

export function idParamSchema(description = 'Task identifier'): FastifySchema['params'] {
  return {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', description },
    },
  };
}

function ensureJsonContent(operation: OpenApiOperation, statusCode: string) {
  const response = (operation.responses ?? {})[statusCode] ?? {};
  response.content ??= {};
  response.content['application/json'] ??= {};
  operation.responses ??= {};
  operation.responses[statusCode] = response;
  return response.content['application/json'];
}

function addOpenApiExamples(paths: OpenApiPathRecord) {
  const rootGet = paths['/']?.get;
  if (rootGet) {
    ensureJsonContent(rootGet, '200').example = examples.apiInfo;
  }

  const healthGet = paths['/health']?.get;
  if (healthGet) {
    ensureJsonContent(healthGet, '200').example = examples.health;
  }

  const meGet = paths['/me']?.get;
  if (meGet) {
    ensureJsonContent(meGet, '200').example = examples.me;
    ensureJsonContent(meGet, '401').example = examples.apiError('Unauthorized');
  }

  const tasksListGet = paths['/tasks']?.get;
  if (tasksListGet) {
    ensureJsonContent(tasksListGet, '200').example = examples.paginatedTasks;
    ensureJsonContent(tasksListGet, '401').example = examples.apiError('Unauthorized');
  }

  const tasksPost = paths['/tasks']?.post;
  if (tasksPost) {
    tasksPost.requestBody ??= { content: { 'application/json': {} } };
    tasksPost.requestBody.content ??= {};
    tasksPost.requestBody.content['application/json'] ??= {};
    tasksPost.requestBody.content['application/json'].example = examples.createTask;
    ensureJsonContent(tasksPost, '201').example = examples.task;
    ensureJsonContent(tasksPost, '400').example = examples.apiError('Task title is required');
    ensureJsonContent(tasksPost, '401').example = examples.apiError('Unauthorized');
    ensureJsonContent(tasksPost, '500').example = examples.apiError('Failed to create task');
  }

  const taskByIdGet = paths['/tasks/{id}']?.get;
  if (taskByIdGet) {
    ensureJsonContent(taskByIdGet, '200').example = examples.task;
    ensureJsonContent(taskByIdGet, '401').example = examples.apiError('Unauthorized');
    ensureJsonContent(taskByIdGet, '404').example = examples.apiError('Task not found');
  }

  const taskByIdPatch = paths['/tasks/{id}']?.patch;
  if (taskByIdPatch) {
    taskByIdPatch.requestBody ??= { content: { 'application/json': {} } };
    taskByIdPatch.requestBody.content ??= {};
    taskByIdPatch.requestBody.content['application/json'] ??= {};
    taskByIdPatch.requestBody.content['application/json'].example = examples.updateTask;
    ensureJsonContent(taskByIdPatch, '200').example = {
      ...examples.task,
      completed: true,
      status: 'done',
    };
    ensureJsonContent(taskByIdPatch, '401').example = examples.apiError('Unauthorized');
    ensureJsonContent(taskByIdPatch, '404').example = examples.apiError('Task not found');
    ensureJsonContent(taskByIdPatch, '500').example = examples.apiError('Failed to update task');
  }

  const taskByIdDelete = paths['/tasks/{id}']?.delete;
  if (taskByIdDelete) {
    ensureJsonContent(taskByIdDelete, '200').example = { ok: true };
    ensureJsonContent(taskByIdDelete, '401').example = examples.apiError('Unauthorized');
    ensureJsonContent(taskByIdDelete, '404').example = examples.apiError('Task not found');
  }
}

function authPaths() {
  return {
    '/auth/sign-up/email': {
      post: {
        tags: ['auth'],
        summary: 'Register a user with email and password',
        description: 'Creates a new user account and starts an authenticated session.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: 'AuthSignUp#' },
              example: examples.authSignUp,
            },
          },
        },
        responses: {
          200: {
            description: 'User registered',
            content: {
              'application/json': {
                schema: { $ref: 'AuthUserResponse#' },
                example: examples.authUser,
              },
            },
          },
          400: {
            description: 'Invalid registration payload',
            content: {
              'application/json': {
                schema: { $ref: 'AuthError#' },
                example: {
                  message: 'User already exists',
                  code: 'USER_ALREADY_EXISTS',
                  status: 400,
                },
              },
            },
          },
        },
      },
    },
    '/auth/sign-in/email': {
      post: {
        tags: ['auth'],
        summary: 'Sign in with email and password',
        description:
          'Authenticates a user and returns the user profile while setting the session cookie.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: 'AuthCredentials#' },
              example: examples.authSignIn,
            },
          },
        },
        responses: {
          200: {
            description: 'User authenticated',
            content: {
              'application/json': {
                schema: { $ref: 'AuthUserResponse#' },
                example: examples.authUser,
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: { $ref: 'AuthError#' },
                example: examples.authError,
              },
            },
          },
        },
      },
    },
    '/auth/sign-out': {
      post: {
        tags: ['auth'],
        summary: 'Sign out the current session',
        description: 'Clears the session cookie for the authenticated user.',
        security: authCookieSecurity,
        responses: {
          200: {
            description: 'Session cleared',
            content: {
              'application/json': {
                schema: { $ref: 'AuthSignOutResponse#' },
                example: examples.authSignOut,
              },
            },
          },
          401: {
            description: 'No active session',
            content: {
              'application/json': {
                schema: { $ref: 'AuthError#' },
                example: {
                  message: 'Unauthorized',
                  code: 'UNAUTHORIZED',
                  status: 401,
                },
              },
            },
          },
        },
      },
    },
    '/auth/session': {
      get: {
        tags: ['auth'],
        summary: 'Fetch the current auth session',
        description:
          'Returns the Better Auth session and user. This endpoint is cookie-based; send the session cookie to retrieve an authenticated session.',
        security: authCookieSecurity,
        responses: {
          200: {
            description: 'Session response',
            content: {
              'application/json': {
                schema: { $ref: 'AuthSessionResponse#' },
                example: examples.authSession,
              },
            },
          },
        },
      },
    },
  } as const;
}

export async function registerOpenApi(app: FastifyInstance) {
  for (const schema of sharedSchemas) {
    app.addSchema(schema);
  }

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Yotara API',
        version: '0.1.0',
        description:
          'Machine-readable API documentation for Yotara. Session-based endpoints use the Better Auth cookie.',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Local development server',
        },
      ],
      tags: [
        { name: 'meta', description: 'Service metadata and health endpoints' },
        { name: 'tasks', description: 'Authenticated task CRUD endpoints' },
        { name: 'auth', description: 'Better Auth session and credential flows' },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
            description: 'Better Auth session cookie',
          },
        },
      },
    },
    transformObject(documentObject) {
      if (!('openapiObject' in documentObject)) {
        return documentObject.swaggerObject;
      }

      const openapiObject = {
        ...documentObject.openapiObject,
        paths: {
          ...(documentObject.openapiObject.paths ?? {}),
          ...authPaths(),
        },
      };

      addOpenApiExamples(openapiObject.paths as OpenApiPathRecord);

      return openapiObject as never;
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  });

  app.get(
    '/docs/openapi.json',
    {
      schema: {
        hide: true,
      } satisfies FastifySchema,
    },
    async () => app.swagger(),
  );
}

export function withJsonResponse(schema: RouteOptions['schema']): RouteOptions['schema'] {
  return {
    ...schema,
    consumes: ['application/json'],
    produces: ['application/json'],
  };
}
