import { describe, expect, it } from "vitest";
import { renderCaption } from "../src/templates/text.js";

describe("renderCaption", () => {
  it("renders populated fields and omits empty fields", () => {
    const caption = renderCaption({
      eventIds: ["event-1"],
      camera: "front",
      severity: "alert",
      objects: ["person"],
      zones: [],
      subLabels: [],
      lastUpdatedAt: Date.parse("2026-04-13T10:00:00.000Z")
    });

    expect(caption).toContain("Frigate: alert");
    expect(caption).toContain("Camara: front");
    expect(caption).toContain("Objetos: person");
    expect(caption).toContain("Hora: 13/04/2026 06:00:00");
    expect(caption).not.toContain("Zonas:");
  });
});
