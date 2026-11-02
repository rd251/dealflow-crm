import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProfiles } from "@/hooks/use-profiles";
import { typeColors, typeIcons, type AktivitetType } from "@/components/ActivityLog";
import EpostTraadDialog, { type EpostForVisning } from "@/components/EpostTraadDialog";
import { epostKontaktTekst, epostTraadId, renAktivitetstekst } from "@/lib/aktivitet-visning";
import { cn } from "@/lib/utils";

/** Hvor mange rader som vises før «Vis alle». */
const SYNLIGE_RADER = 12;

interface Rad {
  id: string;
  type: AktivitetType;
  tittel: string;
  beskrivelse: string;
  dato: string;
  user_id?: string | null;
  aktivitet_kilde?: string | null;
  fase: string;
}

interface Props {
  kontakt_id?: string;
  selskap_id?: string;
  e_post?: string;
  /** Begrens til et utsnitt (f.eks. på en salgsmulighet). */
  maks?: number;
  tittel?: string;
  /** Vises som lenke når tidslinjen er et utsnitt. */
  onSeAlt?: () => void;
  /** Ny henting når noe logges. */
  refreshKey?: number;
}

const tidspunkt = (iso: string) =>
  new Date(iso).toLocaleString("no-NO", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function PersonTimeline({ kontakt_id, selskap_id, e_post, maks, tittel = "Relasjonstidslinje", onSeAlt, refreshKey }: Props) {
  const { profiles } = useProfiles();
  const [rader, setRader] = useState<Rad[]>([]);
  const [laster, setLaster] = useState(true);
  const [utvidet, setUtvidet] = useState(false);
  const [visEpost, setVisEpost] = useState<EpostForVisning | null>(null);

  const hent = useCallback(async () => {
    if (!kontakt_id && !selskap_id && !e_post) { setRader([]); setLaster(false); return; }
    setLaster(true);
    try {
      // 1. Finn alle poster personen er eller har vært knyttet til – uansett fase.
      const leadQuery = e_post
        ? supabase.from("leads").select("id, firmanavn, status").eq("e_post", e_post)
        : null;
      const dealFilter: string[] = [];
      if (kontakt_id) dealFilter.push(`kontakt_id.eq.${kontakt_id}`);
      if (selskap_id) dealFilter.push(`selskap_id.eq.${selskap_id}`);
      const dealQuery = dealFilter.length
        ? supabase.from("salgsmuligheter").select("id, navn, status").or(dealFilter.join(","))
        : null;

      const [leadRes, dealRes] = await Promise.all([
        leadQuery ?? Promise.resolve({ data: [] as { id: string; firmanavn: string; status: string | null }[] }),
        dealQuery ?? Promise.resolve({ data: [] as { id: string; navn: string; status: string | null }[] }),
      ]);

      const leadStatus = new Map((leadRes.data || []).map(l => [l.id, l.status || "Lead"]));
      const dealStatus = new Map((dealRes.data || []).map(d => [d.id, d.status || "Salgsmulighet"]));

      // 2. Hent alle aktiviteter på tvers av disse postene.
      const filtre: string[] = [];
      if (kontakt_id) filtre.push(`kontakt_id.eq.${kontakt_id}`);
      if (selskap_id) filtre.push(`selskap_id.eq.${selskap_id}`);
      if (leadStatus.size) filtre.push(`lead_id.in.(${[...leadStatus.keys()].join(",")})`);
      if (dealStatus.size) filtre.push(`salgsmulighet_id.in.(${[...dealStatus.keys()].join(",")})`);
      if (!filtre.length) { setRader([]); return; }

      const { data } = await supabase
        .from("aktiviteter")
        .select("id, type, tittel, beskrivelse, dato, user_id, lead_id, salgsmulighet_id, selskap_id, partner_id, prosjekt_id, aktivitet_kilde")
        .or(filtre.join(","))
        .order("dato", { ascending: false })
        .limit(300);

      const mappet: Rad[] = (data || []).map(a => {
        let fase = "Kontakt";
        if (a.salgsmulighet_id) fase = `Salgsmulighet · ${dealStatus.get(a.salgsmulighet_id) || "Åpen"}`;
        else if (a.lead_id) fase = `Lead · ${leadStatus.get(a.lead_id) || "Ny"}`;
        else if (a.prosjekt_id) fase = "Prosjekt";
        else if (a.partner_id) fase = "Partner";
        else if (a.selskap_id) fase = "Kunde";
        return {
          id: a.id,
          type: a.type as AktivitetType,
          tittel: a.tittel || a.type,
          beskrivelse: a.beskrivelse || "",
          dato: a.dato,
          user_id: a.user_id,
          aktivitet_kilde: a.aktivitet_kilde,
          fase,
        };
      });
      setRader(mappet);
    } catch (err) {
      console.error("Kunne ikke hente relasjonstidslinjen", err);
      setRader([]);
    } finally {
      setLaster(false);
    }
  }, [kontakt_id, selskap_id, e_post]);

  useEffect(() => { hent(); }, [hent, refreshKey]);

  const navnPaa = useMemo(() => {
    const kart = new Map(profiles.map(p => [p.user_id, p.display_name]));
    return (id?: string | null) => (id ? kart.get(id) || "Ukjent" : "System");
  }, [profiles]);

  const grense = maks ?? (utvidet ? rader.length : SYNLIGE_RADER);
  const synlige = rader.slice(0, grense);

  return (
    <>
    <section className="rounded-lg border bg-card shadow-card">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">{tittel}</h3>
          {!laster && <span className="text-xs text-muted-foreground">{rader.length}</span>}
        </div>
        {onSeAlt && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onSeAlt}>Se hele relasjonen</Button>
        )}
      </header>

      {laster ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />Henter tidslinjen…
        </div>
      ) : synlige.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Ingen aktiviteter registrert ennå.</p>
      ) : (
        <ol className="divide-y">
          {synlige.map(rad => {
            const Icon = typeIcons[rad.type] || typeIcons["Notat"];
            const tråd = epostTraadId(rad.beskrivelse);
            const kropp = renAktivitetstekst(rad.beskrivelse);
            const kontakt = epostKontaktTekst(rad.beskrivelse, rad.aktivitet_kilde === "gmail_sendt");
            return (
              <li key={rad.id}
                className={cn("flex gap-3 px-4 py-3", tråd && "cursor-pointer rounded-lg hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
                onClick={tråd ? () => setVisEpost(rad) : undefined}
                onKeyDown={tråd ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVisEpost(rad); } } : undefined}
                {...(tråd ? { role: "button", tabIndex: 0 } : {})}>
                <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md", typeColors[rad.type] || typeColors["Notat"])}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{rad.tittel}</p>
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">{rad.fase}</Badge>
                  </div>
                  {kropp && kropp !== rad.tittel && (
                    <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{kropp}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    {kontakt && <span>{kontakt} · </span>}{tidspunkt(rad.dato)} · {navnPaa(rad.user_id)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!maks && !utvidet && rader.length > SYNLIGE_RADER && (
        <div className="border-t p-2">
          <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setUtvidet(true)}>
            Vis alle {rader.length}
          </Button>
        </div>
      )}
    </section>
    <EpostTraadDialog epost={visEpost} onOpenChange={o => !o && setVisEpost(null)} />
    </>
  );
}
