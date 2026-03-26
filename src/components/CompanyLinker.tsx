import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCrmStore } from "@/hooks/use-crm-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Building2, Plus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface CompanyLinkerProps {
  email: string;
  kontaktId: string | null;
  currentSelskapId: string | null;
  personNavn: string;
  onLinked: () => void;
}

export default function CompanyLinker({ email, kontaktId, currentSelskapId, personNavn, onLinked }: CompanyLinkerProps) {
  const { selskaper, refresh } = useCrmStore();
  const [search, setSearch] = useState("");
  const [linking, setLinking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const domain = email.split("@")[1] || "";
  const domainBase = domain.split(".")[0] || "";

  // Smart match: find selskaper whose name contains the domain base
  const suggestions = useMemo(() => {
    if (!domainBase || domainBase.length < 2) return [];
    const q = domainBase.toLowerCase();
    return selskaper.filter(s =>
      s.firmanavn.toLowerCase().includes(q)
    ).slice(0, 3);
  }, [selskaper, domainBase]);

  // Search results
  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    return selskaper.filter(s =>
      s.firmanavn.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [selskaper, search]);

  const currentSelskap = currentSelskapId
    ? selskaper.find(s => s.id === currentSelskapId)
    : null;

  // Ensure kontakt exists, then link to selskap
  const linkToSelskap = async (selskapId: string) => {
    setLinking(true);
    try {
      let actualKontaktId = kontaktId;

      if (!actualKontaktId) {
        // Check if kontakt already exists with this email
        const { data: existing } = await supabase
          .from("kontakter")
          .select("id")
          .eq("e_post", email)
          .maybeSingle();

        if (existing) {
          actualKontaktId = existing.id;
        } else {
          // Create kontakt
          const { data: newKontakt, error } = await supabase
            .from("kontakter")
            .insert({
              navn: personNavn !== email ? personNavn : email.split("@")[0],
              e_post: email,
              selskap_id: selskapId,
            })
            .select()
            .single();

          if (error) throw error;
          actualKontaktId = newKontakt.id;
        }
      }

      // Update kontakt's selskap_id
      if (actualKontaktId) {
        const { error } = await supabase
          .from("kontakter")
          .update({ selskap_id: selskapId })
          .eq("id", actualKontaktId);
        if (error) throw error;
      }

      // Update email_contacts selskap_id
      await supabase
        .from("email_contacts")
        .update({ selskap_id: selskapId, kontakt_id: actualKontaktId })
        .eq("primary_email", email);

      toast.success("Kontakt koblet til selskap");
      refresh();
      onLinked();
    } catch (err: any) {
      toast.error("Kunne ikke koble: " + (err.message || "Ukjent feil"));
    } finally {
      setLinking(false);
    }
  };

  const unlinkSelskap = async () => {
    setLinking(true);
    try {
      if (kontaktId) {
        await supabase
          .from("kontakter")
          .update({ selskap_id: null })
          .eq("id", kontaktId);
      }
      await supabase
        .from("email_contacts")
        .update({ selskap_id: null })
        .eq("primary_email", email);

      toast.success("Selskapstilknytning fjernet");
      refresh();
      onLinked();
    } catch (err: any) {
      toast.error("Kunne ikke fjerne kobling: " + (err.message || "Ukjent feil"));
    } finally {
      setLinking(false);
    }
  };

  const createAndLink = async () => {
    setCreating(true);
    try {
      // Capitalize domain base as company name suggestion
      const suggestedName = domainBase.charAt(0).toUpperCase() + domainBase.slice(1);

      const { data: newSelskap, error } = await supabase
        .from("selskaper")
        .insert({
          firmanavn: suggestedName,
          kundestatus: "Ikke kunde" as any,
        })
        .select()
        .single();

      if (error) throw error;

      // Now link to the new selskap
      await linkToSelskap(newSelskap.id);
      toast.success(`Selskap "${suggestedName}" opprettet og koblet`);
    } catch (err: any) {
      toast.error("Kunne ikke opprette selskap: " + (err.message || "Ukjent feil"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        Knytt til selskap
      </div>

      {/* Current link */}
      {currentSelskap && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium flex-1">{currentSelskap.firmanavn}</span>
          <Badge variant="outline" className="text-xs">{currentSelskap.kundestatus}</Badge>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={unlinkSelskap}
            disabled={linking}
            title="Fjern kobling"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Smart suggestions */}
      {!currentSelskap && suggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            Forslag basert på @{domain}
          </div>
          {suggestions.map(s => (
            <button
              key={s.id}
              className="w-full flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              onClick={() => linkToSelskap(s.id)}
              disabled={linking}
            >
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">{s.firmanavn}</span>
              <Badge variant="outline" className="text-xs">{s.kundestatus}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Search / manual select */}
      {!currentSelskap && (
        <>
          {showSearch ? (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Søk selskaper..."
                  className="pl-8 h-8 text-sm"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              {searchResults.length > 0 && (
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {searchResults.map(s => (
                    <button
                      key={s.id}
                      className="w-full flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 transition-colors text-left"
                      onClick={() => linkToSelskap(s.id)}
                      disabled={linking}
                    >
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1">{s.firmanavn}</span>
                      <Badge variant="outline" className="text-[10px]">{s.kundestatus}</Badge>
                    </button>
                  ))}
                </div>
              )}
              {search.length >= 2 && searchResults.length === 0 && (
                <div className="text-xs text-muted-foreground py-2 text-center">
                  Ingen selskaper funnet
                </div>
              )}
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowSearch(true)}
            >
              <Search className="w-3.5 h-3.5" />
              Søk etter selskap
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2"
            onClick={createAndLink}
            disabled={creating}
          >
            <Plus className="w-3.5 h-3.5" />
            {creating ? "Oppretter..." : `Opprett nytt selskap (${domainBase})`}
          </Button>
        </>
      )}
    </div>
  );
}
