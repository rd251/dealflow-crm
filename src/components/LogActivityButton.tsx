import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import LogActivityDialog from "@/components/LogActivityDialog";
import type { ActivityTarget } from "@/lib/activity-logging";

interface KontaktOption { id: string; navn: string }

interface Props {
  target?: ActivityTarget;
  /** Global variant: brukeren velger tilknytning i dialogen. */
  allowTargetPick?: boolean;
  entityName?: string;
  kontaktListe?: KontaktOption[];
  /** Utgått – hurtighandlinger er erstattet av den felles loggkomponenten. */
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
  size = "sm",
  variant = "outline",
  label = "Logg aktivitet",
  className,
  onLogged,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Button size={size === "icon" ? "icon" : size} variant={variant} className={size === "icon" ? undefined : "gap-1.5"} onClick={() => setOpen(true)}>
        <Plus className={size === "icon" ? "w-4 h-4" : "w-3.5 h-3.5"} />
        {size !== "icon" && label}
      </Button>

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
