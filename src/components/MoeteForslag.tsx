import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { vurderMoete, eksterneDeltakere } from "@/lib/moete-kobling";
import { kortDato } from "@/lib/lead-kort";

interface Moete { id: string; tittel: string | null; dato: string; eksterne_deltakere: string[]; lead_id: string | null; salgsmulighet_id: string | null }

/** Forslag i Innboks: møter med eksterne deltakere som ikke matcher noe i CRM-et. */
export default function MoeteForslag() {
  const { leads, salgsmuligheter } = useCrmStore();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const [moeter, setMoeter] = useState<Moete[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const fra = new Date(Date.now() - 60 * 86400e3).toISOString();
    supabase.from("aktiviteter")
      .select("id, tittel, dato, eksterne_deltakere, lead_id, salgsmulighet_id")
      .eq("type", "Møte").gte("dato", fra)
      .is("salgsmulighet_id", null).is("lead_id", null).is("selskap_id", null).is("kontakt_id", null)
      .not("eksterne_deltakere", "eq", "{}")
      .order("dato", { ascending: false }).limit(20)
      .then(({ data }) => setMoeter((data as Moete[]) || []));
  }, []);

  const forslag = moeter.filter(m => vurderMoete({ type: "Møte", ...m }, leads, salgsmuligheter).type === "forslag");
  if (!canEdit || forslag.length === 0) return null;

  const gjorTilSalg = async (m: Moete) => {
    setBusy(m.id);
    const { data, error } = await supabase.rpc("moete_forslag_til_salgsmulighet", { _moete_id: m.id });
    setBusy(null);
    if (error) { toast.error(`Kunne ikke opprette: ${error.message}`); return; }
    setMoeter(prev => prev.filter(x => x.id !== m.id));
    toast.success("Salgsmulighet opprettet (Møte booket)", { action: { label: "Åpne", onClick: () => navigate(`/salgsmuligheter?open=${data}`) } });
  };

  return (
    <section aria-label="Møter uten kobling" className="mb-6 space-y-2">
      {forslag.map(m => (
        <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <CalendarPlus className="h-4 w-4 shrink-0 text-warning" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Møte uten kobling: gjør til salgsmulighet?</p>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {m.tittel || "Møte"} · {kortDato(m.dato)} · {eksterneDeltakere({ type: "Møte", ...m }).join(", ")}
            </p>
          </div>
          <Button size="sm" disabled={busy === m.id} onClick={() => gjorTilSalg(m)}>
            {busy === m.id ? "Oppretter…" : "Gjør til salgsmulighet"}
          </Button>
        </div>
      ))}
    </section>
  );
}
