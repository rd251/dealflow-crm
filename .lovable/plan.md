# Ringeliste på Leads

## Endringer
- Legg «I dag»-listen inn som en egen fane på Leads-siden, med dagens eksisterende kortvisning og handlinger.
- La den separate Ringeliste-siden kun vise kampanjelister, slik at dagens leadoppfølging finnes ett sted.
- Fjern Ringeliste fra hovedmenyen; eksisterende adresse beholdes for kampanjelister.
- Legg til egne leadstatuser «Svarte ikke telefon» og «Ikke fått tak i ennå» i alle statusvalg og filtre.
- Oppdater «Ikke svar»-handlingen til å lagre statusen «Svarte ikke telefon», og tilby «Ikke fått tak i ennå» direkte på dagens ringekort.

## Tekniske detaljer
- Utvid `lead_status` additivt i databasen, uten å endre eksisterende leaddata.
- Oppdater TypeScript-typen og de delte statusfargene.
- Behold dagens kriterier for hvem som vises i ringelisten, og all eksisterende logging og oppgaveoppretting.
- Verifiser Leads-fanene, statuslagring og mobil/desktop uten å endre øvrig CRM-funksjonalitet.
