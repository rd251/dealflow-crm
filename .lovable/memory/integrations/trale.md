---
name: Trale meeting notes integration
description: Webhook receives Trale meeting data, creates activity, AI suggests next step, auto-tasks from action items, LinkedIn enrichment, meetingUrl matching
type: feature
---
Trale-integrasjonen mottar møtenotater via webhook (`trale-webhook` edge function).

**Bekreftet payload-struktur (april 2026):**
```json
{
  "event": "meeting.completed",
  "meeting": { "id": "...", "meetingUrl": "https://meet.google.com/...", "createdAt": "ISO", "name": null, "duration": null },
  "attendees": [{ "email": "...", "name": null, "linkedinUrl": "..." }],
  "summary": "Markdown med ### overskrifter, action items under ### Tiltak",
  "transcript": [{ "speaker": "Navn", "text": "...", "timestamp": "HH:MM:SS" }]
}
```
Merk: `meeting.name` og `attendees[].name` er ofte `null`. Tittel hentes fra summary-kontekst.

**Webhook-flyt:**
1. Trale sender POST med `event: "meeting.completed"`
2. Verifiserer valgfri X-Signature (HMAC-SHA256 med `TRALE_WEBHOOK_SECRET`)
3. **Duplikatsjekk:** `ekstern_id` + `ekstern_provider=trale`
4. **LinkedIn-berikelse:** Oppdaterer kontakter med LinkedIn-URL fra Trale-deltakere
5. **Matching-logikk (prioritert rekkefølge):**
   a. Attendee-e-poster mot `salgsmuligheter.e_post`
   b. Attendee-e-poster mot `kontakter.e_post` → `salgsmuligheter.kontakt_id`
   c. **meetingUrl** mot Google Calendar-hendelser (`aktiviteter.beskrivelse ILIKE %url%`)
6. Oppretter aktivitet (type: Møte) med sammendrag + full transkripsjon i `moetenotater`
7. AI (Gemini Flash) foreslår neste steg basert på sammendraget
8. Oppdaterer salgsmulighet: `sist_aktivitet`, `neste_steg`, appender notat
9. **Auto-oppgaver:** Parser action items fra summary markdown (### Tiltak/Action), maks 5 oppgaver
10. Fallback: Én oppgave fra AI neste steg hvis ingen action items
11. Sender varsel til ansvarlig bruker

**aktivitet_kilde:** `trale`, **ekstern_provider:** `trale`
**Innstillinger-side:** Webhook-URL vises under Innstillinger
