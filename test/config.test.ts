import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadBridgeConfig } from "../src/config.js";

const originalEnv = { ...process.env };
const tempRoots: string[] = [];

describe("loadBridgeConfig", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("uses a Codex CLI model supported by the installed app by default", () => {
    delete process.env.CODEX_WEIXIN_MODEL;
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";

    expect(loadBridgeConfig().codexModel).toBe("gpt-5.4-mini");
  });

  it("defaults bridge state to the OS-local app state directory", () => {
    delete process.env.CODEX_WEIXIN_LOG_ROOT;
    delete process.env.CODEX_WEIXIN_STATE_ROOT;
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";
    process.env.LOCALAPPDATA = "C:\\Users\\roy\\AppData\\Local";

    const expected = process.platform === "win32"
      ? path.join(process.env.LOCALAPPDATA, "codex-weixin-bridge")
      : path.join(os.homedir(), ".local", "state", "codex-weixin-bridge");

    expect(loadBridgeConfig().logRoot).toBe(expected);
  });

  it("lets bridge state environment variables override the OS-local default", () => {
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";
    process.env.CODEX_WEIXIN_STATE_ROOT = "D:\\bridge-state";
    delete process.env.CODEX_WEIXIN_LOG_ROOT;

    expect(loadBridgeConfig().logRoot).toBe("D:\\bridge-state");

    process.env.CODEX_WEIXIN_LOG_ROOT = "D:\\bridge-logs";
    expect(loadBridgeConfig().logRoot).toBe("D:\\bridge-logs");
  });

  it("loads local .env values before building the bridge config", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "weixin-env-"));
    tempRoots.push(root);
    const envPath = path.join(root, ".env");
    writeFileSync(envPath, "CODEX_WEIXIN_CWD=C:\\work\\from-env-file\nCODEX_WEIXIN_CONSOLE_PORT=19991\n", "utf8");
    delete process.env.CODEX_WEIXIN_CWD;
    delete process.env.CODEX_WEIXIN_CONSOLE_PORT;
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";
    process.env.CODEX_WEIXIN_ENV_FILE = envPath;

    const config = loadBridgeConfig();

    expect(config.codexCwd).toBe("C:\\work\\from-env-file");
    expect(config.consolePort).toBe(19991);
  });

  it("keeps shell environment variables above local .env defaults", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "weixin-env-"));
    tempRoots.push(root);
    const envPath = path.join(root, ".env");
    writeFileSync(envPath, "CODEX_WEIXIN_CWD=C:\\work\\from-env-file\n", "utf8");
    process.env.CODEX_WEIXIN_CWD = "C:\\work\\from-shell";
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";
    process.env.CODEX_WEIXIN_ENV_FILE = envPath;

    expect(loadBridgeConfig().codexCwd).toBe("C:\\work\\from-shell");
  });

  it("defaults new Weixin auth state under the bridge state root", () => {
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";
    process.env.CODEX_WEIXIN_STATE_ROOT = "D:\\bridge-state";
    delete process.env.CODEX_WEIXIN_LOG_ROOT;
    delete process.env.CODEX_WEIXIN_AUTH_ROOT;
    delete process.env.OPENCLAW_STATE_DIR;

    expect(loadBridgeConfig().openclawStateRoot).toBe(path.join("D:\\bridge-state", "weixin-auth"));
  });

  it("lets explicit Weixin auth roots override the bridge auth default", () => {
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";
    process.env.CODEX_WEIXIN_STATE_ROOT = "D:\\bridge-state";
    process.env.CODEX_WEIXIN_AUTH_ROOT = "D:\\weixin-auth";
    delete process.env.OPENCLAW_STATE_DIR;

    expect(loadBridgeConfig().openclawStateRoot).toBe("D:\\weixin-auth");

    process.env.OPENCLAW_STATE_DIR = "D:\\legacy-openclaw";
    expect(loadBridgeConfig().openclawStateRoot).toBe("D:\\weixin-auth");
  });

  it("uses legacy OpenClaw auth state only when this bridge has no auth root", () => {
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";
    process.env.CODEX_WEIXIN_STATE_ROOT = "D:\\bridge-state";
    delete process.env.CODEX_WEIXIN_AUTH_ROOT;
    process.env.OPENCLAW_STATE_DIR = "D:\\legacy-openclaw";

    expect(loadBridgeConfig().openclawStateRoot).toBe("D:\\legacy-openclaw");
  });

  it("lets CODEX_WEIXIN_MODEL override the bridge default", () => {
    process.env.CODEX_WEIXIN_MODEL = "gpt-5.4";
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";

    expect(loadBridgeConfig().codexModel).toBe("gpt-5.4");
  });

  it("keeps Codex CLI fallback disabled unless explicitly enabled", () => {
    delete process.env.CODEX_WEIXIN_CLI_FALLBACK;
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";

    expect(loadBridgeConfig().cliFallbackEnabled).toBe(false);

    process.env.CODEX_WEIXIN_CLI_FALLBACK = "true";
    expect(loadBridgeConfig().cliFallbackEnabled).toBe(true);
  });

  it("keeps Desktop UI delivery single-lane even when max parallel is configured", () => {
    process.env.CODEX_WEIXIN_DELIVERY_MODE = "desktop-ui";
    process.env.CODEX_WEIXIN_MAX_PARALLEL = "5";
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";

    expect(loadBridgeConfig().maxParallelRuns).toBe(1);
  });

  it("lets codex-cli delivery process multiple Weixin sessions in parallel", () => {
    process.env.CODEX_WEIXIN_DELIVERY_MODE = "codex-cli";
    process.env.CODEX_WEIXIN_MAX_PARALLEL = "4";
    process.env.CODEX_WEIXIN_AUTO_DESKTOP_SESSION = "false";

    expect(loadBridgeConfig().maxParallelRuns).toBe(4);
  });
});
