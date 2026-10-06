# Én samlet salgsflyt

## Resultat
- Erstatt de synlige sidene **Leads** og **Salgsmuligheter** med én side: **Salg**.
- Vis hele reisen i én horisontal kanban: **Nye**, **Kontaktet**, **Møte**, **Behov avklart**, **Tilbud sendt** og **Avsluttet**.
- Behold alle eksisterende leads, salgsmuligheter, tilbud, aktiviteter og historikk. Ingen data slås sammen eller slettes.

## Ny Salg-side
- Bruk samme lyse bento-stil, gule detaljer, store nøkkeltall og typografi som oversiktssiden.
- Toppområdet viser bare tall som hjelper i arbeidet: aktive løp, trenger oppfølging, møter, tilbud ute og pipelineverdi.
- Legg søk, **Mine/Teamet**, ansvarlig og «trenger oppfølging» i en kompakt filterrad.
- Gjør kortene enkle å skanne: bedrift, kontaktperson, siste aktivitet, neste steg, eier og MRR når det finnes.
- Klikk på et kort åpner det eksisterende lead- eller salgsinnholdet i et sentrert vindu, slik at all redigering, logging, tilbud og historikk fortsatt er tilgjengelig.
- Legg inn tabellvisning som sekundær visning for søk og større datamengder.

## Flyt og automatikk
- Nye leads starter i **Nye**.
- Første registrerte samtale eller e-post flytter dem til **Kontaktet**.
- Booket møte konverterer leadet trygt til salgsmulighet og plasserer det i **Møte**.
- Eksisterende behov-, løsning- og demo-statuser samles visuelt i **Behov avklart**.
- Sendt tilbud eller kontrakt vises i **Tilbud sendt**.
- **Avsluttet** samler vunnet, tapt og ikke aktuelt, med tydelig status og egne filtre.
- Manuell flytting beholdes som sikkerhetsventil. Vunnet/tapt bruker fortsatt eksisterende bekreftelser og automatiseringer.

## Navigasjon og kompatibilitet
- Vis bare **Salg** i hovedmenyen; fjern de to konkurrerende menypunktene.
- Behold dagens adresser til leads og salgsmuligheter for gamle e-postlenker, varsler og dypkoblinger, men før vanlige besøk inn i den samlede arbeidsflaten.
- Behold ringemodus som egen fokusflyt, tilgjengelig fra Salg-siden.

## Teknisk
- Bygg videre på den eksisterende `Salg`-siden og dagens CRM-lager; ikke dupliser data eller lag en ny datamodell.
- Samle mappingen mellom lagrede lead-/salgstatuser og de seks synlige stegene i navngitte konstanter.
- Bevar tilbuds-, kontrakts-, møte-, oppgave-, partner- og vinnerflytene uendret.
- Verifiser kortflytting, automatisk stegvalg, sentrert detaljvindu, gamle dypkoblinger og mobil/desktop med reelle innloggede data.
