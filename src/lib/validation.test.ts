import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adminReportQuerySchema,
  adminReservationCreateSchema,
  adminUserCreateSchema,
  contactSchema,
  documentUploadSchema,
  guestStartSchema,
  isoDate,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  updateAccountSchema,
} from "@/lib/validation";

const signup = {
  firstName: "Marie",
  lastName: "Tremblay",
  email: "marie@example.com",
  phone: "418-555-0100",
  password: "un-bon-mot-de-passe",
};

function firstMessage(result: { success: boolean; error?: { issues: { message: string }[] } }): string | undefined {
  return result.success ? undefined : result.error?.issues[0]?.message;
}

describe("sign-up", () => {
  it("accepts a normal form and trims what was typed", () => {
    const parsed = signupSchema.safeParse({ ...signup, firstName: "  Marie ", lastName: " Tremblay  " });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.firstName, "Marie");
    assert.equal(parsed.data?.lastName, "Tremblay");
  });

  // "Test@x.com" and "test@x.com" must be one person: emails are stored and looked up in lower case.
  it("lower-cases and trims the email", () => {
    const parsed = signupSchema.safeParse({ ...signup, email: "  Marie.Tremblay@Example.COM " });
    assert.equal(parsed.data?.email, "marie.tremblay@example.com");
  });

  it("refuses an invalid or oversized email", () => {
    assert.equal(firstMessage(signupSchema.safeParse({ ...signup, email: "pas-un-courriel" })), "Courriel invalide");
    assert.equal(firstMessage(signupSchema.safeParse({ ...signup, email: `${"a".repeat(250)}@example.com` })), "Courriel invalide");
  });

  it("asks for at least 8 characters in the password, and not a novel", () => {
    assert.equal(
      firstMessage(signupSchema.safeParse({ ...signup, password: "1234567" })),
      "Le mot de passe doit contenir au moins 8 caractères",
    );
    assert.equal(signupSchema.safeParse({ ...signup, password: "12345678" }).success, true);
    assert.equal(firstMessage(signupSchema.safeParse({ ...signup, password: "x".repeat(201) })), "Mot de passe trop long");
  });

  it("limits the length of names and the phone number", () => {
    assert.equal(firstMessage(signupSchema.safeParse({ ...signup, firstName: "a".repeat(81) })), "Prénom trop long");
    assert.equal(firstMessage(signupSchema.safeParse({ ...signup, firstName: "   " })), "Prénom requis");
    assert.equal(firstMessage(signupSchema.safeParse({ ...signup, phone: "123456" })), "Téléphone invalide");
    assert.equal(firstMessage(signupSchema.safeParse({ ...signup, phone: "1".repeat(41) })), "Téléphone invalide");
  });
});

describe("booking without an account", () => {
  it("needs contact details only, no password, and ignores any extra field", () => {
    const { password: _unused, ...contact } = signup;
    void _unused;
    const parsed = guestStartSchema.safeParse({ ...contact, role: "owner" });
    assert.equal(parsed.success, true);
    assert.ok(!("role" in (parsed.data ?? {})));
  });
});

describe("sign-in", () => {
  it("matches the email in lower case and needs a password", () => {
    assert.equal(loginSchema.safeParse({ email: "Marie@Example.com", password: "x" }).data?.email, "marie@example.com");
    assert.equal(firstMessage(loginSchema.safeParse({ email: "marie@example.com", password: "" })), "Mot de passe requis");
  });
});

describe("password reset", () => {
  it("needs a token and a new password of at least 8 characters", () => {
    assert.equal(resetPasswordSchema.safeParse({ token: "abc", password: "12345678" }).success, true);
    assert.equal(resetPasswordSchema.safeParse({ token: "", password: "12345678" }).success, false);
    assert.equal(resetPasswordSchema.safeParse({ token: "abc", password: "short" }).success, false);
  });
});

describe("employee accounts", () => {
  it("need a clean user name and a password of at least 10 characters", () => {
    assert.equal(adminUserCreateSchema.safeParse({ username: "vincent.b", password: "0123456789" }).success, true);
    assert.equal(adminUserCreateSchema.safeParse({ username: "vincent.b", password: "012345678" }).success, false);
    assert.equal(adminUserCreateSchema.safeParse({ username: "ab", password: "0123456789" }).success, false);
    assert.equal(adminUserCreateSchema.safeParse({ username: "vincent b!", password: "0123456789" }).success, false);
    assert.equal(adminUserCreateSchema.safeParse({ username: "a".repeat(41), password: "0123456789" }).success, false);
  });
});

describe("document upload", () => {
  it("needs the client's consent and a known type", () => {
    assert.equal(documentUploadSchema.safeParse({ type: "license", consent: true }).success, true);
    assert.equal(documentUploadSchema.safeParse({ type: "insurance", consent: true }).success, true);
    assert.equal(documentUploadSchema.safeParse({ type: "license", consent: false }).success, false);
    assert.equal(documentUploadSchema.safeParse({ type: "passport", consent: true }).success, false);
  });
});

