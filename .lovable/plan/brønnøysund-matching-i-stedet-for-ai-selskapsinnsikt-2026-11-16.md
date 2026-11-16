# Brønnøysund-matching i stedet for AI-selskapsinnsikt

Mål: riktig selskap på leads (særlig Meta Instant Forms) med faste regler mot Brønnøysundregistrene – ingen gjetting – og de samme registerdataene på salgsmulighet, kundekort og partnerprofil.

## Hva du vil se
- **Lead-kortet**: «Hva skjedde?», Neste steg og feltene står som før øverst. Selskapsboksen ligger nederst. Ved navnet øverst: grønn «✓ Navn · org.nr», eller oransje «Velg selskap» / «Firma ikke funnet».
- **Selskapsboksen** viser «Oppgitt i skjemaet: «…»», og deretter:
  - Bekreftet: navn, org.nr (kopierbar), organisasjonsform, bransje, ansatte, adresse, kommune, nettside, telefon/e-post, daglig leder, styreleder og siste regnskap (driftsinntekter, driftsresultat, årsresultat, egenkapital). Rødt banner ved konkurs, avvikling eller sletting. Grønn linje når kontaktpersonen står med en rolle i registeret. Knappene «Oppdater» og «Bytt selskap».
  - Usikker: «Velg riktig selskap» med 3–5 kandidater, poeng og begrunnelse, «Velg» og «Ingen av disse – søk selv».
  - Ingen: «Fant ikke firmaet i Brønnøysund» med melding og søkefelt (navn eller org.nr).
  - AI-feltene (beskrivelse, størrelse, omsetning) og glitter-ikonet fjernes.
- **Salgsmulighet (Selskap-fanen), kundekort og partnerprofil**: de samme dataene fra selskapet. Org.nr, adresser og bransje er låst (lås-ikon). Telefon, e-post og domene fylles bare inn hvis de er tomme. Firmanavnet i CRM endres aldri, og juridisk navn vises separat. Merkelappen «✓ Bekreftet i Brønnøysund» står øverst, med rødt merke ved konkurs. Mangler org.nr, vises søket direkte.
- **Konvertering** (salgsmulighet/partner): Brreg-dataene følger med til selskapet. Hvis leadet ikke er bekreftet, får du advarselen «Selskapet er ikke bekreftet i Brønnøysund».
- **Admin-knapp**: «Match firma på eksisterende leads og selskaper».

## Regler (som spesifisert)
- Tullesvar («noting», «ingen», «privat», «-», likt kontaktpersonen, tomt uten firmadomene osv.): ingen søk, status «ingen» og meldingen «Firmanavn ikke oppgitt».
- 9 sifre: direkte oppslag. Navn med «kommune»: søk bare blant kommuner. Finnes ingen aktiv kommune, blir meldingen «kan være sammenslått». E-post på firmadomene gir et ekstra søk på domenet (gmail, hotmail osv. ignoreres).
- Poeng: eksakt navn +60, alle ord +30, delvis +5, nettside samme domene +40, rollematch +40 (topp 3), slettet/konkurs/avvikling −50.
- Status «sikker» krever minst 80 poeng og minst 25 poeng foran nr. 2. Ellers blir status «usikker» uten org.nr, eller «ingen».
- Svarer registeret ikke (8 s): ingen status, så prøves det igjen senere.

## Automatikk
- Etter nye leads fra Meta og lead-intake (blokkerer aldri innsettingen).
- Når firmanavnet endres manuelt (etter 1,5 s), unntatt når selskapet er valgt manuelt.
- Ukentlig oppdatering (én gang i uka, maks 2 kall/s) av alle selskaper med org.nr. Ved ny konkurs, avvikling eller sletting får kundeansvarlig en oppgave.

## Tester jeg kjører og viser deg
1. Halsa Kommune + gmail: «ingen» med kommune-melding, ikke sauehold.
2. «noting»: «ingen», ingen søk.
3. Snakk Teknologi + Robin Sæter Diallo: «sikker» med rollematch.
4. Tomt firmanavn + firmadomene: treff via domenet.
5. 9-sifret org.nr: «sikker».
6. «Support agent» / Bilskadesenteret Telemark AS (986658645): «Oppdater fra Brønnøysund» fyller de låste feltene, og kundekortet viser det samme.

Test 1–5 kjøres på funksjonen direkte, uten å lagre noe. Test 6 skriver ekte registerdata på det selskapet.

## Teknisk
- Migrering (additiv): `brreg_status text`, `brreg_kandidater jsonb`, `brreg_data jsonb`, `brreg_hentet timestamptz` på `leads` og `selskaper`, og `orgnr text` på `leads`. Eksisterende RLS dekker kolonnene.
- Ny edge-funksjon `brreg-match` med input `{lead_id}` | `{selskap_id}` | `{firmanavn,e_post,kontaktperson}` | `{sok}` (søkefeltet) | `{velg: orgnr, lead_id|selskap_id}` | `{refresh_alle}` (cron/admin). Skriver til raden når id er gitt. Regler i `functions/_shared/brreg-match.ts`, speilet i `src/lib/brreg-match.ts` med vitest-tester for tullesvar, normalisering, poeng og avgjørelse.
- Regnskap fra `regnskapsregisteret/regnskap/{orgnr}` (formatet verifiseres; 404 = ingen regnskap).
- Ved valg på lead med koblet selskap oppdateres også selskapets felter etter reglene for låste og tomme felt.
- `SelskapInnsikt.tsx` skrives om (props: `leadId` | `selskapId`), og brukes i Leads, Salgsmuligheter, CompanyProfile og PartnerProfile. Merkelapp-komponent `BrregMerke`.
- Konverteringen i CRM-storen kopierer brreg-feltene og forhåndsfyller selskapsfeltene.
- `meta-lead-worker` og `lead-intake` kaller `brreg-match` uten å vente på svar. Det gamle kallet til `company-enrich` fjernes.
- Ukentlig cron via managed HTTP-callback (mandag natt).
- `company-enrich` slettes og avpubliseres. `selskap_innsikt` beholdes, men brukes ikke (MeetingPrepPanel leser i stedet `brreg_data`).
- Memory-fil og regel i AGENTS.md.
