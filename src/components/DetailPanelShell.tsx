import { ReactNode, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface DetailPanelShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onTitleChange?: (value: string) => void;
  subtitle?: string;
  initials?: string;
  badges?: ReactNode;
  actions?: ReactNode;
  /** Legacy: flat children (no tabs). Use tabContent instead for tabbed layout. */
  children?: ReactNode;
  /** Tabbed content: { detaljer, interaksjoner, notater } */
  tabContent?: {
    detaljer?: ReactNode;
    selskap?: ReactNode;
    kontakt?: ReactNode;
    interaksjoner?: ReactNode;
    notater?: ReactNode;
    kalender?: ReactNode;
    dokumenter?: ReactNode;
  };
  activeTab?: TabKey;
  onActiveTabChange?: (tab: TabKey) => void;
}

export type TabKey = "detaljer" | "selskap" | "kontakt" | "interaksjoner" | "notater" | "kalender" | "dokumenter";

const TAB_KEYS = ["detaljer", "selskap", "kontakt", "interaksjoner", "notater", "kalender", "dokumenter"] as const;
const TAB_LABELS: Record<(typeof TAB_KEYS)[number], string> = {
  detaljer: "Detaljer",
  selskap: "Selskap",
  kontakt: "Kontakt",
  interaksjoner: "Interaksjoner",
  notater: "Notater",
  kalender: "Kalender",
  dokumenter: "Dokumenter",
};

export default function DetailPanelShell({
  open,
  onClose,
  title,
  onTitleChange,
  subtitle,
  initials,
  badges,
  actions,
  children,
  tabContent,
}: DetailPanelShellProps) {
  const [activeTab, setActiveTab] = useState<(typeof TAB_KEYS)[number]>("detaljer");

  const useTabs = !!tabContent;
  // Only show tabs that have content
  const visibleTabs = useTabs
    ? TAB_KEYS.filter(k => tabContent![k])
    : [];

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
                {onTitleChange ? (
                  <input
                    className="text-xl font-semibold tracking-tight truncate bg-transparent border-none outline-none focus:ring-1 focus:ring-primary/30 rounded px-0 w-full"
                    value={title}
                    onChange={e => onTitleChange(e.target.value)}
                  />
                ) : (
                  <h2 className="text-xl font-semibold tracking-tight truncate">{title}</h2>
                )}
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

          {/* Tabs bar */}
          {useTabs && visibleTabs.length > 1 && (
            <div className="border-b px-6 flex flex-wrap gap-0">
              {visibleTabs.map(key => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium transition-colors relative",
                    activeTab === key
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {TAB_LABELS[key]}
                  {activeTab === key && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Content sections */}
          <div className="px-6 py-5 space-y-5">
            {useTabs ? tabContent![activeTab] : children}
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
