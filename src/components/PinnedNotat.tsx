import { useEffect, useState } from "react";
import { Pin } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";

export const PINNED_NOTAT_PLACEHOLDER = "Legg til et notat som vises direkte på kortet...";

export interface PinnedNotatData {
  pinned_notat?: string;
  pinned_notat_av?: string;
  pinned_notat_dato?: string;
}

/** Navnet som lagres på notatet for innlogget bruker. */
export function useNotatForfatter(): string {
  const { user } = useAuth();
  const meta = (user?.user_metadata || {}) as Record<string, string>;
  return meta.full_name || meta.name || user?.email || "Ukjent";
}

function formaterTidspunkt(dato?: string) {
  if (!dato) return "";
  const d = new Date(dato);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nb-NO", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
}

/** Gul notatboks som vises direkte på kort i liste/kanban. Rendres kun når det finnes et notat. */
export function PinnedNotatBoks({
  notat, av, visAv = false, className = "",
}: { notat?: string; av?: string; visAv?: boolean; className?: string }) {
  if (!notat?.trim()) return null;
  return (
    <div className={`rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 ${className}`} title={notat}>
      {visAv && av && (
        <p className="text-[10px] font-medium text-warning-foreground/70 mb-0.5">Notat fra {av}</p>
      )}
      <p className="text-[11px] leading-snug text-foreground/85 line-clamp-2">{notat}</p>
    </div>
  );
}

/** Redigerbart pinned notat øverst i drawer. Lagres automatisk ved blur. */
export function PinnedNotatFelt({
  verdi, av, dato, onLagre, disabled = false,
}: {
  verdi?: string;
  av?: string;
  dato?: string;
  onLagre: (notat: string, av: string, dato: string) => void;
  disabled?: boolean;
}) {
  const forfatter = useNotatForfatter();
  const [tekst, setTekst] = useState(verdi || "");

  useEffect(() => { setTekst(verdi || ""); }, [verdi]);

  const lagre = () => {
    const ny = tekst.trim();
    if (ny === (verdi || "").trim()) return;
    onLagre(ny, ny ? forfatter : "", ny ? new Date().toISOString() : "");
  };

  const tid = formaterTidspunkt(dato);

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Pin className="h-3.5 w-3.5 text-warning" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pinned notat</span>
      </div>
      <Textarea
        rows={3}
        className="text-sm bg-background"
        placeholder={PINNED_NOTAT_PLACEHOLDER}
        value={tekst}
        readOnly={disabled}
        onChange={e => setTekst(e.target.value)}
        onBlur={lagre}
      />
      {av && tid && (
        <p className="mt-1.5 text-[10px] text-muted-foreground">Sist oppdatert av {av} · {tid}</p>
      )}
    </div>
  );
}
