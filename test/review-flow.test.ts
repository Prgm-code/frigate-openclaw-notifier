import { describe, expect, it, vi } from "vitest";

vi.mock("../src/media/video.js", () => ({
  processVideoForWhatsapp: vi.fn(async (_ffmpegBin: string, _inputPath: string, outputPath: string) => outputPath)
}));

import { NotifierApp } from "../src/app.js";
import { DedupeStore } from "../src/dedupe/store.js";
import { EventCorrelator } from "../src/frigate/correlator.js";
import { Logger } from "../src/logger.js";
import { MediaResolver } from "../src/media/resolver.js";
import { OpenClawCli } from "../src/openclaw/cli.js";
import { makeConfig } from "./helpers.js";

const cameras = ["Cam01", "Cam02", "Cam03", "Cam04"];

describe("review notification flow", () => {
  it.each(cameras)("uses review detection media for %s", async (camera) => {
    const media = new FakeMediaResolver();
    const openclaw = new FakeOpenClaw();
    const app = new NotifierApp(
      makeConfig({
        allowedCameras: cameras,
        allowedObjects: ["person", "car"],
        sendClip: true,
        openclawTargets: ["test-target"]
      }),
      nullLogger,
      new EventCorrelator(),
      new DedupeStore(90_000),
      media as unknown as MediaResolver,
      openclaw as unknown as OpenClawCli
    );

    await app.handleReview(
      JSON.stringify({
        type: "new",
        after: {
          id: `review-${camera}`,
          camera,
          severity: "alert",
          data: {
            detections: [`event-${camera}`],
            objects: ["person"],
            zones: []
          }
        }
      })
    );
    await Promise.resolve();

    expect(media.snapshots).toEqual([{ camera, eventId: `event-${camera}` }]);
    expect(media.clips).toEqual([`event-${camera}`]);
    expect(openclaw.media).toHaveLength(2);
    expect(openclaw.media.map((send) => send.mediaPath)).toEqual(["/tmp/event-snapshot.jpg", "/tmp/event-clip_processed.mp4"]);
    expect(openclaw.text).toHaveLength(0);
  });

  it("does not notify cameras outside ALLOWED_CAMERAS", async () => {
    const media = new FakeMediaResolver();
    const openclaw = new FakeOpenClaw();
    const app = new NotifierApp(
      makeConfig({ allowedCameras: cameras, allowedObjects: ["person"] }),
      nullLogger,
      new EventCorrelator(),
      new DedupeStore(90_000),
      media as unknown as MediaResolver,
      openclaw as unknown as OpenClawCli
    );

    await app.handleReview(
      JSON.stringify({
        type: "new",
        after: {
          id: "review-unknown",
          camera: "Cam99",
          severity: "alert",
          data: {
            detections: ["event-unknown"],
            objects: ["person"]
          }
        }
      })
    );

    expect(media.snapshots).toHaveLength(0);
    expect(media.clips).toHaveLength(0);
    expect(openclaw.media).toHaveLength(0);
    expect(openclaw.text).toHaveLength(0);
  });
});

class FakeMediaResolver {
  readonly snapshots: Array<{ camera: string | undefined; eventId: string | undefined }> = [];
  readonly clips: Array<string | undefined> = [];

  async resolveSnapshot(camera: string | undefined, eventId: string | undefined): Promise<{ kind: "snapshot"; path: string }> {
    this.snapshots.push({ camera, eventId });
    return { kind: "snapshot", path: "/tmp/event-snapshot.jpg" };
  }

  async resolveClipWithRetry(eventId: string | undefined): Promise<{ kind: "clip"; path: string }> {
    this.clips.push(eventId);
    return { kind: "clip", path: "/tmp/event-clip.mp4" };
  }

  processedClipPath(): string {
    return "/tmp/event-clip_processed.mp4";
  }
}

class FakeOpenClaw {
  readonly text: string[] = [];
  readonly media: Array<{ mediaPath: string; caption?: string }> = [];

  async sendText(_target: string, message: string): Promise<{ ok: true; channel: "whatsapp"; to: string }> {
    this.text.push(message);
    return { ok: true, channel: "whatsapp", to: _target };
  }

  async sendMedia(_target: string, mediaPath: string, caption?: string): Promise<{ ok: true; channel: "whatsapp"; to: string }> {
    this.media.push({ mediaPath, caption });
    return { ok: true, channel: "whatsapp", to: _target };
  }
}

const nullLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};
