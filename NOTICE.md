# 第三方镜像与修改声明

本仓库是 [YuJunZhiXue/dsh-purge](https://github.com/YuJunZhiXue/dsh-purge) 历史版本 **1.1.71** 的**第三方镜像 + 兼容性修改版**，不是上游官方仓库，也不由原作者维护。

| 项目 | 说明 |
| --- | --- |
| 上游仓库 | https://github.com/YuJunZhiXue/dsh-purge |
| 原作者 | 小杨 |
| 上游许可证 | MIT（`LICENSE` 为原文，未改动，版权与免责声明完整保留） |
| 本仓库性质 | 非官方镜像，附带 7 项本地兼容性补丁 |
| 关系声明 | 与原作者及 DeepSeek 官方均无隶属、授权、合作或背书关系 |

## 署名

上游 `README.zh-CN.md`「署名要求」一节规定：

> 借用本项目的名称、思路、代码或提示词，必须署名，并写明来源仓库：YuJunZhiXue/dsh-purge。不署名、隐瞒来源、改头换面据为己有，作者将依法追究责任。

本文件、两份 README 顶部的声明以及保留的 `LICENSE`，即为履行该署名与版权声明义务。仓库名刻意不与上游同名，以免被误认为官方仓库。

## 与上游 1.1.71 的差异

仅包含针对 **DeepSeek Harness 0.2.1-rc.5** 的 7 项兼容性补丁，未改变版本号、未增删功能、未移除上游文档：

1. `lib/identity.js` — `{{cwd}}` 静态回退（rc.5 只注册 `provider` / `model`）
2. `lib/redteam/tools.js` — 补齐桌面版 `dsh-tools` 解析路径 + object schema 显式 `additionalProperties`
3. `lib/extract-asar.js` — `hostFs` 的 fd 方法直通
4. `presets/redteam/agent.cordis.yml` — 移除 rc.5 已废弃的 `toolFilter`
5. `lib/redteam/index.js` — 同步预设时自动剥离 `toolFilter`
6. `lib/restart-desktop.js` — 换包助手待杀 PID 排除自身

（另有一处同性质的用户预设清理不在本包内，由补丁脚本在运行时处理。）

补丁脚本与用法见本仓库 [`tools/`](tools/) 目录（`fix-dsh-purge-1.1.71.cjs` 与 `launch-dsh-fixed.bat`），可脱离本镜像单独使用。

## 使用范围

上游 README 对使用范围有明确的合法合规要求：仅限使用者有权管理的本机 Harness、离线靶标或已获书面授权的演练环境，禁止用于未授权渗透、公网攻击及任何违法活动。本镜像的发布不改变、不豁免这些条款，使用者须自行遵守。

上游亦声明：将项目用于非法攻击或违规行为的，其开源许可自动终止。本镜像按「现状」提供，不提供任何担保，也不代表上游作者对本镜像的认可。

## 新增文件

本仓库在镜像之外新增 `NOTICE.md`、`.gitignore`、`tools/`（补丁脚本与其 README），并在两份 README 顶部各加入一段第三方镜像声明（README 其余内容为上游原文）。这些新增内容按 MIT 许可提供。
