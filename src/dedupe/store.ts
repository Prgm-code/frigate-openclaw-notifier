import { createHash } from "node:crypto";

export interface DedupeDecision {
  duplicate: boolean;
  reason?: string;
}

interface DedupeEntry {
  notifiedAt: number;
  contentHash: string;
  inFlight: boolean;
}

export class DedupeStore {
  private readonly entries = new Map<string, DedupeEntry>();

  constructor(private readonly cooldownMs: number) {}

  check(key: string, content: string, now = Date.now()): DedupeDecision {
    this.prune(now);
    const hash = hashContent(content);
    const entry = this.entries.get(key);
    if (!entry) {
      return { duplicate: false };
    }

    if (entry.inFlight) {
      return { duplicate: true, reason: "in_flight" };
    }

    if (entry.contentHash === hash) {
      return { duplicate: true, reason: "same_content" };
    }

    if (now - entry.notifiedAt < this.cooldownMs) {
      return { duplicate: true, reason: "cooldown" };
    }

    return { duplicate: false };
  }

  mark(key: string, content: string, now = Date.now()): void {
    this.entries.set(key, {
      notifiedAt: now,
      contentHash: hashContent(content),
      inFlight: false
    });
  }

  markInFlight(key: string, content: string, now = Date.now()): void {
    this.entries.set(key, {
      notifiedAt: now,
      contentHash: hashContent(content),
      inFlight: true
    });
  }

  private prune(now: number): void {
    for (const [key, value] of this.entries) {
      if (now - value.notifiedAt > this.cooldownMs * 2) {
        this.entries.delete(key);
      }
    }
  }
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
