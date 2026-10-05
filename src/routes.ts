import { Router } from 'express';
import { formFillerRoutes } from './modules/form-filler/form-filler.routes';

const v1Router = Router();

// Form Filler - Google Forms & Microsoft Forms AI autofill
v1Router.use('/form-filler', formFillerRoutes);

// Future project modules will be mounted here:
// import { notesRoutes } from './modules/notes/notes.routes';
// v1Router.use('/notes', notesRoutes);

export const routes = Router();

// Mount API version routers
routes.use('/v1', v1Router);
