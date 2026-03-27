import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { nb } from "date-fns/locale";

interface Varsel {
  id: string;
  tittel: string;
  beskrivelse: string;
  lest: boolean;
  lenke: string;
  created_at: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [varsler, setVarsler] = useState<Varsel[]>([]);
  const [open, setOpen] = useState(false);

  const fetchVarsler = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("varsler")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setVarsler(data as Varsel[]);
  };

  useEffect(() => {
    fetchVarsler();

    if (!user) return;
    const channel = supabase
      .channel("varsler-realtime")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "varsler",
        filter: `user_id=eq.${user.id}`,
      }, () => fetchVarsler())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const uleste = varsler.filter(v => !v.lest).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("varsler").update({ lest: true }).eq("user_id", user.id).eq("lest", false);
    setVarsler(prev => prev.map(v => ({ ...v, lest: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from("varsler").update({ lest: true }).eq("id", id);
    setVarsler(prev => prev.map(v => v.id === id ? { ...v, lest: true } : v));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {uleste > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {uleste}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Varsler</span>
          {uleste > 0 && (
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={markAllRead}>
              Merk alle som lest
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {varsler.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Ingen varsler</div>
          ) : (
            varsler.map(v => (
              <button
                key={v.id}
                onClick={() => { markRead(v.id); if (v.lenke) window.location.hash = v.lenke; }}
                className={`w-full text-left px-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors ${!v.lest ? "bg-primary/5" : ""}`}
              >
                <p className={`text-sm ${!v.lest ? "font-medium" : "text-muted-foreground"}`}>{v.tittel}</p>
                {v.beskrivelse && <p className="text-xs text-muted-foreground mt-0.5">{v.beskrivelse}</p>}
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {formatDistanceToNow(new Date(v.created_at), { addSuffix: true, locale: nb })}
                </p>
              </button>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
