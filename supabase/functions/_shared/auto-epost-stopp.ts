// Automatiske e-poster fra CRM-et er slått av (bestemt av Robin 22.11.2026).
// Funksjoner som før sendte rapporter, påminnelser, interne varsler eller velkomstmail
// av seg selv, svarer nå trygt uten å sende noe – også om de kalles ved et uhell.
// Manuelle e-poster (Gmail-utsending, kontrakter, autentisering) går ikke gjennom her.

export const AUTO_EPOST_STOPPET = true;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Trygt svar fra en avslått automatisk e-postfunksjon. Sender aldri noe. */
export function autoEpostAvslattSvar(funksjon: string): Response {
  return new Response(
    JSON.stringify({ ok: true, deaktivert: true, funksjon, sendt: 0, melding: "Automatiske e-poster er slått av" }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
  );
}

/**
 * Erstatter Deno.serve for automatiske e-postfunksjoner. Den opprinnelige
 * behandleren beholdes i koden, men kalles aldri mens AUTO_EPOST_STOPPET er sann.
 */
export function serveUtenAutoEpost(
  funksjon: string,
  // deno-lint-ignore no-unused-vars
  _behandler: (req: Request) => Response | Promise<Response>,
  opprydding?: () => Promise<void>,
): void {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    if (opprydding) {
      try { await opprydding(); } catch (e) {
        console.warn(`${funksjon}: opprydding feilet`, e instanceof Error ? e.message : String(e));
      }
    }
    console.log(`${funksjon}: automatisk e-post er slått av – ingenting sendt`);
    return autoEpostAvslattSvar(funksjon);
  });
}
