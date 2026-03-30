import { z } from 'zod';

export const LoginBodySchema = z.object({
  email: z.string().min(1, 'Email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

/** @deprecated use LoginBodySchema */
export const LoginAdminSchema = LoginBodySchema;

const phoneSchema = z
  .string()
  .min(1, 'Phone is required.')
  .max(20)
  .transform((v) => v.trim());

export const RegisterUserSchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: phoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

export const UpdateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).transform((v) => v.toLowerCase()),
  phone: phoneSchema,
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
});
