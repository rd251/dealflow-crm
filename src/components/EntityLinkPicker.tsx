import { useState, useRef, useEffect } from "react";
import { Search, X, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface EntityOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface EntityLinkPickerProps {
  options: EntityOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  loading?: boolean;
}

export default function EntityLinkPicker({ options, value, onChange, placeholder = "Søk...", loading }: EntityLinkPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    o.sublabel?.toLowerCase().includes(query.toLowerCase())
  );

  if (value) {
    const selected = options.find(o => o.id === value);
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium truncate flex-1">{selected?.label || "..."}</span>
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => onChange(null)}>
          <X className="w-3 h-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1 w-full justify-start text-muted-foreground"
        onClick={() => setOpen(!open)}
      >
        <Link2 className="w-3 h-3" /> Koble til...
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-1.5">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                autoFocus
                placeholder={placeholder}
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="h-7 text-xs pl-7"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto">
            {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Laster...</div>}
            {!loading && filtered.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">Ingen treff</div>}
            {filtered.map(o => (
              <button
                key={o.id}
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                onClick={() => { onChange(o.id); setOpen(false); setQuery(""); }}
              >
                <span className="block truncate">{o.label}</span>
                {o.sublabel && <span className="block text-[10px] text-muted-foreground truncate">{o.sublabel}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
