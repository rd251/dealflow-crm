import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Date window: today + tomorrow (local-ish, UTC bounds)
    const now = new Date();
    const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endOfTomorrow = new Date(startOfToday.getTime() + 2 * 86400000);
    const todayStr = startOfToday.toISOString().split("T")[0];
    const tomorrowStr = new Date(startOfToday.getTime() + 86400000).toISOString().split("T")[0];

    // 1. Pipeline summary
    const { data: activeDeals } = await supabase
      .from("salgsmuligheter")
      .select("status")
      .not("status", "in", '("Vunnet","Tapt")');

    const stageMap = new Map<string, number>();
    for (const d of activeDeals || []) {
      if (!d.status) continue;
      stageMap.set(d.status, (stageMap.get(d.status) || 0) + 1);
    }
    const pipeline_summary = Array.from(stageMap.entries())
      .map(([stage, count]) => ({ stage, count }))
      .sort((a, b) => b.count - a.count);

    // 2. Upcoming: tasks (oppgaver) with frist today/tomorrow + meetings (aktiviteter) today/tomorrow
    const [{ data: tasks }, { data: activities }] = await Promise.all([
      supabase
        .from("oppgaver")
        .select("oppgave, frist, kontakt_id, selskap_id, salgsmulighet_id, lead_id, status")
        .in("frist", [todayStr, tomorrowStr])
        .neq("status", "Ferdig"),
      supabase
        .from("aktiviteter")
        .select("tittel, beskrivelse, type, dato, start_tid, kontakt_id, selskap_id, salgsmulighet_id, lead_id, partner_id")
        .gte("dato", startOfToday.toISOString())
        .lt("dato", endOfTomorrow.toISOString())
        .order("dato", { ascending: true }),
    ]);

    // Resolve names
    const kontaktIds = new Set<string>();
    const selskapIds = new Set<string>();
    const salgsIds = new Set<string>();
    const leadIds = new Set<string>();
    const partnerIds = new Set<string>();
    for (const t of tasks || []) {
      if (t.kontakt_id) kontaktIds.add(t.kontakt_id);
      if (t.selskap_id) selskapIds.add(t.selskap_id);
      if (t.salgsmulighet_id) salgsIds.add(t.salgsmulighet_id);
      if (t.lead_id) leadIds.add(t.lead_id);
    }
    for (const a of activities || []) {
      if (a.kontakt_id) kontaktIds.add(a.kontakt_id);
      if (a.selskap_id) selskapIds.add(a.selskap_id);
      if (a.salgsmulighet_id) salgsIds.add(a.salgsmulighet_id);
      if (a.lead_id) leadIds.add(a.lead_id);
      if (a.partner_id) partnerIds.add(a.partner_id);
    }

    const [k, s, sm, l, p] = await Promise.all([
      kontaktIds.size ? supabase.from("kontakter").select("id, navn, selskap_id").in("id", [...kontaktIds]) : Promise.resolve({ data: [] as any[] }),
      selskapIds.size ? supabase.from("selskaper").select("id, firmanavn").in("id", [...selskapIds]) : Promise.resolve({ data: [] as any[] }),
      salgsIds.size ? supabase.from("salgsmuligheter").select("id, navn, selskap_id, kontaktperson").in("id", [...salgsIds]) : Promise.resolve({ data: [] as any[] }),
      leadIds.size ? supabase.from("leads").select("id, firmanavn, kontaktperson").in("id", [...leadIds]) : Promise.resolve({ data: [] as any[] }),
      partnerIds.size ? supabase.from("partnere").select("id, partnernavn, kontaktperson").in("id", [...partnerIds]) : Promise.resolve({ data: [] as any[] }),
    ]);

    const kontakterMap = new Map((k.data || []).map((x: any) => [x.id, x]));
    const selskaperMap = new Map((s.data || []).map((x: any) => [x.id, x]));
    const salgsMap = new Map((sm.data || []).map((x: any) => [x.id, x]));
    const leadsMap = new Map((l.data || []).map((x: any) => [x.id, x]));
    const partnereMap = new Map((p.data || []).map((x: any) => [x.id, x]));

    const resolve = (row: any) => {
      let contact = "";
      let company = "";
      if (row.kontakt_id && kontakterMap.has(row.kontakt_id)) {
        const kx = kontakterMap.get(row.kontakt_id) as any;
        contact = kx.navn || "";
        if (!row.selskap_id && kx.selskap_id) row.selskap_id = kx.selskap_id;
      }
      if (row.selskap_id && selskaperMap.has(row.selskap_id)) {
        company = (selskaperMap.get(row.selskap_id) as any).firmanavn || "";
      }
      if (!company && row.salgsmulighet_id && salgsMap.has(row.salgsmulighet_id)) {
        const sx = salgsMap.get(row.salgsmulighet_id) as any;
        if (!contact) contact = sx.kontaktperson || "";
        if (sx.selskap_id && selskaperMap.has(sx.selskap_id)) {
          company = (selskaperMap.get(sx.selskap_id) as any).firmanavn || "";
        } else {
          company = sx.navn || "";
        }
      }
      if (!company && row.lead_id && leadsMap.has(row.lead_id)) {
        const lx = leadsMap.get(row.lead_id) as any;
        company = lx.firmanavn || "";
        if (!contact) contact = lx.kontaktperson || "";
      }
      if (!company && row.partner_id && partnereMap.has(row.partner_id)) {
        const px = partnereMap.get(row.partner_id) as any;
        company = px.partnernavn || "";
        if (!contact) contact = px.kontaktperson || "";
      }
      return { contact, company };
    };

    const upcoming: Array<{ date: string; title: string; contact: string; company: string }> = [];

    for (const t of tasks || []) {
      const r = resolve(t);
      upcoming.push({
        date: t.frist,
        title: t.oppgave || "Oppgave",
        contact: r.contact,
        company: r.company,
      });
    }
    for (const a of activities || []) {
      const r = resolve(a);
      upcoming.push({
        date: a.start_tid || a.dato,
        title: a.tittel || a.beskrivelse || a.type || "Aktivitet",
        contact: r.contact,
        company: r.company,
      });
    }

    upcoming.sort((a, b) => a.date.localeCompare(b.date));

    return new Response(
      JSON.stringify({ pipeline_summary, upcoming }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
