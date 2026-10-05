export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Aditya Universal Backend API',
    version: '1.0.0',
    description:
      'Universal Personal Backend Platform designed for all personal websites, Chrome extensions (like Google & Microsoft Forms AI Filler), automation tools, and services. Hosted on Render with MongoDB Atlas.',
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
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
  ],
  tags: [
    {
      name: 'Health',
      description: 'System health checks and uptime monitoring',
    },
    {
      name: 'Form Filler',
      description: 'AI-powered auto-fill for Google Forms, Microsoft Forms & ATS job applications',
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
              code: { type: 'string', example: 'BAD_REQUEST' },
              message: { type: 'string', example: 'fields array is required and must not be empty' },
              details: { type: 'object' },
            },
            required: ['code', 'message'],
          },
        },
        required: ['success', 'error'],
      },
      CandidateProfile: {
        type: 'object',
        description: 'Candidate profile details used for instant rule-based matching and AI context',
        properties: {
          fullName: { type: 'string', example: 'Aditya Agarwal' },
          email: { type: 'string', example: 'aditya@example.com' },
          phone: { type: 'string', example: '+91 9876543210' },
          location: { type: 'string', example: 'Bangalore, India' },
          college: { type: 'string', example: 'National Institute of Technology' },
          degree: { type: 'string', example: 'B.Tech' },
          major: { type: 'string', example: 'Computer Science and Engineering' },
          cgpa: { type: 'string', example: '8.85' },
          gradYear: { type: 'string', example: '2025' },
          currentEmployer: { type: 'string', example: 'Tech Corp' },
          currentRole: { type: 'string', example: 'Software Engineer Intern' },
          totalExperience: { type: 'string', example: '1 year' },
          skills: { type: 'string', example: 'Node.js, TypeScript, React, Python, MongoDB' },
          linkedin: { type: 'string', example: 'https://linkedin.com/in/aditya' },
          github: { type: 'string', example: 'https://github.com/aditya' },
        },
      },
      FormField: {
        type: 'object',
        required: ['id', 'label', 'type'],
        properties: {
          id: { type: 'string', example: 'entry.123456789' },
          label: { type: 'string', example: 'Why do you want to join our company?' },
          type: {
            type: 'string',
            enum: ['text', 'email', 'tel', 'number', 'textarea', 'select', 'radio', 'checkbox', 'date', 'url', 'aria-radio'],
            example: 'textarea',
          },
          required: { type: 'boolean', example: true },
          options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                text: { type: 'string', example: 'Yes' },
                value: { type: 'string', example: 'Yes' },
              },
            },
          },
        },
      },
      BatchFillRequest: {
        type: 'object',
        required: ['fields'],
        properties: {
          fields: {
            type: 'array',
            items: { $ref: '#/components/schemas/FormField' },
          },
          jobContext: {
            type: 'object',
            properties: {
              title: { type: 'string', example: 'Software Engineer' },
              company: { type: 'string', example: 'Google' },
              jdText: { type: 'string', example: 'Looking for a full-stack engineer proficient in TypeScript and backend systems.' },
            },
          },
          profile: { $ref: '#/components/schemas/CandidateProfile' },
        },
      },
      FillFieldResponse: {
        type: 'object',
        properties: {
          fieldId: { type: 'string', example: 'entry.123456789' },
          answer: { type: 'string', example: 'I am excited by the company mission and scale of engineering challenges.' },
          source: { type: 'string', enum: ['profile', 'ai'], example: 'ai' },
          provider: { type: 'string', example: 'groq' },
          model: { type: 'string', example: 'llama-3.3-70b-versatile' },
        },
      },
      BatchFillResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Filled 5 from profile, 3 via AI' },
          data: {
            type: 'object',
            properties: {
              results: {
                type: 'array',
                items: { $ref: '#/components/schemas/FillFieldResponse' },
              },
              stats: {
                type: 'object',
                properties: {
                  total: { type: 'number', example: 8 },
                  fromProfile: { type: 'number', example: 5 },
                  fromAI: { type: 'number', example: 3 },
                  failed: { type: 'number', example: 0 },
                },
              },
              provider: { type: 'string', example: 'groq' },
            },
          },
        },
      },
      ProvidersResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Active AI provider chain' },
          data: {
            type: 'object',
            properties: {
              providers: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', example: 'groq' },
                    models: {
                      type: 'array',
                      items: { type: 'string' },
                      example: ['llama-3.3-70b-versatile'],
                    },
                  },
                },
              },
              total: { type: 'number', example: 4 },
            },
          },
        },
      },
      FormFillerHealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          service: { type: 'string', example: 'form-filler' },
          activeProviders: { type: 'number', example: 4 },
          providers: {
            type: 'array',
            items: { type: 'string' },
            example: ['groq', 'cerebras', 'openrouter', 'gemini'],
          },
          timestamp: { type: 'string', format: 'date-time' },
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
    '/api/v1/form-filler/health': {
      get: {
        tags: ['Form Filler'],
        summary: 'Check Form Filler module and AI providers status',
        description: 'Verifies if at least one AI provider in the fallback chain is configured and active.',
        responses: {
          200: {
            description: 'Form filler is active with at least one AI provider configured',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/FormFillerHealthResponse' } },
            },
          },
          503: {
            description: 'Form filler is mounted but no AI providers have API keys set',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/FormFillerHealthResponse' } },
            },
          },
        },
      },
    },
    '/api/v1/form-filler/providers': {
      get: {
        tags: ['Form Filler'],
        summary: 'List active AI providers in fallback chain',
        description: 'Returns the ordered chain of fallback AI providers currently active (Groq -> Cerebras -> OpenRouter -> Gemini). Used by Chrome extension to display status.',
        responses: {
          200: {
            description: 'List of active providers',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ProvidersResponse' } },
            },
          },
        },
      },
    },
    '/api/v1/form-filler/fill': {
      post: {
        tags: ['Form Filler'],
        summary: 'Batch auto-fill form fields',
        description: 'Matches known profile fields (name, email, phone, college, etc.) immediately, and routes any unknown/open questions to the 4-level AI fallback system with candidate background and job context.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/BatchFillRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Batch fill results with answers and stats',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/BatchFillResponse' } },
            },
          },
          400: {
            description: 'Invalid input (e.g. empty fields array or over 100 fields)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
    '/api/v1/form-filler/ai-answer': {
      post: {
        tags: ['Form Filler'],
        summary: 'Answer a single field question with AI',
        description: 'Answers a single question using the multi-AI fallback chain.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['field'],
                properties: {
                  field: { $ref: '#/components/schemas/FormField' },
                  jobContext: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', example: 'Frontend Engineer' },
                      company: { type: 'string', example: 'Acme Corp' },
                      jdText: { type: 'string', example: 'Looking for React expertise.' },
                    },
                  },
                  profile: { $ref: '#/components/schemas/CandidateProfile' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Single field AI answer',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Field answered' },
                    data: { $ref: '#/components/schemas/FillFieldResponse' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Field object missing or invalid',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
        },
      },
    },
  },
};