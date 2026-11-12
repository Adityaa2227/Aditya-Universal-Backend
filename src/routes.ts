import { Router } from 'express';
import { formFillerRoutes } from './modules/form-filler/form-filler.routes';
import { portfolioRoutes } from './modules/portfolio/portfolio.routes';

const v1Router = Router();

// Form Filler - Google Forms & Microsoft Forms AI autofill
v1Router.use('/form-filler', formFillerRoutes);

// Portfolio - adityaagarwalportfolio.vercel.app (projects, resume, reviews, contact, admin)
v1Router.use('/portfolio', portfolioRoutes);

// Future project modules will be mounted here:
// import { notesRoutes } from './modules/notes/notes.routes';
// v1Router.use('/notes', notesRoutes);

export const routes = Router();

// Mount API version routers
routes.use('/v1', v1Router);
