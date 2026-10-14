import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secret-box";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const MINOR_VERSION = "75";
export const CONNECTION_ID = "quickbooks";

export function quickBooksConfigured(): boolean {
  return Boolean(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET);
}

// Trimmed: a stray space or newline from copy-paste into Vercel makes Intuit
// answer "invalid_client".
function clientCredentials() {
  const id = process.env.QUICKBOOKS_CLIENT_ID?.trim();
  const secret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim();
  if (!id || !secret) throw new Error("QUICKBOOKS_CLIENT_ID / QUICKBOOKS_CLIENT_SECRET ne sont pas configurés");
  return { id, secret };
}

function apiBase(realmId: string): string {
  const host =
    process.env.QUICKBOOKS_ENVIRONMENT === "production"
      ? "https://quickbooks.api.intuit.com"
      : "https://sandbox-quickbooks.api.intuit.com";
  return `${host}/v3/company/${realmId}`;
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { id } = clientCredentials();
  const params = new URLSearchParams({
    client_id: id,
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in: number;
};

async function requestTokens(body: URLSearchParams): Promise<TokenResponse> {
  const { id, secret } = clientCredentials();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  if (!res.ok) throw new Error(`Intuit OAuth ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const tokens = await requestTokens(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
  return toStored(tokens);
}

function toStored(tokens: TokenResponse) {
  const now = Date.now();
  return {
    accessTokenEnc: encryptSecret(tokens.access_token),
    refreshTokenEnc: encryptSecret(tokens.refresh_token),
    accessTokenExpiresAt: new Date(now + tokens.expires_in * 1000),
    refreshTokenExpiresAt: new Date(now + tokens.x_refresh_token_expires_in * 1000),
  };
}

// Refresh tokens rotate on every refresh: persist the new pair with a
// compare-and-set on the old refresh token so concurrent requests don't clobber
// each other, and fall back to whatever the winner stored.
async function refreshConnection(connectionId: string) {
  const current = await prisma.accountingConnection.findUnique({ where: { id: connectionId } });
  if (!current) throw new Error("QuickBooks n'est pas connecté");
  try {
    const tokens = await requestTokens(
      new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptSecret(current.refreshTokenEnc) }),
    );
    await prisma.accountingConnection.updateMany({
      where: { id: connectionId, refreshTokenEnc: current.refreshTokenEnc },
      data: toStored(tokens),
    });
  } catch (error) {
    const latest = await prisma.accountingConnection.findUnique({ where: { id: connectionId } });
    if (latest && latest.refreshTokenEnc !== current.refreshTokenEnc) return latest;
    throw error;
  }
  const refreshed = await prisma.accountingConnection.findUnique({ where: { id: connectionId } });
  if (!refreshed) throw new Error("QuickBooks n'est pas connecté");
  return refreshed;
}

async function validConnection() {
  let connection = await prisma.accountingConnection.findUnique({ where: { id: CONNECTION_ID } });
  if (!connection) throw new Error("QuickBooks n'est pas connecté");
  if (connection.refreshTokenExpiresAt < new Date()) {
    throw new Error("L'autorisation QuickBooks a expiré — reconnectez QuickBooks");
  }
  // Refresh a minute early so a token never expires mid-request.
  if (connection.accessTokenExpiresAt.getTime() - 60_000 < Date.now()) {
    connection = await refreshConnection(CONNECTION_ID);
  }
  return connection;
}

export class QuickBooksApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

async function qbFetch<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const connection = await validConnection();
  const separator = path.includes("?") ? "&" : "?";
  const res = await fetch(`${apiBase(connection.realmId)}${path}${separator}minorversion=${MINOR_VERSION}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${decryptSecret(connection.accessTokenEnc)}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });

  if (res.status === 401 && !retried) {
    await refreshConnection(CONNECTION_ID);
    return qbFetch<T>(path, init, true);
  }
  if (!res.ok) {
    const text = await res.text();
    let code: string | undefined;
    let message = text.slice(0, 300);
    try {
      const fault = JSON.parse(text)?.Fault?.Error?.[0];
      code = fault?.code;
      message = [fault?.Message, fault?.Detail].filter(Boolean).join(" — ") || message;
    } catch {
      // keep raw text
    }
    throw new QuickBooksApiError(`QuickBooks ${res.status}: ${message}`, res.status, code);
  }
  return (await res.json()) as T;
}

function escapeQueryValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function query<T>(statement: string, entity: string): Promise<T[]> {
  const data = await qbFetch<{ QueryResponse?: Record<string, T[]> }>(`/query?query=${encodeURIComponent(statement)}`);
  return data.QueryResponse?.[entity] ?? [];
}

export type QbOption = { id: string; name: string };

export async function listIncomeAccounts(): Promise<QbOption[]> {
  const rows = await query<{ Id: string; Name: string }>(
    "select Id, Name from Account where AccountType = 'Income'",
    "Account",
  );
  return rows.map((r) => ({ id: r.Id, name: r.Name }));
}

export async function listTaxCodes(): Promise<QbOption[]> {
  const rows = await query<{ Id: string; Name: string; Taxable?: boolean }>(
    "select Id, Name, Taxable from TaxCode",
    "TaxCode",
  );
  return rows.filter((r) => r.Taxable !== false).map((r) => ({ id: r.Id, name: r.Name }));
}

async function ensureServiceItem(name: string, incomeAccountId: string): Promise<string> {
  const existing = await query<{ Id: string }>(
    `select Id from Item where Name = '${escapeQueryValue(name)}'`,
    "Item",
  );
  if (existing[0]) return existing[0].Id;
  const created = await qbFetch<{ Item: { Id: string } }>("/item", {
    method: "POST",
    body: JSON.stringify({ Name: name, Type: "Service", IncomeAccountRef: { value: incomeAccountId } }),
  });
  return created.Item.Id;
}

export const RENTAL_ITEM_NAME = "Location de remorque réfrigérée";
export const TRANSPORT_ITEM_NAME = "Transport (livraison et récupération)";

export async function ensureServiceItems(incomeAccountId: string) {
  const rentalItemId = await ensureServiceItem(RENTAL_ITEM_NAME, incomeAccountId);
  const transportItemId = await ensureServiceItem(TRANSPORT_ITEM_NAME, incomeAccountId);
  return { rentalItemId, transportItemId };
}

export type QbCustomerInput = {
  firstName: string;
  lastName: string;
  company: string | null;
  email: string;
  phone: string;
  billingAddress: string | null;
  billingCity: string | null;
  billingProvince: string | null;
  billingPostalCode: string | null;
};

export function customerDisplayName(c: Pick<QbCustomerInput, "firstName" | "lastName" | "company">): string {
  return c.company?.trim() || `${c.firstName} ${c.lastName}`.trim();
}

// Finds the QuickBooks customer for a client (by email first, then display name)
// or creates it. DisplayName must be unique in QuickBooks, so a name clash with a
// different person falls back to "Name (email)".
export async function findOrCreateCustomer(c: QbCustomerInput): Promise<string> {
  const byEmail = await query<{ Id: string }>(
    `select Id from Customer where PrimaryEmailAddr = '${escapeQueryValue(c.email)}'`,
    "Customer",
  ).catch(() => []);
  if (byEmail[0]) return byEmail[0].Id;

  const displayName = customerDisplayName(c);
  const byName = await query<{ Id: string; PrimaryEmailAddr?: { Address?: string } }>(
    `select Id, PrimaryEmailAddr from Customer where DisplayName = '${escapeQueryValue(displayName)}'`,
    "Customer",
  );
  const sameName = byName.find(
    (r) => !r.PrimaryEmailAddr?.Address || r.PrimaryEmailAddr.Address.toLowerCase() === c.email.toLowerCase(),
  );
  if (sameName) return sameName.Id;

  const body = (name: string) => ({
    DisplayName: name,
    GivenName: c.firstName,
    FamilyName: c.lastName,
    ...(c.company ? { CompanyName: c.company } : {}),
    PrimaryEmailAddr: { Address: c.email },
    PrimaryPhone: { FreeFormNumber: c.phone },
    ...(c.billingAddress
      ? {
          BillAddr: {
            Line1: c.billingAddress,
            City: c.billingCity ?? undefined,
            CountrySubDivisionCode: c.billingProvince ?? undefined,
            PostalCode: c.billingPostalCode ?? undefined,
            Country: "Canada",
          },
        }
      : {}),
  });

  const create = (name: string) =>
    qbFetch<{ Customer: { Id: string } }>("/customer", { method: "POST", body: JSON.stringify(body(name)) });

  try {
    return (await create(byName.length > 0 ? `${displayName} (${c.email})` : displayName)).Customer.Id;
  } catch (error) {
    if (error instanceof QuickBooksApiError && error.code === "6240") {
      return (await create(`${displayName} (${c.email})`)).Customer.Id;
    }
    throw error;
  }
}

export async function createInvoice(payload: unknown): Promise<{ id: string; docNumber: string | null }> {
  const data = await qbFetch<{ Invoice: { Id: string; DocNumber?: string } }>("/invoice", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return { id: data.Invoice.Id, docNumber: data.Invoice.DocNumber ?? null };
}
