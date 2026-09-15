# Redesign av Dashboard og Oppgaver

## Mål
Bygge to rene arbeidsflater basert kun på eksisterende CRM-data: ett dashboard for salgs- og kundekontroll, og én oppgaveside for dagens prioriteringer.

## Dashboard
- Erstatt dagens omfattende dashboard, AI-felt, velkomstinnhold og tips med én kompakt side.
- Behold globalt søk øverst, men la treff åpne riktig selskap eller riktig lead-/kontakt-/salgsmulighetsvisning direkte via dyp lenke.
- Vis to tydelig merkede KPI-rader med fire klikkbare kort hver:
  - Salg: nye leads denne uken, åpen pipeline i total kontraktsverdi, vunnet MRR denne måneden og månedlig win rate.
  - Kunder: aktive live-kunder, live MRR, kansellerte denne måneden og månedlig churn-rate.
- Legg inn «Krever handling nå» med de fire avtalte kontrollpunktene og lenker som åpner relevante, filtrerte sider.
- Slå sammen kommende møter og åpne oppgaver til én kronologisk liste med fem elementer og riktige lenker.
- Lag to enkle grafer med eksisterende diagramverktøy:
  - MRR-utvikling for siste seks måneder.
  - Leads gruppert som Inbound, Outbound, Partner og Referanse.
- Bruk én kolonne på mobil og to kolonner for de nederste seksjonene på desktop.

## Oppgaver
- Erstatt dagens grupperte oppgaveliste og opprettelsesmodal med en fokusert to-kolonners arbeidsflate.
- Legg inn fanene «I dag», «Denne uken», «Alle åpne» og «Ferdig».
- Vis kun den innloggede brukerens oppgaver i «Min liste», sortert i denne rekkefølgen: forfalt, i dag, denne uken, uten frist.
- Lag hurtigoppretting øverst: oppgavetekst med Enter, samt valgfrie inline-felt for frist og tilknytning til selskap, lead eller salgsmulighet.
- Hvert kort får tittel, klikkbar tilknytning, relativ frist, prioritetsprikk, ansvarlig avatar og «Merk ferdig» direkte på kortet.
- Behold redigering av eksisterende oppgaver, men enkel opprettelse skal aldri kreve modal.
- Vis adminoversikten i høyre kolonne med alle åpne oppgaver per bruker, antall forfalte og tydelig markering av høyeste belastning. Skjul denne kolonnen for andre brukere.

## Design og samspill
- Følg den eksisterende mørke sidebaren og de semantiske fargetokenene, med rød hovedaksent tilsvarende `#c0392b`.
- Bruk hvite/rene innholdsflater, diskrete rammer, store tall og få dekorative elementer.
- Forfalte oppgaver får rød flate/ramme, dagens oppgaver oransje uttrykk, og ferdige oppgaver grå tekst med gjennomstreking.
- Alle klikkbare kort og relasjoner får tastaturfokus og mobilvennlig oppsett.

## Tekniske detaljer
- Dashboard-data beregnes fra eksisterende leads, salgsmuligheter, selskaper, oppgaver og aktiviteter; ingen AI-kall eller generert tekst brukes.
- MRR-grafen rekonstruerer månedsslutt fra nåværende MRR, go-live-dato og kanselleringsdato. Historiske prisendringer kan ikke gjenskapes fordi de ikke lagres som tidsserie.
- Kontrakter eldre enn sju dager bruker statusendring fra endringsloggen når tilgjengelig, ellers siste aktivitetsdato som trygg reserve.
- Kildegrafen bruker prosjektets eksisterende kildegruppering.
- Oppgaveendringer går gjennom eksisterende lagring og tilgangsstyring; adminstatus hentes fra eksisterende innlogging.
- Verifiser typekontroll, forhåndsvisningsfeil og desktop/mobil med innlogget nettlesertest.

## Avgrensning
- Ingen databaser slettes eller endres.
- Ingen nye AI-funksjoner, velkomsttekster eller tipsseksjoner legges til.
- Historisk MRR blir et databasert estimat innenfor feltene som finnes i dag, ikke et nytt økonomisk historikkregister.
