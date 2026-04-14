import { access } from "node:fs/promises";
import { basename, join, normalize, parse } from "node:path";
import { NotifierConfig } from "../config/schema.js";
import { FrigateApi } from "../frigate/api.js";

export type MediaKind = "snapshot" | "clip";

export interface ResolvedMedia {
  kind: MediaKind;
  path: string;
}

export class MediaResolver {
  constructor(
    private readonly config: NotifierConfig,
    private readonly frigateApi: FrigateApi
  ) {}

  async resolve(camera: string | undefined, eventId: string | undefined): Promise<ResolvedMedia | null> {
    if (!eventId) {
      return null;
    }

    if (this.config.sendSnapshot) {
      const snapshot = await this.resolveSnapshot(camera, eventId);
      if (snapshot) {
        return snapshot;
      }
    }

    if (this.config.sendClip) {
      const clip = await this.resolveClip(eventId);
      if (clip) {
        return clip;
      }
    }

    return null;
  }

  async resolveSnapshot(camera: string | undefined, eventId: string | undefined): Promise<ResolvedMedia | null> {
    if (!eventId) {
      return null;
    }

    const snapshot = await this.frigateApi.downloadSnapshot(eventId, this.config.mediaTmpDir);
    if (snapshot) {
      return { kind: "snapshot", path: snapshot };
    }

    const localSnapshot = await this.resolveLocalSnapshot(camera, eventId);
    if (localSnapshot) {
      return { kind: "snapshot", path: localSnapshot };
    }

    return null;
  }

  async resolveClip(eventId: string | undefined): Promise<ResolvedMedia | null> {
    if (!eventId) {
      return null;
    }

    const clip = await this.frigateApi.downloadClip(eventId, this.config.mediaTmpDir);
    return clip ? { kind: "clip", path: clip } : null;
  }

  async resolveClipWithRetry(eventId: string | undefined): Promise<ResolvedMedia | null> {
    const attempts = Math.max(1, Math.floor(this.config.clipRetryAttempts));
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const clip = await this.resolveClip(eventId);
      if (clip) {
        return clip;
      }

      if (attempt < attempts) {
        await delay(this.config.clipRetryDelayMs);
      }
    }

    return null;
  }

  processedClipPath(inputPath: string): string {
    const parsed = parse(basename(inputPath));
    return join(this.config.mediaTmpDir, `${safeName(parsed.name)}_processed.mp4`);
  }

  private async resolveLocalSnapshot(camera: string | undefined, eventId: string): Promise<string | null> {
    if (!this.config.frigateUseLocalMedia || !camera) {
      return null;
    }

    const base = normalize(this.config.frigateLocalClipsDir);
    const candidate = normalize(join(base, `${safeName(camera)}-${safeName(eventId)}.jpg`));
    if (!candidate.startsWith(base)) {
      return null;
    }

    try {
      await access(candidate);
      return candidate;
    } catch {
      return null;
    }
  }
}

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
