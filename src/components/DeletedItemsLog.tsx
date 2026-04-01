import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, RotateCcw, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

interface DeletedItem {
  id: string;
  table_name: string;
  record_id: string;
  record_data: Record<string, any>;
  deleted_by: string | null;
  deleted_at: string;
  restored_at: string | null;
}

const TABLE_LABELS: Record<string, string> = {
  leads: "Lead",
  salgsmuligheter: "Salgsmulighet",
  selskaper: "Selskap",
  kontakter: "Kontakt",
  oppgaver: "Oppgave",
  prosjekter: "Prosjekt",
  partnere: "Partner",
  aktiviteter: "Aktivitet",
};

const TABLE_COLORS: Record<string, string> = {
  leads: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  salgsmuligheter: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  selskaper: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  kontakter: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  oppgaver: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  prosjekter: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  partnere: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  aktiviteter: "bg-muted text-muted-foreground",
};

function getItemLabel(item: DeletedItem): string {
  const d = item.record_data;
  return d.firmanavn || d.navn || d.prosjektnavn || d.partnernavn || d.oppgave || d.tittel || d.beskrivelse?.substring(0, 50) || item.record_id.substring(0, 8);
}

export default function DeletedItemsLog() {
  const { refresh } = useCrmStore();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [showRestored, setShowRestored] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    let query = supabase
      .from("deleted_items" as any)
      .select("*")
      .order("deleted_at", { ascending: false })
      .limit(200);
    if (!showRestored) {
      query = query.is("restored_at", null);
    }
    const { data } = await query;
    setItems((data as any as DeletedItem[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [showRestored]);

  const handleRestore = async (item: DeletedItem) => {
    setRestoring(item.id);
    try {
      // Re-insert the record into the original table
      const { id, created_at, updated_at, ...restData } = item.record_data;
      const { error } = await supabase
        .from(item.table_name as any)
        .insert({ ...restData, id: item.record_id } as any);

      if (error) throw error;

      // Mark as restored
      await supabase
        .from("deleted_items" as any)
        .update({ restored_at: new Date().toISOString() } as any)
        .eq("id", item.id);

      toast.success(`${TABLE_LABELS[item.table_name] || item.table_name} "${getItemLabel(item)}" gjenopprettet`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      refresh();
    } catch (err: any) {
      toast.error("Gjenoppretting feilet: " + (err.message || "Ukjent feil"));
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (item: DeletedItem) => {
    try {
      await supabase
        .from("deleted_items" as any)
        .delete()
        .eq("id", item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      toast.success("Slettet permanent");
    } catch {
      toast.error("Kunne ikke slette");
    }
  };

  const visibleItems = expanded ? items : items.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <CardTitle className="text-lg">Slettet logg</CardTitle>
            <CardDescription>
              {items.length === 0
                ? "Ingen slettede elementer"
                : `${items.length} element${items.length !== 1 ? "er" : ""} kan gjenopprettes · slettes automatisk etter 30 dager`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Laster...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            Når du sletter elementer i CRM-et lagres de her slik at du kan gjenopprette dem om nødvendig.
          </p>
        ) : (
          <div className="space-y-1">
            {visibleItems.map(item => (
              <div
                key={item.id}
                className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 group transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${TABLE_COLORS[item.table_name] || ""}`}>
                      {TABLE_LABELS[item.table_name] || item.table_name}
                    </Badge>
                    <span className="text-sm font-medium truncate">{getItemLabel(item)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Slettet {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true, locale: nb })}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gap-1 text-xs"
                    onClick={() => handleRestore(item)}
                    disabled={restoring === item.id}
                  >
                    {restoring === item.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3 h-3" />
                    )}
                    Gjenopprett
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                    onClick={() => handlePermanentDelete(item)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
            {items.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs gap-1 mt-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" /> Vis færre
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" /> Vis {items.length - 5} flere
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
