import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";

export type SetupDeliveryMode = "desktop-ui" | "codex-cli";

export interface BeginnerSetupOptions {
  consolePort?: number;
  deliveryMode?: SetupDeliveryMode;
  envPath?: string;
  workspace?: string;
}

export interface BeginnerSetupResult {
  created: boolean;
  envPath: string;
  values: Record<string, string>;
}

const SETUP_KEY_ORDER = [
  "CODEX_WEIXIN_CWD",
  "CODEX_WEIXIN_DELIVERY_MODE",
  "CODEX_WEIXIN_CLI_FALLBACK",
  "CODEX_WEIXIN_CONSOLE_PORT"
];

export function mergeEnvContent(existing: string, updates: Record<string, string>): string {
  const seen = new Set<string>();
  const lines = existing.replace(/\r\n/g, "\n").split("\n");
  const merged = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!match) {
      return line;
    }

    const key = match[1];
    if (!Object.hasOwn(updates, key)) {
      return line;
    }

    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  const missing = SETUP_KEY_ORDER
    .filter((key) => Object.hasOwn(updates, key) && !seen.has(key))
    .map((key) => `${key}=${updates[key]}`);
  if (missing.length > 0) {
    if (merged.length > 0 && merged[merged.length - 1] !== "") {
      merged.push("");
    }
    merged.push(...missing);
  }

  if (merged[merged.length - 1] !== "") {
    merged.push("");
  }
  return merged.join("\n");
}

export async function saveBeginnerSetupEnv(options: BeginnerSetupOptions): Promise<BeginnerSetupResult> {
  const envPath = path.resolve(options.envPath ?? path.join(process.cwd(), ".env"));
  const values = beginnerEnvValues(options);
  const existing = await readText(envPath);
  await mkdir(path.dirname(envPath), { recursive: true });
  await writeFile(envPath, mergeEnvContent(existing ?? "", values), "utf8");
  return {
    created: existing == null,
    envPath,
    values
  };
}

export async function runBeginnerSetup(options: BeginnerSetupOptions = {}): Promise<BeginnerSetupResult> {
  const interactive = process.stdin.isTTY && process.stdout.isTTY;
  let workspace = options.workspace;
  let deliveryMode = options.deliveryMode;
  let consolePort = options.consolePort;

  if (interactive) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      workspace = await askWithDefault(rl, "Codex 要操作的项目目录", workspace ?? process.cwd());
      deliveryMode = normalizeDeliveryMode(await askWithDefault(rl, "投递模式 desktop-ui/codex-cli", deliveryMode ?? "desktop-ui"));
      consolePort = Number.parseInt(await askWithDefault(rl, "本地控制台端口", String(consolePort ?? 18790)), 10);
    } finally {
      rl.close();
    }
  }

  const result = await saveBeginnerSetupEnv({
    ...options,
    consolePort,
    deliveryMode,
    workspace
  });

  console.log(`已${result.created ? "创建" : "更新"}配置文件：${result.envPath}`);
  console.log(`Codex 工作目录：${result.values.CODEX_WEIXIN_CWD}`);
  console.log(`投递模式：${result.values.CODEX_WEIXIN_DELIVERY_MODE}`);
  console.log("下一步：运行 npm run login 扫码，然后运行 npm start。");
  return result;
}

function beginnerEnvValues(options: BeginnerSetupOptions): Record<string, string> {
  const deliveryMode = normalizeDeliveryMode(options.deliveryMode ?? "desktop-ui");
  const consolePort = Number.isFinite(options.consolePort) && Number(options.consolePort) > 0
    ? Number(options.consolePort)
    : 18790;

  return {
    CODEX_WEIXIN_CLI_FALLBACK: "false",
    CODEX_WEIXIN_CONSOLE_PORT: String(consolePort),
    CODEX_WEIXIN_CWD: path.resolve(options.workspace ?? process.cwd()),
    CODEX_WEIXIN_DELIVERY_MODE: deliveryMode
  };
}

function normalizeDeliveryMode(value: string): SetupDeliveryMode {
  return value === "codex-cli" ? "codex-cli" : "desktop-ui";
}

async function askWithDefault(rl: readline.Interface, label: string, defaultValue: string): Promise<string> {
  const answer = (await rl.question(`${label} [${defaultValue}]: `)).trim();
  return answer || defaultValue;
}

async function readText(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return undefined;
  }
}
