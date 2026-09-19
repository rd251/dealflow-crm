# Del 1: Smarte «venter på svar»-påminnelser per person

I dag teller oppfølging bare dager. Dette legger til at CRM-et forstår at *du venter på svar* fra en bestemt person, og sender deg én rolig e-post om akkurat den personen — med begrunnelsen skrevet ut.

## 1. Oppdag «venter på svar»

Bygger på aktivitetsloggen som allerede finnes. Ingen ny parallell historikk.

- Når en e-post sendes fra CRM-et, eller synkroniseres som utgående, avgjør AI-en ut fra emne og tekst: inneholder denne en forespørsel eller et spørsmål som krever svar? (bekrefte tidspunkt, ta en beslutning, sende et dokument)
- Hvis ja, markeres personen/salgsmuligheten som **venter på svar**, med dato for vår siste melding, emnet og en kort AI-begrunnelse.
- Markeringen fjernes automatisk når det kommer svar i samme samtale, eller det logges ny aktivitet med personen.

## 2. Påminnelsen

- Etter 3 dager uten svar (justerbar konstant per bruker) sendes én e-post om **den ene personen** — ikke en liste.
- Emne: «Følg opp Ola Nordmann». Innholdet sier antall dager siden siste kontakt, hva samtalen handlet om, og én AI-skrevet setning om hvorfor det trenger oppfølging.
- Knapp «Åpne i CRM» går rett til personen/salgsmuligheten med «Logg aktivitet» klar.
- Din egen signatur brukes, og e-posten sendes aldri med uløste `[...]`-plassholdere.

## 3. Kontroll

- Maks én påminnelse per person per samtale, maks 5 per bruker per dag (konstanter).
- Ny seksjon i Innstillinger: av/på og antall dager, lagret per bruker.

---

# Del 2: Gjør CRM-et riktig for flere brukere

Google-tilkoblingen er allerede lagret per bruker. Det som mangler er eierskap, hvem som gjorde hva, personlige innstillinger og tydelig tilkoblingstilstand.

## 1. Google per bruker

- Gmail-sending og kalender bruker alltid den innloggede brukerens egen tilkobling — aldri en annens. Sending skjer fra din egen adresse med din egen signatur.
- Er du ikke tilkoblet, vises «Koble til Google» der du prøver å sende eller se kalender, i stedet for en stille feil.
- Er tilgangen utløpt eller trukket tilbake, markeres tilkoblingen som utløpt og du får «Koble til på nytt».

## 2. Eierskap og «mine» visninger

- Leads, salgsmuligheter, kunder og partnere får en reell eier (bruker), i tillegg til dagens navnefelt som beholdes.
- «Mine» blir standard i Leads, Salgsmuligheter, «Følg opp i dag» og «Relasjoner som trenger kontakt», med en synlig bryter «Mine / Teamet».
- Påminnelser og mandagsagenda sendes til hver bruker kun om egne poster.

## 3. Delt vs. personlig

- Poster, tidslinje og pipeline forblir felles og synlige for hele teamet; aktivitetsloggen viser hvem som gjorde hva.
- Kun Google-tokens og personlige innstillinger er private.

---

## Teknisk

**Migreringer (additive)**
- `venter_pa_svar`: `id`, `user_id`, `kontakt_id`, `lead_id`, `salgsmulighet_id`, `selskap_id`, `e_post`, `thread_id`, `emne`, `aktivitet_id`, `sendt_dato`, `ai_begrunnelse`, `status` (`venter|besvart|varslet|avbrutt`), `varslet_at`. Unik indeks på (`user_id`, `thread_id`). RLS: kun egne rader for `authenticated`, alt for `service_role`, med `GRANT`.
- `profiles`: `nudge_aktiv boolean default true`, `nudge_dager int default 3`, `ukesagenda_aktiv boolean default true`, `daglig_epost_aktiv boolean default true`.
- Eier-kolonner: `leads.eier_id`, `salgsmuligheter.eier_id`, `selskaper.eier_id`, `partnere.eier_id` (uuid, nullable). Backfill fra dagens `ansvarlig`/`kundeansvarlig` ved match mot `profiles.display_name`; tomme lar stå.
- `aktiviteter.user_id` settes på alle nye innslag; trigger `set_aktivitet_user_id` fyller `auth.uid()` når feltet mangler.
- RLS-gjennomgang: `google_calendar_connections` og `profiles` (private felt) kun egen rad; CRM-tabellene lesbare for alle `authenticated`.

**Konstanter** i ny `src/lib/nudge-rules.ts`: `NUDGE_DAGER_STANDARD = 3`, `NUDGE_MAKS_PER_DAG = 5`, speilet i edge-funksjonen.

