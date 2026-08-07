import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  email: z.string().trim().email("Courriel invalide"),
  phone: z.string().trim().min(7, "Téléphone invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  marketingOptIn: z.boolean().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Courriel invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Courriel invalide"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const updateAccountSchema = z.object({
  email: z.string().trim().email("Courriel invalide"),
  phone: z.string().trim().min(7, "Téléphone invalide"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const selectTrailerSchema = z.object({
  trailerId: z.string().min(1),
  windowStart: isoDate,
  windowEnd: isoDate,
});

export const documentUploadSchema = z.object({
  type: z.enum(["license", "insurance"]),
  consent: z.literal(true, "Le consentement est requis"),
});

export const signContractSchema = z.object({
  signerName: z.string().trim().min(1, "Nom du signataire requis"),
});

export const contactSchema = z.object({
  topic: z.string().trim().min(1),
  name: z.string().trim().min(1, "Nom requis"),
  email: z.string().trim().email("Courriel invalide"),
  phone: z.string().trim().optional(),
  message: z.string().trim().min(1, "Message requis"),
});
