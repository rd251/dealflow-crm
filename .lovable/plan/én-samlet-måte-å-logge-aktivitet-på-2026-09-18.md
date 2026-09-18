# Én samlet måte å logge aktivitet på

I dag kan en aktivitet registreres på flere ulike steder med hver sin dialog og logikk: aktivitetsloggen på kortene, hurtigknappene på leads/ringelista, «etter møtet»-dialogen, kalenderen og AI-kommandolinja. Målet er én knapp, én dialog og én tidslinje – uten at noe eksisterende innhold eller historikk går tapt.

## Hva du får

**1. «Logg aktivitet» overalt**
Samme knapp på salgsmulighet, lead, kunde, kontakt, partner og prosjekt – pluss en global hurtigknapp i toppen som lar deg logge uten å åpne et kort først. I den globale varianten velger du selskap, lead eller salgsmulighet inne i dialogen via eksisterende søk.

**2. Én kompakt dialog**
Typevelger: Ringte · Svarte ikke · Møte · E-post · Notat · Neste steg. Under: valgfritt kort notat, og valgfritt «Neste steg» med datovelger i samme dialog. Ved møte vises de eksisterende møtefeltene (tittel, tid, deltakere) som i dag.

**3. Hurtighandlinger med ett trykk**
«Ringte – svarte ikke», «Ringte – booket møte», «Sendte e-post» lagres umiddelbart uten dialog. Lista defineres som én konstant øverst i filen, enkel å redigere.

**4. Én tidslinje**
Alt vises i samme aktivitetstidslinje på kortet: ikon per type, tekst, tidspunkt og hvem som gjorde det. Parallelle visninger av samme data fjernes fra kortene.

**5. Boardene holder seg selv oppdatert**
Lagring oppdaterer «sist kontaktet» og fjerner «trenger oppfølging» der det er relevant, uten ekstra klikk.

## Teknisk

Ingen nye tabeller. Alt skrives til `aktiviteter` som i dag, med samme felter (`type`, `tittel`, `beskrivelse`, `dato`, relasjons-ID, `user_id`, `aktivitet_kilde`). Typene i basen (`Telefonsamtale`, `E-post`, `LinkedIn-melding`, `SMS`, `Møte`, `Notat`) beholdes uendret; de nye etikettene er presentasjonslag:

- Ringte → `Telefonsamtale`
- Svarte ikke → `Telefonsamtale` med egen tittel (samme verdi som dagens hurtighandling bruker)
- Møte / E-post / Notat → som i dag
- Neste steg → `Notat` + oppdatering av `neste_steg` på posten, og oppgave via eksisterende `NesteStegTaskButton`-logikk

Nye filer:
- `src/lib/activity-logging.ts` – typedefinisjoner, `QUICK_ACTIONS`-konstant, én `loggAktivitet()`-funksjon som all logging går gjennom (skriver aktivitet, setter `sist_aktivitet`, oppretter oppgave ved neste steg).
- `src/components/LogActivityDialog.tsx` – den ene dialogen, med relasjonsvelger når den åpnes globalt.
- `src/components/LogActivityButton.tsx` – knapp + hurtighandlinger, brukes på alle kort.

Endres:
- `ActivityLog.tsx` beholdes som tidslinje (henting, redigering, sletting, e-postvisning, Gmail/Kalender-ikoner uendret), men den interne opprettelsesdialogen erstattes av den nye felles dialogen.
- `LeadQuickActions.tsx` bygges om til å kalle `loggAktivitet()` i stedet for egen insert; knapperaden bruker samme `QUICK_ACTIONS`.
- `PostMeetingDialog.tsx`, `Kalender.tsx`, `Leads.tsx`, `Salgsmuligheter.tsx`, `AiCommandBar.tsx`: direkte `aktiviteter.insert(...)` byttes til `loggAktivitet()`. Møteoppsummering med AI, no-show og stadieflytting beholdes uendret.
- Global hurtigknapp legges i headeren (samme sted som dagens globale handlinger).

Databasetriggeren `sync_sist_aktivitet_from_aktiviteter` finnes allerede; koden setter i tillegg feltet lokalt så lista oppdateres umiddelbart. `use-follow-ups` leser samme tabell og vil derfor automatisk se nye loggføringer – oppfølgingsmerket forsvinner av seg selv.

Farger følger dagens system: blå for handling/neste steg, grønn for positivt, gul for varsel, lilla for AI. `.gitignore` og `.env` røres ikke. Ingen migrasjoner, ingen endringer i lagrede data.
