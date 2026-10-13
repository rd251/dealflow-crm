import { describe, expect, it } from "vitest";
import { appendRobinHtml, escapeEmailHtml, robinSignatureHtml, robinSignatureText, withoutRobinSignature } from "../../supabase/functions/_shared/robin-signature";

describe("Robin email signature", () => {
  it("includes every approved contact field and clickable links", () => {
    const text = robinSignatureText();
    for (const value of ["Robin Sæter Diallo", "Head of sales & Partner", "Snakk Teknologi AS", "+47 934 38 816", "rd@snakk.ai", "snakk.ai", "Sørkedalsveien 6, 0369 Oslo"]) expect(text).toContain(value);
    const html = robinSignatureHtml();
    expect(html).toContain('href="tel:+4793438816"');
    expect(html).toContain('href="mailto:rd@snakk.ai"');
    expect(html).toContain("Head of sales &amp; Partner");
  });
  it("inserts inside the HTML body and never duplicates the full signature", () => {
    const once = appendRobinHtml("<html><body>Hello</body></html>");
    expect(appendRobinHtml(once)).toBe(once);
    expect(once.indexOf("data-snakk-signature")).toBeLessThan(once.indexOf("</body>"));
  });
  it("replaces a trailing old signature without deleting message content", () => {
    expect(withoutRobinSignature("Hei!\n\nMvh\nRobin Sæter Diallo\nSnakk AI")).toBe("Hei!");
    expect(withoutRobinSignature(`Hei!\n\n${robinSignatureText()}`)).toBe("Hei!");
    expect(withoutRobinSignature("Robin Sæter Diallo\nkan møte på tirsdag.")).toBe("Robin Sæter Diallo\nkan møte på tirsdag.");
    expect(withoutRobinSignature("Hei!\n\nKari Nordmann\nSnakk AI")).toContain("Kari Nordmann");
  });
  it("escapes user-entered HTML before creating Gmail markup", () => {
    expect(escapeEmailHtml('<script>alert("x")</script>')).toBe("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
  });
});