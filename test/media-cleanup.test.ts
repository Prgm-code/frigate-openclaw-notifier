import { mkdtemp, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLogger } from "../src/logger.js";
import { cleanupOldMedia } from "../src/media/cleanup.js";

describe("cleanupOldMedia", () => {
  it("removes old media files and keeps recent media files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "frigate-openclaw-test-"));
    const oldPath = join(dir, "old.jpg");
    const recentPath = join(dir, "recent.mp4");
    const textPath = join(dir, "keep.txt");

    await writeFile(oldPath, "old");
    await writeFile(recentPath, "recent");
    await writeFile(textPath, "text");

    const now = Date.now();
    const oldDate = new Date(now - 7200_000);
    await utimes(oldPath, oldDate, oldDate);
    await utimes(textPath, oldDate, oldDate);

    await cleanupOldMedia(dir, 3600, createLogger("error"), now);

    await expect(stat(oldPath)).rejects.toThrow();
    await expect(stat(recentPath)).resolves.toBeTruthy();
    await expect(stat(textPath)).resolves.toBeTruthy();
  });
});
