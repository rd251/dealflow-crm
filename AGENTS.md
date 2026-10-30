# Architecture rules

- Share Robin's email identity and email-safe signature renderers under functions/_shared, while personal Gmail signatures remain scoped to the verified sender; this keeps automated email contact details consistent without impersonating coworkers.

- Apply CRM visual themes through global semantic HSL tokens, shared controls and PageShell; this keeps all existing workflows consistent without changing business logic.
- Keep overview metrics derived from the existing CRM store and preserve their definitions when restyling; previews must never become a source of invented business data.
- Load packaged body fonts in the application entry point; this avoids runtime font dependencies and keeps stylesheet imports local.
- Present leads and sales opportunities as separate route-backed tabs using shared SalesTabs, with Leads as the table-first entry point and existing conversion/detail workflows retained; this keeps navigation simple without migrating business data.
- Persist newsletter-specific visual themes in the existing content JSON and apply them in the shared email renderer; this preserves editing and sending consistency without restyling older drafts or the CRM.
- Keep document-led newsletter layouts and sender overrides scoped to their saved theme, using editable blocks for grids, captions and paired calls to action; this preserves legacy newsletters and keeps preview and delivery aligned.
- Send automatic first-contact emails to new leads from a single queue worker woken by an insert trigger and unscheduled when drained; this avoids permanent polling and prevents duplicate sends.
- Send the daily morning email report (`morgen-epost-rapport`, 06:00 UTC cron, rd@snakk.ai) with counts derived from leads.velkomst_sendt_at, aktiviteter (gmail_sendt), venter_pa_svar and nyhetsbrev; internal driftsvarsel without unsubscribe.

- Sync tasks to the assignee's (fallback: creator's) Google Calendar as timed events via a DB trigger on deadline/date changes and oppgave-kalender; PATCH stored event IDs instead of duplicating entries, and tag events so calendar sync never re-imports them.
- Forward saved activity outcomes through ActivityLog and apply them to the lead store before persistence; this prevents stale lead status and follow-up dates overwriting the saved outcome.
