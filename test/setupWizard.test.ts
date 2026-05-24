import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { mergeEnvContent, saveBeginnerSetupEnv } from "../src/setupWizard.js";

const tempRoots: string[] = [];

describe("beginner setup wizard", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("creates a beginner .env with only the values a customer normally needs", async () => {
    const root = makeTempRoot();
    const workspace = path.join(root, "workspace");
    const envPath = path.join(root, ".env");

    const result = await saveBeginnerSetupEnv({
      consolePort: 18790,
      deliveryMode: "desktop-ui",
      envPath,
      workspace
    });

    expect(result.created).toBe(true);
    expect(readFileSync(envPath, "utf8")).toContain(`CODEX_WEIXIN_CWD=${workspace}`);
    expect(readFileSync(envPath, "utf8")).toContain("CODEX_WEIXIN_DELIVERY_MODE=desktop-ui");
    expect(readFileSync(envPath, "utf8")).toContain("CODEX_WEIXIN_CLI_FALLBACK=false");
    expect(readFileSync(envPath, "utf8")).toContain("CODEX_WEIXIN_CONSOLE_PORT=18790");
    expect(readFileSync(envPath, "utf8")).not.toContain("OPENCLAW_STATE_DIR=");
  });

  it("updates known setup keys without removing existing custom values", () => {
    const existing = [
      "# existing customer config",
      "CODEX_WEIXIN_CWD=C:\\old",
      "CODEX_WEIXIN_MODEL=gpt-5.4",
      ""
    ].join("\n");

    expect(mergeEnvContent(existing, {
      CODEX_WEIXIN_CLI_FALLBACK: "false",
      CODEX_WEIXIN_CONSOLE_PORT: "18791",
      CODEX_WEIXIN_CWD: "C:\\new",
      CODEX_WEIXIN_DELIVERY_MODE: "codex-cli"
    })).toContain([
      "# existing customer config",
      "CODEX_WEIXIN_CWD=C:\\new",
      "CODEX_WEIXIN_MODEL=gpt-5.4",
      "",
      "CODEX_WEIXIN_DELIVERY_MODE=codex-cli",
      "CODEX_WEIXIN_CLI_FALLBACK=false",
      "CODEX_WEIXIN_CONSOLE_PORT=18791",
      ""
    ].join("\n"));
  });
});

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "weixin-setup-"));
  tempRoots.push(root);
  return root;
}
