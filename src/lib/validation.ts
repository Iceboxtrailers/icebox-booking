import { z } from "zod";
import { CLIENT_STATUS, RESERVATION_STATUS, TRAILER_SIZE, TRAILER_STATUS } from "@/lib/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const isoTime = z.string().regex(/^\d{2}:\d{2}$/, "Heure invalide");

// Emails are stored and looked up in lower case, so "Test@x.com" and "test@x.com" are one person.
const emailField = z.string().trim().toLowerCase().max(254, "Courriel invalide").email("Courriel invalide");

// Ceilings for text typed on public and client forms: nobody needs a 4 MB first name.
const personName = (label: string) => z.string().trim().min(1, `${label} requis`).max(80, `${label} trop long`);
const phoneField = z.string().trim().min(7, "Téléphone invalide").max(40, "Téléphone invalide");
const passwordField = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").max(200, "Mot de passe trop long");

export const signupSchema = z.object({
  firstName: personName("Prénom"),
  lastName: personName("Nom"),
  email: emailField,
  phone: phoneField,
  password: passwordField,
  marketingOptIn: z.boolean().optional(),
});

// Booking without an account: contact details only, no password.
export const guestStartSchema = z.object({
  firstName: personName("Prénom"),
  lastName: personName("Nom"),
  email: emailField,
  phone: phoneField,
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Mot de passe requis").max(200, "Mot de passe trop long"),
});

export const adminLoginSchema = z.object({
  username: z.string().trim().min(1, "Nom d'utilisateur requis"),
  password: z.string().min(1, "Mot de passe requis"),
  code: z.string().trim().optional(),
});

export const mfaCodeSchema = z.object({
  code: z.string().trim().min(6, "Code requis").max(20),
});

export const forgotPasswordSchema = z.object({
  email: emailField,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(200),
  password: passwordField,
});

export const updateAccountSchema = z.object({
  firstName: personName("Prénom"),
  lastName: personName("Nom"),
  company: z.string().trim().max(120).optional(),
  email: emailField,
  phone: phoneField,
  billingAddress: z.string().trim().max(200).optional(),
  billingCity: z.string().trim().max(100).optional(),
  billingProvince: z.string().trim().max(60).optional(),
  billingPostalCode: z.string().trim().max(20).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis").max(200, "Mot de passe trop long"),
  newPassword: passwordField,
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

export const depositAuthorizeSchema = z.object({
  transactionId: z.string().trim().min(1, "transactionId requis"),
});

export const cardSavedSchema = z.object({
  setupIntentId: z.string().trim().min(1, "setupIntentId requis"),
});

export const adminDepositCaptureSchema = z.object({
  amountCents: z.number().int().min(1).optional(),
});

export const adminDepositAuthorizeSchema = z.object({
  // Replace a still-active hold (e.g. one that will expire before the trailer is back).
  renew: z.boolean().optional(),
});

export const adminInspectionSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});

export const adminUserCreateSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Nom d'utilisateur trop court")
    .max(40)
    .regex(/^[a-zA-Z0-9._-]+$/, "Lettres, chiffres, point, tiret seulement"),
  password: z.string().min(10, "Mot de passe : 10 caractères minimum"),
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
    isTest: z.boolean().optional(),
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
  isTest: z.boolean().optional(),
  // Departure checks (status -> in_progress): the hold covers less than the rental,
  // or the deposit was taken another way (owner only).
  acknowledgeDepositExpiry: z.boolean().optional(),
  waiveDeposit: z.boolean().optional(),
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
  plate: z.string().trim().optional(),
});

export const adminClientCreateSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  company: z.string().trim().optional(),
  email: emailField,
  phone: z.string().trim().min(7, "Téléphone invalide"),
  billingAddress: z.string().trim().optional(),
  billingCity: z.string().trim().optional(),
  billingProvince: z.string().trim().optional(),
  billingPostalCode: z.string().trim().optional(),
});

export const adminClientUpdateSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").optional(),
  lastName: z.string().trim().min(1, "Nom requis").optional(),
  company: z.string().trim().optional(),
  email: emailField.optional(),
  phone: z.string().trim().min(7, "Téléphone invalide").optional(),
  billingAddress: z.string().trim().optional(),
  billingCity: z.string().trim().optional(),
  billingProvince: z.string().trim().optional(),
  billingPostalCode: z.string().trim().optional(),
  status: z.enum(CLIENT_STATUS).optional(),
  internalNote: z.string().trim().optional(),
});

export const adminReportQuerySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("month"), year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) }),
  z.object({ type: z.literal("year"), year: z.coerce.number().int() }),
  z.object({ type: z.literal("custom"), start: isoDate, end: isoDate }),
]);

export const contactSchema = z.object({
  topic: z.string().trim().min(1).max(80),
  name: personName("Nom"),
  email: z.string().trim().max(254, "Courriel invalide").email("Courriel invalide"),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(1, "Message requis").max(5000, "Message trop long (5 000 caractères au maximum)"),
});
