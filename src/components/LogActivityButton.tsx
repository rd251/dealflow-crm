import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import LogActivityDialog from "@/components/LogActivityDialog";
import { QUICK_ACTIONS, loggAktivitet, type ActivityTarget } from "@/lib/activity-logging";

interface KontaktOption { id: string; navn: string }

interface Props {
  target?: ActivityTarget;
  /** Global variant: brukeren velger tilknytning i dialogen. */
  allowTargetPick?: boolean;
  entityName?: string;
  kontaktListe?: KontaktOption[];
  /** Vis hurtighandlinger med ett trykk. */
  showQuickActions?: boolean;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  label?: string;
  className?: string;
  onLogged?: () => void;
}

export default function LogActivityButton({
  target,
  allowTargetPick,
  entityName,
  kontaktListe,
  showQuickActions,
  size = "sm",
  variant = "outline",
  label = "Logg aktivitet",
  className,
  onLogged,
}: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const kjørHurtig = async (id: string) => {
    const handling = QUICK_ACTIONS.find(q => q.id === id);
    if (!handling || !target) return;
    setBusy(id);
    try {
      await loggAktivitet({
        logg: handling.logg,
        target,
        tittel: handling.tittel,
        notat: handling.beskrivelse,
      });
      toast.success(`${handling.label} · logget`);
      onLogged?.();
    } catch (err) {
      console.error(err);
      toast.error("Kunne ikke logge aktiviteten");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button size={size === "icon" ? "icon" : size} variant={variant} className={size === "icon" ? undefined : "gap-1.5"} onClick={() => setOpen(true)}>
        <Plus className={size === "icon" ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {size !== "icon" && label}
      </Button>

      {showQuickActions && target && QUICK_ACTIONS.map(q => {
        const Icon = q.icon;
        return (
          <Button
            key={q.id}
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-xs border border-border"
            disabled={busy !== null}
            onClick={() => kjørHurtig(q.id)}
          >
            <Icon className={cn("w-3.5 h-3.5", q.tone)} />
            {q.label}
          </Button>
        );
      })}

      <LogActivityDialog
        open={open}
        onOpenChange={setOpen}
        target={target}
        allowTargetPick={allowTargetPick}
        entityName={entityName}
        kontaktListe={kontaktListe}
        onLogged={onLogged}
      />
    </div>
  );
}
