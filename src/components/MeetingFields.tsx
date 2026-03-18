import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Search, Users } from "lucide-react";

interface Kontakt {
  id: string;
  navn: string;
}

interface MeetingFieldsProps {
  tittel: string;
  startTid: string;
  sluttTid: string;
  dato: string;
  onTittelChange: (v: string) => void;
  onStartTidChange: (v: string) => void;
  onSluttTidChange: (v: string) => void;
  onDatoChange: (v: string) => void;
  deltakere?: string[];
  onDeltakereChange?: (ids: string[]) => void;
  kontaktListe?: Kontakt[];
}

export default function MeetingFields({
  tittel, startTid, sluttTid, dato,
  onTittelChange, onStartTidChange, onSluttTidChange, onDatoChange,
  deltakere = [], onDeltakereChange, kontaktListe = [],
}: MeetingFieldsProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = kontaktListe.filter(
    k => !deltakere.includes(k.id) && k.navn.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addDeltaker = (id: string) => {
    onDeltakereChange?.([...deltakere, id]);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const removeDeltaker = (id: string) => {
    onDeltakereChange?.(deltakere.filter(d => d !== id));
  };

  const getDeltakerNavn = (id: string) => kontaktListe.find(k => k.id === id)?.navn || id;

  return (
    <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
      <div>
        <Label className="text-xs">Tittel</Label>
        <Input
          value={tittel}
          onChange={e => onTittelChange(e.target.value)}
          placeholder="Møtetittel..."
          className="h-8 text-sm mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Dato</Label>
        <Input
          type="date"
          value={dato}
          onChange={e => onDatoChange(e.target.value)}
          className="h-8 text-sm mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Starttid</Label>
          <Input
            type="time"
            value={startTid}
            onChange={e => onStartTidChange(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
        <div>
          <Label className="text-xs">Sluttid</Label>
          <Input
            type="time"
            value={sluttTid}
            onChange={e => onSluttTidChange(e.target.value)}
            className="h-8 text-sm mt-1"
          />
        </div>
      </div>

      {/* Deltakere (kontakter) */}
      {onDeltakereChange && (
        <div>
          <Label className="text-xs flex items-center gap-1">
            <Users className="w-3 h-3" /> Deltakere
          </Label>
          {deltakere.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {deltakere.map(id => (
                <Badge key={id} variant="secondary" className="text-xs gap-1 pr-1">
                  {getDeltakerNavn(id)}
                  <button
                    type="button"
                    onClick={() => removeDeltaker(id)}
                    className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
          <div className="relative mt-1.5" ref={dropdownRef}>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                placeholder="Søk kontakt..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                className="h-8 text-sm pl-7"
              />
            </div>
            {searchOpen && filtered.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-md border bg-popover shadow-md">
                {filtered.map(k => (
                  <button
                    key={k.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    onClick={() => addDeltaker(k.id)}
                  >
                    {k.navn}
                  </button>
                ))}
              </div>
            )}
            {searchOpen && searchQuery && filtered.length === 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md px-3 py-2 text-xs text-muted-foreground">
                Ingen kontakter funnet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
