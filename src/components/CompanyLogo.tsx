import { useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  domain?: string;
  firmanavn?: string;
  /** Pass kontakter e_post values to extract real domain */
  kontaktEmails?: string[];
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

const imgSizes = {
  sm: "w-5 h-5",
  md: "w-6 h-6",
  lg: "w-7 h-7",
};

const faviconUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

/** Known generic email providers to skip */
const GENERIC_DOMAINS = /^(gmail\.com|hotmail\.com|outlook\.com|yahoo\.com|live\.com|icloud\.com|me\.com|msn\.com|aol\.com|protonmail\.com|proton\.me)$/i;

export default function CompanyLogo({ domain, firmanavn, kontaktEmails, size = "md", className }: CompanyLogoProps) {
  const [imgError, setImgError] = useState(false);

  // Priority: explicit domain → domain from kontakt emails → skip (no guess)
  let effectiveDomain = domain || "";

  if (!effectiveDomain && kontaktEmails?.length) {
    for (const email of kontaktEmails) {
      if (!email || !email.includes("@")) continue;
      const d = email.split("@")[1]?.toLowerCase();
      if (d && !GENERIC_DOMAINS.test(d)) {
        effectiveDomain = d;
        break;
      }
    }
  }

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
        className={cn("object-contain", imgSizes[size])}
        onError={() => setImgError(true)}
      />
    </div>
  );
}
