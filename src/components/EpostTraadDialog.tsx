import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { epostAdresser, epostKontaktTekst, renAktivitetstekst } from "@/lib/aktivitet-visning";

export interface EpostForVisning {
  beskrivelse: string;
  tittel?: string | null;
  dato: string;
  aktivitet_kilde?: string | null;
}

/**
 *READ-only e-posttråd for aktiviteter i historikk-listene.
 * Brukar same rensing som resten av aktivitetsvisninga.
 */
export default function EpostTraadDialog({ epost, onOpenChange }: { epost: EpostForVisning | null; onOpenChange: (open: boolean) => void }) {
  const isSent = epost?.aktivitet_kilde === "gmail_sendt";
  const adresser = epost ? epostAdresser(epost.beskrivelse) : [];
  const kontakt = epost ? epostKontaktTekst(epost.beskrivelse, isSent) : null;
  const kropp = epost ? renAktivitetstekst(epost.beskrivelse) : "";
  const dato = epost ? format(new Date(epost.dato), "d. MMMM yyyy HH:mm", { locale: nb }) : "";

  return (
    <Dialog open={!!epost} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-base leading-snug break-words">{epost?.tittel || "E-post"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              {isSent ? "Sendt" : "Mottatt"}
            </span>
            {kontakt && <span className="text-muted-foreground">{kontakt}</span>}
            {adresser.length > 1 && <span className="text-muted-foreground">· {adresser.slice(1).join(", ")}</span>}
            {dato && <span className="tabular-nums text-muted-foreground">· {dato}</span>}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh]">
          <p className="whitespace-pre-line text-sm leading-relaxed">{kropp || "Ingen tekst i denne e-posten."}</p>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
