import { z } from 'zod';

const strongPasswordSchema = z
  .string()
  .min(8)
  .max(200)
  .refine((v) => /[a-z]/.test(v), { message: 'Password must include a lowercase letter' })
  .refine((v) => /[A-Z]/.test(v), { message: 'Password must include an uppercase letter' })
  .refine((v) => /\d/.test(v), { message: 'Password must include a number' })
  .refine((v) => /[^A-Za-z0-9]/.test(v), { message: 'Password must include a special character' });

export const publicRoleSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.enum(['buyer', 'seller', 'agent']),
);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(1),
});

export const reactivateSchema = loginSchema;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(320),
  password: strongPasswordSchema,
  role: publicRoleSchema,
  autoLogin: z.boolean().optional(),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(320).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No updates provided' });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: strongPasswordSchema,
});

export const deactivateMeSchema = z.object({
  password: z.string().min(1),
});
