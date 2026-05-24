import { loadBridgeConfig } from "./config.js";
import { CodexWeixinBridge } from "./bridge.js";
import { listWeixinAccountIds } from "./accountStore.js";
import { buildConfigDiagnostics } from "./configDiagnostics.js";
import { startConsoleServer } from "./consoleServer.js";
import { loginWeixinAccount } from "./weixinLogin.js";
import { runBeginnerSetup } from "./setupWizard.js";

function printHelp(): void {
  console.log(`
Usage:
  node dist/cli.js init
  node dist/cli.js login
  node dist/cli.js start
  node dist/cli.js serve
  node dist/cli.js doctor

Options:
  --workspace <path>   Codex workspace root
  --config-file <path> .env file to write/read
  --delivery-mode <mode> desktop-ui or codex-cli
  --console-port <port> local console port
  --auth-root <path>   Weixin credential root used by this bridge
  --base-url <url>     Weixin login/API base URL
  --bot-type <id>      Weixin bot type, defaults to 3
`);
}

interface CliArgs {
  _: string[];
  [key: string]: string | string[] | true | undefined;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = value;
    i += 1;
  }
  return args;
}

function applyArgEnv(args: CliArgs): void {
  if (typeof args.workspace === "string") {
    process.env.CODEX_WEIXIN_CWD = args.workspace;
  }
  if (typeof args["auth-root"] === "string") {
    process.env.CODEX_WEIXIN_AUTH_ROOT = args["auth-root"];
  }
  if (typeof args["base-url"] === "string") {
    process.env.CODEX_WEIXIN_BASE_URL = args["base-url"];
  }
  if (typeof args["bot-type"] === "string") {
    process.env.CODEX_WEIXIN_BOT_TYPE = args["bot-type"];
  }
  if (typeof args["config-file"] === "string") {
    process.env.CODEX_WEIXIN_ENV_FILE = args["config-file"];
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0] ?? "start";
  if (command === "help" || args.help) {
    printHelp();
    return;
  }
  applyArgEnv(args);

  if (command === "init") {
    await runBeginnerSetup({
      consolePort: typeof args["console-port"] === "string" ? Number.parseInt(args["console-port"], 10) : undefined,
      deliveryMode: args["delivery-mode"] === "codex-cli" ? "codex-cli" : "desktop-ui",
      envPath: typeof args["config-file"] === "string" ? args["config-file"] : undefined,
      workspace: typeof args.workspace === "string" ? args.workspace : undefined
    });
    return;
  }

  const config = loadBridgeConfig();

  if (command === "login") {
    await loginWeixinAccount(config);
    return;
  }

  if (command === "doctor") {
    const checks = buildConfigDiagnostics(config);
    const accountIds = await listWeixinAccountIds(config);
    console.log(JSON.stringify({
      accountIds,
      checks,
      codexCwd: config.codexCwd,
      deliveryMode: config.deliveryMode,
      stateRoot: config.logRoot,
      weixinAuthRoot: config.openclawStateRoot
    }, null, 2));
    return;
  }

  if (command !== "start" && command !== "serve") {
    printHelp();
    process.exitCode = 1;
    return;
  }

  const bridge = new CodexWeixinBridge(config);
  await bridge.init();

  console.log(`[codex-weixin] bridge started`);
  console.log(`[codex-weixin] state root: ${config.logRoot}`);
  console.log(`[codex-weixin] codex cwd: ${config.codexCwd}`);

  const controller = new AbortController();
  const consoleServer = config.consoleEnabled
    ? await startConsoleServer(config, { getTaskSnapshot: () => bridge.getTaskSnapshot() })
    : undefined;
  if (consoleServer) {
    console.log(`[codex-weixin] console: ${consoleServer.url}`);
  }
  process.on("SIGINT", () => controller.abort());
  process.on("SIGTERM", () => controller.abort());
  try {
    await bridge.runForever(controller.signal);
  } finally {
    await consoleServer?.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
