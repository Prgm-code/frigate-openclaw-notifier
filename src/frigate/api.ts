import { mkdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export class FrigateApi {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchTimeoutMs: number
  ) {}

  async downloadSnapshot(eventId: string, outputDir: string): Promise<string | null> {
    return this.download(`/events/${encodeURIComponent(eventId)}/snapshot.jpg`, outputDir, `${safeName(eventId)}.jpg`);
  }

  async downloadClip(eventId: string, outputDir: string): Promise<string | null> {
    return this.download(`/events/${encodeURIComponent(eventId)}/clip.mp4`, outputDir, `${safeName(eventId)}.mp4`);
  }

  private async download(path: string, outputDir: string, fileName: string): Promise<string | null> {
    const url = new URL(path.replace(/^\//, ""), ensureTrailingSlash(this.baseUrl));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return null;
      }

      await mkdir(outputDir, { recursive: true });
      const outputPath = join(outputDir, basename(fileName));
      const body = Buffer.from(await response.arrayBuffer());
      await writeFile(outputPath, body);
      return outputPath;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}
