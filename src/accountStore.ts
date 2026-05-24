import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { BridgeConfig } from "./config.js";
import type { WeixinAccount } from "./types.js";

interface StoredAccount {
  baseUrl?: string;
  token?: string;
  userId?: string;
}

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";

function accountsRoot(config: BridgeConfig): string {
  return path.join(config.openclawStateRoot, "openclaw-weixin");
}

function legacyAccountsRoot(): string {
  return path.join(os.homedir(), ".openclaw", "openclaw-weixin");
}

function accountRoots(config: BridgeConfig): string[] {
  const primary = accountsRoot(config);
  const legacy = legacyAccountsRoot();
  return legacy === primary ? [primary] : [primary, legacy];
}

async function readJson<T>(filePath: string): Promise<T | null> {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

export async function listWeixinAccountIds(config: BridgeConfig): Promise<string[]> {
  const ids = new Set<string>();
  for (const root of accountRoots(config)) {
    const indexPath = path.join(root, "accounts.json");
    const parsed = await readJson<unknown>(indexPath);
    if (!Array.isArray(parsed)) {
      continue;
    }

    for (const entry of parsed) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        ids.add(entry);
      }
    }
  }

  return [...ids];
}

export async function loadWeixinAccount(config: BridgeConfig): Promise<WeixinAccount> {
  const accountIds = await listWeixinAccountIds(config);
  const accountId = config.accountId ?? accountIds[0];
  if (!accountId) {
    throw new Error(`No Weixin account found under ${accountsRoot(config)}. Run npm run login to scan a Weixin QR code, or set OPENCLAW_STATE_DIR to an existing OpenClaw state root.`);
  }

  const accountPath = accountRoots(config)
    .map((root) => path.join(root, "accounts", `${accountId}.json`))
    .find((candidate) => existsSync(candidate));
  if (!accountPath) {
    throw new Error(`Weixin account ${accountId} is listed but no account file was found.`);
  }
  const stored = await readJson<StoredAccount>(accountPath);
  if (!stored?.token?.trim()) {
    throw new Error(`Weixin account ${accountId} has no token at ${accountPath}.`);
  }

  return {
    accountId,
    baseUrl: stored.baseUrl?.trim() || DEFAULT_BASE_URL,
    token: stored.token.trim(),
    userId: stored.userId
  };
}
