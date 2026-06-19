---
name: Forward lead to partner
description: Admin-only flow that sends a lead to an external partner via email and tracks the assignment on the lead row
type: feature
---

Admin-only on the Leads page. Button "Videresend" (Send icon) appears in mobile cards, desktop table, and the lead detail panel for non-converted leads.

Flow:
1. `openForwardDialog(lead)` auto-detects if the lead has tried the self-builder by querying `onboarding_svar` on `kontakt_epost` (fallback: `firmanavn`). Sets `forwardHarByggeagent` and a short summary in `forwardOnboarding`.
2. Admin selects an active partner (must have `e_post`) and adds an optional message.
3. On submit the client invokes `send-transactional-email` with template `lead-forwarded-to-partner` and these fields:
   - contact info (navn, e-post, telefon, rolle)
   - general lead info (firmanavn, kilde, use_case, notater)
   - `har_byggeagent` flag + optional onboarding summary
   - sender name (`user.email`) and intern_melding
4. Lead row is updated with `videresendt_til_partner_id` + `videresendt_dato` (columns added in migration).
5. An `aktiviteter` row is logged (type=E-post, kilde=manuell, partner_id+lead_id) for the audit trail.

Idempotency key: `lead-forward-{leadId}-{partnerId}-{today}`.

Detail panel shows a "Videresendt til X" info block when the lead has been forwarded. The desktop table and mobile card show a small "Videresendt {dato}" indicator under the actions.

Template: `supabase/functions/_shared/transactional-email-templates/lead-forwarded-to-partner.tsx` (registered in `registry.ts`).
