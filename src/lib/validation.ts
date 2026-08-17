import { z } from "zod";
import { RESERVATION_STATUS, TRAILER_SIZE, TRAILER_STATUS } from "@/lib/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const isoTime = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide");

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
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  company: z.string().trim().optional(),
  email: z.string().trim().email("Courriel invalide"),
  phone: z.string().trim().min(7, "Téléphone invalide"),
  billingAddress: z.string().trim().optional(),
  billingCity: z.string().trim().optional(),
  billingProvince: z.string().trim().optional(),
  billingPostalCode: z.string().trim().optional(),
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

export const adminReservationCreateSchema = z
  .object({
    clientId: z.string().min(1, "Client requis"),
    trailerId: z.string().min(1, "Remorque requise"),
    pickupDate: isoDate,
    returnDate: isoDate,
    totalAmount: z.number().int().min(0),
    status: z.enum(RESERVATION_STATUS).optional(),
    note: z.string().trim().optional(),
    pickupTime: isoTime.optional().or(z.literal("")),
    returnTime: isoTime.optional().or(z.literal("")),
  })
  .refine((v) => v.returnDate > v.pickupDate, {
    message: "La date de retour doit être après la date de ramassage",
    path: ["returnDate"],
  });

export const adminReservationUpdateSchema = z.object({
  status: z.enum(RESERVATION_STATUS).optional(),
  pickupDate: isoDate.optional(),
  returnDate: isoDate.optional(),
  trailerId: z.string().min(1).optional(),
  totalAmount: z.number().int().min(0).optional(),
  note: z.string().trim().optional(),
  pickupTime: isoTime.optional().or(z.literal("")),
  returnTime: isoTime.optional().or(z.literal("")),
});

export const adminTrailerCreateSchema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  size: z.enum(TRAILER_SIZE),
});

export const adminTrailerUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  size: z.enum(TRAILER_SIZE).optional(),
  status: z.enum(TRAILER_STATUS).optional(),
  description: z.string().trim().optional(),
});

export const adminClientCreateSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  company: z.string().trim().optional(),
  email: z.string().trim().email("Courriel invalide"),
  phone: z.string().trim().min(7, "Téléphone invalide"),
  billingAddress: z.string().trim().optional(),
  billingCity: z.string().trim().optional(),
  billingProvince: z.string().trim().optional(),
  billingPostalCode: z.string().trim().optional(),
});

export const contactSchema = z.object({
  topic: z.string().trim().min(1),
  name: z.string().trim().min(1, "Nom requis"),
  email: z.string().trim().email("Courriel invalide"),
  phone: z.string().trim().optional(),
  message: z.string().trim().min(1, "Message requis"),
});
