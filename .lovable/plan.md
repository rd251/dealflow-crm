

## Plan: Gmail AI-funksjoner – Trådoppsummering, viktig info og e-postutkast

### Oversikt
Legge til tre AI-drevne Gmail-funksjoner i CRM-et:
1. **Oppsummer tråd** – AI analyserer alle e-poster i en tråd og gir en kort oppsummering
2. **Finn viktig info** – Trekker ut nøkkelinformasjon (datoer, beløp, avtaler, kontaktinfo) fra e-posttråder
3. **Lag utkast** – Genererer et profesjonelt e-postsvar basert på trådkonteksten

### Teknisk tilnærming

#### 1. Ny Edge Function: `gmail-thread-ai`
- Mottar `threadId` og `action` (summarize | extract | draft)
- Henter alle meldinger i tråden via Gmail Threads API (`/threads/{id}?format=full`)
- Bruker brukerens eksisterende Google OAuth-tokens fra `google_calendar_connections`
- Sender trådinnhold til Lovable AI Gateway (Gemini) med action-spesifikk prompt
- Returnerer strukturert resultat

#### 2. Oppdatert e-postvisning (`ActivityLog.tsx`)
Legge til tre knapper i e-post-dialogen (ved siden av "Svar"-knappen):
- **Oppsummer tråd** – Viser AI-oppsummering i dialogen
- **Viktig info** – Viser uttrukket nøkkelinformasjon
- **Skriv utkast** – Åpner `SendEmailDialog` med AI-generert svar forhåndsutfylt

#### 3. Kontaktstrøm-integrasjon (`Kontaktstrom.tsx`)
Legge til en "AI-oppsummering"-knapp på person-detaljpanelet som oppsummerer all e-postkommunikasjon med kontakten.

### Filer som endres/opprettes

| Fil | Endring |
|-----|---------|
| `supabase/functions/gmail-thread-ai/index.ts` | **Ny** – Edge function for trådanalyse |
| `src/components/ActivityLog.tsx` | Legge til AI-knapper i e-postvisning |
| `src/components/SendEmailDialog.tsx` | Støtte for forhåndsutfylt AI-utkast |

### Sikkerhet
- Verifiserer bruker-JWT i edge function
- Bruker kun brukerens egne Gmail-tokens
- Ingen ny database-endring nødvendig

