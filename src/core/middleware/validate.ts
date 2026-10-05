import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodEffects } from 'zod';

type ValidationTarget = AnyZodObject | ZodEffects<AnyZodObject>;

export interface RequestValidators {
  body?: ValidationTarget;
  query?: ValidationTarget;
  params?: ValidationTarget;
}

export const validateRequest = (validators: RequestValidators) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (validators.params) {
        req.params = await validators.params.parseAsync(req.params);
      }
      if (validators.query) {
        req.query = await validators.query.parseAsync(req.query);
      }
      if (validators.body) {
        req.body = await validators.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
