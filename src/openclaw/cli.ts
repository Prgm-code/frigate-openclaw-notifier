import { spawn } from "node:child_process";
import { NotifierConfig } from "../config/schema.js";
import { OpenClawSendResult } from "./types.js";

export class OpenClawCli {
  constructor(private readonly config: NotifierConfig) {}

  sendText(target: string, message: string): Promise<OpenClawSendResult> {
    return this.run(this.buildArgs({ target, message }));
  }

  sendMedia(target: string, mediaPathOrUrl: string, caption?: string): Promise<OpenClawSendResult> {
    return this.run(this.buildArgs({ target, media: mediaPathOrUrl, message: caption }));
  }

  buildArgs(input: { target: string; message?: string; media?: string }): string[] {
    const args = ["message", "send", "--channel", this.config.openclawChannel];
    if (this.config.openclawAccount) {
      args.push("--account", this.config.openclawAccount);
    }
    args.push("--target", input.target);
    if (input.media) {
      args.push("--media", input.media);
    }
    if (input.message) {
      args.push("--message", input.message);
    }
    args.push("--json");
    return args;
  }

  private run(args: string[]): Promise<OpenClawSendResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.openclawBin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: false
      });

      let stdout = "";
      let stderr = "";
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`OpenClaw timed out after ${this.config.openclawTimeoutMs}ms`));
      }, this.config.openclawTimeoutMs);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        if (code !== 0) {
          reject(new Error(`OpenClaw exited with code ${code}: ${stderr.trim()}`));
          return;
        }

        resolve(parseJsonResult(stdout, this.config.openclawChannel));
      });
    });
  }
}

function parseJsonResult(stdout: string, channel: string): OpenClawSendResult {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return { ok: true, channel, to: "", raw: undefined };
  }

  const raw = JSON.parse(trimmed) as Record<string, unknown>;
  return {
    ok: true,
    channel: stringValue(raw.channel) || channel,
    to: stringValue(raw.to) || stringValue(raw.target) || "",
    messageId: stringValue(raw.messageId),
    mediaUrl: stringValue(raw.mediaUrl),
    caption: stringValue(raw.caption),
    raw
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
