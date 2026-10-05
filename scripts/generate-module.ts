import fs from 'fs';
import path from 'path';

const rawName = process.argv[2];

if (!rawName) {
  console.error('\n❌ Error: Please provide a module name.');
  console.log('Usage: npm run generate:module <module-name>');
  console.log('Example: npm run generate:module notes\n');
  process.exit(1);
}

const moduleName = rawName.toLowerCase().trim();

if (!/^[a-z][a-z0-9_-]*$/.test(moduleName)) {
  console.error(
    `\n❌ Error: Invalid module name "${moduleName}". Use lowercase alphanumeric characters, dashes, or underscores.\n`,
  );
  process.exit(1);
}

// Convert kebab/snake to PascalCase (e.g. "job-tracker" -> "JobTracker")
const toPascalCase = (str: string): string => {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
};

const pascalName = toPascalCase(moduleName);
const targetDir = path.join(__dirname, '..', 'src', 'modules', moduleName);

if (fs.existsSync(targetDir)) {
  console.error(`\n❌ Error: Module "${moduleName}" already exists at ${targetDir}\n`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

// 1. Model Template
const modelContent = `import { Schema, model, Document } from 'mongoose';

export interface I${pascalName} extends Document {
  title: string;
  metadata?: Record<string, unknown>;
  userId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ${moduleName}Schema = new Schema<I${pascalName}>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete (ret as Record<string, unknown>).__v;
        return ret;
      },
    },
  },
);

export const ${pascalName}Model = model<I${pascalName}>('${pascalName}', ${moduleName}Schema);
`;

// 2. Validation Template
const validationContent = `import { z } from 'zod';

export const create${pascalName}Schema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title cannot exceed 200 characters'),
  metadata: z.record(z.unknown()).optional(),
});

export const update${pascalName}Schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title cannot exceed 200 characters')
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ${moduleName}ParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
});

export type Create${pascalName}Input = z.infer<typeof create${pascalName}Schema>;
export type Update${pascalName}Input = z.infer<typeof update${pascalName}Schema>;
`;

// 3. Service Template
const serviceContent = `import { ${pascalName}Model, I${pascalName} } from './${moduleName}.model';
import { Create${pascalName}Input, Update${pascalName}Input } from './${moduleName}.validation';
import { AppError } from '../../core/errors/AppError';

export class ${pascalName}Service {
  public static async list(userId?: string): Promise<I${pascalName}[]> {
    const filter = userId ? { userId } : {};
    return ${pascalName}Model.find(filter).sort({ createdAt: -1 });
  }

  public static async getById(id: string): Promise<I${pascalName}> {
    const item = await ${pascalName}Model.findById(id);
    if (!item) {
      throw AppError.notFound('${pascalName} not found', 'RESOURCE_NOT_FOUND');
    }
    return item;
  }

  public static async create(input: Create${pascalName}Input, userId?: string): Promise<I${pascalName}> {
    return ${pascalName}Model.create({
      ...input,
      ...(userId ? { userId } : {}),
    });
  }

  public static async update(id: string, input: Update${pascalName}Input): Promise<I${pascalName}> {
    const item = await ${pascalName}Model.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
    if (!item) {
      throw AppError.notFound('${pascalName} not found', 'RESOURCE_NOT_FOUND');
    }
    return item;
  }

  public static async delete(id: string): Promise<void> {
    const result = await ${pascalName}Model.findByIdAndDelete(id);
    if (!result) {
      throw AppError.notFound('${pascalName} not found', 'RESOURCE_NOT_FOUND');
    }
  }
}
`;

// 4. Controller Template
const controllerContent = `import { Request, Response, NextFunction } from 'express';
import { ${pascalName}Service } from './${moduleName}.service';
import { sendCreated, sendSuccess } from '../../core/utils/response';

export class ${pascalName}Controller {
  public static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const items = await ${pascalName}Service.list(req.user?.userId);
      sendSuccess(res, items, '${pascalName} items fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await ${pascalName}Service.getById(req.params.id);
      sendSuccess(res, item, '${pascalName} fetched successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await ${pascalName}Service.create(req.body, req.user?.userId);
      sendCreated(res, item, '${pascalName} created successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await ${pascalName}Service.update(req.params.id, req.body);
      sendSuccess(res, item, '${pascalName} updated successfully');
    } catch (error) {
      next(error);
    }
  }

  public static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await ${pascalName}Service.delete(req.params.id);
      sendSuccess(res, null, '${pascalName} deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}
`;

// 5. Routes Template
const routesContent = `import { Router } from 'express';
import { ${pascalName}Controller } from './${moduleName}.controller';
import { validateRequest } from '../../core/middleware/validate';
import {
  create${pascalName}Schema,
  update${pascalName}Schema,
  ${moduleName}ParamsSchema,
} from './${moduleName}.validation';
import { optionalAuth } from '../../core/middleware/auth';

const router = Router();

// Routes for /api/v1/${moduleName}
router.use(optionalAuth);

router.get('/', ${pascalName}Controller.list);
router.post('/', validateRequest({ body: create${pascalName}Schema }), ${pascalName}Controller.create);
router.get('/:id', validateRequest({ params: ${moduleName}ParamsSchema }), ${pascalName}Controller.getById);
router.put(
  '/:id',
  validateRequest({ params: ${moduleName}ParamsSchema, body: update${pascalName}Schema }),
  ${pascalName}Controller.update,
);
router.delete('/:id', validateRequest({ params: ${moduleName}ParamsSchema }), ${pascalName}Controller.delete);

export const ${moduleName}Routes = router;
`;

fs.writeFileSync(path.join(targetDir, `${moduleName}.model.ts`), modelContent);
fs.writeFileSync(path.join(targetDir, `${moduleName}.validation.ts`), validationContent);
fs.writeFileSync(path.join(targetDir, `${moduleName}.service.ts`), serviceContent);
fs.writeFileSync(path.join(targetDir, `${moduleName}.controller.ts`), controllerContent);
fs.writeFileSync(path.join(targetDir, `${moduleName}.routes.ts`), routesContent);

console.log(`\n✨ Successfully created module "${moduleName}" at: src/modules/${moduleName}/`);
console.log(`   ├── ${moduleName}.model.ts`);
console.log(`   ├── ${moduleName}.validation.ts`);
console.log(`   ├── ${moduleName}.service.ts`);
console.log(`   ├── ${moduleName}.controller.ts`);
console.log(`   └── ${moduleName}.routes.ts`);
console.log(`\n👉 Next Step: Register the module in "src/routes.ts":`);
console.log(`   import { ${moduleName}Routes } from './modules/${moduleName}/${moduleName}.routes';`);
console.log(`   v1Router.use('/${moduleName}', ${moduleName}Routes);\n`);
