import type { ReactNode } from "react";
import { useKort, type KundeRef } from "@/hooks/use-kort";
import { cn } from "@/lib/utils";

const stil = "min-w-0 max-w-full truncate rounded-sm text-left underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Klikkbart kontakt-/lead-navn som åpner det globale kundekortet. */
export function KundeNavn({ r, children, className }: { r: KundeRef | null; children: ReactNode; className?: string }) {
  const { openKunde } = useKort();
  if (!r?.id) return <span className={className}>{children}</span>;
  return (
    <button type="button" className={cn(stil, className)} onClick={e => { e.stopPropagation(); e.preventDefault(); openKunde(r); }} onKeyDown={e => e.stopPropagation()}>
      {children}
    </button>
  );
}

/** Klikkbart firmanavn som åpner selskapskortet. */
export function SelskapNavn({ id, children, className }: { id?: string | null; children: ReactNode; className?: string }) {
  const { openSelskap } = useKort();
  if (!id) return <span className={className}>{children}</span>;
  return (
    <button type="button" className={cn(stil, className)} onClick={e => { e.stopPropagation(); e.preventDefault(); openSelskap(id); }} onKeyDown={e => e.stopPropagation()}>
      {children}
    </button>
  );
}
