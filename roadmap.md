# Roadmap

- [x] Redesign Dashboard med globalt søk, KPI-er, handlinger, kommende aktiviteter og grafer
- [x] Legg til «Dagens aktivitet» med dagens CRM-hendelser og kontraktstatus
- [x] Redesign Oppgaver med faner, hurtigoppretting, personlig liste og adminoversikt
- [x] Verifiser desktop, mobil, navigasjon og datalagring
- [x] Innfør samlet lyst/mørkt designsystem i hele CRM-et
- [x] Bygg datadrevet porteføljeoversikt som landingsside
- [x] Verifiser oversikt og sentrale arbeidsflater på desktop og mobil
- [x] Flytt dagens ringeliste til Leads og behold kampanjelister separat
- [x] Legg til statusene «Svarte ikke telefon» og «Ikke fått tak i ennå»
- [x] Verifiser statuslagring og Leads-fanene på desktop og mobil
- [x] Forenkle Salgsmuligheter til Aktive/Vunnet/Tapt/Arkiv
- [x] Redesign kanbankort, kolonneoverskrifter og KPI-stripen
- [x] Verifiser drag-and-drop, filtre, desktop og mobil
- [x] Legg til steget «Demo-prosjekt» før «Kontrakt sendt» i pipelinen
- [x] Gjør tall og rader på Porteføljeoversikt klikkbare med deep-linkede filtre og filterchips

## Meta Lead Ads
- [x] Webhook med challenge-verifisering og HMAC-signaturkontroll
- [x] Varig kø med idempotens per Meta lead-ID
- [x] Bakgrunnsjobb med lease, retry/backoff og permanent feilstatus
- [x] Graph API-henting, feltmapping og lead-oppretting med dedup
- [x] Adminvisning under Innstillinger (status, kø, feil, prøv igjen)
- [x] Tester: challenge, signatur, batch, allowlist, mapping, retry, duplikater, uautorisert tilgang
- [ ] Legge inn Meta-hemmeligheter og abonnere siden på leadgen (krever tilgang hos Meta)
- [ ] Bekrefte ende-til-ende med et ekte testlead fra Meta

## Ukentlig prioritering
- [x] Ukesagenda med AI-rangering sendes mandag morgen (weekly-priorities)
- [x] Daglig e-post gjort konkret: topp 3 handlinger, kontaktinfo og direktelenker

## Oppfølgingspåminnelser per person
- [x] Oppdag «venter på svar» på utgående e-post med AI
- [x] Én fokusert påminnelses-e-post per person etter 3 dager
- [x] Kontroller: én per samtale, maks 5 per dag, av/på og terskel i Innstillinger

## Flerbruker
- [x] Per bruker Google-tilkobling (Gmail + Kalender) med egne tokens
- [x] Tydelig koble-til/koble-på-nytt-tilstand på Gmail-knapper
- [x] Sending fra egen Gmail med egen signatur; kalender leser/skriver mot egen kalender
- [x] Eierskap på leads, salgsmuligheter, kunder og partnere + «Mine»/«Teamet»-visninger (kun bekvemmelighetsfilter)
- [x] Påminnelser og ukesagenda kun om egne poster
- [x] Personlige innstillinger per bruker; delt CRM-data fortsatt synlig for alle
- [x] Gjennomgang av RLS: delt data lesbar, tokens og personlige innstillinger private

## Kun Snakk-ansatte
- [x] Kun @snakk.ai-kontoer får opprettet konto (investor-allowlist er eneste unntak)
- [x] Tydelig melding ved avvist konto, og Google-innlogging begrenset til snakk.ai
- [x] Ingen multi-tenant-logikk: ett felles arbeidsområde
- [x] Aktivitetslogg registrerer hvem som gjorde hva

## Investorvisning
- [x] Rollen «investor» med adminstyrt e-postallowlist
- [x] Én skrivebeskyttet side: MRR/ARR, aktive kunder, MRR-trend, churn, netto ny MRR
- [x] Kundeliste (navn, bransje, status, MRR, kunde siden) og inntektskonsentrasjon topp 1/3/5
- [x] Partnerinntekt kun som samlet linje
- [x] RLS og ruting hindrer all annen CRM-tilgang for investorer
