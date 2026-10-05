import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel, IUser } from './auth.model';
import { RegisterInput, LoginInput } from './auth.validation';
import { AppError } from '../../core/errors/AppError';
import { env } from '../../config/env';

export interface AuthResult {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: Date;
  };
  token: string;
}

export class AuthService {
  public static async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await UserModel.findOne({ email: input.email });
    if (existing) {
      throw AppError.conflict('User with this email already exists', 'RESOURCE_CONFLICT');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(input.password, saltRounds);

    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'user',
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  public static async login(input: LoginInput): Promise<AuthResult> {
    const user = await UserModel.findOne({ email: input.email }).select('+passwordHash');
    if (!user) {
      throw AppError.unauthorized('Invalid email or password', 'UNAUTHORIZED');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password', 'UNAUTHORIZED');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  public static async getMe(userId: string): Promise<Record<string, unknown>> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found', 'RESOURCE_NOT_FOUND');
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private static generateToken(user: IUser): string {
    return jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
      } as jwt.SignOptions,
    );
  }
}
