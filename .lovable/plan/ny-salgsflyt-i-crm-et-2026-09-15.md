# Ny salgsflyt i CRM-et

Mål: én rett linje fra lead til signert kontrakt. Leads i en rask tabell, salgsmuligheter i kanban, ringeliste som dagens arbeidsliste, og automatikk som lager oppgavene underveis.

## Leads

Tabell (ikke kanban) med kolonnene: firmanavn, kontaktperson, kilde, status, ansvarlig, siste aktivitet (relativ tid), neste steg, dager siden opprettet. Klikk på firmanavn åpner en skuff fra høyre.

Tre nøkkeltall øverst: nye leads denne uken, kvalifiserte denne måneden, konverteringsrate (kvalifisert → salgsmulighet).

Statusfarger: Ny (blå), Kontaktet (gul), Kvalifisert (grønn), Ikke aktuelt (grå), Konvertert (lilla).

Hurtighandlinger vises på rad-hover: logg samtale, book møte, send e-post, konverter til salgsmulighet.

Skuffen: venstre side med firmaopplysninger, statusvalg, ansvarlig, neste steg og selskapsinnsikt (org.nr, ansatte, bransje). Høyre side med aktivitetstidslinje og hurtigknapper «Ringt», «E-post», «Møte», «Notat».

Kilde: dagens lange kildeliste beholdes på hvert lead, men tabellen filtrerer på fire grupper — Inbound, Outbound, Partner, Referanse. Eksisterende kilder mappes inn i disse (f.eks. Nettside/Organisk/Agent Builder → Inbound, Kald outbound/Instantly → Outbound).

## Salgsmuligheter — kanban

Fem kolonner: Møte booket, Demo gjennomført, Kontrakt sendt, Vunnet, Tapt.

Øverst: total pipelineverdi, vunnet denne måneden (MRR), win rate denne måneden, gjennomsnittlig deal-alder.

Kort viser: firmanavn med logo, kontaktperson, pakke + MRR, dager i nåværende steg, neste steg, kontraktstatus, ansvarlig, og en rød prikk hvis ingen aktivitet siste 7 dager.

Skuff med fire faner: Oversikt (pakke, MRR, ARR, oppstart, kontraktslengde, totalverdi, sannsynlighet, lukkedato, neste steg, ansvarlig, kilde, use case), Kontakt og selskap, Aktivitet (tidslinje, hurtiglogg, kommende møter), Kontrakt (status, send kontrakt, påminnelse, signert dato, historikk).

## Automatikk

- Lead konvertert → ny salgsmulighet i «Møte booket» + oppgave «Gjennomfør demo»
- Flyttet til «Demo gjennomført» → oppgave «Send kontrakt» med 2 dagers frist
- «Send kontrakt» → status «Kontrakt sendt», PDF genereres og sendes via DealBuilder
- Kontrakt signert (webhook) → «Vunnet», konfetti, kundeforhold + prosjekt opprettes, velkomst-e-post sendes
- Flyttet til «Tapt» → tapsårsak må velges + oppgave «Følg opp om 90 dager»

## Ringeliste

Viser hvem som skal ringes i dag, satt sammen av: leads uten aktivitet siste 3 dager, ringeoppgaver med frist i dag, og leads med status «Ny» eldre enn 2 dager.

Hvert kort: navn, firma, telefon, siste kontakt, neste steg. Knapper: «Ringt», «Ikke svar», «Ikke aktuelt», «Book møte». «Ringt» logger aktiviteten, åpner notatfelt og spør om møtebooking.

## Design

Mørk sidemeny, lyst innhold, god luft, tydelige statusfarger, skuffer fra høyre, tabeller med hover, mobilvennlig. Ny aksentfarge #c0392b.

Sidemeny i rekkefølgen: Dashboard, Leads, Ringeliste, Salgsmuligheter, Kundeforhold, Prosjekter, Kontakter, Partnere, Kalender, Oppgaver, Rapporter, Admin. Den samlede «Salg»-siden som ble laget tidligere fjernes fra menyen, siden Leads og Salgsmuligheter nå tar over.

## Antakelser

- «Kundeforhold» i menyen = dagens kundeside (/selskaper). Sidene Alle selskaper, Kontaktstrøm, Møtenotater, Endringslogg, Partner Pipeline og Nyhetsbrev beholdes, men samlet under «Mer» slik at hovedmenyen følger rekkefølgen over.
- Aksentfargen #c0392b erstatter dagens røde primærfarge i hele appen. Den mørke sidemenyen beholdes, men justeres til samme rødtone.
- Ingen data slettes; eksisterende leads, deals, aktiviteter og kontrakter beholdes.

## Teknisk

- Databasen har i dag stegene «Behov avklart» og «Løsning presentert». Additiv migrering legger til «Demo gjennomført» i `salgsmulighet_status`; de to gamle verdiene beholdes i databasen men vises i «Demo gjennomført»-kolonnen, og nye deals bruker kun de fem nye stegene.
- Kildegruppering (Inbound/Outbound/Partner/Referanse) gjøres i frontend via en mapping over dagens `kilde`-enum — ingen skjemaendring.
- `src/pages/Leads.tsx`, `src/pages/Salgsmuligheter.tsx` og `src/pages/Ringeliste.tsx` skrives om; felles byggeklosser (`PageShell`, `DetailPanelShell`, `ActivityLog`, `CompanyLogo`, `StatCard`) gjenbrukes.
- Automatikken bygger på eksisterende `konverterLead`, `vinnSalgsmulighet`, `tapSalgsmulighet` i `use-crm-store`, DealBuilder-funksjonene og `welcome-customer`-malen; nye steg legger til oppgaver i `oppgaver`.
- Fargetokens (#c0392b, statusfarger, stadiefarger) oppdateres i `src/index.css` og `tailwind.config.ts` — ingen hardkodede farger i komponentene.
- `src/pages/Salg.tsx` og ruten `/salg` fjernes fra navigasjonen.

## Rekkefølge

1. Fargetokens og sidemeny
2. Leads-siden med skuff og hurtighandlinger
3. Salgsmuligheter-kanban med fanedrevet skuff (inkl. migrering av steg)
4. Ringeliste
5. Automatikk og kontraktsflyt
