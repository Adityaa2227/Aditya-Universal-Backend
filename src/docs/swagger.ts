export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Aditya Backend API',
    version: '1.0.0',
    description:
      'Universal Personal Backend Platform designed for all future personal websites, Chrome extensions, dashboards, and automation tools. Hosted on Render with MongoDB Atlas.',
    contact: {
      name: 'Aditya',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current Environment Server',
    },
    {
      url: 'https://aditya-backend.onrender.com',
      description: 'Production (Render)',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from /api/v1/auth/login or /api/v1/auth/register',
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Project API Key for Chrome extensions, scripts, and personal apps',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid request data' },
              details: { type: 'object' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      HealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'ok' },
          database: { type: 'string', example: 'connected' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'Aditya', minLength: 2, maxLength: 50 },
          email: { type: 'string', format: 'email', example: 'aditya@example.com' },
          password: { type: 'string', format: 'password', example: 'SecurePassword123', minLength: 6 },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'aditya@example.com' },
          password: { type: 'string', format: 'password', example: 'SecurePassword123' },
        },
      },
      AuthSuccessResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  id: { type: 'string', example: '66a1b2c3d4e5f67890123456' },
                  name: { type: 'string', example: 'Aditya' },
                  email: { type: 'string', example: 'aditya@example.com' },
                  role: { type: 'string', example: 'user' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
              token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            },
          },
          message: { type: 'string', example: 'Login successful' },
        },
      },
      UserProfileResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '66a1b2c3d4e5f67890123456' },
              name: { type: 'string', example: 'Aditya' },
              email: { type: 'string', example: 'aditya@example.com' },
              role: { type: 'string', example: 'user' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          message: { type: 'string', example: 'User profile fetched successfully' },
        },
      },
      CreateApiKeyRequest: {
        type: 'object',
        required: ['name', 'project'],
        properties: {
          name: { type: 'string', example: 'Chrome Extension Key', minLength: 2, maxLength: 100 },
          project: { type: 'string', example: 'chrome-extension', pattern: '^[a-z0-9-_]+$' },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            example: ['*'],
            default: ['*'],
          },
        },
      },
      ApiKeyCreatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              id: { type: 'string', example: '66a1b2c3d4e5f67890123456' },
              name: { type: 'string', example: 'Chrome Extension Key' },
              project: { type: 'string', example: 'chrome-extension' },
              keyPrefix: { type: 'string', example: 'ak_live_7c8d' },
              apiKey: {
                type: 'string',
                example: 'ak_live_7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
                description: 'RAW KEY ONLY DISPLAYED ONCE',
              },
              permissions: { type: 'array', items: { type: 'string' }, example: ['*'] },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
          message: {
            type: 'string',
            example: 'API key generated successfully. Store it safely, as it will NOT be shown again.',
          },
        },
      },
      ApiKeyItem: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '66a1b2c3d4e5f67890123456' },
          name: { type: 'string', example: 'Chrome Extension Key' },
          project: { type: 'string', example: 'chrome-extension' },
          keyPrefix: { type: 'string', example: 'ak_live_7c8d' },
          permissions: { type: 'array', items: { type: 'string' }, example: ['*'] },
          isRevoked: { type: 'boolean', example: false },
          lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check service health & database connectivity',
        description: 'Returns the health status of the backend and MongoDB connection.',
        responses: {
          200: {
            description: 'Backend is healthy and database is connected',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
          503: {
            description: 'Backend is running but database is disconnected',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } } },
        },
        responses: {
          201: {
            description: 'User registered successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSuccessResponse' } } },
          },
          400: {
            description: 'Validation error',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          409: {
            description: 'User already exists',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with email and password',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          200: {
            description: 'Login successful',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthSuccessResponse' } } },
          },
          401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current authenticated user profile',
        security: [{ BearerAuth: [] }],
        responses: {
          200: {
            description: 'Profile fetched successfully',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfileResponse' } } },
          },
          401: {
            description: 'Unauthorized - Missing or invalid token',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },
    '/api/v1/api-keys': {
      post: {
        tags: ['API Keys'],
        summary: 'Generate a new API key for a project or extension',
        description: 'Returns the raw API key ONCE. Save it immediately.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateApiKeyRequest' } } },
        },
        responses: {
          201: {
            description: 'API key created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiKeyCreatedResponse' } } },
          },
          401: { description: 'Unauthorized' },
        },
      },
      get: {
        tags: ['API Keys'],
        summary: 'List project API keys',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'project',
            in: 'query',
            description: 'Filter keys by project name',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'List of API keys',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ApiKeyItem' },
                    },
                    message: { type: 'string', example: 'API keys fetched successfully' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/api-keys/{id}': {
      delete: {
        tags: ['API Keys'],
        summary: 'Revoke an API key by ID',
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: '24-hex-character MongoDB ObjectId of the key',
          },
        ],
        responses: {
          200: {
            description: 'API key revoked successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'API key revoked successfully' },
                  },
                },
              },
            },
          },
          404: { description: 'API Key not found' },
        },
      },
    },
  },
};
