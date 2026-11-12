// ============================================================================
// Portfolio Module - Models
// ----------------------------------------------------------------------------
// Same model names as the original portfolio server, so they map onto the
// existing collections: admins, projects, resumes, testimonials, contactmessages.
// ============================================================================

import { Schema, Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { getPortfolioConnection } from './portfolio.db';

export interface IAdmin {
  _id: Types.ObjectId;
  username: string;
  password: string;
}

export interface IProject {
  _id: Types.ObjectId;
  title: string;
  slug?: string;
  description: string;
  shortDescription?: string;
  problem?: string;
  solution?: string;
  features: string[];
  metrics?: string;
  technologies: string[];
  category: string;
  tags: string[];
  githubLink?: string;
  liveLink?: string;
  youtubeVideoUrl?: string | null;
  projectImage?: string | null;
  galleryImages: string[];
  isFeatured: boolean;
  isPublished: boolean;
  order: number;
}

export interface IResume {
  _id: Types.ObjectId;
  fileUrl: string;
  fileName: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ITestimonial {
  _id: Types.ObjectId;
  name: string;
  role: string;
  message: string;
  rating: number;
  isApproved: boolean;
  isFeatured: boolean;
}

export interface IContactMessage {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  isRead: boolean;
}

export const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const adminSchema = new Schema<IAdmin>(
  {
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

adminSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

const projectSchema = new Schema<IProject>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, sparse: true, index: true },
    description: { type: String, required: true },
    shortDescription: { type: String },
    problem: { type: String },
    solution: { type: String },
    features: [{ type: String }],
    metrics: { type: String },
    technologies: [{ type: String }],
    category: { type: String, required: true, default: 'Other' },
    tags: [{ type: String }],
    githubLink: { type: String },
    liveLink: { type: String },
    youtubeVideoUrl: { type: String, default: null },
    projectImage: { type: String, default: null },
    galleryImages: [{ type: String }],
    isFeatured: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

projectSchema.pre('save', function fillSlug() {
  if (!this.slug && this.title) this.slug = toSlug(this.title);
});

const resumeSchema = new Schema<IResume>(
  {
    fileUrl: { type: String, required: true },
    fileName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const testimonialSchema = new Schema<ITestimonial>(
  {
    name: { type: String, required: true },
    role: { type: String, required: true },
    message: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    isApproved: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const contactMessageSchema = new Schema<IContactMessage>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: '' },
    subject: { type: String, default: '' },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export interface PortfolioModels {
  Admin: Model<IAdmin>;
  Project: Model<IProject>;
  Resume: Model<IResume>;
  Testimonial: Model<ITestimonial>;
  ContactMessage: Model<IContactMessage>;
}

let models: PortfolioModels | null = null;

/** Models are bound to the portfolio connection, created on first use. */
export const getModels = (): PortfolioModels => {
  if (!models) {
    const db = getPortfolioConnection();
    models = {
      Admin: db.model<IAdmin>('Admin', adminSchema),
      Project: db.model<IProject>('Project', projectSchema),
      Resume: db.model<IResume>('Resume', resumeSchema),
      Testimonial: db.model<ITestimonial>('Testimonial', testimonialSchema),
      ContactMessage: db.model<IContactMessage>('ContactMessage', contactMessageSchema),
    };
  }
  return models;
};

export const passwordMatches = (admin: IAdmin, candidate: string): Promise<boolean> =>
  bcrypt.compare(candidate, admin.password);
