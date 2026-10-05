# Aditya Universal Backend

> **Universal Personal Backend Platform** for all future personal websites, Chrome extensions, automation tools, dashboards, and applications.

[![Node.js](https://img.shields.io/badge/Node.js-v22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/atlas)
[![Deployed on Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7.svg)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. What is Aditya Universal Backend?

When building personal tools, websites, Chrome extensions, and automation scripts, deploying a separate backend server and database for every idea is slow, tedious, and messy.

**Aditya Universal Backend** solves this:

```text
ONE backend deployment on Render (https://aditya-universal-backend.onrender.com)
+
ONE MongoDB Atlas database (aditya-backend)
+
MANY isolated, pluggable project modules
```

Every project simply becomes a new isolated module inside this platform:
- `https://aditya-universal-backend.onrender.com/api/v1/notes`
- `https://aditya-universal-backend.onrender.com/api/v1/jobs`
- `https://aditya-universal-backend.onrender.com/api/v1/expenses`
- `https://aditya-universal-backend.onrender.com/api/v1/bookmarks`
- `https://aditya-universal-backend.onrender.com/api/v1/dashboard`

---

## 2. Architecture & Design

The platform uses a **Modular Monolith** architecture. Each module owns its schema and logic, while sharing common core infrastructure (centralized error handling, request logging, rate limiting, and CORS).

```text
┌────────────────────────────────────────────────────────┐
│                      Client Apps                       │
│  Chrome Extensions • Personal Dashboards • Websites    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS
                            ▼
┌────────────────────────────────────────────────────────┐
│             Render Web Service Deployment              │
│     https://aditya-universal-backend.onrender.com      │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Core Infrastructure                              │  │
│  │ Helmet • CORS • Rate Limiter • Pino Request Log  │  │
│  │ Centralized Error Handler (AppError)             │  │
│  └────────────────────────┬─────────────────────────┘  │
│                           │                            │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Modular Routing Layer (/api/v1)                  │  │
│  │ Route → Controller → Service → Model             │  │
│  │                                                  │  │
│  │ ┌───────────────┐ ┌───────────────┐ ┌──────────┐ │  │
│  │ │     notes     │ │     jobs      │ │ expenses │ │  │
│  │ └───────────────┘ └───────────────┘ └──────────┘ │  │
│  └────────────────────────┬─────────────────────────┘  │
└───────────────────────────┼────────────────────────────┘
                            │ Mongoose ODM
                            ▼
┌────────────────────────────────────────────────────────┐
│                  MongoDB Atlas                         │
│               Database: aditya-backend                 │
└────────────────────────────────────────────────────────┘
```

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
- **Deployment**: Render Web Service (`render.yaml`)

---

## 4. Project Structure

```text
aditya-backend/
├── .env                      # Local environment configuration
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── .prettierrc               # Prettier configuration
├── eslint.config.mjs         # ESLint configuration
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
    │
    ├── core/                 # Shared platform infrastructure
    │   ├── errors/
    │   │   ├── AppError.ts   # Custom operational error class
    │   │   └── errorHandler.ts # Centralized Express error handler
    │   ├── middleware/
    │   │   ├── rateLimiter.ts # General API rate limiter
    │   │   ├── requestLogger.ts # Structured request ID & timing logger
    │   │   └── validate.ts   # Zod request validation middleware
    │   ├── types/
    │   │   └── index.ts      # Express Request types
    │   └── utils/
    │       ├── logger.ts     # Pino logger with redaction
    │       └── response.ts   # Standard API response helpers
    │
    ├── docs/
    │   └── swagger.ts        # OpenAPI 3.0 specification
    │
    ├── modules/              # Project modules
    │   └── health/           # Health check module (/health)
    │       ├── health.controller.ts
    │       └── health.routes.ts
    │
    ├── routes.ts             # Central API route registration (/api/v1)
    ├── app.ts                # Express app & middleware setup
    └── server.ts             # Server entrypoint & graceful shutdown
```

---

## 5. Adding a New Project Module in Seconds

Whenever you build a new project (e.g. `bookmarks`), run:

```bash
npm run generate:module bookmarks
```

This instantly scaffolds:
```text
src/modules/bookmarks/
├── bookmarks.model.ts        # Mongoose Schema
├── bookmarks.validation.ts   # Zod Validation
├── bookmarks.service.ts      # Business Logic
├── bookmarks.controller.ts   # Thin Controller
└── bookmarks.routes.ts       # Express Routes
```

Then register it in **`src/routes.ts`** with one line:
```typescript
import { bookmarksRoutes } from './modules/bookmarks/bookmarks.routes';

// Add inside v1Router:
v1Router.use('/bookmarks', bookmarksRoutes);
```

Your API is live:
```text
https://aditya-universal-backend.onrender.com/api/v1/bookmarks
```

---

## 6. Local Setup & Running

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

---

## 7. Render Deployment

1. Push your repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com), create a **New Web Service**:
   - **Name**: `aditya-universal-backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `PORT`: `10000`
     - `MONGODB_URI`: `<Your MongoDB Atlas connection string>`
     - `CORS_ORIGINS`: `*`
     - `LOG_LEVEL`: `info`
3. Render will deploy automatically to:
   ```text
   https://aditya-universal-backend.onrender.com
   ```

---

## 8. Graceful Shutdown & Reliability

The server captures `SIGTERM` and `SIGINT` signals (sent by Render during deployments and restarts) to:
1. Stop accepting new HTTP requests.
2. Complete in-flight requests.
3. Cleanly close the MongoDB connection.
4. Exit cleanly with code 0.
