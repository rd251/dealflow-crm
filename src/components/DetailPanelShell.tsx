import { ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface DetailPanelShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initials?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export default function DetailPanelShell({
  open,
  onClose,
  title,
  subtitle,
  initials,
  badges,
  actions,
  children,
}: DetailPanelShellProps) {
  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:w-[440px] sm:max-w-[540px] overflow-y-auto p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col">
          {/* Hero header */}
          <div className="px-6 pt-10 pb-5 border-b">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-base shrink-0">
                {initials || title.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-semibold tracking-tight truncate">{title}</h2>
                {subtitle && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>

            {badges && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3">{badges}</div>
            )}

            {actions && (
              <div className="flex flex-wrap gap-2 mt-4">{actions}</div>
            )}
          </div>

          {/* Content sections */}
          <div className="px-6 py-5 space-y-5">
            {children}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function DetailSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {title && (
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h3>
      )}
      {children}
    </div>
  );
}

export function DetailField({
  label,
  children,
  value,
}: {
  label: string;
  children?: ReactNode;
  value?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children || <div className="text-sm">{value || "–"}</div>}
    </div>
  );
}

export function DetailDivider() {
  return <div className="border-t" />;
}

export function DetailStatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

export function DetailStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
