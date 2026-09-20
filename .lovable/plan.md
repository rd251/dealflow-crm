# Kundeforhold-redesign + timeregistrering

## 1. Oversiktssiden (Kundeforhold)

Ny toppseksjon med fire nøkkeltall i 2x2-rutenett: aktive kunder, total MRR (kun live), kansellerte denne måneden, churn-rate denne måneden.

Filterknapper: Alle / Live / Risiko / Pilot / Kansellert (erstatter dagens egen/partner-bryter som egen liten bryter ved siden av).

Listen deles i to seksjoner:
- **Krever oppmerksomhet** — kundetilstand Risiko eller Usikker, eller ingen aktivitet siste 14 dager. Rød ramme ved Risiko/inaktiv, gul ved Usikker.
- **Live kunder** — resten, sortert på siste aktivitet.

Kundekort: initialer/logo, firmanavn, pakke + MRR, kundetilstand-merke, siste aktivitet som relativ tid («for 3 dager siden»). Klikk åpner kundeprofilen.

Dagens tabellvisning og importfunksjon beholdes tilgjengelig, men kortvisningen blir standard.

## 2. Kundeprofil

Ny header: logo/initialer, firmanavn, org.nr, pakke, status-merke (Live/Pilot/Kansellert), tilstandsmerke, mini-nøkkeltall MRR / ARR / go-live, og hurtigknapper Ring / E-post / Møte / Kontrakt.

Fem faner:

**Oversikt** — kundeansvarlig, kundestatus, kundetilstand, pakke, oppstart betalt, kontraktslengde, sist aktivitet (redigerbart som i dag). Neste steg med «→ Gjør til oppgave». Kontaktperson-kort (navn, rolle, e-post, telefon). Siste 3 aktiviteter.

**Aktivitet** — full tidslinje med ikoner per type (telefon, e-post, møte, notat, kontrakt) og hurtiglogg øverst: Ringt / E-post / Møte / Notat (gjenbruker eksisterende logg-aktivitet-flyt).

**Prosjekt** — onboarding-type som nedtrekk: Selvbetjening / Assistert / Konsulent, med forklarende undertekst. Stegliste tilpasset valgt type (avkrysningsbokser, felles steg 1–2 + typespesifikke steg). Timeregistrering vises kun for Assistert og Konsulent.

**Dokumenter** — kontrakter fra DealBuilder («Åpne i DealBuilder», «Last ned PDF») og manuelt opplastede dokumenter med opplastingsknapp (bygger på dagens dokumentkomponent).

**Onboarding** — svar fra onboarding-skjemaet, KB-filer lastet opp av kunde, opplasting av interne KB-filer. Når prosjektet settes til Live slettes KB-filene automatisk fra lagring (bekreftelsesdialog først).

## 3. Timeregistrering

Per innslag: type (Oppsett / Integrasjon / Møte / Opplæring / Support / Annet), beskrivelse, dato, timer (desimal), timepris (standard 1500 kr, kan endres per prosjekt).

Liste over alle timer med summer: totalt antall timer, total sum, allerede fakturert, gjenstår å fakturere.

Knapper: «Forhåndsvis faktura» (pen liste i dialog), «Eksporter til Tripletex» (deaktivert, med forklaring «Kommer snart — Tripletex-integrasjon settes opp»), «Merk som fakturert» for valgte rader.

## Teknisk

