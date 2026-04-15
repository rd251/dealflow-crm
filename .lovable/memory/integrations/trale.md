---
name: Trale meeting notes integration
description: Webhook receives Trale meeting data, creates activity, AI suggests next step, notifies responsible user
type: feature
---
Trale-integrasjonen mottar møtenotater via webhook (`trale-webhook` edge function).

**Webhook-flyt:**
1. Trale sender POST med `event: "meeting.completed"`, `meeting`, `attendees`, `summary`, `transcript`
2. Verifiserer valgfri X-Signature (HMAC-SHA256 med `TRALE_WEBHOOK_SECRET`)
3. Matcher deltakere mot kontakter/salgsmuligheter via e-post
4. Oppretter aktivitet (type: Møte) med sammendrag og transkripsjon i `moetenotater`
5. AI (Gemini Flash) foreslår neste steg basert på sammendraget
6. Oppdaterer salgsmulighet: `sist_aktivitet`, `neste_steg`, appender notat
7. Sender varsel til ansvarlig bruker

**Matching-logikk:**
- Først matcher attendee-e-poster mot `salgsmuligheter.e_post`
- Fallback: matcher via `kontakter.e_post` → `salgsmuligheter.kontakt_id`
- Ekskluderer Vunnet/Tapt salgsmuligheter

**aktivitet_kilde:** `trale`, **ekstern_provider:** `trale`
**Innstillinger-side:** Webhook-URL vises under Innstillinger med oppsettsinstruksjoner
