import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SESSION_LOST_MESSAGE, apiErrorMessage } from "@/lib/api-client";

const FALLBACK = "Impossible d'enregistrer votre sélection";

describe("what to tell the person when a booking request fails", () => {
  it("says the session has ended when the server redirected to the login page", async () => {
    const redirected = { redirected: true, status: 200, json: async () => ({}) } as unknown as Response;
    assert.equal(await apiErrorMessage(redirected, FALLBACK), SESSION_LOST_MESSAGE);
  });

  it("says the same for a 401", async () => {
    assert.equal(await apiErrorMessage(new Response("{}", { status: 401 }), FALLBACK), SESSION_LOST_MESSAGE);
  });

  it("shows the server's own message when it sent one", async () => {
    const response = new Response(JSON.stringify({ error: "Cette remorque n'est plus disponible" }), { status: 409 });
    assert.equal(await apiErrorMessage(response, FALLBACK), "Cette remorque n'est plus disponible");
  });

  it("falls back to the generic message when the answer is not usable", async () => {
    assert.equal(await apiErrorMessage(new Response("<html>Erreur</html>", { status: 500 }), FALLBACK), FALLBACK);
    assert.equal(await apiErrorMessage(new Response(JSON.stringify({ error: 42 }), { status: 400 }), FALLBACK), FALLBACK);
    assert.equal(await apiErrorMessage(new Response(JSON.stringify({}), { status: 400 }), FALLBACK), FALLBACK);
  });
});
