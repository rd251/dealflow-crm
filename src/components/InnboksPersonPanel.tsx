import { useEffect, useState } from "react";
import { gmailLenke } from "@/lib/kundekort";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Building2, ChevronRight, Mail, Phone, Plus, ExternalLink, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import KobleSelskap from "@/components/KobleSelskap";
import ActivityLog from "@/components/ActivityLog";
import DealSuggestions from "@/components/DealSuggestions";
import InnboksSalgsmulighet from "@/components/InnboksSalgsmulighet";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { useKort } from "@/hooks/use-kort";
import { cn } from "@/lib/utils";
import { epostDomene, visningsnavn } from "@/lib/innboks-salg";
import type { Selskap } from "@/data/crm-data";

export interface PanelPerson {
  email: string; navn: string; firmanavn: string;
  type: string; status: string; ansvarlig: string; nesteSteg: string;
  sistKontaktetDato: string | null; totalSent: number; totalReceived: number;
  kontaktId: string | null; leadId: string | null; salgsmulighetId: string | null;
  selskapId: string | null; partnerId: string | null;
  suggestedSelskapId: string | null; suggestedSelskapNavn: string;
}

const tittel = "text-xs font-medium uppercase tracking-wide text-muted-foreground";
const vent = (ms: number) => new Promise(r => setTimeout(r, ms));
type Felt = "e_post" | "telefon" | "rolle";

