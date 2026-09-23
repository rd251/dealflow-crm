import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Merge, Search, X } from "lucide-react";
import { toast } from "sonner";
import PageShell from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import type { Kontakt, Selskap } from "@/data/crm-data";
import {
  DublettPar, dublettNokkel, finnPersonDubletter, finnSelskapDubletter,
} from "@/lib/duplicates";

type Fane = "personer" | "selskaper";

interface Rad {
  key: string;
  grunn: string;
  type: Fane;
  behold: Kontakt | Selskap;
  fjern: Kontakt | Selskap;
  navnBehold: string;
  navnFjern: string;
  detaljerBehold: string[];
  detaljerFjern: string[];
  sok: string;
}

function eldst<T extends { id: string }>(a: T, b: T, rekkefolge: Map<string, number>) {
  const ia = rekkefolge.get(a.id) ?? 0;
  const ib = rekkefolge.get(b.id) ?? 0;
  return ia <= ib ? [a, b] : [b, a];
}

function kontaktDetaljer(k: Kontakt, selskapNavn: string): string[] {
  return [selskapNavn, k.rolle, k.e_post, k.telefon].filter(Boolean);
}

function selskapDetaljer(s: Selskap): string[] {
  return [s.bransje, s.domene, s.orgnr, s.kundestatus].filter(Boolean);
}

