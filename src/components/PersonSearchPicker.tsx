import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { User, X } from "lucide-react";

interface Person {
  id: string;
  label: string;
  type: "kontakt" | "e-post";
}

interface PersonSearchPickerProps {
  persons: Person[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export default function PersonSearchPicker({ persons, value, onChange, placeholder = "Søk etter person..." }: PersonSearchPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = persons.find(p => p.id === value);

  const filtered = query.trim()
    ? persons.filter(p => p.label.toLowerCase().includes(query.toLowerCase())).slice(0, 20)
    : persons.slice(0, 20);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-background">
        <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 truncate">{selected.label}</span>
        <button type="button" onClick={() => onChange("")} className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder={placeholder}
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.map(p => (
            <button
              key={p.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center gap-2"
              onClick={() => { onChange(p.id); setQuery(""); setOpen(false); }}
            >
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{p.label}</span>
              {p.type === "e-post" && <span className="text-[10px] text-muted-foreground ml-auto shrink-0">E-post</span>}
            </button>
          ))}
        </div>
      )}
      {open && filtered.length === 0 && query.trim() && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-lg shadow-lg p-3 text-sm text-muted-foreground">
          Ingen treff
        </div>
      )}
    </div>
  );
}