describe("dates", () => {
  it("accept real calendar days only", () => {
    assert.equal(isoDate.safeParse("2028-02-29").success, true);
    for (const bad of ["2029-02-30", "2029-13-45", "2029-00-01", "2029-1-1", "", "demain"]) {
      assert.equal(firstMessage(isoDate.safeParse(bad)), "Date invalide", bad);
    }
  });
});

describe("booking created by staff", () => {
  const base = { clientId: "c1", trailerId: "t1", pickupDate: "2029-03-05", returnDate: "2029-03-08", totalAmount: 40000 };

  it("accepts a valid booking", () => {
    assert.equal(adminReservationCreateSchema.safeParse(base).success, true);
  });

  it("needs the return after the pickup", () => {
    const parsed = adminReservationCreateSchema.safeParse({ ...base, returnDate: "2029-03-05" });
    assert.equal(firstMessage(parsed), "La date de retour doit être après la date de ramassage");
  });

  it("refuses impossible dates and amounts that are not whole non-negative cents", () => {
    assert.equal(adminReservationCreateSchema.safeParse({ ...base, pickupDate: "2029-02-30" }).success, false);
    assert.equal(adminReservationCreateSchema.safeParse({ ...base, totalAmount: -1 }).success, false);
    assert.equal(adminReservationCreateSchema.safeParse({ ...base, totalAmount: 100.5 }).success, false);
  });

  it("takes the transport: how it travels, where to, and what it costs in whole cents", () => {
    const delivered = { ...base, deliveryOption: "delivery", usageLocation: "  777 rue Villeray, Montréal ", deliveryFeeCents: 49000 };
    const parsed = adminReservationCreateSchema.safeParse(delivered);
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.usageLocation, "777 rue Villeray, Montréal");
    assert.equal(adminReservationCreateSchema.safeParse({ ...delivered, deliveryOption: "drone" }).success, false);
    assert.equal(adminReservationCreateSchema.safeParse({ ...delivered, deliveryFeeCents: -1 }).success, false);
    assert.equal(adminReservationCreateSchema.safeParse({ ...delivered, deliveryFeeCents: 10.5 }).success, false);
    assert.equal(firstMessage(adminReservationCreateSchema.safeParse({ ...delivered, usageLocation: "x".repeat(201) })), "Adresse trop longue");
  });
});

describe("report query", () => {
  it("takes a month between 1 and 12, a year, or a range of real days", () => {
    assert.equal(adminReportQuerySchema.safeParse({ type: "month", year: "2029", month: "3" }).success, true);
    assert.equal(adminReportQuerySchema.safeParse({ type: "month", year: "2029", month: "13" }).success, false);
    assert.equal(adminReportQuerySchema.safeParse({ type: "year", year: "2029" }).success, true);
    assert.equal(adminReportQuerySchema.safeParse({ type: "custom", start: "2029-01-01", end: "2029-01-31" }).success, true);
    assert.equal(adminReportQuerySchema.safeParse({ type: "custom", start: "2029-01-01", end: "2029-02-30" }).success, false);
  });
});

describe("account profile", () => {
  const profile = { firstName: "Marie", lastName: "Tremblay", email: "marie@example.com", phone: "418-555-0100" };

  it("caps the free-text fields", () => {
    assert.equal(updateAccountSchema.safeParse(profile).success, true);
    assert.equal(updateAccountSchema.safeParse({ ...profile, company: "x".repeat(121) }).success, false);
    assert.equal(updateAccountSchema.safeParse({ ...profile, billingAddress: "x".repeat(201) }).success, false);
    assert.equal(updateAccountSchema.safeParse({ ...profile, billingPostalCode: "x".repeat(21) }).success, false);
  });
});

describe("contact form", () => {
  const message = { topic: "Question", name: "Marie Tremblay", email: "marie@example.com", message: "Bonjour" };

  it("accepts a normal message and caps its length at 5 000 characters", () => {
    assert.equal(contactSchema.safeParse(message).success, true);
    assert.equal(contactSchema.safeParse({ ...message, message: "x".repeat(5000) }).success, true);
    assert.equal(
      firstMessage(contactSchema.safeParse({ ...message, message: "x".repeat(5001) })),
      "Message trop long (5 000 caractères au maximum)",
    );
  });

  it("needs a message and a valid email", () => {
    assert.equal(firstMessage(contactSchema.safeParse({ ...message, message: "   " })), "Message requis");
    assert.equal(firstMessage(contactSchema.safeParse({ ...message, email: "pas-un-courriel" })), "Courriel invalide");
  });
});
