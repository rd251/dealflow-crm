# Relasjonslag i CRM-et

Et personsentrisk lag oppå dagens pipeline: én sammenhengende tidslinje per person, varme-/forsømmelsesmerking på kunder og partnere, og en rask måte å legge inn en person og logge første samtale på. Alt bruker den eksisterende aktivitetsloggen — ingen nye parallelle datastrukturer, ingen endring i eksisterende data eller integrasjoner.

## 1. Personsentrisk tidslinje

Ny komponent `src/components/PersonTimeline.tsx`:
- Henter alle aktiviteter knyttet til personen uansett fase: direkte på `kontakt_id`, pluss aktiviteter på leads, salgsmuligheter og selskap personen er/var knyttet til (matchet på kontakt-ID, e-post og selskap).
- Tidslinjen nullstilles aldri ved faseskifte — den følger personen og selskapet gjennom hele reisen (lead → salgsmulighet → signert → kunde).
- Hver rad viser ikon per type, tittel/notat, tidspunkt, hvem som gjorde det, og en liten fase-etikett («Lead», «Salgsmulighet · Kontrakt sendt», «Kunde», «Partner») utledet fra hvilken post aktiviteten hang på og statusen den posten har.
- Vises på kontaktkortet (fanen «Interaksjoner» i Kontakter) som full tidslinje, og som relevant utsnitt på salgsmulighet- og kundekort (kun det som gjelder den kontakten/selskapet), med lenke «Se hele relasjonen».

## 2. Relasjonsvarme

Nye konstanter i `src/lib/relationship.ts`:
- `RELASJON_LUNKEN_DAGER = 60` → «Ikke snakket på en stund» (amber)
- `RELASJON_KALD_DAGER = 120` → «Forsømt» (rød/destructive)
- Hjelpefunksjoner `relasjonTilstand()`, `relasjonEtikett()`, `relasjonFarge()` som gjenbruker samme semantiske farger som resten av CRM-et.

Bruk:
- «Sist kontaktet» vises tydelig på kundekort/-tabell (`Companies.tsx`, `CompanyProfile.tsx`) og på partnere (`Partnere.tsx`, `PartnerProfile.tsx`) — ikke bare på pipeline-poster. Verdien leses fra `sist_aktivitet` som allerede oppdateres av `loggAktivitet`.
- Ny side `/relasjoner` («Relasjoner som trenger kontakt»), lagt i sidebaren ved siden av Kontakter: aktive kunder og partnere sortert etter lengst tid siden kontakt, med filterbrikker «Alle», «Lunkne (60+)», «Forsømte (120+)» og «Logg aktivitet»-knapp direkte på hver rad.
- Porteføljeoversikten får to tappbare tall — «Ikke snakket på en stund» og «Forsømte relasjoner» — som lenker til `/relasjoner?filter=lunken` / `?filter=forsomt`, med samme drill-through-mønster og muted/ikke-klikkbar visning ved 0.

## 3. Rask registrering

Ny `src/components/QuickAddPersonDialog.tsx`:
- Ett skjema: navn (eneste påkrevde felt), valgfri e-post, telefon, rolle og selskap (søk blant eksisterende, eller skriv nytt firmanavn som opprettes samtidig).
- Under skjemaet ligger den samme aktivitetsdelen som i «Logg aktivitet» (type, notat, neste steg) slik at personen og første interaksjon lagres i én flyt.
- Lagring oppretter kontakt (og evt. selskap) via eksisterende store-funksjoner, og logger aktiviteten gjennom `loggAktivitet` med den nye kontakt-ID-en.
- Tilgjengelig fra global «+»-knapp i headeren og fra Kontakter-siden; «Logg aktivitet»-dialogen gjenbrukes uendret overalt ellers.

## Teknisk

- Ingen skjemaendringer i databasen. All lesing skjer mot `aktiviteter`, `kontakter`, `selskaper`, `partnere` og `salgsmuligheter` slik de er i dag.
- Nye filer: `src/lib/relationship.ts`, `src/components/PersonTimeline.tsx`, `src/components/QuickAddPersonDialog.tsx`, `src/pages/Relasjoner.tsx`.
- Endres: `src/App.tsx` (rute), `src/components/AppSidebar.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Contacts.tsx`, `src/pages/Companies.tsx`, `src/pages/Partnere.tsx`, `src/components/PageShell.tsx` (global hurtigknapp).
- Alle terskler er navngitte konstanter. Norske etiketter, sentence case, eksisterende designsystem og farger.
