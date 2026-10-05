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
      url: 'https://aditya-universal-backend.onrender.com',
      description: 'Production (Render)',
    },
  ],
  components: {
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'ok' },
          database: { type: 'string', example: 'connected' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'RESOURCE_NOT_FOUND' },
              message: { type: 'string', example: 'Resource not found' },
              details: { type: 'object' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
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
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } },
            },
          },
          503: {
            description: 'Backend is running but database is disconnected',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } },
            },
          },
        },
      },
    },
  },
};
