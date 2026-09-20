import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ONBOARDING_STEG, ONBOARDING_TYPER, type OnboardingType } from "@/lib/kundeforhold";

interface Props {
  onboardingType: string;
  fullforteSteg: string[];
  onEndreType: (type: OnboardingType) => void;
  onEndreSteg: (steg: string[]) => void;
}

export function stegListe(type: string): string[] {
  return ONBOARDING_STEG[(type as OnboardingType)] || ONBOARDING_STEG.Selvbetjening;
}

export function fremdrift(type: string, fullforte: string[]): { ferdig: number; totalt: number; prosent: number } {
  const alle = stegListe(type);
  const ferdig = alle.filter(s => fullforte.includes(s)).length;
  return { ferdig, totalt: alle.length, prosent: alle.length ? Math.round((ferdig / alle.length) * 100) : 0 };
}

export default function ProsjektFremdrift({ onboardingType, fullforteSteg, onEndreType, onEndreSteg }: Props) {
  const steg = stegListe(onboardingType);
  const f = fremdrift(onboardingType, fullforteSteg);

  const toggle = (navn: string, av: boolean) => {
    onEndreSteg(av ? [...fullforteSteg.filter(s => s !== navn), navn] : fullforteSteg.filter(s => s !== navn));
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="text-xs text-muted-foreground">Onboarding-type</span>
        <select
          className="w-full border rounded-md px-2 py-1.5 text-sm bg-background h-9 mt-0.5"
          value={onboardingType}
          onChange={e => onEndreType(e.target.value as OnboardingType)}
        >
          {ONBOARDING_TYPER.map(t => (
            <option key={t.verdi} value={t.verdi}>{t.verdi} — {t.beskrivelse}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground uppercase tracking-wide font-medium">Onboarding-steg</span>
          <span className="tabular-nums text-muted-foreground">{f.ferdig} av {f.totalt}</span>
        </div>
        <Progress value={f.prosent} className="h-1.5" />
        <div className="space-y-1.5 pt-1">
          {steg.map((s, i) => {
            const av = fullforteSteg.includes(s);
            return (
              <label key={s} className="flex items-center gap-2.5 rounded-lg border bg-muted/30 px-3 py-2 cursor-pointer">
                <Checkbox checked={av} onCheckedChange={c => toggle(s, !!c)} />
                <span className={`text-sm ${av ? "line-through text-muted-foreground" : ""}`}>
                  <span className="tabular-nums text-muted-foreground mr-1.5">{i + 1}.</span>{s}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
