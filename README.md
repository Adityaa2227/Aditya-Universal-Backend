# Aditya Universal Backend Platform 🚀

A production-grade, highly modular TypeScript backend platform built to power all of Aditya's personal websites, Chrome extensions (like Google Forms & Microsoft Forms AI Filler), automation tools, and future web applications.

Hosted on **Render** with **MongoDB Atlas**, structured with clean architectural layers, robust security, strict validation, centralized error handling, and interactive **Swagger (OpenAPI 3.0)** documentation.

---

## 1. Quick URLs

| Environment | Base URL | Swagger Docs | Health Check |
|---|---|---|---|
| **Production (Render)** | `https://aditya-universal-backend.onrender.com` | [`/api-docs`](https://aditya-universal-backend.onrender.com/api-docs) | [`/health`](https://aditya-universal-backend.onrender.com/health) |
| **Local Development** | `http://localhost:5000` | [`http://localhost:5000/api-docs`](http://localhost:5000/api-docs) | [`http://localhost:5000/health`](http://localhost:5000/health) |

> 📌 **URL Convention**: All feature modules are mounted under `/api/v1/<module-name>/`.  
> For example: `https://aditya-universal-backend.onrender.com/api/v1/form-filler/`

---

## 2. Active Modules

### 🏥 1. System Health (`/health`)
- `GET /health` — Check server status, uptime, and MongoDB connectivity.

### 🤖 2. Form Filler AI (`/api/v1/form-filler`)
Powers the Chrome Extension for **Google Forms**, **Microsoft Forms**, and job application autofill. Uses a **4-level multi-AI fallback system** (Groq `llama-3.3-70b` → Cerebras `llama-3.3-70b` → OpenRouter `meta-llama/llama-3.3-70b-instruct` → Google Gemini 2.5 Flash).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/form-filler/health` | Service & provider status check |
| `GET` | `/api/v1/form-filler/providers` | Lists active AI providers in fallback order |
| `POST` | `/api/v1/form-filler/fill` | Batch autofill scanned form fields |
| `POST` | `/api/v1/form-filler/ai-answer` | Answer a single question with AI |

---

## 3. Technology Stack

- **Runtime**: Node.js v22
- **Language**: TypeScript (Strict Mode)
- **Framework**: Express.js
- **Database**: MongoDB Atlas + Mongoose
- **Validation**: Zod
- **Security**: Helmet, CORS, `express-rate-limit`
- **Logging**: Pino & `pino-http` (structured JSON in prod, pretty in dev)
- **API Docs**: Swagger / OpenAPI 3.0 at `/api-docs`
- **AI Integrations**: Groq SDK, Cerebras SDK, OpenRouter REST, Google Generative AI SDK
- **Deployment**: Render Web Service (`render.yaml`)

---

## 4. Project Structure

```text
aditya-backend/
├── .env                      # Local environment configuration
├── .env.example              # Environment variables template
├── package.json              # Scripts & dependencies
├── render.yaml               # Render deployment blueprint
├── tsconfig.json             # Strict TypeScript compiler options
├── README.md
│
├── scripts/
│   └── generate-module.ts    # CLI module generator
│
└── src/
    ├── config/
    │   ├── env.ts            # Type-safe environment validation
    │   └── database.ts       # MongoDB Atlas connection & graceful shutdown
    ├── core/                 # Shared platform infrastructure
    │   ├── errors/           # AppError & centralized errorHandler
    │   ├── middleware/       # Rate limiting, requestLogger, Zod validate
    │   ├── types/            # Express Request types
    │   └── utils/            # Pino logger, standard response helper
    ├── docs/
    │   └── swagger.ts        # OpenAPI 3.0 specification & schema registry
    ├── modules/              # Pluggable feature modules
    │   ├── health/           # Health check module (/health)
    │   └── form-filler/      # Form filler AI module (/api/v1/form-filler)
    ├── routes.ts             # Central API route registration (/api/v1)
    ├── app.ts                # Express app & middleware setup
    └── server.ts             # Server entrypoint & graceful shutdown
```

---

## 5. Adding a New Project Module in Seconds

Whenever you build a new project or feature (e.g. `bookmarks`), run:

```bash
npm run generate:module bookmarks
```

This scaffolds:
```text
src/modules/bookmarks/
├── bookmarks.model.ts        # Mongoose Schema
├── bookmarks.validation.ts   # Zod Validation
├── bookmarks.service.ts      # Business Logic
├── bookmarks.controller.ts   # Thin Controller
└── bookmarks.routes.ts       # Express Routes
```

Register it in **`src/routes.ts`**:
```typescript
import { bookmarksRoutes } from './modules/bookmarks/bookmarks.routes';

// Add inside v1Router:
v1Router.use('/bookmarks', bookmarksRoutes);
```

Your API is instantly accessible at:
```text
https://aditya-universal-backend.onrender.com/api/v1/bookmarks
```

---

## 6. How to Update Swagger / OpenAPI for Future Changes 📖

All Swagger / OpenAPI 3.0 documentation is centralized in **`src/docs/swagger.ts`**. Whenever you add or update endpoints, follow this 4-step checklist:

### Step 1: Add Tag (if new module)
Add a tag entry under `tags`:
```typescript
tags: [
  // ...existing tags
  {
    name: 'Bookmarks',
    description: 'Manage personal bookmarks and links',
  },
]
```

### Step 2: Define Data Schemas
Add your Request and Response schemas under `components.schemas`:
```typescript
components: {
  schemas: {
    CreateBookmarkRequest: {
      type: 'object',
      required: ['url', 'title'],
      properties: {
        url: { type: 'string', example: 'https://github.com' },
        title: { type: 'string', example: 'GitHub' },
        tags: { type: 'array', items: { type: 'string' }, example: ['dev', 'git'] },
      },
    },
    BookmarkResponse: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
            url: { type: 'string', example: 'https://github.com' },
            title: { type: 'string', example: 'GitHub' },
          },
        },
      },
    },
  },
}
```

### Step 3: Add Path & HTTP Methods
Add the endpoint under `paths`:
```typescript
paths: {
  '/api/v1/bookmarks': {
    post: {
      tags: ['Bookmarks'],
      summary: 'Create a new bookmark',
      description: 'Saves a new bookmark to the user database.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateBookmarkRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Bookmark created successfully',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/BookmarkResponse' } },
          },
        },
        400: {
          description: 'Validation failed',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
      },
    },
  },
}
```

### Step 4: Verify & Deploy
1. Run `npx tsc --noEmit` to ensure TypeScript types are valid.
2. Start the dev server: `npm run dev`
3. Visit `http://localhost:5000/api-docs` to view and interactively test your new endpoints in the Swagger UI.
4. Commit and push:
   ```bash
   git add src/docs/swagger.ts README.md
   git commit -m "docs: update swagger spec for <module>"
   git push origin main
   ```
   Render will deploy the new documentation automatically!

---

## 7. Local Setup & Running

```bash
# 1. Install dependencies
npm install

# 2. Build TypeScript
npm run build

# 3. Start development server (with hot reload)
npm run dev
```

### Endpoints
- **Health Check**: `http://localhost:5000/health`
- **Swagger Documentation**: `http://localhost:5000/api-docs`
- **Form Filler Health**: `http://localhost:5000/api/v1/form-filler/health`

---

## 8. Render Deployment

1. Push your repository to GitHub `main` branch.
2. Render automatically builds and deploys via `render.yaml`.
3. Set the following environment variables in the Render dashboard:
   - `MONGODB_URI`: `<Your MongoDB Atlas connection string>`
   - `GROQ_API_KEY`: `<Your Groq API Key>`
   - `CEREBRAS_API_KEY`: `<Your Cerebras API Key>`
   - `OPENROUTER_API_KEY`: `<Your OpenRouter API Key>`
   - `GEMINI_API_KEY`: `<Your Google Gemini API Key>`