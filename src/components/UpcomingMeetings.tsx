import { useState, useEffect } from "react";
import { CalendarDays, Clock, Users } from "lucide-react";
import { format } from "date-fns";
import { nb } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { typeIcons, typeColors, AktivitetType } from "@/components/ActivityLog";

const API_URL = import.meta.env.VITE_SUPABASE_URL + '/rest/v1';
const API_HEADERS = {
  'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
};

interface UpcomingItem {
  id: string;
  type: AktivitetType;
  tittel: string;
  beskrivelse: string;
  dato: string;
  start_tid: string | null;
  slutt_tid: string | null;
}

export default function UpcomingMeetings() {
  const [items, setItems] = useState<UpcomingItem[]>([]);

  useEffect(() => {
    const now = new Date().toISOString();
    fetch(
      `${API_URL}/aktiviteter?dato=gte.${now}&order=dato.asc&limit=8&select=id,type,tittel,beskrivelse,dato,start_tid,slutt_tid`,
      { headers: API_HEADERS }
    )
      .then(r => r.ok ? r.json() : [])
      .then(setItems)
      .catch(() => {});
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h2 className="text-base sm:text-lg font-semibold">Kommende møter og aktiviteter</h2>
        <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map(item => {
          const Icon = typeIcons[item.type] || CalendarDays;
          const colorClass = typeColors[item.type] || "text-muted-foreground bg-muted";
          const date = new Date(item.start_tid || item.dato);

          return (
            <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {item.tittel || item.beskrivelse || item.type}
                </p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {format(date, "EEE d. MMM", { locale: nb })}
                  </span>
                  {item.start_tid && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(item.start_tid), "HH:mm")}
                      {item.slutt_tid && ` – ${format(new Date(item.slutt_tid), "HH:mm")}`}
                    </span>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">{item.type}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
