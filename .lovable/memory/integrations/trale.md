---
name: Trale meeting notes integration
description: Webhook receives Trale meeting data, creates activity, AI suggests next step, auto-task, LinkedIn enrichment, duplicate check
type: feature
---
Trale-integrasjonen mottar møtenotater via webhook (`trale-webhook` edge function).

**Webhook-flyt:**
1. Trale sender POST med `event: "meeting.completed"`, `meeting`, `attendees`, `summary`, `transcript`
2. Verifiserer valgfri X-Signature (HMAC-SHA256 med `TRALE_WEBHOOK_SECRET`)
3. **Duplikatsjekk:** Sjekker `ekstern_id` + `ekstern_provider=trale` — skipper hvis møtet allerede finnes
4. **LinkedIn-berikelse:** Oppdaterer kontakter med LinkedIn-URL fra Trale-deltakere (felt: `linkedinUrl`, `linkedin_url`, `linkedin`)
5. Matcher deltakere mot kontakter/salgsmuligheter via e-post
6. Oppretter aktivitet (type: Møte) med sammendrag og transkripsjon i `moetenotater`
7. AI (Gemini Flash) foreslår neste steg basert på sammendraget
8. Oppdaterer salgsmulighet: `sist_aktivitet`, `neste_steg`, appender notat
9. **Auto-oppgave:** Oppretter oppgave med AI neste steg, frist 2 virkedager, prioritet Høy
10. Sender varsel til ansvarlig bruker

**Matching-logikk:**
- Først matcher attendee-e-poster mot `salgsmuligheter.e_post`
- Fallback: matcher via `kontakter.e_post` → `salgsmuligheter.kontakt_id`
- Ekskluderer Vunnet/Tapt salgsmuligheter

**aktivitet_kilde:** `trale`, **ekstern_provider:** `trale`
**Innstillinger-side:** Webhook-URL vises under Innstillinger med oppsettsinstruksjoner
