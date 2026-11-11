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

- Share task scheduling, title and ordering rules between CRM and Google event generation; preserve absent times as all-day transparent events, PATCH stored event IDs via the existing trigger, and retain sync tags to avoid re-imports.
- Use the shared OppgaveTid control in task forms and global customer cards, with immediate store updates for existing task times; this keeps time editing consistent without migrating task data.
- Forward saved activity outcomes through ActivityLog and apply them to the lead store before persistence; this prevents stale lead status and follow-up dates overwriting the saved outcome.
- Convert leads to sales opportunities from meetings in the database trigger on aktiviteter (moete_til_salgsmulighet_vakt/_kjor, external emails in eksterne_deltakere), mirrored by src/lib/moete-kobling.ts for UI suggestions and tests; this works for every meeting source and stays idempotent across re-syncs.
- Detach activities (salgsmulighet_id = null, keep selskap) before deleting a sales opportunity; this preserves email and meeting history.
- Keep Oversikt (/dashboard) as a daily «I dag» work list derived in src/lib/i-dag.ts from the CRM store and live tables, with portfolio metrics on /portefolje unchanged; follow-up replies are only created as Gmail drafts via gmail-utkast, never sent.
- Open customer and company cards app-wide through URL params (?kunde=<lead|kontakt|sm|oppgave>:ID, ?selskap=ID, fra=selskap for back) rendered once by GlobaleKort; link names with KortLenker; this keeps one card open at a time and makes cards linkable without new tables.
- Log every outcome through the shared LoggUtfall component (rules in src/lib/logg-utfall.ts), wrapped by LogActivityDialog for the global search-first «+ Logg»; one «Neste oppfølging» creates the follow-up task and closes the current one, so logging behaves the same everywhere.
- Treat leads as «Senere» while leads.senere_til is in the future (computed at display via erSenere, no cron); «Ikke nå» sets it plus a follow-up task on that date, so leads return to Følg opp nå automatically.
- Derive Oversikt «Gjort i dag» from manual aktiviteter (outcome inferred from shared LoggUtfall titles in src/lib/gjort-i-dag.ts) plus oppgaver set Ferdig since Oslo midnight; refresh via the crm:logget window event so no new tables or columns are needed.
- Derive Rapporter chart counts and their click-through lists from the same filters in src/lib/rapport-detaljer.ts; this keeps every list exactly matching its bar.
