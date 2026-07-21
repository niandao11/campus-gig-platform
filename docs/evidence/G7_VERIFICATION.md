# G7 生产发布与最终 UAT

- 执行日期：2026-07-21（北京时间）
- 发布分支：`main`
- 当前 Production 源提交：`34d7851879e5abc1c71b5a9d4f88353798ad9925`
- 完整生命周期 UAT 的应用等价提交：`c0b6a21bff083768066f436038c17fedf966b861`；`34d7851` 只新增 G7 脚本、截图与文档，部署后的 HTML/JS/CSS 与该 UAT 版本一致
- Vercel GitHub Deployment：`Production`，构建状态 `success`
- 当前项目正式 Production 域名：[campus-gig-platform-nine.vercel.app](https://campus-gig-platform-nine.vercel.app)
- Vercel Deployment Details：`Ready Latest`、`Environment = Production`，因此 `Promote` 按钮置灰属于已发布状态
- 遗留同名域名：`campus-gig-platform.vercel.app` 指向另一个旧英文项目/部署，不是当前项目的 Production 域名，不得作为交付链接
- 网络条件：Edge UAT 使用当前可访问 Vercel/Supabase 的系统代理路径；不作为中国大陆无 VPN 通过证据

## 发布前自动门禁

| 检查 | 结果 |
| --- | --- |
| `tsc -b --force --pretty false` | 通过 |
| ESLint | 通过，0 warning |
| Vitest | 5 个文件、27 项通过 |
| `pnpm run build` | 通过；Vite 100 modules，JS gzip 127.55 kB，CSS gzip 5.19 kB |
| 旧模板与 PII 关键字 | 新部署 HTML/JS/CSS 中 `YUVASREE`、`CampusGig`、`Dynamic Freelance Hub`、`Python Scraper`、邮箱等均零命中 |
| 密钥边界 | 跟踪文件只有空值 `.env.example`；未发现数据库串、private key、`sb_secret_*`、GitHub PAT 或 `service_role` JWT |
| 冻结契约 | G7 未修改 migration、schema、RLS、RPC、状态机或金额规则 |

## Edge Production UAT

- 浏览器：Microsoft Edge `150.0.4078.65`
- 可复现脚本：`scripts/edge-g7-uat.mjs`
- 结构化结果：`docs/evidence/g7/screenshots/edge-g7-results.json`
- 结果：`passed=true`

已通过：

1. 清除当前域名站点数据后直接打开 `/student/jobs`，自动建立匿名会话并返回五条岗位；
2. 标题为“校园零工平台”，`lang=zh-CN`；
3. `/`、三条学生静态路由和三条招聘方静态路由均加载中文 SPA，无 404；
4. 重置后 J-01 主流程从 5/5 名额开始；
5. 学生报名进入 `pending`，时间线 1 条；硬刷新后保持；
6. 招聘方确认进入 `confirmed`，时间线 2 条；
7. 核定 270 分钟后，数据库计算 ¥54，当前状态为 `pending_settlement`，时间线 4 条；
8. 独立结算页完成“Demo 模拟结算”，学生回读 `settled_demo` 和 5 条事件；
9. 终态硬刷新后状态、金额和事件保持；
10. 终态重置后 J-01 实例 ID 改变、名额恢复 5/5、报名入口恢复；
11. 390×844 主流程与 1440×900 重置首页无横向溢出；
12. 应用控制台 warning/error 为 0。

## Production 截图与哈希

| 文件 | 场景 | SHA-256 |
| --- | --- | --- |
| `01-production-jobs-390.png` | 新匿名会话与五岗位 | `b003b04326fd2a788221ce31548020ef7e39b64127e79a89a00924cb4049494a` |
| `02-production-pending-390.png` | 学生 pending | `cda26e3fc60957e417ed1abec3fa0fb0463ec2875ec5b6ab1bfe4fffde6ddcbf` |
| `03-production-confirmed-390.png` | 招聘方 confirmed | `8aa4780dfa9c59aab419a902a25c80b2758fc2e9b01d0a5b69c3f09200fb6a72` |
| `04-production-pending-settlement-390.png` | 270分钟、¥54、四事件 | `6c0d4050e8dc7a3bb3f563f4a72723905c4f406c0d5abc6134398ffcf80dc50b` |
| `05-production-settled-employer-390.png` | 招聘方模拟结算终态 | `e8de20617a0e7ccbaa2bd3a71ef6e41c0d7359ffffa1f56b127ef4f4b0e9cfd8` |
| `06-production-settled-student-390.png` | 学生五事件回读 | `b64f29770efea143c559e4acfc9085c48821e6d34a0e4d9435fd479f35351b27` |
| `07-production-reset-1440.png` | 终态重置与 PC 布局 | `c2149e4421b9b2fa082ccb95bfe206c79d97b968ebe8d4bb7f9350c746efe8e4` |

## 尚未关闭的 G7 闸门

### 1. Production 域名（已通过）

Vercel 已将 `campus-gig-platform-nine.vercel.app` 自动分配给当前项目最新 Production。根路由、`/student/jobs`、`/student/compare`、`/student/applications`、`/employer/dashboard`、`/employer/applications`、`/employer/settlements` 均返回 HTTP 200、标题“校园零工平台”；HTML 中旧 CampusGig/YUVASREE/Python Scraper 等关键词零命中。

### 2. 旧部署历史

遗留的 `campus-gig-platform.vercel.app` 当前仍公开旧姓名、注册号和邮箱等 PII 候选。它不属于截图所示当前 Production 域名。按既定计划必须经用户确认后再删除、停用或保护对应旧 Vercel 项目/部署；Codex 不自行执行不可逆删除。

### 3. 中国大陆无 VPN 实网

本机 `curl --noproxy '*'` 对新部署等待 15 秒后连接超时，与 D-020 既有风险一致。还需用户完成：

- 关闭 VPN、系统代理和浏览器代理后，使用大陆普通宽带 PC 冷启动 3 次；
- 手机关闭 Wi-Fi、保持蜂窝且无 VPN，冷启动 3 次；
- 每次记录 URL、网络、设备、应用壳耗时、匿名 Auth + 五岗位耗时和失败文本；
- 开发电脑断网或关机后，从另一设备再次访问。

代理环境成功不能写为大陆无 VPN 通过。若真实测试仍失败，README、三分钟脚本和最终交付消息保留“部分中国大陆网络可能无法直连，实际需要可访问 Vercel 与 Supabase 的网络环境”的说明。

### 4. 备用托管候选

D-020 约定 G7 测试一个经批准的备用托管候选；当前尚未批准或部署第二托管平台。新增 Netlify、Cloudflare Pages 或 GitHub Pages 属于外部托管变更，必须先走 `CHANGE_CONTROL`，不能在截止压力下隐式增加外部服务。

### 5. Preview 保护

Production 最终稳定后，按 D-018 在 Vercel 重新开启 Preview `Require Log In`，并确认 Preview 恢复保护、Production 仍公开。该后台操作尚未执行。

## 三方票决

- 产品负责人：待实网、遗留项目与最终交付材料复核
- 技术负责人：待最终 `main` / Vercel SHA、Production 域名与环境复核
- 质量负责人：待全部 G7 闸门关闭或按批准风险边界处置
- 阶段状态：进行中，不得标记 G7 完成。
