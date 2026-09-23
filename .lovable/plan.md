# Dubletter — forslag om å slå sammen personer og selskaper

En ny side «Dubletter» i menyen, bygget som i Folk: to faner (Personer / Selskaper), søk, og ett kort per funnet dublett-par med knappene «Ignorer» og «Slå sammen».

## Slik ser siden ut

- Faner øverst: **Personer** og **Selskaper**, med antall funn på hver.
- Søkefelt for å filtrere forslagene.
- Tekst: «Vi fant N mulige dubletter.»
- Hvert forslag vises som en rad med tre felt:
  - de to postene som ligner på hverandre, med navn, selskap/bransje, e-post, telefon og hvor mye som ligger på hver (aktiviteter, oppgaver, salgsmuligheter)
  - et resultatfelt til høyre som viser hva den sammenslåtte posten blir, med «Ignorer» og «Slå sammen»
- Over hvert forslag står grunnen: «Samme e-post», «Samme navn», «Likt navn», «Samme org.nr.», «Samme nettadresse».

## Hvordan dubletter finnes

Personer (kontakter):
- samme e-postadresse
- samme navn
- svært likt navn (skrivefeil, ekstra mellomrom, ulik store/små bokstaver)
- samme telefonnummer

Selskaper:
- samme org.nr.
- samme nettadresse (domene)
- samme eller svært likt firmanavn (uten AS/ASA/AB-endelser og store/små bokstaver)

Grensene settes som navngitte konstanter i én fil, så de er lette å justere.

## Hva skjer ved «Slå sammen»

Den eldste posten beholdes (samme regel som CRM-et bruker i dag). Før sammenslåing vises en bekreftelsesdialog som lister hva som flyttes.

- Tomme felt på posten som beholdes fylles fra den andre (e-post, telefon, rolle, LinkedIn, org.nr., adresse osv.).
- Notater slås sammen, ikke overskrives.
- Alt som peker på den andre posten flyttes over: aktiviteter, oppgaver, salgsmuligheter, prosjekter, e-postkontakter, ringelister, venter-på-svar, dokumenter.
- Den andre posten legges i Slettede elementer (30 dagers angrefrist), ikke slettet for godt.
- Handlingen føres i endringsloggen.

«Ignorer» skjuler paret permanent, slik at det ikke dukker opp igjen.

## Teknisk

- Ny tabell `dublett_ignorert` (type, id_a, id_b, ignorert_av, tidspunkt) med RLS for interne brukere, pluss GRANT.
- `src/lib/duplicates.ts`: terskler som konstanter (`NAVN_LIKHET_TERSKEL`), normalisering av navn/telefon/domene, og funksjoner `finnPersonDubletter()` / `finnSelskapDubletter()` som kjører på data som allerede ligger i `use-crm-store`.
- Ny edge-funksjon `merge-duplicates` (JWT-verifisert) som utfører selve sammenslåingen i databasen: oppdaterer alle fremmednøkler, fyller tomme felt, arkiverer taperen i `deleted_items` og skriver til `crm_changelog`. Klienten kaller den og oppdaterer lokal state etterpå.
- Ny side `src/pages/Dubletter.tsx` + rute `/dubletter` i `App.tsx`, menypunkt under «Mer» i `AppSidebar.tsx`.
- Norsk UI, `PageShell`, eksisterende kort- og badge-stil.
