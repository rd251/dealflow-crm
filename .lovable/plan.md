# Smarte «venter på svar»-påminnelser per person

I dag teller oppfølging bare dager. Dette legger til at CRM-et forstår at *du venter på svar* fra en bestemt person, og sender deg én rolig e-post om akkurat den personen — med begrunnelsen skrevet ut.

## 1. Oppdag «venter på svar»

Alt bygger på aktivitetsloggen som allerede finnes. Ingen ny parallell historikk.

- Når en e-post sendes fra CRM-et (Gmail-sending) eller synkroniseres som utgående, ser AI-en på emne og tekst og avgjør: inneholder denne en forespørsel eller et spørsmål som krever svar? (bekrefte tidspunkt, ta en beslutning, sende et dokument)
- Hvis ja, markeres personen/salgsmuligheten som **venter på svar**, med dato for vår siste melding, emnet i samtalen og en kort AI-begrunnelse.
- Markeringen fjernes automatisk så snart det kommer et svar i samme samtale, eller det logges hvilken som helst ny aktivitet med den personen.

## 2. Påminnelsen

- Etter 3 dager uten svar (justerbar konstant) sendes én e-post til deg om **den ene personen** — ikke en liste.
- Emne: «Følg opp Ola Nordmann».
- Innholdet sier hvor mange dager siden siste kontakt, hva samtalen handlet om, og én setning med AI-skrevet kontekst om hvorfor det trenger oppfølging.
- Knapp «Åpne i CRM» som går rett til personen/salgsmuligheten med «Logg aktivitet» klar.
- Din egen signatur brukes, og e-posten sendes aldri med uløste `[...]`-plassholdere.

## 3. Kontroll

- Maks én påminnelse per person per samtale.
- Maks 5 påminnelser per bruker per dag (konstant).
- Ny seksjon i Innstillinger: skru påminnelser av/på og endre antall dager.
- Bruker eksisterende sendelogikk og signaturinnstillinger.

## Teknisk

**Migrering (additiv)**
- `venter_pa_svar`: `id`, `user_id`, `kontakt_id`, `lead_id`, `salgsmulighet_id`, `selskap_id`, `e_post`, `thread_id`, `emne`, `aktivitet_id`, `sendt_dato`, `ai_begrunnelse`, `status` (`venter` | `besvart` | `varslet` | `avbrutt`), `varslet_at`. Unik indeks på (`user_id`, `thread_id`) hindrer dobbeltvarsling per samtale. RLS: egne rader for `authenticated`, full tilgang for `service_role`, med `GRANT`.
- `profiles`: `nudge_aktiv boolean default true`, `nudge_dager int default 3`.

**Konstanter** i ny `src/lib/nudge-rules.ts`: `NUDGE_DAGER_STANDARD = 3`, `NUDGE_MAKS_PER_DAG = 5`, delt speiling i edge-funksjon.

**Klassifisering** — ny delt `supabase/functions/_shared/awaiting-reply.ts`: kaller Lovable AI Gateway (`openai/gpt-6-astra`, Responses API, streaming) og returnerer strengt JSON `{ venter: boolean, emne: string, begrunnelse: string }`. Kalles fra `gmail-send` etter vellykket sending og fra `gmail-sync` for utgående meldinger som er siste melding i tråden.

**Opprydding** — `gmail-sync` setter `besvart` når en innkommende melding har samme `thread_id`; en databasetrigger på `aktiviteter` setter `besvart` når ny aktivitet logges på samme kontakt/lead/salgsmulighet.

**Utsending** — ny edge-funksjon `nudge-awaiting-reply` (cron hver morgen kl. 06:00 UTC, `verify_jwt = false`): henter `venter`-rader eldre enn brukerens terskel, respekterer av/på og dagskvoten, sender via `sendTemplateEmail` med ny mal `follow-up-nudge` (registrert i `registry.ts`), idempotensnøkkel per rad, og setter `varslet`.

**Mal** `follow-up-nudge.tsx`: samme rolige Snakk-stil som dagens maler — overskrift, dager siden kontakt, emne, AI-setning, én primærknapp med dyplenke, signaturblokk nederst.

**UI**: «Venter på svar»-merke i `PersonTimeline`/kontaktkort, og nudge-innstillinger i `Innstillinger.tsx`.
