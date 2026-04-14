import { readdir, rm, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { Logger } from "../logger.js";

const mediaExtensions = new Set([".jpg", ".jpeg", ".png", ".mp4", ".webp"]);

export async function cleanupOldMedia(mediaTmpDir: string, retentionSeconds: number, logger: Logger, now = Date.now()): Promise<void> {
  if (retentionSeconds <= 0) {
    return;
  }

  const base = normalize(mediaTmpDir);
  let entries: string[];
  try {
    entries = await readdir(base);
  } catch {
    return;
  }

  let removed = 0;
  const retentionMs = retentionSeconds * 1000;

  for (const entry of entries) {
    if (!mediaExtensions.has(extname(entry).toLowerCase())) {
      continue;
    }

    const filePath = normalize(join(base, entry));
    if (!filePath.startsWith(base)) {
      continue;
    }

    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile() || now - fileStat.mtimeMs < retentionMs) {
        continue;
      }

      await rm(filePath, { force: true });
      removed += 1;
    } catch (error) {
      logger.warn("media_cleanup_file_failed", {
        path: filePath,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (removed > 0) {
    logger.info("media_cleanup_completed", { mediaTmpDir: base, removed });
  }
}

export async function removeMediaFiles(paths: Array<string | undefined>, logger: Logger): Promise<void> {
  for (const path of paths) {
    if (!path) {
      continue;
    }

    try {
      await rm(path, { force: true });
      logger.info("media_file_removed", { path });
    } catch (error) {
      logger.warn("media_file_remove_failed", {
        path,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}
