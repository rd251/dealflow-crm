# Architecture rules

- Apply CRM visual themes through global semantic HSL tokens, shared controls and PageShell; this keeps all existing workflows consistent without changing business logic.
- Keep overview metrics derived from the existing CRM store and preserve their definitions when restyling; previews must never become a source of invented business data.
- Load packaged body fonts in the application entry point; this avoids runtime font dependencies and keeps stylesheet imports local.
- Present leads and sales opportunities through one UI-only sales pipeline while retaining their separate records and legacy detail routes; this preserves integrations and historical links.
- Persist newsletter-specific visual themes in the existing content JSON and apply them in the shared email renderer; this preserves editing and sending consistency without restyling older drafts or the CRM.
- Keep document-led newsletter layouts and sender overrides scoped to their saved theme, using editable blocks for grids, captions and paired calls to action; this preserves legacy newsletters and keeps preview and delivery aligned.
- Send automatic first-contact emails to new leads from a single queue worker woken by an insert trigger and unscheduled when drained; this avoids permanent polling and prevents duplicate sends.
- Send the daily morning email report (`morgen-epost-rapport`, 06:00 UTC cron, rd@snakk.ai) with counts derived from leads.velkomst_sendt_at, aktiviteter (gmail_sendt), venter_pa_svar and nyhetsbrev; internal driftsvarsel without unsubscribe.
