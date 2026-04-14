import { describe, expect, it } from "vitest";
import { shouldNotifyReview } from "../src/frigate/rules.js";
import { makeConfig } from "./helpers.js";

describe("rules", () => {
  it("allows configured alert reviews", () => {
    const decision = shouldNotifyReview(
      { type: "new", after: { id: "r1", camera: "front", severity: "alert", data: { objects: ["person"], zones: [] } } },
      makeConfig({ allowedCameras: ["front"], allowedObjects: ["person"] })
    );
    expect(decision.allowed).toBe(true);
  });

  it("blocks disabled update reviews", () => {
    const decision = shouldNotifyReview(
      { type: "update", after: { id: "r1", camera: "front", severity: "alert", data: { objects: ["person"] } } },
      makeConfig()
    );
    expect(decision).toEqual({ allowed: false, reason: "review_type_disabled" });
  });
});
