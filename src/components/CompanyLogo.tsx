import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  domain?: string;
  firmanavn?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
};

const iconSizes = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
};

const faviconUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

export default function CompanyLogo({ domain, firmanavn, size = "md", className }: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);

  const effectiveDomain = domain || (firmanavn ? guessDomain(firmanavn) : "");

  if (!effectiveDomain || imgError) {
    return (
      <div className={cn("rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0", sizeClasses[size], className)}>
        <Building2 className={iconSizes[size]} />
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden", sizeClasses[size], className)}>
      <img
        src={faviconUrl(effectiveDomain)}
        alt={firmanavn || effectiveDomain}
        className="w-6 h-6 object-contain"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

/** Best-effort: turn "Acme AS" → "acme.no", "Google" → "google.com" */
function guessDomain(name: string): string {
  const clean = name
    .replace(/\b(AS|ASA|ANS|DA|ENK|SA|NUF|KS|BA|IKS|SF|Ltd|GmbH|Inc|LLC|AB|ApS|Oy|BV|SRL|SAS)\b/gi, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  return clean ? `${clean}.com` : "";
}

export { guessDomain };
