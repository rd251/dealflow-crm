import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchTool from "./tools/search";
import pipelineSummaryTool from "./tools/pipeline-summary";
import myTasksTool from "./tools/my-tasks";
import overdueFollowupsTool from "./tools/overdue-followups";
import getSalgsmulighetTool from "./tools/get-salgsmulighet";
import getSelskapTool from "./tools/get-selskap";
import createTaskTool from "./tools/create-task";
import createActivityTool from "./tools/create-activity";
import completeTaskTool from "./tools/complete-task";

// Direct Supabase issuer — never the .lovable.cloud proxy. Read from the
// build-time inlined VITE_SUPABASE_PROJECT_ID literal so this module stays
// import-safe (no runtime env reads at top level).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "snakk-crm-mcp",
  title: "Snakk CRM",
  version: "0.1.0",
  instructions:
    "Verktøy for Snakk CRM. Bruk `search` for å finne leads, salgsmuligheter, selskaper eller kontakter. " +
    "Bruk `pipeline_summary` for aktiv MRR og pipeline-status, `my_tasks` og `overdue_followups` for prioritert " +
    "arbeid, `get_salgsmulighet`/`get_selskap` for detaljer, og `create_task`/`create_activity`/`complete_task` " +
    "for å oppdatere CRM. Alle handlinger kjøres som den innloggede Snakk CRM-brukeren og respekterer RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    searchTool,
    pipelineSummaryTool,
    myTasksTool,
    overdueFollowupsTool,
    getSalgsmulighetTool,
    getSelskapTool,
    createTaskTool,
    createActivityTool,
    completeTaskTool,
  ],
});
