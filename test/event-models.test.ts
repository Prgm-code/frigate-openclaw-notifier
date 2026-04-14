import { describe, expect, it } from "vitest";
import { getFrigateEventState, parseFrigateEventMessage, parseReviewMessage, selectEventId } from "../src/frigate/event-models.js";
import { testEnv } from "./helpers.js";

describe("review messages", () => {
  it("parses a valid review message", () => {
    const message = parseReviewMessage(JSON.stringify({ type: "new", after: { id: "r1", data: { detections: ["e1"] } } }));
    expect(message.type).toBe("new");
    expect(message.after?.id).toBe("r1");
  });

  it("selects the first detection id", () => {
    const message = parseReviewMessage(JSON.stringify({ type: "new", after: { id: "r1", data: { detections: ["e1", "e2"] } } }));
    expect(selectEventId(message)).toBe("e1");
  });

  it("rejects unknown review types", () => {
    expect(() => parseReviewMessage(JSON.stringify({ type: "bad" }))).toThrow(/type/);
  });
});

describe("frigate events", () => {
  it("parses direct new events from frigate/events", () => {
    const message = parseFrigateEventMessage(
      JSON.stringify({ type: "new", id: "event-1", camera: testEnv.cameraName, label: "person", current_zones: [testEnv.eventZone], has_clip: true })
    );
    const state = getFrigateEventState(message);
    expect(state.id).toBe("event-1");
    expect(state.camera).toBe(testEnv.cameraName);
    expect(state.label).toBe("person");
    expect(state.current_zones).toEqual([testEnv.eventZone]);
    expect(state.has_clip).toBe(true);
  });

  it("uses after payload for update events from frigate/events", () => {
    const message = parseFrigateEventMessage(JSON.stringify({ type: "update", after: { id: "event-2", camera: testEnv.secondCameraName, label: "person" } }));
    expect(getFrigateEventState(message).id).toBe("event-2");
  });
});
