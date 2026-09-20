import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Rocket } from "lucide-react";
import ActivityLog from "@/components/ActivityLog";
import Timeregistrering from "@/components/kunde/Timeregistrering";
import ProsjektFremdrift from "./ProsjektFremdrift";
import { PROSJEKT_STATUSER, harTimeregistrering, prosjektStatusFarge, type OnboardingType } from "@/lib/kundeforhold";
import type { Integrasjon, Prosjekt, ProsjektStatus } from "@/data/crm-data";

const INTEGRASJONER: Integrasjon[] = ["Ingen", "GastroPlanner", "HubSpot", "Lime", "Salesforce", "API", "Annet"];

interface Props {
  prosjekt: Prosjekt | null;
  firmanavn: string;
  onClose: () => void;
  onEndre: (patch: Partial<Prosjekt>) => void;
  onSettLive: () => void;
}

export default function ProsjektDrawer({ prosjekt: p, firmanavn, onClose, onEndre, onSettLive }: Props) {
  return (
    <Sheet open={!!p} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        {p && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle className="text-lg">{firmanavn}</SheetTitle>
              <SheetDescription>{p.prosjektnavn}</SheetDescription>
            </SheetHeader>

            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <Badge className={`text-[10px] ${prosjektStatusFarge[p.status] || "bg-muted text-muted-foreground"}`}>{p.status}</Badge>
              <Badge variant="outline" className="text-[10px]">{p.onboarding_type}</Badge>
              <span className="text-xs text-muted-foreground">Ansvarlig: {p.ansvarlig || "–"}</span>
              <span className="text-xs text-muted-foreground tabular-nums">Go-live: {p.forventet_go_live || "–"}</span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <select
                className="border rounded-md px-2 py-1.5 text-sm bg-background h-9 flex-1"
                value={p.status}
                onChange={e => {
                  const ny = e.target.value as ProsjektStatus;
                  if (ny === "Live") onSettLive();
                  else onEndre({ status: ny });
                }}
              >
                {PROSJEKT_STATUSER.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {p.status !== "Live" && (
                <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground h-9" onClick={onSettLive}>
                  <Rocket className="w-3.5 h-3.5 mr-1.5" />Sett live
                </Button>
              )}
            </div>

            <div className="mt-6 space-y-6">
              <section>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Fremdrift</h3>
                <ProsjektFremdrift
                  onboardingType={p.onboarding_type}
                  fullforteSteg={p.onboarding_steg}
                  onEndreType={(t: OnboardingType) => onEndre({ onboarding_type: t, onboarding_steg: [] })}
                  onEndreSteg={steg => onEndre({ onboarding_steg: steg })}
                />
              </section>

              {harTimeregistrering(p.onboarding_type) && (
                <section className="border-t pt-6">
                  <Timeregistrering prosjektId={p.id} selskapId={p.selskap_id} firmanavn={firmanavn} timepris={p.timepris} />
                </section>
              )}

              <section className="border-t pt-6">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notater</h3>
                <Textarea rows={4} className="text-sm" placeholder="Notater for teamet"
                  value={p.notater_ansvarlig || p.notater}
                  onChange={e => onEndre({ notater_ansvarlig: e.target.value })} />
              </section>

              <section className="border-t pt-6 space-y-2">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Integrasjon</h3>
                <select className="w-full border rounded-md px-2 py-1.5 text-sm bg-background h-9"
                  value={p.integrasjon} onChange={e => onEndre({ integrasjon: e.target.value as Integrasjon })}>
                  {INTEGRASJONER.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
                <div>
                  <span className="text-xs text-muted-foreground">Tekniske notater</span>
                  <Textarea rows={3} className="text-sm mt-0.5" value={p.notater} onChange={e => onEndre({ notater: e.target.value })} />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Forventet go-live</span>
                  <Input type="date" className="h-9 text-sm mt-0.5" value={p.forventet_go_live} onChange={e => onEndre({ forventet_go_live: e.target.value })} />
                </div>
              </section>

              <section className="border-t pt-6">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Aktivitetslogg</h3>
                <ActivityLog prosjekt_id={p.id} />
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
