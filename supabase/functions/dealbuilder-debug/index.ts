const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const key = Deno.env.get("DEALBUILDER_API_KEY")!;
  const res = await fetch("https://api.dealbuilder.io/v1/Documents?PageSize=1000", {
    headers: { "x-api-key": key },
  });
  const data = await res.json();
  const docs = data?.data?.items || data?.data || data?.items || data || [];
  const list = Array.isArray(docs) ? docs : [];
  const hit = q ? list.filter((d: any) => JSON.stringify(d).toLowerCase().includes(q)) : list.slice(0, 1);
  return new Response(JSON.stringify({ count: list.length, hit }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
