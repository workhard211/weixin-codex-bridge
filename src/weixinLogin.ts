import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import QRCode from "qrcode";
import qrcodeTerminal from "qrcode-terminal";

import type { BridgeConfig } from "./config.js";

const QR_LOGIN_TIMEOUT_MS = 8 * 60_000;
const QR_REFRESH_LIMIT = 3;

interface QrCodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface QrStatusResponse {
  baseurl?: string;
  bot_token?: string;
  ilink_bot_id?: string;
  ilink_user_id?: string;
  status?: "confirmed" | "expired" | "scaned" | "wait" | string;
}

export interface WeixinLoginAccountFile {
  baseUrl: string;
  qrcodeUrl: string;
  savedAt: string;
  token: string;
  userId?: string;
}

export interface WeixinLoginAccountRecord {
  account: WeixinLoginAccountFile;
  accountId: string;
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

function normalizeAccountId(rawAccountId: string): string {
  return rawAccountId.replace(/@im\.bot$/i, "-im-bot");
}

function buildClientVersion(version: string): number {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map((piece) => Number.parseInt(piece, 10) || 0);
  return ((major & 0xff) << 16) | ((minor & 0xff) << 8) | (patch & 0xff);
}

export function buildWeixinLoginAccountRecord(params: {
  baseUrl: string;
  qrcodeUrl: string;
  status: QrStatusResponse;
}): WeixinLoginAccountRecord {
  if (!params.status.bot_token?.trim()) {
    throw new Error("Weixin login confirmed but no bot token was returned.");
  }
  if (!params.status.ilink_bot_id?.trim()) {
    throw new Error("Weixin login confirmed but no bot account id was returned.");
  }

  return {
    accountId: normalizeAccountId(params.status.ilink_bot_id.trim()),
    account: {
      baseUrl: params.status.baseurl?.trim() || params.baseUrl,
      qrcodeUrl: params.qrcodeUrl,
      savedAt: new Date().toISOString(),
      token: params.status.bot_token.trim(),
      userId: params.status.ilink_user_id
    }
  };
}

export async function saveWeixinLoginAccount(
  config: BridgeConfig,
  record: WeixinLoginAccountRecord
): Promise<void> {
  const root = path.join(config.openclawStateRoot, "openclaw-weixin");
  const accountsDir = path.join(root, "accounts");
  await mkdir(accountsDir, { recursive: true });

  const indexPath = path.join(root, "accounts.json");
  const existing = await readJson<string[]>(indexPath, []);
  const accounts = Array.isArray(existing) ? existing.filter((entry) => typeof entry === "string") : [];
  if (!accounts.includes(record.accountId)) {
    accounts.push(record.accountId);
  }

  await writeFile(indexPath, `${JSON.stringify(accounts, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(accountsDir, `${record.accountId}.json`),
    `${JSON.stringify(record.account, null, 2)}\n`,
    "utf8"
  );
}

export async function loginWeixinAccount(config: BridgeConfig): Promise<WeixinLoginAccountRecord> {
  let refreshCount = 0;
  let current = await fetchQrCode(config);
  const startedAt = Date.now();

  for (;;) {
    refreshCount += 1;
    console.log("请使用微信扫描下面的二维码，完成 Codex 微信桥登录。");
    const qrPath = await writeQrPreview(config, current.qrcode_img_content);
    await renderQr(current.qrcode_img_content);
    console.log(`二维码图片：${qrPath}`);
    console.log("等待微信确认...");

    for (;;) {
      const status = await pollQrStatus(config, current.qrcode);
      if (status.status === "wait") {
        process.stdout.write(".");
        continue;
      }
      if (status.status === "scaned") {
        process.stdout.write("\n已扫码，请在微信里确认登录。\n");
        continue;
      }
      if (status.status === "confirmed") {
        process.stdout.write("\n微信登录成功。\n");
        const record = buildWeixinLoginAccountRecord({
          baseUrl: config.weixinBaseUrl,
          qrcodeUrl: current.qrcode_img_content,
          status
        });
        await saveWeixinLoginAccount(config, record);
        console.log(`已保存账号 ${record.accountId} 到 ${path.join(config.openclawStateRoot, "openclaw-weixin")}`);
        return record;
      }
      if (status.status === "expired") {
        break;
      }
    }

    if (Date.now() - startedAt > QR_LOGIN_TIMEOUT_MS || refreshCount >= QR_REFRESH_LIMIT) {
      throw new Error("登录超时：二维码多次过期。");
    }

    console.log("二维码已过期，正在刷新...");
    current = await fetchQrCode(config);
  }
}

async function fetchQrCode(config: BridgeConfig): Promise<QrCodeResponse> {
  const url = new URL(
    `ilink/bot/get_bot_qrcode?bot_type=${encodeURIComponent(config.weixinBotType)}`,
    ensureTrailingSlash(config.weixinBaseUrl)
  );
  const response = await fetch(url);
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`get_bot_qrcode failed with HTTP ${response.status}: ${raw}`);
  }
  return JSON.parse(raw) as QrCodeResponse;
}

async function pollQrStatus(config: BridgeConfig, qrcode: string): Promise<QrStatusResponse> {
  const url = new URL(
    `ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
    ensureTrailingSlash(config.weixinBaseUrl)
  );
  const response = await fetch(url, {
    headers: {
      "iLink-App-ClientVersion": String(buildClientVersion(config.weixinChannelVersion))
    }
  });
  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`get_qrcode_status failed with HTTP ${response.status}: ${raw}`);
  }
  return JSON.parse(raw) as QrStatusResponse;
}

function renderQr(qrcodeUrl: string): Promise<void> {
  return new Promise((resolve) => {
    qrcodeTerminal.generate(qrcodeUrl, { small: true }, (output: string) => {
      process.stdout.write(`${output}\n`);
      resolve();
    });
  });
}

async function writeQrPreview(config: BridgeConfig, qrcodeUrl: string): Promise<string> {
  const filePath = path.join(config.logRoot, "login-qr.png");
  await mkdir(config.logRoot, { recursive: true });
  await QRCode.toFile(filePath, qrcodeUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512
  });
  return filePath;
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}
