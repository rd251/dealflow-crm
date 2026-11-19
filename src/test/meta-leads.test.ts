import { describe, expect, it } from "vitest";
import { erMetaInnloggingUloept } from "@/lib/meta-leads";

describe("erMetaInnloggingUloept", () => {
  it("gjenkjenner utløpt Meta-økt", () => {
    expect(erMetaInnloggingUloept(
      'Graph API 401: {"error":{"message":"Error validating access token: Session has expired on Tuesday, 17-Nov-26 01:36:48 PST.","type":"OAuthException","code":190,"error_subcode":463}}',
    )).toBe(true);
  });

  it("gjenkjenner ugyldig tilgangstoken", () => {
    expect(erMetaInnloggingUloept("Graph API 401: Invalid OAuth access token")).toBe(true);
  });

  it("er tom for tom og manglende feil", () => {
    expect(erMetaInnloggingUloept(null)).toBe(false);
    expect(erMetaInnloggingUloept(undefined)).toBe(false);
    expect(erMetaInnloggingUloept("")).toBe(false);
  });

  it("blandet ikke innleadingsfeil og manglende tilgang med utløpt innlogging", () => {
    expect(erMetaInnloggingUloept("Innsendingen mangler navn, firmanavn og e-post")).toBe(false);
    expect(erMetaInnloggingUloept('Graph API 403: {"error":{"message":"Requires permission","code":200}}')).toBe(false);
    expect(erMetaInnloggingUloept("Graph API 500: server error")).toBe(false);
  });
});