/** Personpanelet i Innboks, i samme stil som det globale kundekortet. */
export default function InnboksPersonPanel({ person, onClose, onEndret, opprettLead }: { person: PanelPerson | null; onClose: () => void; onEndret: () => void; opprettLead?: { vis: boolean; laster: boolean; onClick: () => void } }) {
  const isMobile = useIsMobile();
  const { selskaper, kontakter, leads, updateKontakter, updateLeads, refresh } = useCrmStore();
  const kort = useKort();
  const openKunde: typeof kort.openKunde = (r) => { onClose(); kort.openKunde(r); };
  const openSelskap = (id: string) => { onClose(); kort.openSelskap(id); };
  const [visSkjema, setVisSkjema] = useState(false);
  const [redigerer, setRedigerer] = useState<Felt | null>(null);
  const [verdi, setVerdi] = useState("");
  const [kobler, setKobler] = useState(false);
  useEffect(() => { setVisSkjema(false); setRedigerer(null); }, [person?.email]);
  if (!person) return null;

  const kontakt = person.kontaktId ? kontakter.find(k => k.id === person.kontaktId) : undefined;
  const lead = person.leadId ? leads.find(l => l.id === person.leadId) : undefined;
  const navn = visningsnavn(person.navn && person.navn !== person.email ? person.navn : person.email.split("@")[0]);
  const selskap = person.selskapId ? selskaper.find(s => s.id === person.selskapId) : undefined;
  const forslag = !selskap && person.suggestedSelskapId ? selskaper.find(s => s.id === person.suggestedSelskapId) : undefined;
  const egenFirma = person.firmanavn && ![person.navn, navn, person.email].includes(person.firmanavn) && visningsnavn(person.firmanavn) !== navn ? person.firmanavn : "";
  const firmaTekst = selskap?.firmanavn || forslag?.firmanavn || egenFirma;
  const telefon = kontakt?.telefon || lead?.telefon || "";
  const rolle = kontakt?.rolle || lead?.rolle_i_firma || "";
  const tel = telefon.replace(/\s/g, "");
  const totalt = person.totalSent + person.totalReceived;

  /** Samme kobling som «Knytt til selskap»: sikre kontakt, sett selskap_id på kontakt og e-postkontakt. */
  const kobleTil = async (s: Selskap) => {
    setKobler(true);
    try {
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.from("selskaper").select("id").eq("id", s.id).maybeSingle();
        if (data) break;
        await vent(400);
      }
      let kId = person.kontaktId;
      if (!kId) {
        const { data } = await supabase.from("kontakter").select("id").eq("e_post", person.email).maybeSingle();
        kId = data?.id ?? null;
      }
      if (!kId) {
        const { data, error } = await supabase.from("kontakter").insert({ navn, e_post: person.email, selskap_id: s.id }).select("id").single();
        if (error) throw error;
        kId = data.id;
      } else {
        const { error } = await supabase.from("kontakter").update({ selskap_id: s.id }).eq("id", kId);
        if (error) throw error;
      }
      await supabase.from("email_contacts").update({ selskap_id: s.id, kontakt_id: kId }).eq("primary_email", person.email);
      toast.success(`Koblet til ${s.firmanavn}`);
      refresh(); onEndret();
    } catch (e: any) {
      toast.error("Kunne ikke koble: " + (e.message || "Ukjent feil"));
    } finally { setKobler(false); }
  };

  const lagreFelt = async () => {
    if (!redigerer) return;
    const v = verdi.trim();
    try {
      if (kontakt) {
        const key = redigerer;
        updateKontakter(p => p.map(k => k.id === kontakt.id ? { ...k, [key]: v } : k));
      } else if (lead) {
        const key = redigerer === "rolle" ? "rolle_i_firma" : redigerer;
        updateLeads(p => p.map(l => l.id === lead.id ? { ...l, [key]: v } : l));
      } else {
        const { error } = await supabase.from("kontakter").insert({ navn, e_post: person.email, [redigerer]: v || null } as never);
        if (error) throw error;
        refresh(); onEndret();
      }
      toast.success("Lagret");
      setRedigerer(null);
    } catch (e: any) { toast.error("Kunne ikke lagre: " + (e.message || "Ukjent feil")); }
  };

  const felt = (key: Felt, label: string, v: string, lenke?: string) => {
    const kanRedigere = key !== "e_post" || !!kontakt || !!lead;
    return (
      <>
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="min-w-0">
          {redigerer === key ? (
            <form className="flex gap-1.5" onSubmit={e => { e.preventDefault(); void lagreFelt(); }}>
              <Input autoFocus className="h-8" value={verdi} type={key === "telefon" ? "tel" : key === "e_post" ? "email" : "text"}
                onChange={e => setVerdi(e.target.value)} onKeyDown={e => e.key === "Escape" && setRedigerer(null)} aria-label={label} />
              <Button size="sm" className="h-8" type="submit">Lagre</Button>
            </form>
          ) : v ? (
            <span className="flex min-w-0 items-center gap-2">
              {lenke ? <a href={lenke} className={cn("truncate underline-offset-2 hover:underline", key === "telefon" && "tabular-nums")}>{v}</a> : <span className="truncate">{v}</span>}
              {kanRedigere && <button type="button" className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => { setVerdi(v); setRedigerer(key); }}>Endre</button>}
            </span>
          ) : kanRedigere ? (
            <button type="button" className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => { setVerdi(""); setRedigerer(key); }}>
              Legg til {label.toLowerCase()}
            </button>
          ) : <span className="text-muted-foreground">–</span>}
        </dd>
      </>
    );
  };

  const statusTekst = [person.type, person.status].filter(Boolean).join(" · ");

  return (
    <Sheet open onOpenChange={o => !o && onClose()}>
      <SheetContent side={isMobile ? "bottom" : "right"} className={cn("overflow-y-auto", isMobile ? "max-h-[90vh] rounded-t-xl" : "w-full sm:max-w-md")}>
        {/* 1. Hvem */}
        <SheetHeader className="space-y-1.5 text-left">
          <SheetTitle className="font-display break-words pr-6">{navn}</SheetTitle>
          <SheetDescription asChild>
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
              {selskap ? <span className="font-medium text-foreground">{selskap.firmanavn}</span>
                : firmaTekst ? <span className="text-muted-foreground/80">{firmaTekst}</span> : null}
              {firmaTekst && <span aria-hidden>·</span>}
              <span className="min-w-0 truncate">{person.email}</span>
            </div>
          </SheetDescription>
          {statusTekst && <div><Badge variant="secondary" className="text-xs">{statusTekst}</Badge></div>}
        </SheetHeader>

        <div className="mt-5 space-y-6">
          {/* 2. Hva gjør jeg nå */}
          <div className="flex flex-wrap gap-2">
            {person.salgsmulighetId
              ? <Button size="sm" className="gap-1" onClick={() => openKunde({ type: "sm", id: person.salgsmulighetId! })}><ChevronRight className="h-3.5 w-3.5" />Åpne salgsmulighet</Button>
              : <Button size="sm" className="gap-1" variant={visSkjema ? "secondary" : "default"} onClick={() => setVisSkjema(v => !v)}><Plus className="h-3.5 w-3.5" />Opprett salgsmulighet</Button>}
            {person.leadId
              ? <Button size="sm" variant="outline" onClick={() => openKunde({ type: "lead", id: person.leadId! })}>Åpne lead</Button>
              : person.kontaktId && <Button size="sm" variant="outline" onClick={() => openKunde({ type: "kontakt", id: person.kontaktId! })}>Åpne kontakt</Button>}
            {opprettLead?.vis && <Button size="sm" variant="outline" className="gap-1" disabled={opprettLead.laster} onClick={opprettLead.onClick}><UserPlus className="h-3.5 w-3.5" />{opprettLead.laster ? "Oppretter..." : "Opprett lead"}</Button>}
            <Button asChild size="sm" variant="outline" className="gap-1"><a href={gmailLenke(person.email)} target="_blank" rel="noopener noreferrer"><Mail className="h-3.5 w-3.5" />Svar</a></Button>
            {tel && <Button asChild size="sm" variant="outline" className="gap-1"><a href={`tel:${tel}`}><Phone className="h-3.5 w-3.5" />Ring</a></Button>}
            {person.partnerId && <Button asChild size="sm" variant="ghost" className="gap-1"><a href={`/partnere/${person.partnerId}`}><ExternalLink className="h-3.5 w-3.5" />Partner</a></Button>}
          </div>

          {visSkjema && !person.salgsmulighetId && (
            <InnboksSalgsmulighet key={person.email} person={person} onAvbryt={() => setVisSkjema(false)} onFerdig={() => { setVisSkjema(false); onEndret(); onClose(); }} />
          )}

          {/* 3. Selskap */}
          <section aria-labelledby="ip-selskap" className="space-y-2">
            <h3 id="ip-selskap" className={tittel}>Selskap</h3>
            {selskap ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => openSelskap(selskap.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium">{selskap.firmanavn}</span>
                  <Badge variant="outline" className="text-xs">{selskap.kundestatus}</Badge>
                </button>
                <KobleSelskap forslag="" onVelg={kobleTil} trigger={<Button variant="link" size="sm" className="h-auto px-1 text-xs text-muted-foreground">Endre</Button>} />
              </div>
            ) : (
              <div className="space-y-1.5">
                {forslag && (
                  <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{forslag.firmanavn}</span><span className="text-muted-foreground"> · foreslått fra @{epostDomene(person.email)}</span></span>
                    <Button size="sm" variant="outline" className="h-7" disabled={kobler} onClick={() => kobleTil(forslag)}>Koble</Button>
                  </div>
                )}
                {!forslag && <p className="text-sm text-muted-foreground">Ikke koblet til et selskap.</p>}
                <KobleSelskap forslag={forslag ? "" : person.firmanavn !== person.email ? person.firmanavn : ""} onVelg={kobleTil}
                  trigger={<Button variant="link" size="sm" className="h-auto p-0 text-xs text-muted-foreground">{forslag ? "Annet selskap…" : "Koble til selskap…"}</Button>} />
              </div>
            )}
          </section>

          {/* Faner */}
          <Tabs defaultValue="detaljer">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="detaljer">Detaljer</TabsTrigger>
              <TabsTrigger value="aktivitet">Aktivitet</TabsTrigger>
            </TabsList>
            <TabsContent value="detaljer" className="mt-4 space-y-6">
              {/* 4. Kontaktdetaljer */}
              <section aria-labelledby="ip-kontakt" className="space-y-2">
                <h3 id="ip-kontakt" className={tittel}>Kontaktdetaljer</h3>
                <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
                  {felt("e_post", "E-post", kontakt?.e_post || lead?.e_post || person.email, gmailLenke(person.email))}
                  {felt("telefon", "Telefon", telefon, tel ? `tel:${tel}` : undefined)}
                  {felt("rolle", "Rolle", rolle)}
                  {person.ansvarlig && <><dt className="text-muted-foreground">Ansvarlig</dt><dd>{person.ansvarlig}</dd></>}
                  {person.nesteSteg && <><dt className="text-muted-foreground">Neste steg</dt><dd>{person.nesteSteg}</dd></>}
                </dl>
              </section>

              {/* 5. Statistikk */}
              {(totalt > 0 || person.sistKontaktetDato) && (
                <section aria-labelledby="ip-stat" className="space-y-1">
                  <h3 id="ip-stat" className={tittel}>E-post</h3>
                  <p className="text-sm tabular-nums text-muted-foreground">
                    {[totalt > 0 && `${totalt} e-poster`, totalt > 0 && `${person.totalSent} sendt`, totalt > 0 && `${person.totalReceived} mottatt`,
                      person.sistKontaktetDato && `sist ${format(new Date(person.sistKontaktetDato), "d. MMM HH:mm", { locale: nb })}`].filter(Boolean).join(" · ")}
                  </p>
                </section>
              )}

              <DealSuggestions
                selskapId={person.selskapId || person.suggestedSelskapId}
                kontaktId={person.kontaktId}
                email={person.email}
                currentSalgsmulighetId={person.salgsmulighetId}
                onLinked={() => { onEndret(); onClose(); }}
              />
            </TabsContent>
            <TabsContent value="aktivitet" className="mt-4">
              {person.kontaktId && <ActivityLog kontakt_id={person.kontaktId} />}
              {person.leadId && !person.kontaktId && <ActivityLog lead_id={person.leadId} />}
              {!person.kontaktId && !person.leadId && <ActivityLog email={person.email} />}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
