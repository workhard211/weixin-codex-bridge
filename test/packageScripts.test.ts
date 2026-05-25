import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(__dirname, "..");

describe("package scripts", () => {
  it("routes login through the built bridge CLI instead of the legacy local login script", () => {
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));

    expect(pkg.scripts.init).toBe("node dist/cli.js init");
    expect(pkg.scripts.login).toBe("node dist/cli.js login");
    expect(pkg.scripts.start).toBe("node dist/cli.js start");
    expect(pkg.scripts.serve).toBe("node dist/cli.js serve");
    expect(pkg.scripts.setup).toContain("scripts/Setup-CodexWeixinBridge.ps1");
  });

  it("prebuilds beginner-facing commands so users do not need a separate build step", () => {
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));

    expect(pkg.scripts.preinit).toBe("npm run build");
    expect(pkg.scripts.prelogin).toBe("npm run build");
    expect(pkg.scripts.prestart).toBe("npm run build");
    expect(pkg.scripts.preserve).toBe("npm run build");
    expect(pkg.scripts.predoctor).toBe("npm run build");
  });

  it("publishes only public source and support files", () => {
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));

    expect(pkg.files).toEqual(expect.arrayContaining([
      ".env.example",
      ".github",
      "CHANGELOG.md",
      "docs/open-source-checklist.md",
      "docs/FAQ.md",
      "scripts",
      "src",
      "test"
    ]));
    expect(pkg.files).not.toContain(".workflow");
  });

  it("avoids the Node-reserved --env-file flag in the bridge CLI", () => {
    const cli = readFileSync(path.join(projectRoot, "src", "cli.ts"), "utf8");

    expect(cli).toContain("--config-file <path>");
    expect(cli).not.toContain("--env-file");
  });
});
