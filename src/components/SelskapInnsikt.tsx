import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, TrendingUp, Briefcase, Sparkles, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelskapInnsiktProps {
  domene?: string;
  firmanavn?: string;
  e_post?: string;
  onEnriched?: (data: InnsiktData) => void;
}

interface InnsiktData {
  bransje?: string | null;
  beskrivelse?: string | null;
  stoerrelse?: string | null;
  estimert_ansatte?: string | null;
  estimert_omsetning?: string | null;
  orgnr?: string | null;
}

function extractDomain(email?: string, domene?: string): string {
  if (domene) {
    let d = domene.trim().toLowerCase();
    if (d.startsWith("http")) {
      try { d = new URL(d).hostname; } catch { /* keep */ }
    }
    return d.replace(/^www\./, "");
  }
  if (email) {
    const parts = email.split("@");
    if (parts.length === 2) {
      const domain = parts[1].toLowerCase();
      const generic = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "live.com", "icloud.com"];
      if (!generic.includes(domain)) return domain;
    }
  }
  return "";
}

export default function SelskapInnsikt({ domene, firmanavn, e_post, onEnriched }: SelskapInnsiktProps) {
  const [data, setData] = useState<InnsiktData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);

  const cleanDomain = extractDomain(e_post, domene);

  const fetchInnsikt = async (forceRefresh = false) => {
    if (!cleanDomain && !firmanavn) return;
    setLoading(true);

    // Check cache first (client-side)
    if (!forceRefresh && cleanDomain) {
      const { data: cached } = await supabase
        .from("selskap_innsikt")
        .select("bransje, beskrivelse, stoerrelse, estimert_ansatte, estimert_omsetning, orgnr, updated_at")
        .eq("domene", cleanDomain)
        .single();

      if (cached) {
        const age = Date.now() - new Date(cached.updated_at).getTime();
        if (age < 7 * 24 * 60 * 60 * 1000) {
          setData(cached);
          onEnriched?.(cached);
          setLoading(false);
          setHasChecked(true);
          return;
        }
      }
    }

    // Call edge function
    try {
      const { data: result, error } = await supabase.functions.invoke("company-enrich", {
        body: { domene: cleanDomain, firmanavn },
      });

      if (!error && result?.success) {
        setData(result.data);
      }
    } catch (e) {
      console.error("Enrichment error:", e);
    } finally {
      setLoading(false);
      setHasChecked(true);
    }
  };

  useEffect(() => {
    setData(null);
    setHasChecked(false);
    // Auto-fetch on mount / when domain changes
    if (cleanDomain || firmanavn) {
      fetchInnsikt();
    }
  }, [cleanDomain, firmanavn]);

  if (!cleanDomain && !firmanavn) return null;

  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Henter selskapsinnsikt…
      </div>
    );
  }

  if (!data || (!data.bransje && !data.beskrivelse && !data.stoerrelse)) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground text-center">
        Ingen selskapsinnsikt funnet
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-gradient-to-br from-muted/30 to-muted/10 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
          <Sparkles className="w-3 h-3 text-primary" />
          Selskap innsikt
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => fetchInnsikt(true)}
          title="Oppdater innsikt"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>

      {data.beskrivelse && (
        <p className="text-xs text-foreground/80 leading-relaxed">{data.beskrivelse}</p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {data.bransje && (
          <div className="flex items-center gap-1.5 text-xs rounded-md bg-background/60 px-2 py-1.5">
            <Briefcase className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="truncate">{data.bransje}</span>
          </div>
        )}
        {data.stoerrelse && (
          <div className="flex items-center gap-1.5 text-xs rounded-md bg-background/60 px-2 py-1.5">
            <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
            <span>{data.stoerrelse}</span>
          </div>
        )}
        {data.estimert_ansatte && (
          <div className="flex items-center gap-1.5 text-xs rounded-md bg-background/60 px-2 py-1.5">
            <Users className="w-3 h-3 text-muted-foreground shrink-0" />
            <span>{data.estimert_ansatte} ansatte</span>
          </div>
        )}
        {data.estimert_omsetning && data.estimert_omsetning !== "Ukjent" && (
          <div className="flex items-center gap-1.5 text-xs rounded-md bg-background/60 px-2 py-1.5">
            <TrendingUp className="w-3 h-3 text-muted-foreground shrink-0" />
            <span>{data.estimert_omsetning}</span>
          </div>
        )}
      </div>

      {data.orgnr && (
        <div className="text-[10px] text-muted-foreground">Org.nr: {data.orgnr}</div>
      )}
    </div>
  );
}