- Migrering: ny tabell `public.prosjekt_timer` (id, prosjekt_id, selskap_id, type, beskrivelse, dato, timer numeric, timepris numeric default 1500, fakturert boolean default false, fakturert_dato, opprettet_av, created_at/updated_at) med GRANT til `authenticated`/`service_role`, RLS og interne policyer likt øvrige CRM-tabeller.
- Additivt på `prosjekter`: `onboarding_type` text (standard «Selvbetjening»), `onboarding_steg` jsonb (fullførte steg), `timepris` numeric default 1500.
- Nye filer: `src/lib/kundeforhold.ts` (navngitte konstanter: `INAKTIV_DAGER = 14`, `STANDARD_TIMEPRIS = 1500`, onboarding-typer og stegdefinisjoner, timetyper), `src/components/kunde/Timeregistrering.tsx`, `src/components/kunde/ProsjektOnboarding.tsx`, `src/components/kunde/KundeKort.tsx`.
- Endres: `src/pages/Companies.tsx` (oversikt), `src/pages/CompanyProfile.tsx` (faner), `src/components/CompanyDocuments.tsx` (gjenbrukes uendret), `src/hooks/use-crm-store.ts` (prosjektfelter).
- Eksisterende data, queries og integrasjoner beholdes; alt norsk UI og gjeldende designsystem.

## 4. Prosjektsiden (oversikt)

Ren oversikt — ingen opprettelse her. Fire nøkkeltall øverst (2x2): aktive prosjekter (ikke Live/Kansellert), klar for go-live, gjennomsnittlig onboarding-tid i dager (opprettet → Live), live denne måneden.

Filterfaner: Alle / Ny / I produksjon / Test med kunde / Klar for live / Live / Blokkert. (Statusen «Klar for live» legges til i prosjektstatus.)

Prosjektkort: firmanavn + logo/initialer, prosjektnavn, onboarding-type-merke, statusmerke med farge, ansvarlig, opprettet dato, forventet go-live, dager siden opprettet, fremdriftsbar (fullførte steg av totalt). Rød ramme hvis blokkert eller forventet go-live er passert.

Klikk åpner prosjekt-panelet. «Nytt prosjekt»-knappen fjernes fra siden.

## 5. Opprette prosjekt (fra kundeprofil)

Under fanen Prosjekt på kundeprofilen: knapp «Opprett prosjekt» når kunden ikke har prosjekt. Modal med prosjektnavn (auto «Onboarding — [firmanavn]»), ansvarlig (nedtrekk med brukere, standard Roberto Garcia Bjertnes), onboarding-type, timepris (kun Assistert/Konsulent, standard 1500), startdato (i dag), forventet go-live, integrasjon og notater til ansvarlig.

Ved opprettelse: prosjektet lagres og kobles til selskapet med status «Ny», det opprettes oppgave «Start onboarding — [firmanavn]» til ansvarlig, ansvarlig får intern varsling «Nytt prosjekt tildelt: [firmanavn] — [type]», og aktiviteten «Prosjekt opprettet av [bruker]» logges på selskapet.

## 6. Prosjekt-panel

Header: firmanavn, prosjektnavn, status, onboarding-type, ansvarlig, forventet go-live.

Seksjoner: fremdrift (steg med avkryssing tilpasset type), timeregistrering (samme komponent som på kundeprofilen), notater, integrasjon med tekniske notater, og aktivitetslogg.

Statusvalg: Ny / I produksjon / Test med kunde / Klar for live / Live / Blokkert.

Ved «Live»: kundens status settes til Live, go-live dato settes på selskapet, KB-filer slettes fra lagring, aktiviteten «Kunde satt live av [bruker]» logges, og kundeansvarlig varsles «[firmanavn] er nå live!».

## Teknisk (tillegg)

- Migrering: `prosjekt_status`-enum utvides med «Klar for live»; `prosjekter` får `notater_ansvarlig` text.
- Nye filer: `src/components/prosjekt/OpprettProsjektDialog.tsx`, `src/components/prosjekt/ProsjektDrawer.tsx`, `src/components/prosjekt/ProsjektKort.tsx`.
- `src/pages/Prosjekter.tsx` skrives om til oversikt med nøkkeltall, filtre og kort (dagens kanban-drag erstattes av statusvalg i panelet).
- Varslinger skrives til `varsler`-tabellen; oppgaver til `oppgaver`; aktiviteter via eksisterende `loggAktivitet`.
