import { z } from "zod";
import { DATE_RANGE_TYPE, TRAILER_SIZE, TRAILER_TYPE } from "@/lib/constants";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

export const signupSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis"),
  lastName: z.string().trim().min(1, "Nom requis"),
  email: z.string().trim().email("Courriel invalide"),
  phone: z.string().trim().min(7, "Téléphone invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Courriel invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const trailerDatesSchema = z
  .object({
    type: z.enum(TRAILER_TYPE),
    size: z.enum(TRAILER_SIZE),
    dateRangeType: z.enum(DATE_RANGE_TYPE),
    start: isoDate,
    end: isoDate,
  })
  .refine((v) => v.end > v.start, {
    message: "La date de retour doit être après la date de ramassage",
    path: ["end"],
  });

export const availabilityRequestSchema = trailerDatesSchema;

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
