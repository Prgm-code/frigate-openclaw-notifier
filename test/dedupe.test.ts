import { describe, expect, it } from "vitest";
import { DedupeStore } from "../src/dedupe/store.js";

describe("DedupeStore", () => {
  it("suppresses identical content", () => {
    const store = new DedupeStore(90_000);
    store.mark("r1", "hello", 1000);
    expect(store.check("r1", "hello", 2000)).toEqual({ duplicate: true, reason: "same_content" });
  });

  it("suppresses changed content inside cooldown", () => {
    const store = new DedupeStore(90_000);
    store.mark("r1", "hello", 1000);
    expect(store.check("r1", "changed", 2000)).toEqual({ duplicate: true, reason: "cooldown" });
  });

  it("allows changed content after cooldown", () => {
    const store = new DedupeStore(90_000);
    store.mark("r1", "hello", 1000);
    expect(store.check("r1", "changed", 100_000)).toEqual({ duplicate: false });
  });

  it("suppresses content while a send is in flight", () => {
    const store = new DedupeStore(90_000);
    store.markInFlight("r1", "hello", 1000);
    expect(store.check("r1", "changed", 2000)).toEqual({ duplicate: true, reason: "in_flight" });
  });
});
