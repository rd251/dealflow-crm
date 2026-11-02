import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles } from "@/hooks/use-profiles";
import { useKort } from "@/hooks/use-kort";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Search, Sparkles, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
  FOERSTE_STEG, aapenSalgsmulighet, epostDomene, erGeneriskDomene, finnSelskap, foreslaaSelskap, navnFraDomene,
} from "@/lib/innboks-salg";

export interface InnboksPerson {
  email: string; navn: string; firmanavn: string;
  kontaktId: string | null; leadId: string | null; selskapId: string | null;
}

const vent = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Lite skjema i personpanelet: opprett salgsmulighet eller koble personen til en åpen. */
export default function InnboksSalgsmulighet({ person, onAvbryt, onFerdig }: { person: InnboksPerson; onAvbryt: () => void; onFerdig: () => void }) {
  const { selskaper, salgsmuligheter, leads, kontakter, konverterLead, refresh } = useCrmStore();
  const { user } = useAuth();
  const { profiles } = useProfiles();
  const { openKunde } = useKort();
  const meg = profiles.find(p => p.user_id === user?.id)?.display_name || "";

  const forslag = useMemo(() => foreslaaSelskap(selskaper, person.email, person.selskapId), [selskaper, person.email, person.selskapId]);
  const [selskapId, setSelskapId] = useState<string | null>(forslag?.id || null);
  const [nyttSelskapNavn, setNyttSelskapNavn] = useState(forslag ? "" : (person.firmanavn && person.firmanavn !== person.email ? person.firmanavn : navnFraDomene(person.email)));
  const valgt = selskaper.find(s => s.id === selskapId) || null;
  const [navn, setNavn] = useState(valgt?.firmanavn || nyttSelskapNavn || person.navn);
  const [mrr, setMrr] = useState("");
  const [lukkedato, setLukkedato] = useState("");
  const [sok, setSok] = useState("");
  const [visSok, setVisSok] = useState(false);
  const [lagrer, setLagrer] = useState(false);

  const kontaktNavn = person.navn && person.navn !== person.email ? person.navn : person.email.split("@")[0];
  const aapen = aapenSalgsmulighet(salgsmuligheter, selskapId);
  const treff = sok.length >= 2 ? selskaper.filter(s => s.firmanavn.toLowerCase().includes(sok.toLowerCase())).slice(0, 6) : [];

  const velgSelskap = (id: string | null, nyttNavn = "") => {
    setSelskapId(id); setNyttSelskapNavn(nyttNavn); setVisSok(false); setSok("");
    const s = selskaper.find(x => x.id === id);
    setNavn(s?.firmanavn || nyttNavn || navn);
  };

  /** Gjenbruk selskap på navn/domene, ellers opprett. */
  const sikreSelskap = async (): Promise<string | null> => {
    if (selskapId) return selskapId;
    const n = nyttSelskapNavn.trim();
    if (!n) return null;
    const domene = epostDomene(person.email);
    const fins = finnSelskap(selskaper, n, domene);
    if (fins) return fins.id;
    const { data, error } = await supabase.from("selskaper")
      .insert({ firmanavn: n, kundestatus: "Ikke kunde" as any, domene: erGeneriskDomene(domene) ? "" : domene, kundeansvarlig: meg || null })
      .select("id").single();
    if (error) throw error;
    return data.id;
  };

  /** Gjenbruk kontakt på e-post, ellers opprett koblet til selskapet. */
  const sikreKontakt = async (sId: string | null): Promise<string> => {
    const kjent = person.kontaktId ? kontakter.find(k => k.id === person.kontaktId) : null;
    let id = person.kontaktId;
    let harSelskap = !!kjent?.selskap_id;
    if (!id) {
      const { data } = await supabase.from("kontakter").select("id, selskap_id").ilike("e_post", person.email).limit(1).maybeSingle();
      if (data) { id = data.id; harSelskap = !!data.selskap_id; }
    }
    if (!id) {
      const lead = person.leadId ? leads.find(l => l.id === person.leadId) : null;
      const { data, error } = await supabase.from("kontakter")
        .insert({ navn: kontaktNavn, e_post: person.email, telefon: lead?.telefon || null, selskap_id: sId })
        .select("id").single();
      if (error) throw error;
      return data.id;
    }
    if (sId && !harSelskap) await supabase.from("kontakter").update({ selskap_id: sId }).eq("id", id);
    return id;
  };

  /** Koble e-posttråd og aktiviteter til salgsmuligheten (bare de som ikke alt har en). */
  const kobleHistorikk = async (smId: string, kontaktId: string | null, sId: string | null) => {
    const base = () => supabase.from("aktiviteter").update({ salgsmulighet_id: smId }).is("salgsmulighet_id", null);
    if (kontaktId) await base().eq("kontakt_id", kontaktId);
    if (person.leadId) await base().eq("lead_id", person.leadId);
    await base().contains("eksterne_deltakere", [person.email.toLowerCase()]);
    await base().contains("deltakere", [person.email]);
    await supabase.from("email_contacts")
      .update({ salgsmulighet_id: smId, ...(kontaktId ? { kontakt_id: kontaktId } : {}), ...(sId ? { selskap_id: sId } : {}) })
      .ilike("primary_email", person.email);
  };

  const ferdig = (smId: string, tekst: string) => {
    toast.success(tekst);
    refresh();
    onFerdig();
    openKunde({ type: "sm", id: smId });
  };

  const kobleTilAapen = async () => {
    if (!aapen) return;
    setLagrer(true);
    try {
      const kontaktId = await sikreKontakt(selskapId);
      if (!salgsmuligheter.find(s => s.id === aapen.id)?.kontakt_id) {
        await supabase.from("salgsmuligheter").update({ kontakt_id: kontaktId }).eq("id", aapen.id);
      }
      await kobleHistorikk(aapen.id, kontaktId, selskapId);
      ferdig(aapen.id, `Koblet til «${aapen.navn}»`);
    } catch (e: any) {
      toast.error("Kunne ikke koble: " + (e.message || "Ukjent feil"));
    } finally { setLagrer(false); }
  };

  const opprett = async () => {
    if (!navn.trim()) { toast.error("Gi salgsmuligheten et navn"); return; }
    setLagrer(true);
    try {
      const sId = await sikreSelskap();
      const verdi = Number(mrr.replace(/\s/g, "").replace(",", ".")) || 0;
      const lead = person.leadId ? leads.find(l => l.id === person.leadId) : null;
      const kanKonverteres = lead && !["Konvertert til salg", "Konvertert til partner"].includes(lead.status);

      if (kanKonverteres) {
        // Eksisterende lead: bruk vanlig konvertering så leadet blir «Konvertert til salg».
        const smId = konverterLead(lead.id, navn.trim(), undefined, {
          selskapId: sId || undefined, ansvarlig: meg || undefined, forventet_mrr: verdi, forventet_lukkedato: lukkedato || undefined,
        });
        if (!smId) throw new Error("Fant ikke leadet");
        // Vent til salgsmuligheten er lagret før historikken kobles.
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.from("salgsmuligheter").select("id, kontakt_id").eq("id", smId).maybeSingle();
          if (data) { await kobleHistorikk(smId, data.kontakt_id, sId); break; }
          await vent(500);
        }
        ferdig(smId, "Salgsmulighet opprettet");
        return;
      }

      const kontaktId = await sikreKontakt(sId);
      const iDag = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase.from("salgsmuligheter").insert({
        navn: navn.trim(), selskap_id: sId, kontakt_id: kontaktId, status: FOERSTE_STEG as any,
        ansvarlig: meg || null, forventet_mrr: verdi, forventet_lukkedato: lukkedato || null,
        kontaktperson: kontaktNavn, e_post: person.email, telefon: lead?.telefon || null,
        kilde: "E-post" as any, opprettet_dato: iDag, sist_aktivitet: iDag, eier_id: user?.id || null,
      }).select("id").single();
      if (error) throw error;
      await kobleHistorikk(data.id, kontaktId, sId);
      ferdig(data.id, "Salgsmulighet opprettet");
    } catch (e: any) {
      toast.error("Kunne ikke opprette salgsmulighet: " + (e.message || "Ukjent feil"));
    } finally { setLagrer(false); }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4" aria-label="Ny salgsmulighet">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ny salgsmulighet</h3>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onAvbryt} aria-label="Lukk skjema"><X className="h-4 w-4" /></Button>
      </div>

      {aapen && (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/10 p-3 text-sm">
          <p className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Åpen salgsmulighet finnes: <strong>{aapen.navn}</strong> ({aapen.status})</span></p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { onFerdig(); openKunde({ type: "sm", id: aapen.id }); }}>Åpne</Button>
            <Button size="sm" onClick={kobleTilAapen} disabled={lagrer}>Koble {kontaktNavn} til denne</Button>
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="sm-navn">Navn på salgsmulighet</Label>
        <Input id="sm-navn" value={navn} onChange={e => setNavn(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Selskap</Label>
        {valgt ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm">
            <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate">{valgt.firmanavn}</span>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => setVisSok(v => !v)}>Endre</Button>
          </div>
        ) : (
          <div className="space-y-1">
            <Input value={nyttSelskapNavn} onChange={e => setNyttSelskapNavn(e.target.value)} placeholder="Nytt selskap" aria-label="Navn på nytt selskap" />
            <p className="text-xs text-muted-foreground">Opprettes som nytt selskap hvis det ikke finnes fra før. <button className="underline" onClick={() => setVisSok(true)}>Søk i eksisterende</button></p>
          </div>
        )}
        {forslag && !person.selskapId && selskapId === forslag.id && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" />Forslag basert på @{epostDomene(person.email)}</p>
        )}
        {visSok && (
          <div className="space-y-1.5 pt-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus className="h-8 pl-8 text-sm" placeholder="Søk selskaper..." value={sok} onChange={e => setSok(e.target.value)} />
            </div>
            {treff.map(s => (
              <button key={s.id} className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted/50" onClick={() => velgSelskap(s.id)}>
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />{s.firmanavn}
              </button>
            ))}
            {sok.length >= 2 && (
              <Button size="sm" variant="outline" className="w-full" onClick={() => velgSelskap(null, sok.trim())}>Opprett nytt selskap «{sok.trim()}»</Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-muted-foreground">Kontaktperson</p><p className="truncate">{kontaktNavn}</p></div>
        <div><p className="text-xs text-muted-foreground">Steg</p><p>{FOERSTE_STEG}</p></div>
        <div><p className="text-xs text-muted-foreground">Ansvarlig</p><p className="truncate">{meg || "Deg"}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sm-mrr">Verdi (MRR, kr)</Label>
          <Input id="sm-mrr" inputMode="decimal" className="tabular-nums" value={mrr} onChange={e => setMrr(e.target.value)} placeholder="Valgfritt" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sm-dato">Forventet lukkedato</Label>
          <Input id="sm-dato" type="date" value={lukkedato} onChange={e => setLukkedato(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onAvbryt}>Avbryt</Button>
        <Button onClick={opprett} disabled={lagrer}>{lagrer ? "Oppretter..." : "Opprett"}</Button>
      </div>
    </div>
  );
}
