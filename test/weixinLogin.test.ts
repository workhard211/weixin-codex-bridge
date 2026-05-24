import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { BridgeConfig } from "../src/config.js";
import { buildWeixinLoginAccountRecord, saveWeixinLoginAccount } from "../src/weixinLogin.js";

const tempRoots: string[] = [];

describe("Weixin direct login account storage", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { force: true, recursive: true });
    }
  });

  it("normalizes QR login status into the account shape read by the bridge", () => {
    const record = buildWeixinLoginAccountRecord({
      baseUrl: "https://ilinkai.weixin.qq.com",
      qrcodeUrl: "https://example.com/qr",
      status: {
        baseurl: "https://login.weixin.qq.com",
        bot_token: "bot-token",
        ilink_bot_id: "abc@im.bot",
        ilink_user_id: "user@im.wechat"
      }
    });

    expect(record).toMatchObject({
      accountId: "abc-im-bot",
      account: {
        baseUrl: "https://login.weixin.qq.com",
        qrcodeUrl: "https://example.com/qr",
        token: "bot-token",
        userId: "user@im.wechat"
      }
    });
    expect(record.account.savedAt).toEqual(expect.any(String));
  });

  it("writes OpenClaw-compatible account files under the bridge auth root", async () => {
    const root = makeTempRoot();
    const config = makeConfig(root);

    await saveWeixinLoginAccount(config, {
      accountId: "abc-im-bot",
      account: {
        baseUrl: "https://ilinkai.weixin.qq.com",
        qrcodeUrl: "https://example.com/qr",
        savedAt: "2026-05-23T00:00:00.000Z",
        token: "bot-token",
        userId: "user@im.wechat"
      }
    });

    const accountRoot = path.join(root, "openclaw-weixin");
    expect(JSON.parse(readFileSync(path.join(accountRoot, "accounts.json"), "utf8"))).toEqual(["abc-im-bot"]);
    expect(JSON.parse(readFileSync(path.join(accountRoot, "accounts", "abc-im-bot.json"), "utf8"))).toEqual({
      baseUrl: "https://ilinkai.weixin.qq.com",
      qrcodeUrl: "https://example.com/qr",
      savedAt: "2026-05-23T00:00:00.000Z",
      token: "bot-token",
      userId: "user@im.wechat"
    });
  });
});

function makeTempRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "weixin-login-"));
  tempRoots.push(root);
  return root;
}

function makeConfig(root: string): BridgeConfig {
  return {
    autoDesktopSession: false,
    codexCmdPath: "codex.cmd",
    codexCwd: root,
    codexHome: path.join(root, ".codex"),
    codexModel: "gpt-5.4-mini",
    cliFallbackEnabled: false,
    consoleEnabled: true,
    consolePort: 18790,
    deliveryMode: "desktop-ui",
    desktopInputScriptPath: path.join(root, "Send-CodexDesktopInput.ps1"),
    desktopModelScriptPath: path.join(root, "Set-CodexDesktopModel.ps1"),
    desktopResponseTimeoutMs: 900_000,
    logRoot: path.join(root, "state"),
    maxParallelRuns: 1,
    openclawConfigPath: path.join(root, "openclaw.json"),
    openclawStateRoot: root,
    pollTimeoutMs: 35_000,
    resumeAllSessions: true,
    resumeLast: true,
    skipBacklogOnStart: true,
    weixinChannelVersion: "2.1.1"
  };
}
