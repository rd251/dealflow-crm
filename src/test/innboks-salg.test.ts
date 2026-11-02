import { describe, it, expect } from "vitest";
import { finnSelskap, foreslaaSelskap, aapenSalgsmulighet, navnFraDomene } from "@/lib/innboks-salg";

const selskaper = [
  { id: "a", firmanavn: "Boels Rental", domene: "boels.de" },
  { id: "b", firmanavn: "Consto AS", domene: "" },
];

describe("Salgsmulighet fra Innboks", () => {
  it("gjenbruker selskap ved likt navn", () => {
    expect(finnSelskap(selskaper, "consto as", "x.no")?.id).toBe("b");
  });
  it("gjenbruker selskap ved likt domene", () => {
    expect(finnSelskap(selskaper, "Boels", "boels.de")?.id).toBe("a");
  });
  it("matcher ikke på generiske domener som gmail.com", () => {
    expect(finnSelskap([{ id: "g", firmanavn: "X", domene: "gmail.com" }], "Ny", "gmail.com")).toBeNull();
  });
  it("foreslår selskap fra e-postdomenet når personen ikke er koblet", () => {
    expect(foreslaaSelskap(selskaper, "lars@boels.de")?.id).toBe("a");
    expect(foreslaaSelskap(selskaper, "x@consto.no")?.id).toBe("b");
    expect(foreslaaSelskap(selskaper, "x@gmail.com")).toBeNull();
  });
  it("koblet selskap vinner over domeneforslag", () => {
    expect(foreslaaSelskap(selskaper, "lars@boels.de", "b")?.id).toBe("b");
  });
  it("navn fra domene", () => {
    expect(navnFraDomene("lars@boels.de")).toBe("Boels");
  });
  it("finner åpen salgsmulighet, ikke vunnet eller tapt", () => {
    const sm = [
      { id: "1", navn: "Gammel", selskap_id: "a", status: "Vunnet" },
      { id: "2", navn: "Tapt", selskap_id: "a", status: "Tapt" },
      { id: "3", navn: "Åpen", selskap_id: "a", status: "Tilbud sendt" },
    ];
    expect(aapenSalgsmulighet(sm, "a")?.id).toBe("3");
    expect(aapenSalgsmulighet(sm.slice(0, 2), "a")).toBeNull();
  });
});
