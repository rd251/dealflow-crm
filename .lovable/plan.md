# Samlet designsystem og ny porteføljeoversikt

## Mål
Gi hele CRM-et ett rolig, profesjonelt visuelt språk i lys og mørk modus, og gjøre `/dashboard` til en datadrevet porteføljeoversikt. Eksisterende funksjoner, navigasjon, datalagring og integrasjoner beholdes uendret.

## Det som bygges

### 1. Felles designsystem
- Definere de oppgitte lyse og mørke fargene som semantiske variabler i global CSS og eksponere dem i Tailwind-temaet.
- Legge til egne roller for positiv/inntekt, advarsel/churn, pipeline og partner, slik at samme betydning alltid får samme farge.
- Bruke Space Grotesk på overskrifter og alle tallverdier, Inter på øvrig tekst, og tabellariske sifre på økonomi og måltall.
- Standardisere kort, paneler, tabeller, felt, faner, knapper, badges, popovere og dialoger til 14 px radius, 1 px kant og den beskrevne lave skyggen.
- Gjøre mørk modus komplett via `.dark`-variablene uten å endre eksisterende temafunksjon eller appoppførsel.
- Begrense bevegelse til en diskret vekst i MRR-stolpene, deaktivert ved redusert bevegelse.

### 2. Ny porteføljeoversikt på forsiden
- Erstatte dagens dashboardinnhold med en norsk porteføljeoversikt, fortsatt på eksisterende `/dashboard`.
- Vise hero-kort for aktiv MRR og en kompakt KPI-rad med ARR, snitt-MRR, aktive kunder, churn-risiko, kunder i dialog og partnere.
- Lage «MRR per kunde» med aktive kunder sortert synkende, bransje, norsk kr-format og skalerte grønne stolper.
- Lage statusoversikt med egne semantiske markører for aktive, churn-risiko og i dialog.
- Gruppere aktive kunder i tydelige MRR-nivåer med antall og summert MRR.
- Vise partnere i en separat lilla seksjon med navn, status og avtaletype.
- Alle tall beregnes fra eksisterende `selskaper`, `salgsmuligheter` og `partnere`; ingen eksempeldata eller nye spørringer legges inn.

### 3. Samme uttrykk på resten av CRM-et
- Oppdatere den delte siderammen og navigasjonen til det nye systemet, med «Oversikt» som vanlig norsk navn på landingssiden.
- La globale UI-komponenter bære mesteparten av endringen, og rydde målrettet i sider som har egne hardkodede farger eller avvikende paneler.
- Samordne tabeller, mobilkort, KPI-felt, kanban-kolonner og statusmerker på leads, salgsmuligheter, kunder, partnere, oppgaver, kalender, kontrakter og øvrige arbeidsflater.
- Restyle onboarding visuelt med de samme tokens og typografien, uten å endre spørsmål, progresjon, opplasting eller innsending.
- Beholde partnerinnhold visuelt adskilt med lilla aksent og kunde-/inntektsinnhold med grønn aksent.

## Datatolkning
- **Aktiv kunde:** `kundestatus = Live`.
- **Churn-risiko:** kunder med `kundestatus = Pause` eller `kundetilstand = Risiko`; disse dedupliseres og holdes utenfor aktiv MRR.
- **I dialog:** unike selskaper med en åpen salgsmulighet, altså ikke `Vunnet` eller `Tapt`.
- **Partneravtale:** eksisterende `partnertype`; status kommer fra `partnerstatus`.
- **MRR-nivåer:** under 5 000 kr, 5 000–9 999 kr, 10 000–19 999 kr og 20 000 kr eller mer.

## Tekniske grenser
- Ingen endringer i datamodeller, backend, spørringer, integrasjoner, ruter eller forretningslogikk.
- Ingen endringer i `.env`, `.gitignore`, autentisering eller låste/autogenererte filer.
- Valuta fortsetter å bruke eksisterende `nok()` for norsk formatering.

## Kontroll
- Kjøre målrettet typekontroll og kontrollere at siste bygg er feilfritt.
- Verifisere oversikten innlogget på desktop og mobil, inkludert ekte tall, sortering, mørk modus og manglende horisontal overflow.
- Stikkprøve kanban, kalender, kunde-/dealvisning, kontraktvisning, onboarding og navigasjon for visuell konsistens og uendret interaksjon.
