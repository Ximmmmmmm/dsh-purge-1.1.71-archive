# 兼容性补丁工具（tools/）

本目录是根目录那套 `dsh-purge` 1.1.71 镜像对应的**独立补丁脚本**。即使不使用本仓库的镜像、而是在本机已装好 1.1.71，也可以只取这两个文件单独使用。

| 文件 | 用途 |
| --- | --- |
| `fix-dsh-purge-1.1.71.cjs` | 幂等地应用 7 项 DSH 0.2.1-rc.5 兼容补丁 |
| `launch-dsh-fixed.bat` | 双击：先跑补丁，再启动 DeepSeek Harness |

## 用法

前置：Node.js 22+、Windows、已安装 `dsh-purge` 1.1.71 与 DeepSeek Harness 0.2.1-rc.5。

```bash
node fix-dsh-purge-1.1.71.cjs
```

自定义路径：

```bash
node fix-dsh-purge-1.1.71.cjs <profile目录> <用户redteam预设路径>
```

默认 profile 为 `~/.dsh/profiles/desktop`，默认用户预设为 `~/.dsh/.agent-presets/redteam/agent.cordis.yml`。Harness 不在 `D:\DeepSeek` 时，设置环境变量 `DSH_DESKTOP_HOME` 指向安装目录。

也可以直接双击 `launch-dsh-fixed.bat`；脚本用 `%~dp0` 定位自身，整目录搬到任何位置都能用。

## 注意事项

- **幂等**：重复运行安全。每项修改前会在原文件旁生成 `*.pre-compat-fix.bak`，覆盖回去即可回滚。
- **重装即失效**：`pnpm install`、插件更新或版本切换会从 tarball 重新解压并覆盖补丁，重跑一次即可。
- **必须完全退出并重新打开 DeepSeek Harness**，Node 的 ESM 模块缓存不会热更新。
- 补丁只动插件自身文件与用户预设，不改 DSH 安装目录里的官方包，也不改变 `dsh-purge` 的版本号。

## 7 项修复

1. `lib/identity.js` — `{{cwd}}` 静态回退（rc.5 只注册 `provider` / `model`）
2. `lib/redteam/tools.js` — 补齐桌面版 `dsh-tools` 解析路径 + object schema 显式 `additionalProperties`
3. `lib/extract-asar.js` — `hostFs` 的 fd 方法直通
4. `presets/redteam/agent.cordis.yml` — 移除 rc.5 已废弃的 `toolFilter`
5. `~/.dsh/.agent-presets/redteam/agent.cordis.yml` — 同上（用户预设，运行时处理）
6. `lib/redteam/index.js` — 同步预设时自动剥离 `toolFilter`
7. `lib/restart-desktop.js` — 换包助手待杀 PID 排除自身

## 许可与署名

本目录脚本按 MIT 许可提供。上游项目 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge)（作者小杨，MIT）的兼容修复思路已在根目录 [NOTICE.md](../NOTICE.md) 中署名，本目录不含上游源码。
