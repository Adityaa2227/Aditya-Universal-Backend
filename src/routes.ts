import { Router } from 'express';
import { authRoutes } from './modules/auth/auth.routes';
import { apiKeyRoutes } from './modules/apiKey/apiKey.routes';

const v1Router = Router();

// Version 1 Routes
v1Router.use('/auth', authRoutes);
v1Router.use('/api-keys', apiKeyRoutes);

// FUTURE MODULES: Register new modules here with a single line
// Example:
// import { notesRoutes } from './modules/notes/notes.routes';
// v1Router.use('/notes', notesRoutes);
//
// import { jobsRoutes } from './modules/jobs/jobs.routes';
// v1Router.use('/jobs', jobsRoutes);

export const routes = Router();

// Mount API version routers
routes.use('/v1', v1Router);
