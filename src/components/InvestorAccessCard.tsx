import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { LineChart, Loader2, Trash2 } from "lucide-react";

interface InvestorRad {
  id: string;
  e_post: string;
  navn: string | null;
  aktiv: boolean;
  created_at: string;
}

/** Adminstyrt allowlist: hvem som har skrivebeskyttet investortilgang. */
export default function InvestorAccessCard() {
  const { user, isAdmin } = useAuth();
  const [rader, setRader] = useState<InvestorRad[]>([]);
  const [laster, setLaster] = useState(true);
  const [epost, setEpost] = useState("");
  const [navn, setNavn] = useState("");
  const [lagrer, setLagrer] = useState(false);

  const hent = async () => {
    const { data } = await supabase
      .from("investor_tilgang")
      .select("id, e_post, navn, aktiv, created_at")
      .order("created_at", { ascending: false });
    setRader((data as InvestorRad[]) || []);
    setLaster(false);
  };

  useEffect(() => {
    if (isAdmin) hent();
    else setLaster(false);
  }, [isAdmin]);

  if (!isAdmin) return null;

  const leggTil = async () => {
    const e = epost.trim().toLowerCase();
    if (!e || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
      toast.error("Skriv inn en gyldig e-postadresse");
      return;
    }
    setLagrer(true);
    const { error } = await supabase.from("investor_tilgang").insert({
      e_post: e,
      navn: navn.trim() || null,
      opprettet_av: user?.id ?? null,
    });
    setLagrer(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "Denne adressen har allerede tilgang" : "Kunne ikke legge til");
      return;
    }
    setEpost("");
    setNavn("");
    toast.success("Investortilgang lagt til");
    hent();
  };

  const settAktiv = async (id: string, aktiv: boolean) => {
    await supabase.from("investor_tilgang").update({ aktiv }).eq("id", id);
    setRader((prev) => prev.map((r) => (r.id === id ? { ...r, aktiv } : r)));
    toast.success(aktiv ? "Tilgang aktivert" : "Tilgang deaktivert");
  };

  const fjern = async (id: string) => {
    await supabase.from("investor_tilgang").delete().eq("id", id);
    setRader((prev) => prev.filter((r) => r.id !== id));
    toast.success("Tilgang fjernet");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <LineChart className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Investortilgang</CardTitle>
            <CardDescription>
              Disse e-postadressene får kun se investoroversikten – ingen kunder, dialog eller pipeline.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="inv-epost">E-post</Label>
            <Input id="inv-epost" value={epost} onChange={(e) => setEpost(e.target.value)} placeholder="investor@fond.no" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-navn">Navn (valgfritt)</Label>
            <Input id="inv-navn" value={navn} onChange={(e) => setNavn(e.target.value)} placeholder="Kari Nordmann" />
          </div>
          <Button onClick={leggTil} disabled={lagrer} size="sm">
            {lagrer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Legg til
          </Button>
        </div>

        {laster ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Laster...
          </div>
        ) : rader.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Ingen investorer har tilgang ennå.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rader.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.navn || r.e_post}</p>
                  {r.navn && <p className="truncate text-xs text-muted-foreground">{r.e_post}</p>}
                </div>
                <Badge variant={r.aktiv ? "default" : "secondary"}>{r.aktiv ? "Aktiv" : "Deaktivert"}</Badge>
                <Switch checked={r.aktiv} onCheckedChange={(v) => settAktiv(r.id, v)} />
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => fjern(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