**Klassifisering** — ny `supabase/functions/_shared/awaiting-reply.ts`: Lovable AI Gateway, `openai/gpt-6-astra` (Responses API, streaming), strengt JSON `{ venter, emne, begrunnelse }`. Kalles fra `gmail-send` etter sending og fra `gmail-sync` for utgående siste-melding-i-tråd. Opprydding: `gmail-sync` setter `besvart` ved innkommende melding i samme tråd; databasetrigger på `aktiviteter` setter `besvart` ved ny aktivitet på samme kontakt/lead/salgsmulighet.

**Utsending** — ny edge-funksjon `nudge-awaiting-reply` (cron 06:00 UTC, `verify_jwt = false`): per bruker, respekterer av/på, terskel og dagskvote, sender via `sendTemplateEmail` med ny mal `follow-up-nudge` (registrert i `registry.ts`), idempotensnøkkel per rad, setter `varslet`. `weekly-priorities` og `daily-task-digest` filtreres på `eier_id` per mottaker.

**Frontend** — `useMineFilter`-hook med `Mine/Teamet`-bryter (lagret i localStorage per bruker) brukt i Leads, Salgsmuligheter, Dashboard-drilldowns og Relasjoner; `loggAktivitet` setter `user_id`; `ActivityLog`/`PersonTimeline` viser hvem som utførte handlingen; «Venter på svar»-merke i tidslinjen; Gmail-avhengige knapper viser «Koble til Google» når tilkobling mangler; nudge-innstillinger i `Innstillinger.tsx`.

**Mal** `follow-up-nudge.tsx`: samme rolige Snakk-stil — overskrift, dager siden kontakt, emne, AI-setning, én primærknapp med dyplenke, signaturblokk nederst.

---

# Del 3: Investorvisning (skrivebeskyttet)

Én rolig, faktabasert rapportside for investorer — den eneste flaten utenfor teamet.

## Tilgang

- Ny rolle **investor**, adskilt fra interne brukere. En admin styrer en e-postallowlist under Innstillinger, slik at det alltid er lett å se hvem som har investortilgang.
- En investor logger inn med sin egen e-post og lander rett på investorsiden. Alle andre sider er stengt — også hvis noen skriver inn adressen manuelt.
- Sperren ligger i databasen, ikke bare i grensesnittet: investorer får lese kun de aggregerte tallene, aldri rådataene.
- Interne beholder full tilgang nøyaktig som i dag.

## Hva siden viser

- Nøkkeltall: samlet MRR og ARR, antall aktive kunder, MRR-utvikling over tid, churn og netto ny MRR.
- Kundeliste: firmanavn, bransje, status (aktiv/pause), MRR og kunde siden.
- Inntektskonsentrasjon: hvor stor andel av MRR som kommer fra største kunde, topp 3 og topp 5.
- Partnerinntekt som én samlet linje.

## Hva den aldri viser

Ingen kontaktpersoner, e-post eller telefon. Ingen tidslinje, notater, samtalelogg eller dialog. Ingen pipeline, leads, stadier eller AI-oppsummeringer. Ingen avtalevilkår eller partnerbetingelser.

## Teknisk

- `app_role`-enum utvides med `investor` (additivt). Allowlist-tabell `investor_tilgang`: `id`, `e_post`, `aktiv`, `opprettet_av`, `created_at`; admin-styrt via `has_role(auth.uid(),'admin')`-policyer, med `GRANT`.
- Rolle tildeles ved innlogging: trigger på `auth.users` (insert + e-postbekreftelse) gir `investor` når verifisert e-post står i allowlisten, ellers dagens logikk. Tildeling krever verifisert e-post.
- Ny database-view `investor_portefolje` (aggregater: firmanavn, bransje, status, mrr, kunde siden) og `investor_noekkeltall`/`investor_mrr_trend` som `security invoker`-views med `GRANT SELECT` kun til `authenticated` og policyer som krever `has_role(auth.uid(),'investor') OR has_role(auth.uid(),'admin')`. Investorer får ingen `SELECT`-policy på `leads`, `salgsmuligheter`, `aktiviteter`, `kontakter`, `partnere` — dagens policyer strammes fra «alle innloggede» til «interne roller».
- Frontend: ny side `src/pages/Investor.tsx` på `/investor` med dagens kortdesign, `nok()`-formatering og tabular-nums; `useAuth` eksponerer `erInvestor`; `App.tsx` ruter investorer til `/investor` og blokkerer øvrige ruter; sidebar skjules for investorer; Innstillinger får adminseksjon «Investortilgang» med liste, legg til og deaktiver.

## Rekkefølge

Del 1 (påminnelser) → Del 2 (flerbruker, inkludert eierskap og RLS-opprydding) → Del 3 (investorvisning), siden Del 3 bygger på det strammere rolleoppsettet i Del 2.
