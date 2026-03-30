import { useMemo } from "react";
import { useCrmStore } from "@/hooks/use-crm-store";

export interface MatchResult {
  matchType: "exact-email" | "name-company" | "company-name" | "domain" | "none";
  kontaktId: string | null;
  selskapId: string | null;
  selskapNavn: string;
  selskapStatus: string;
  suggestedSelskapId: string | null;
  suggestedSelskapNavn: string;
}

/**
 * Smart matching logic — resolves a person to CRM entities in priority order:
 * 1. Exact email → existing kontakt
 * 2. Name + company → existing kontakt
 * 3. Company name → existing selskap
 * 4. Email domain → existing selskap (fallback)
 */
export function useSmartMatch(email: string, navn: string, firmanavn: string): MatchResult {
  const { kontakter, selskaper } = useCrmStore();

  return useMemo(() => {
    const emailLower = email.toLowerCase();
    const domain = emailLower.split("@")[1] || "";
    const domainBase = domain.split(".")[0] || "";

    // 1. Exact email match against kontakter
    const kontaktByEmail = kontakter.find(k => k.e_post?.toLowerCase() === emailLower);
    if (kontaktByEmail) {
      const selskap = kontaktByEmail.selskap_id
        ? selskaper.find(s => s.id === kontaktByEmail.selskap_id)
        : null;
      return {
        matchType: "exact-email" as const,
        kontaktId: kontaktByEmail.id,
        selskapId: kontaktByEmail.selskap_id || null,
        selskapNavn: selskap?.firmanavn || "",
        selskapStatus: selskap?.kundestatus || "",
        suggestedSelskapId: null,
        suggestedSelskapNavn: "",
      };
    }

    // 2. Name + company match
    if (navn && firmanavn && navn !== email) {
      const navnLower = navn.toLowerCase();
      const firmaLower = firmanavn.toLowerCase();
      const kontaktByNameCompany = kontakter.find(k => {
        if (k.navn.toLowerCase() !== navnLower) return false;
        if (!k.selskap_id) return false;
        const s = selskaper.find(s => s.id === k.selskap_id);
        return s && s.firmanavn.toLowerCase() === firmaLower;
      });
      if (kontaktByNameCompany) {
        const selskap = selskaper.find(s => s.id === kontaktByNameCompany.selskap_id);
        return {
          matchType: "name-company" as const,
          kontaktId: kontaktByNameCompany.id,
          selskapId: kontaktByNameCompany.selskap_id || null,
          selskapNavn: selskap?.firmanavn || "",
          selskapStatus: selskap?.kundestatus || "",
          suggestedSelskapId: null,
          suggestedSelskapNavn: "",
        };
      }
    }

    // 3. Company name match
    if (firmanavn && firmanavn.length >= 2) {
      const firmaLower = firmanavn.toLowerCase();
      const selskapByName = selskaper.find(s => s.firmanavn.toLowerCase() === firmaLower);
      if (selskapByName) {
        return {
          matchType: "company-name" as const,
          kontaktId: null,
          selskapId: null,
          selskapNavn: "",
          selskapStatus: "",
          suggestedSelskapId: selskapByName.id,
          suggestedSelskapNavn: selskapByName.firmanavn,
        };
      }
    }

    // 4. Domain fallback — find selskaper where kontakter share the same domain
    if (domainBase && domainBase.length >= 2) {
      // Check selskaper whose name contains the domain base
      const domainLower = domainBase.toLowerCase();
      const selskapByDomain = selskaper.find(s =>
        s.firmanavn.toLowerCase().includes(domainLower)
      );
      if (selskapByDomain) {
        return {
          matchType: "domain" as const,
          kontaktId: null,
          selskapId: null,
          selskapNavn: "",
          selskapStatus: "",
          suggestedSelskapId: selskapByDomain.id,
          suggestedSelskapNavn: selskapByDomain.firmanavn,
        };
      }
    }

    return {
      matchType: "none",
      kontaktId: null,
      selskapId: null,
      selskapNavn: "",
      selskapStatus: "",
      suggestedSelskapId: null,
      suggestedSelskapNavn: "",
    };
  }, [email, navn, firmanavn, kontakter, selskaper]);
}
