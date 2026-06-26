import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/PageShell";
import { useCrmStore } from "@/hooks/use-crm-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, ChevronRight, ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { Kundestatus, Selskap } from "@/data/crm-data";
import CompanyLogo from "@/components/CompanyLogo";

const kundestatusColors: Record<Kundestatus, string> = {
  "Ikke kunde": "bg-muted text-muted-foreground",
  "Pilot": "bg-stage-contacted/10 text-stage-contacted",
  "Live": "bg-success/10 text-success",
  "Pause": "bg-warning/10 text-warning",
  "Kansellert": "bg-destructive/10 text-destructive",
};

type SortKey = "firmanavn" | "bransje" | "kundestatus" | "kundeansvarlig" | "sist_aktivitet";

export default function AlleSelskaper() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { selskaper, kontakter, partnere } = useCrmStore();
  const partnerNavn = (id?: string) => id ? partnere.find(p => p.id === id)?.partnernavn : undefined;
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const filteredUnsorted = selskaper.filter(s =>
    s.firmanavn.toLowerCase().includes(search.toLowerCase()) ||
    (s.bransje || "").toLowerCase().includes(search.toLowerCase())
  );

  const filtered = [...filteredUnsorted].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "firmanavn": return dir * a.firmanavn.localeCompare(b.firmanavn, "nb");
      case "bransje": return dir * (a.bransje || "").localeCompare(b.bransje || "", "nb");
      case "kundestatus": return dir * a.kundestatus.localeCompare(b.kundestatus, "nb");
      case "kundeansvarlig": return dir * (a.kundeansvarlig || "").localeCompare(b.kundeansvarlig || "", "nb");
      case "sist_aktivitet": return dir * (a.sist_aktivitet || "").localeCompare(b.sist_aktivitet || "");
      default: return 0;
    }
  });

  return (
    <PageShell title="Selskaper" subtitle="Alle selskaper i CRM-et">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Søk selskaper..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">{filtered.length} selskaper</span>
      </div>

      {isMobile ? (
        <div className="space-y-2">
          {filtered.map(s => (
            <div
              key={s.id}
              className="bg-card border rounded-xl p-4 space-y-1 cursor-pointer active:bg-muted/50"
              onClick={() => navigate(`/selskaper/${s.id}`)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CompanyLogo domain={s.domene} firmanavn={s.firmanavn} kontaktEmails={kontakter.filter(k => k.selskap_id === s.id).map(k => k.e_post)} size="sm" />
                  <p className="font-semibold text-sm truncate">{s.firmanavn}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${kundestatusColors[s.kundestatus]}`}>
                  {s.kundestatus}
                </Badge>
                {partnerNavn(s.partner_id) && (
                  <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                    Kunde hos {partnerNavn(s.partner_id)}
                  </Badge>
                )}
                {s.bransje && <span className="text-xs text-muted-foreground">{s.bransje}</span>}
              </div>
              {s.kundeansvarlig && (
                <p className="text-xs text-muted-foreground">Ansvarlig: {s.kundeansvarlig}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                {([
                  ["firmanavn", "Selskap"],
                  ["bransje", "Bransje"],
                  ["kundestatus", "Status"],
                  ["kundeansvarlig", "Ansvarlig"],
                  ["sist_aktivitet", "Sist aktivitet"],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left font-semibold text-muted-foreground cursor-pointer select-none hover:bg-muted/80 transition-colors"
                    onClick={() => toggleSort(key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label} <SortIcon col={key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/selskaper/${s.id}`)}
                >
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <CompanyLogo domain={s.domene} firmanavn={s.firmanavn} kontaktEmails={kontakter.filter(k => k.selskap_id === s.id).map(k => k.e_post)} size="sm" />
                      {s.firmanavn}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.bransje || "–"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] ${kundestatusColors[s.kundestatus]}`}>
                        {s.kundestatus}
                      </Badge>
                      {partnerNavn(s.partner_id) && (
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                          via {partnerNavn(s.partner_id)}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.kundeansvarlig || "–"}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {s.sist_aktivitet || "–"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Ingen selskaper funnet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
