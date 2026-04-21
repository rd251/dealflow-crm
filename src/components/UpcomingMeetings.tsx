import { useState, useEffect } from "react";
import { CalendarDays, Clock, Building2 } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { nb } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { typeIcons, typeColors, AktivitetType } from "@/components/ActivityLog";
import { GmailIcon, GoogleCalendarIcon } from "@/components/BrandIcons";
import { useNavigate } from "react-router-dom";

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
  selskap_id: string | null;
  lead_id: string | null;
  salgsmulighet_id: string | null;
  partner_id: string | null;
  kontakt_id: string | null;
  ekstern_provider?: string | null;
}

export default function UpcomingMeetings() {
  const navigate = useNavigate();
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [entityNames, setEntityNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const fromDate = today.toISOString();
    const toDate = dayAfterTomorrow.toISOString();
    fetch(
      `${API_URL}/aktiviteter?dato=gte.${fromDate}&dato=lt.${toDate}&order=dato.asc,start_tid.asc&limit=20&select=id,type,tittel,beskrivelse,dato,start_tid,slutt_tid,selskap_id,lead_id,salgsmulighet_id,partner_id,kontakt_id,ekstern_provider`,
      { headers: API_HEADERS }
    )
      .then(r => r.ok ? r.json() : [])
      .then((data: UpcomingItem[]) => {
        setItems(data);
        // Collect entity IDs to resolve names
        const selskapIds = [...new Set(data.map(d => d.selskap_id).filter(Boolean))] as string[];
        const leadIds = [...new Set(data.map(d => d.lead_id).filter(Boolean))] as string[];
        const salgsIds = [...new Set(data.map(d => d.salgsmulighet_id).filter(Boolean))] as string[];
        const partnerIds = [...new Set(data.map(d => d.partner_id).filter(Boolean))] as string[];
        const kontaktIds = [...new Set(data.map(d => d.kontakt_id).filter(Boolean))] as string[];

        const fetches: Promise<void>[] = [];
        const names: Record<string, string> = {};

        if (selskapIds.length) {
          fetches.push(
            fetch(`${API_URL}/selskaper?id=in.(${selskapIds.join(",")})&select=id,firmanavn`, { headers: API_HEADERS })
              .then(r => r.ok ? r.json() : [])
              .then((rows: any[]) => rows.forEach(r => { names[r.id] = r.firmanavn; }))
          );
        }
        if (leadIds.length) {
          fetches.push(
            fetch(`${API_URL}/leads?id=in.(${leadIds.join(",")})&select=id,firmanavn`, { headers: API_HEADERS })
              .then(r => r.ok ? r.json() : [])
              .then((rows: any[]) => rows.forEach(r => { names[r.id] = r.firmanavn; }))
          );
        }
        if (salgsIds.length) {
          fetches.push(
            fetch(`${API_URL}/salgsmuligheter?id=in.(${salgsIds.join(",")})&select=id,navn`, { headers: API_HEADERS })
              .then(r => r.ok ? r.json() : [])
              .then((rows: any[]) => rows.forEach(r => { names[r.id] = r.navn; }))
          );
        }
        if (partnerIds.length) {
          fetches.push(
            fetch(`${API_URL}/partnere?id=in.(${partnerIds.join(",")})&select=id,partnernavn`, { headers: API_HEADERS })
              .then(r => r.ok ? r.json() : [])
              .then((rows: any[]) => rows.forEach(r => { names[r.id] = r.partnernavn; }))
          );
        }
        if (kontaktIds.length) {
          fetches.push(
            fetch(`${API_URL}/kontakter?id=in.(${kontaktIds.join(",")})&select=id,navn`, { headers: API_HEADERS })
              .then(r => r.ok ? r.json() : [])
              .then((rows: any[]) => rows.forEach(r => { names[r.id] = r.navn; }))
          );
        }

        Promise.all(fetches).then(() => setEntityNames(names));
      })
      .catch(() => {});
  }, []);

  const getEntityInfo = (item: UpcomingItem): { name: string; path: string } | null => {
    if (item.selskap_id && entityNames[item.selskap_id]) return { name: entityNames[item.selskap_id], path: `/selskaper/${item.selskap_id}` };
    if (item.lead_id && entityNames[item.lead_id]) return { name: entityNames[item.lead_id], path: `/leads` };
    if (item.salgsmulighet_id && entityNames[item.salgsmulighet_id]) return { name: entityNames[item.salgsmulighet_id], path: `/salgsmuligheter` };
    if (item.partner_id && entityNames[item.partner_id]) return { name: entityNames[item.partner_id], path: `/partnere/${item.partner_id}` };
    if (item.kontakt_id && entityNames[item.kontakt_id]) return { name: entityNames[item.kontakt_id], path: `/kontakter` };
    return null;
  };

  if (items.length === 0) return null;

  const todayItems = items.filter(i => isToday(new Date(i.dato)));
  const tomorrowItems = items.filter(i => isTomorrow(new Date(i.dato)));

  const renderItem = (item: UpcomingItem) => {
    const Icon = typeIcons[item.type] || CalendarDays;
    const colorClass = typeColors[item.type] || "text-muted-foreground bg-muted";
    const entity = getEntityInfo(item);
    const isGmail = item.ekstern_provider === 'gmail';
    const isGCal = item.ekstern_provider === 'google_calendar';
    const isExternal = isGmail || isGCal;

    return (
      <div key={item.id} className="flex items-start gap-3 p-2.5 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors min-w-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isExternal ? 'bg-white border' : colorClass}`}>
          {isGmail ? <GmailIcon size={16} /> : isGCal ? <GoogleCalendarIcon size={16} /> : <Icon className="w-4 h-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {item.tittel || item.beskrivelse || item.type}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {entity && (
              <button
                onClick={(e) => { e.stopPropagation(); navigate(entity.path); }}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Building2 className="w-3 h-3" />
                {entity.name}
              </button>
            )}
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
  };

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-6 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-5 h-5 text-primary" />
        <h2 className="text-base sm:text-lg font-semibold">Dagens og morgendagens aktiviteter</h2>
        <Badge variant="secondary" className="ml-auto text-xs">{items.length}</Badge>
      </div>

      {todayItems.length > 0 && (
        <div className="mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">I dag – {format(new Date(), "EEEE d. MMMM", { locale: nb })}</h3>
          <div className="space-y-2">{todayItems.map(renderItem)}</div>
        </div>
      )}

      {tomorrowItems.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">I morgen – {format(new Date(Date.now() + 86400000), "EEEE d. MMMM", { locale: nb })}</h3>
          <div className="space-y-2">{tomorrowItems.map(renderItem)}</div>
        </div>
      )}
    </div>
  );
}
