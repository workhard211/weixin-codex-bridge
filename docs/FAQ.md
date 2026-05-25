# FAQ

## 新用户需要安装 OpenClaw 吗？

不需要。新用户直接运行 `npm run login`，用微信扫码登录 bot。`OPENCLAW_STATE_DIR` 只用于旧用户复用历史凭据。

## 最短启动流程是什么？

Windows 推荐：

```powershell
npm run setup -- -NoStart
npm run login
npm start
```

如果已经安装依赖，也可以用：

```powershell
npm run init
npm run login
npm start
```

## 哪些环境完整支持？

| 环境 | 支持情况 |
| --- | --- |
| Windows 10/11 + Codex Desktop | 完整支持，推荐给普通客户 |
| Windows 10/11 + Codex CLI | 支持，使用 `codex-cli` 模式 |
| macOS/Linux + Codex CLI | 代码层面可运行 CLI 模式，但桌面自动化脚本不是主支持目标 |
| macOS/Linux + Codex Desktop UI 自动投递 | 暂不作为完整支持目标 |

## 为什么需要设置 `CODEX_WEIXIN_CWD`？

它告诉 Codex 应该在哪个项目目录里工作。运行 `npm run init` 时选择客户自己的项目目录即可。

## 扫码登录后凭据保存在哪里？

默认保存在本项目状态目录下的 `weixin-auth/openclaw-weixin`。不要提交 `.env`、账号 JSON、二维码或运行日志。

## 端口冲突怎么办？

默认本地控制台端口是 `18790`。如果被占用，可以运行：

```powershell
npm run init -- --console-port 18791
```

启动脚本还会检查 `18789` 和 `8787`，避免和旧 OpenClaw/旧桥同时占用。

## Codex Desktop 没收到微信消息怎么办？

先运行：

```powershell
npm run setup-check
```

重点看 Codex Desktop 是否已登录、是否有可见窗口、桌面输入脚本是否存在，以及控制台诊断是否提示粘贴或模型切换失败。

## 可以不用桌面自动化吗？

可以。运行：

```powershell
npm run init -- --delivery-mode codex-cli
```

然后 `npm start`。这种模式不依赖 Codex Desktop 窗口，但需要 Codex CLI 可用。
