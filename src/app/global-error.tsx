"use client";

// Last resort: the page's own layout failed, so no styles or components can be counted on.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr-CA">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "4rem 1rem", textAlign: "center", color: "#1b2733" }}>
        <h1 style={{ fontSize: "1.5rem" }}>Un problème est survenu</h1>
        <p style={{ color: "#5f6b75" }}>
          Réessayez dans un instant; si le problème continue, appelez IceBox au <a href="tel:+15818892093">581 889-2093</a>.
        </p>
        {error.digest && <p style={{ fontSize: "0.75rem", color: "#5f6b75" }}>Code de référence : {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          style={{ marginTop: "1rem", padding: "0.6rem 1.2rem", border: 0, borderRadius: 6, background: "#005f9b", color: "#fff", fontSize: "1rem", cursor: "pointer" }}
        >
          Réessayer
        </button>
      </body>
    </html>
  );
}
