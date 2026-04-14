import { describe, expect, it } from "vitest";
import { OpenClawCli } from "../src/openclaw/cli.js";
import { makeConfig, testEnv } from "./helpers.js";

describe("OpenClawCli", () => {
  it("builds text send args without shell interpolation", () => {
    const cli = new OpenClawCli(makeConfig({ openclawAccount: "biz" }));
    expect(cli.buildArgs({ target: testEnv.openclawTarget, message: "Persona detectada" })).toEqual([
      "message",
      "send",
      "--channel",
      "whatsapp",
      "--account",
      "biz",
      "--target",
      testEnv.openclawTarget,
      "--message",
      "Persona detectada",
      "--json"
    ]);
  });

  it("builds media send args", () => {
    const cli = new OpenClawCli(makeConfig());
    expect(cli.buildArgs({ target: testEnv.openclawTarget, media: testEnv.mediaPath, message: "Caption" })).toEqual([
      "message",
      "send",
      "--channel",
      "whatsapp",
      "--target",
      testEnv.openclawTarget,
      "--media",
      testEnv.mediaPath,
      "--message",
      "Caption",
      "--json"
    ]);
  });
});
