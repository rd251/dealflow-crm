import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import CompanyLogo from "@/components/CompanyLogo";
import { dagerSiden, prosjektStatusFarge } from "@/lib/kundeforhold";
import { fremdrift } from "./ProsjektFremdrift";
import type { Prosjekt } from "@/data/crm-data";

interface Props {
  prosjekt: Prosjekt;
  firmanavn: string;
  domene?: string;
  onClick: () => void;
}

export default function ProsjektKort({ prosjekt: p, firmanavn, domene, onClick }: Props) {
  const f = fremdrift(p.onboarding_type, p.onboarding_steg);
  const opprettet = p.created_at || p.startdato;
  const dager = dagerSiden(opprettet);
  const forsinket = !!p.forventet_go_live && p.status !== "Live" && new Date(p.forventet_go_live) < new Date();
  const varsel = p.status === "Blokkert" || forsinket;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-card border rounded-xl p-4 hover:shadow-md transition-shadow space-y-3 ${varsel ? "border-destructive/60" : ""}`}
    >
      <div className="flex items-start gap-3">
        <CompanyLogo domain={domene} firmanavn={firmanavn} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{firmanavn}</p>
          <p className="text-xs text-muted-foreground truncate">{p.prosjektnavn}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge className={`text-[10px] ${prosjektStatusFarge[p.status] || "bg-muted text-muted-foreground"}`}>{p.status}</Badge>
        <Badge variant="outline" className="text-[10px]">{p.onboarding_type}</Badge>
        {forsinket && <Badge className="bg-destructive/10 text-destructive text-[10px]">Go-live passert</Badge>}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
          <span>Fremdrift</span>
          <span>{f.ferdig}/{f.totalt}</span>
        </div>
        <Progress value={f.prosent} className="h-1.5" />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
        <span>Ansvarlig: {p.ansvarlig || "–"}</span>
        <span>Opprettet: {opprettet ? new Date(opprettet).toLocaleDateString("no-NO") : "–"}</span>
        <span>Forventet go-live: {p.forventet_go_live || "–"}</span>
        <span>{dager !== null ? `${dager} dager siden opprettet` : ""}</span>
      </div>
    </button>
  );
}
