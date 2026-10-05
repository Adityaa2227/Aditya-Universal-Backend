import { Router } from 'express';

const v1Router = Router();

// Future project modules will be mounted here:
// Example:
// import { notesRoutes } from './modules/notes/notes.routes';
// v1Router.use('/notes', notesRoutes);

export const routes = Router();

// Mount API version routers
routes.use('/v1', v1Router);