export default function Dubletter() {
  const navigate = useNavigate();
  const { kontakter, selskaper, loaded, refresh } = useCrmStore();
  const [fane, setFane] = useState<Fane>("personer");
  const [sok, setSok] = useState("");
  const [ignorerte, setIgnorerte] = useState<Set<string>>(new Set());
  const [bekreft, setBekreft] = useState<Rad | null>(null);
  const [jobber, setJobber] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("dublett_ignorert").select("id_a,id_b").then(({ data }) => {
      setIgnorerte(new Set((data ?? []).map(r => dublettNokkel(r.id_a, r.id_b))));
    });
  }, []);

  const selskapNavn = useMemo(
    () => new Map(selskaper.map(s => [s.id, s.firmanavn])),
    [selskaper],
  );
  const rekkefolge = useMemo(() => {
    const m = new Map<string, number>();
    kontakter.forEach((k, i) => m.set(k.id, i));
    selskaper.forEach((s, i) => m.set(s.id, i));
    return m;
  }, [kontakter, selskaper]);

  const personRader = useMemo<Rad[]>(() => {
    return finnPersonDubletter(kontakter).map((p: DublettPar<Kontakt>) => {
      const [behold, fjern] = eldst(p.a, p.b, rekkefolge);
      return {
        key: p.key, grunn: p.grunn, type: "personer" as const, behold, fjern,
        navnBehold: behold.navn, navnFjern: fjern.navn,
        detaljerBehold: kontaktDetaljer(behold, selskapNavn.get(behold.selskap_id) || ""),
        detaljerFjern: kontaktDetaljer(fjern, selskapNavn.get(fjern.selskap_id) || ""),
        sok: `${behold.navn} ${fjern.navn} ${behold.e_post} ${fjern.e_post}`.toLowerCase(),
      };
    });
  }, [kontakter, selskapNavn, rekkefolge]);

  const selskapRader = useMemo<Rad[]>(() => {
    return finnSelskapDubletter(selskaper).map((p: DublettPar<Selskap>) => {
      const [behold, fjern] = eldst(p.a, p.b, rekkefolge);
      return {
        key: p.key, grunn: p.grunn, type: "selskaper" as const, behold, fjern,
        navnBehold: behold.firmanavn, navnFjern: fjern.firmanavn,
        detaljerBehold: selskapDetaljer(behold),
        detaljerFjern: selskapDetaljer(fjern),
        sok: `${behold.firmanavn} ${fjern.firmanavn} ${behold.domene} ${fjern.domene}`.toLowerCase(),
      };
    });
  }, [selskaper, rekkefolge]);

  const synlig = (rader: Rad[]) =>
    rader.filter(r => !ignorerte.has(r.key) && (!sok.trim() || r.sok.includes(sok.trim().toLowerCase())));

  const aktive = synlig(fane === "personer" ? personRader : selskapRader);
  const antallPersoner = synlig(personRader).length;
  const antallSelskaper = synlig(selskapRader).length;

  async function ignorer(rad: Rad) {
    setIgnorerte(prev => new Set(prev).add(rad.key));
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("dublett_ignorert").insert({
      type: rad.type === "personer" ? "kontakt" : "selskap",
      id_a: [rad.behold.id, rad.fjern.id].sort()[0],
      id_b: [rad.behold.id, rad.fjern.id].sort()[1],
      ignorert_av: auth.user?.id ?? null,
    });
    if (error && !error.message.includes("duplicate")) toast.error("Kunne ikke lagre «Ignorer»");
  }

  async function slaSammen(rad: Rad) {
    setJobber(rad.key);
    const { data, error } = await supabase.functions.invoke("merge-duplicates", {
      body: {
        type: rad.type === "personer" ? "kontakt" : "selskap",
        behold_id: rad.behold.id,
        fjern_id: rad.fjern.id,
      },
    });
    setJobber(null);
    setBekreft(null);
    if (error || (data as any)?.error) {
      toast.error("Sammenslåing feilet", { description: error?.message });
      return;
    }
    toast.success(`Slått sammen til «${rad.navnBehold}»`);
    await refresh(true);
  }

  const kort = (navn: string, detaljer: string[], merke?: string) => (
    <div className="flex-1 min-w-0 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium truncate">{navn || "Uten navn"}</p>
        {merke && <Badge variant="secondary" className="shrink-0">{merke}</Badge>}
      </div>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {detaljer.length === 0 && <li>Ingen flere opplysninger</li>}
        {detaljer.map((d, i) => <li key={i} className="truncate">{d}</li>)}
      </ul>
    </div>
  );

  return (
    <PageShell
      title="Dubletter"
      subtitle="Forslag om å slå sammen personer og selskaper som ser like ut"
    >
      <Tabs value={fane} onValueChange={v => setFane(v as Fane)} className="mb-6">
        <TabsList>
          <TabsTrigger value="personer">Personer <span className="ml-2 tabular-nums text-muted-foreground">{antallPersoner}</span></TabsTrigger>
          <TabsTrigger value="selskaper">Selskaper <span className="ml-2 tabular-nums text-muted-foreground">{antallSelskaper}</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={sok} onChange={e => setSok(e.target.value)} placeholder="Søk i forslagene" className="pl-9" />
      </div>

      {!loaded ? (
        <p className="text-muted-foreground">Laster …</p>
      ) : aktive.length === 0 ? (
        <p className="text-muted-foreground">Ingen mulige dubletter funnet.</p>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Vi fant <span className="tabular-nums font-medium text-foreground">{aktive.length}</span> mulige dubletter.
          </p>
          <div className="space-y-8">
            {aktive.map(rad => (
              <div key={rad.key}>
                <p className="text-sm text-muted-foreground mb-2">{rad.grunn}</p>
                <div className="flex flex-col lg:flex-row gap-4 items-stretch">
                  {kort(rad.navnBehold, rad.detaljerBehold, "Beholdes")}
                  {kort(rad.navnFjern, rad.detaljerFjern)}
                  <div className="lg:w-72 shrink-0 rounded-xl border bg-muted/40 p-4 flex flex-col justify-between gap-4">
                    <div>
                      <p className="font-medium truncate">{rad.navnBehold}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Alt samles på denne posten. Den andre legges i Slettede elementer.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => ignorer(rad)}>
                        <X className="w-4 h-4 mr-1" /> Ignorer
                      </Button>
                      <Button className="flex-1" disabled={jobber === rad.key} onClick={() => setBekreft(rad)}>
                        {jobber === rad.key
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <><Merge className="w-4 h-4 mr-1" /> Slå sammen</>}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <AlertDialog open={!!bekreft} onOpenChange={o => !o && setBekreft(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slå sammen «{bekreft?.navnFjern}» inn i «{bekreft?.navnBehold}»?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Dette skjer:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Aktiviteter, oppgaver, salgsmuligheter og e-poster flyttes over.</li>
                  <li>Tomme felt fylles fra den andre posten, og notatene slås sammen.</li>
                  <li>«{bekreft?.navnFjern}» legges i Slettede elementer (30 dagers angrefrist).</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={() => bekreft && slaSammen(bekreft)}>Slå sammen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
