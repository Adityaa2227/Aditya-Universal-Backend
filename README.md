# Aditya Backend

> **Universal Personal Backend Platform** for all future websites, Chrome extensions, automation tools, dashboards, and personal applications.

[![Node.js](https://img.shields.io/badge/Node.js-v22-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/Express-4.21-lightgrey.svg)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-green.svg)](https://www.mongodb.com/atlas)
[![Deployed on Render](https://img.shields.io/badge/Deployed%20on-Render-46E3B7.svg)](https://render.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 1. What is Aditya Backend?

As a developer building personal projects, websites, Chrome extensions, dashboards, and automation utilities, deploying a separate backend server and database for every small idea is slow, tedious, expensive, and difficult to maintain.

**Aditya Backend** solves this problem by providing:

```text
ONE backend deployment (Render: https://aditya-backend.onrender.com)
+
ONE MongoDB Atlas database
+
MANY isolated, pluggable project modules
```

Every new project becomes an isolated module inside this platform without requiring new infrastructure or paid custom domains:
- `https://aditya-backend.onrender.com/api/v1/auth`
- `https://aditya-backend.onrender.com/api/v1/api-keys`
- `https://aditya-backend.onrender.com/api/v1/notes` *(future)*
- `https://aditya-backend.onrender.com/api/v1/jobs` *(future)*
- `https://aditya-backend.onrender.com/api/v1/expenses` *(future)*
- `https://aditya-backend.onrender.com/api/v1/bookmarks` *(future)*

---

## 2. High-Level Architecture

The platform uses a **Modular Monolith** architecture. Modules are completely self-contained with their own models, validations, controllers, routes, and services, sharing only standard core infrastructure.

```text
┌────────────────────────────────────────────────────────┐
│                      Client Apps                       │
│  Chrome Extensions • Personal Dashboards • Websites    │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS (Bearer JWT / X-API-Key)
                            ▼
┌────────────────────────────────────────────────────────┐
│             Render Web Service Deployment              │
│       https://aditya-backend.onrender.com              │
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
│  │ │     auth      │ │    apiKey     │ │ <future> │ │  │
│  │ └───────────────┘ └───────────────┘ └──────────┘ │  │
│  └────────────────────────┬─────────────────────────┘  │
└───────────────────────────┼────────────────────────────┘
                            │ Mongoose ODM
                            ▼
┌────────────────────────────────────────────────────────┐
│                  MongoDB Atlas                         │
│               Database: aditya-backend                 │
│                                                        │
│  Collections: users • apiKeys • <future_collections>   │
└────────────────────────────────────────────────────────┘
```

### Clean Layering Pattern

Within every module, data flows strictly through one-way layered boundaries:

```text
HTTP Request
     ↓
Route (with Zod validation middleware & auth guard)
     ↓
Controller (Thin: unpacks inputs, formats standard response)
     ↓
Service (Pure business logic)
     ↓
Model (Mongoose schema, validation, indexes)
     ↓
MongoDB Atlas
```

---

## 3. Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v20+) | High performance, asynchronous I/O |
| **Language** | TypeScript (Strict Mode) | Type safety, maintainability, zero `any` policy |
| **Web Framework** | Express.js | Lightweight, fast, unopinionated |
| **Database** | MongoDB Atlas & Mongoose | Flexible document model with indexing and schemas |
| **Validation** | Zod | Runtime schema validation for requests & environment |
| **Authentication** | JWT (`jsonwebtoken`) & `bcryptjs` | Stateless authentication & salted password hashing |
| **Security** | Helmet, CORS, `express-rate-limit` | Industry-standard HTTP protection & brute-force defense |
| **Logging** | Pino & `pino-http` | Structured, JSON logging with sensitive data redaction |
| **Documentation** | Swagger / OpenAPI 3.0 | Interactive API documentation at `/api-docs` |
| **Testing** | Vitest, Supertest, `mongodb-memory-server` | Fast, isolated tests without touching production DB |
| **Deployment** | Render (Free Web Service) | Auto-deploy from GitHub, SSL included, zero-cost setup |

---

## 4. Project Structure

```text
aditya-backend/
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── .prettierrc               # Code formatting rules
├── package.json              # Project dependencies and scripts
├── render.yaml               # Render Infrastructure-as-Code blueprint
├── tsconfig.json             # Strict TypeScript compiler configuration
├── vitest.config.ts          # Vitest test runner configuration
├── README.md                 # Complete documentation
│
├── scripts/
│   └── generate-module.ts    # CLI code generator for new modules
│
├── src/
│   ├── config/
│   │   ├── env.ts            # Type-safe environment parsing & validation
│   │   └── database.ts       # MongoDB connection & lifecycle management
│   │
│   ├── core/                 # Shared platform infrastructure
│   │   ├── errors/
│   │   │   ├── AppError.ts   # Custom operational error class
│   │   │   └── errorHandler.ts # Centralized Express error handler
│   │   ├── middleware/
│   │   │   ├── auth.ts       # requireAuth & optionalAuth JWT guards
│   │   │   ├── apiKey.ts     # requireApiKey header validation guard
│   │   │   ├── rateLimiter.ts # General & authentication rate limiters
│   │   │   ├── requestLogger.ts # Structured request ID & timing logger
│   │   │   └── validate.ts   # Zod request validation middleware
│   │   ├── types/
│   │   │   └── index.ts      # Express Request extensions & core interfaces
│   │   └── utils/
│   │       ├── logger.ts     # Pino logger instance with data redaction
│   │       └── response.ts   # Standard API response formatting helpers
│   │
│   ├── docs/
│   │   └── swagger.ts        # OpenAPI 3.0 document definition
│   │
│   ├── modules/              # Pluggable project modules
│   │   ├── health/           # Health check module (/health)
│   │   │   ├── health.controller.ts
│   │   │   └── health.routes.ts
│   │   ├── auth/             # User authentication (/api/v1/auth)
│   │   │   ├── auth.model.ts
│   │   │   ├── auth.validation.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.routes.ts
│   │   └── apiKey/           # Project API Key system (/api/v1/api-keys)
│   │       ├── apiKey.model.ts
│   │       ├── apiKey.validation.ts
│   │       ├── apiKey.service.ts
│   │       ├── apiKey.controller.ts
│   │       └── apiKey.routes.ts
│   │
│   ├── routes.ts             # Central route registration (/api/v1)
│   ├── app.ts                # Express app setup & middleware pipeline
│   └── server.ts             # Server startup & graceful shutdown
│
└── tests/                    # Automated integration & unit test suite
    ├── setup.ts              # In-memory MongoDB initialization
    ├── health.test.ts        # Health check tests
    ├── auth.test.ts          # Auth module tests (register, login, me)
    ├── apiKey.test.ts        # API Key management & middleware tests
    └── errors.test.ts        # Error handling tests
```

---

## 5. Standard API Response Specification

All endpoints return a uniform JSON structure.

### Successful Response (Single Entity or Object)
```json
{
  "success": true,
  "data": {
    "id": "66a1b2c3d4e5f67890123456",
    "name": "Aditya"
  },
  "message": "Resource fetched successfully"
}
```

### Successful Response (List / Array)
```json
{
  "success": true,
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "message": "Items fetched successfully"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested item does not exist"
  }
}
```

### Validation Error Response (HTTP 400)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

---

## 6. Local Setup and Development

### Prerequisites
- **Node.js**: v20 or higher
- **MongoDB**: Local MongoDB instance or free MongoDB Atlas URI

### Step-by-Step Setup

1. **Clone the repository**:
   ```bash
   git clone <your-github-repo-url>
   cd aditya-backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your settings:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/aditya-backend
   JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long_for_security
   JWT_EXPIRES_IN=7d
   CORS_ORIGINS=*
   LOG_LEVEL=info
   ```

4. **Start Development Server**:
   ```bash
   npm run dev
   ```
   The server starts with automatic hot-reloading on code changes.

5. **Access Interactive API Documentation**:
   Open in your browser:
   ```text
   http://localhost:5000/api-docs
   ```

6. **Check Health**:
   ```text
   http://localhost:5000/health
   ```

---

## 7. Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts server in development mode with `tsx` hot-reloading |
| `npm run build` | Compiles strict TypeScript to `./dist` |
| `npm run start` | Runs compiled production server from `./dist/server.js` |
| `npm test` | Runs complete automated test suite via Vitest & in-memory MongoDB |
| `npm run test:watch` | Runs tests in interactive watch mode |
| `npm run lint` | Runs ESLint check across all files |
| `npm run lint:fix` | Fixes auto-fixable ESLint issues |
| `npm run format` | Formats all code with Prettier |
| `npm run format:check` | Verifies code formatting compliance |
| `npm run generate:module <name>` | **CLI generator** to scaffold a new production-ready module in 1 second |

---

## 8. Adding a New Project Module

Whenever you start a new personal project, you can add a backend module in seconds.

### Method 1: Using the Automated CLI Generator (Recommended)

Run the generator with your project module name:
```bash
npm run generate:module bookmarks
```

This instantly creates:
```text
src/modules/bookmarks/
├── bookmarks.model.ts
├── bookmarks.validation.ts
├── bookmarks.service.ts
├── bookmarks.controller.ts
└── bookmarks.routes.ts
```

Then, simply register it in `src/routes.ts`:
```typescript
import { bookmarksRoutes } from './modules/bookmarks/bookmarks.routes';

// Register inside v1Router:
v1Router.use('/bookmarks', bookmarksRoutes);
```

Your new API is now live at:
```text
https://aditya-backend.onrender.com/api/v1/bookmarks
```

### Method 2: Manual Creation

1. Create a folder under `src/modules/<module-name>/`.
2. Implement:
   - `<module-name>.model.ts`: Mongoose schema and model.
   - `<module-name>.validation.ts`: Zod request schemas.
   - `<module-name>.service.ts`: Pure business logic and database queries.
   - `<module-name>.controller.ts`: Thin controller returning `sendSuccess` or `sendCreated`.
   - `<module-name>.routes.ts`: Express router using `validateRequest()` and optional/required auth guards.
3. Export `<module-name>Routes` and mount it inside `src/routes.ts`.

---

## 9. API Key System & Extension Security

Aditya Backend provides a first-class **API Key System** for personal tools, server-side scripts, and automation jobs.

### Key Management Endpoints
- `POST /api/v1/api-keys`: Create a key for a project (e.g. `chrome-extension`).
  - **Returns the raw key ONCE** (format: `ak_live_<random_48_hex_chars>`).
  - **Stores only a secure SHA-256 hash** in MongoDB Atlas.
- `GET /api/v1/api-keys`: List created keys, prefixes, and projects (never reveals secret hashes).
- `DELETE /api/v1/api-keys/:id`: Immediately revokes a key.

### Using the API Key
Send the key in the `X-API-Key` HTTP header:
```http
GET /api/v1/my-module
X-API-Key: ak_live_7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
```

> [!CAUTION]
> **CRITICAL SECURITY REQUIREMENT FOR BROWSER EXTENSIONS & CLIENT-SIDE APPS:**
> **Never embed secret API keys directly into publicly distributed frontend or browser extension code!**
> Anyone inspecting your extension's JavaScript bundle or using Chrome DevTools can extract your API key and make unauthorized calls.
>
> **Best Practices for Extensions & Client Apps:**
> 1. **User Authentication:** Allow users (or yourself) to log in via `/api/v1/auth/login` to obtain a short-lived JWT token stored in `chrome.storage.local`.
> 2. **Extension Options Page:** If you want personal API key access, provide an Options/Settings page where you paste your personal API key locally instead of hardcoding it in the source.
> 3. **Server-Side Scripts:** Use API keys freely in serverless functions, GitHub Actions, private local scripts, and webhooks where source code is private.

---

## 10. MongoDB Atlas Setup Guide

Aditya Backend utilizes a single MongoDB Atlas database cluster for all modules.

1. **Create MongoDB Atlas Account**:
   Sign up for free at [mongodb.com/atlas](https://www.mongodb.com/atlas).

2. **Create Free M0 Cluster**:
   - Choose AWS or Google Cloud in your closest region.
   - Select the free `M0` sandbox tier (512 MB storage, shared RAM, free forever).

3. **Create Database User**:
   - Go to **Security → Database Access → Add New Database User**.
   - Authentication Method: **Password**.
   - Username: `aditya_admin` (or your choice).
   - Generate a strong password and save it securely.
   - Database User Privileges: `Read and write to any database`.

4. **Configure Network Access**:
   - Go to **Security → Network Access → Add IP Address**.
   - For Render and cloud deployments: Add `0.0.0.0/0` (Allow Access from Anywhere) with a comment like `Render Cloud Backend`.
   - *Security Note:* Atlas requires both username/password authentication and network access; passwords are protected by SCRAM-SHA-256.

5. **Obtain Connection String**:
   - Go to **Database → Clusters → Connect → Drivers**.
   - Select `Node.js` driver.
   - Copy connection string:
     ```text
     mongodb+srv://aditya_admin:<password>@cluster0.xyz.mongodb.net/aditya-backend?retryWrites=true&w=majority
     ```
   - Replace `<password>` with your database user password and set database name to `aditya-backend`.

6. **Set Environment Variable**:
   In your local `.env` and Render dashboard, set `MONGODB_URI` to this connection string.

---

## 11. Render Deployment Guide

The backend is configured for deployment on [Render](https://render.com) using the included `render.yaml` blueprint.

### Deployment Steps

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Aditya Backend"
   git remote add origin https://github.com/<your-username>/aditya-backend.git
   git push -u origin main
   ```

2. **Create Render Web Service**:
   - Log into [dashboard.render.com](https://dashboard.render.com).
   - Click **New + → Web Service**.
   - Connect your GitHub repository `aditya-backend`.
   - Settings:
     - **Name**: `aditya-backend`
     - **Region**: Choose closest to your MongoDB Atlas region (e.g. Oregon or Frankfurt)
     - **Branch**: `main`
     - **Runtime**: `Node`
     - **Build Command**: `npm install && npm run build`
     - **Start Command**: `npm run start`
     - **Instance Type**: `Free`

3. **Configure Environment Variables in Render**:
   In the Render dashboard under **Environment**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (Render binds automatically)
   - `MONGODB_URI`: `<Your MongoDB Atlas Connection String>`
   - `JWT_SECRET`: `<A random 64-character secret string>`
   - `JWT_EXPIRES_IN`: `7d`
   - `CORS_ORIGINS`: `*` (or comma-separated list of your personal frontend domains)
   - `LOG_LEVEL`: `info`
   - `RATE_LIMIT_WINDOW_MS`: `60000`
   - `RATE_LIMIT_MAX_REQUESTS`: `100`
   - `AUTH_RATE_LIMIT_WINDOW_MS`: `900000`
   - `AUTH_RATE_LIMIT_MAX_REQUESTS`: `15`

4. **Verify Health**:
   Once deployed, test:
   ```text
   https://aditya-backend.onrender.com/health
   ```
   Response:
   ```json
   {
     "success": true,
     "status": "ok",
     "database": "connected",
     "timestamp": "2026-10-06T02:00:00.000Z"
   }
   ```

5. **Continuous Deployment**:
   Every time you push a new module or fix to `main`, Render automatically triggers a zero-downtime deployment.

---

## 12. Graceful Shutdown & Reliability

Aditya Backend includes enterprise-grade process lifecycle management:
- Intercepts `SIGTERM` (sent by Render during deployments and server restarts) and `SIGINT`.
- Closes the HTTP server so no new incoming connections are accepted.
- Flushes in-flight HTTP requests.
- Closes MongoDB Mongoose connections cleanly without data loss.
- Safeguarded with an unref'd 10-second timeout to prevent zombie processes.

---

## 13. Security Features

- **Helmet**: Adds security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, etc.).
- **CORS Protection**: Whitelists authorized origins; blocks unauthorized origins with `FORBIDDEN` status.
- **Rate Limiting**: Defends against denial-of-service and brute force password attacks.
- **Payload Size Limits**: Strict `1mb` maximum JSON and URL-encoded bodies.
- **Password Protection**: Salted password hashing with `bcryptjs`.
- **API Key Hashing**: SHA-256 cryptographic one-way hashes.
- **No Stack Leakage**: Stack traces are stripped from responses in production.
- **Sensitive Log Redaction**: Pino automatically censors passwords, tokens, and authorization headers.

---

## 14. License

MIT License. Built with ❤️ by Aditya as a universal backend for endless future ideas.
