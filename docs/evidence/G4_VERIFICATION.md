# G4 最小真实双端纵向切片验证记录

验证日期：2026-07-21（Asia/Shanghai）  
实现分支：`feat/g4-vertical-slice`  
实现 commit：`8a4af1db458631fdb93203f161c62a60d955472e`  
对应 Vercel Preview：<https://campus-gig-platform-l2mrer1kb-campus-gig-platform.vercel.app>  
部署环境：Vercel Preview + Supabase Anonymous Auth；当前系统 VPN/代理网络路径。依据 D-020，本记录不作为中国大陆无 VPN 直连通过证据。

## 1. 实现范围

- 学生端读取 J-01 主岗位、演示学生可用时间和直招透明度证据；
- 学生确认报名，云端写入 `null → pending` 事件并将名额从 5 原子扣减到 4；
- 招聘方端重新读取同一会话报名，并仅开放 `pending → confirmed`；
- 学生端重新读取“报名已确认”和两条事件时间线；
- 全局重置当前匿名会话，名额恢复为 5，报名与时间线清空；
- G5 的完工、待结算与模拟结算操作保持不可用并明确说明阶段边界。

## 2. 自动检查

| 检查 | 方式 | 结果 |
|---|---|---|
| TypeScript | `tsc -b --pretty false` | 通过 |
| ESLint | `eslint src --ext .ts,.tsx --max-warnings 0` | 通过，0 warning |
| Vitest | `vitest run` | 3 个文件、15 项全部通过 |
| Production build | `vite build` | 通过，98 modules；JS gzip 122.00kB；CSS gzip 4.32kB |
| 页面访问 Supabase 边界 | 扫描 `src/pages`、`src/components`、`src/hooks` | 零直接调用；只有 data repository 接触 Supabase |
| 密钥扫描 | 跟踪文件扫描 secret、Token、数据库连接串和 `service_role` 凭据模式 | 零命中 |
| 旧模板/PII 扫描 | `src`、`public`、`dist` 扫描旧英文模板标记 | 零命中 |

单元测试覆盖：时薪/夜班/日薪/舍入、距离、完整合法与非法状态矩阵、RPC snake_case 输出映射、未知状态拒绝、报名/确认幂等标记和重置响应结构。

## 3. 真实 Supabase 与双角色流程

| ID | 步骤 | 实际结果 | 结论 |
|---|---|---|---|
| G4-C-01 | 新匿名会话初始化 | XX大学、陈同学（演示）、5 条会话班次；J-01 名额 5/5 | Pass |
| G4-C-02 | 学生查看 J-01 详情 | 周六14:00–19:00、12元/小时、预计60元、0.3公里、完整主体/收费/结算证据 | Pass |
| G4-C-03 | 学生提交报名 | 当前状态 `pending`；仅 1 条 `null → pending` 事件；J-01 名额 5→4 | Pass |
| G4-C-04 | 快速双击报名 | RC `3de0331` 的真实 Preview 中仍只有 1 条报名、1 条事件、名额为 4；后续提交仅增加路由回顶和 confirmed 文案修复，未改报名服务或 RPC | Pass |
| G4-C-05 | 招聘方读取并确认 | 待处理数 1；确认后 `confirmed`；招聘方事件新增且名额保持 4 | Pass |
| G4-C-06 | 快速双击确认 | RC `3de0331` 中确认后总事件严格为 2；后续提交未改状态服务或 RPC | Pass |
| G4-C-07 | 学生回读 | 显示“报名已确认”，时间线严格为学生报名、招聘方确认两条事件 | Pass |
| G4-C-08 | 刷新与直接子路由 | `/student/applications` 刷新后状态不回退；根路由和 3 条直接子路由均 HTTP 200 | Pass |
| G4-C-09 | 重置取消/确认 | 取消重置时状态不变；确认后名额恢复 5、报名清空、岗位实例 ID 更新 | Pass |
| G4-C-10 | 两会话隔离 | 会话 A 重置并清空后，会话 B 刷新仍保留已确认报名与 2 条事件；随后分别重置测试会话 | Pass |
| G4-C-11 | 路由滚动状态 | 从 `scrollY≈682` 切换到报名页后为 `scrollY=0`；最终双角色回读也从页首显示 | Pass |
| G4-C-12 | 控制台 | 最终 Preview 完整流程后 warning/error 0 | Pass |
| G4-C-13 | confirmed取消边界文案 | 最终 Preview 明确显示“当前状态不可取消”；只把实际工时、完工和模拟结算列为 G5 能力 | Pass |

数据库安全沿用已执行的 G3 证据：两个匿名会话的班次实例 ID 无交集；基表直接读写均为 HTTP 403；重置会话 A 不改变会话 B 班次。G4 未修改 migration、RLS 或 RPC。

## 4. 响应式与可用性

| 视口 | `scrollWidth / clientWidth` | 可见主要触控目标 | 结果 |
|---|---|---|---|
| 375×812 | 360 / 360 | 角色按钮44px、导航46px、重置44px、主操作44px | Pass |
| 1440×900 | 1425 / 1425 | 角色按钮44px、导航46px、重置44px、刷新44px | Pass |

- [375×812 岗位首页](g4-preview-375x812.png)
- [375×812 报名已确认与时间线](g4-preview-confirmed-375x812.png)
- [1440×900 报名已确认与时间线](g4-preview-1440x900.png)

截图 SHA-256：

- `g4-preview-375x812.png`：`3EF6D6CEDB5EA754743F13C0D27CDD398F9911D24E4B58A954EB5FBD8618BD27`；
- `g4-preview-confirmed-375x812.png`：`07FDC9E8BC4EC4226E92A4F2764FE114ADB1DD28A0A5E0A0CA8E113AF3B5A190`；
- `g4-preview-1440x900.png`：`944CEC4F966971E7465C20BA4E6B24EA6FADBF30D821ECB64359D8E2643FD431`。

## 5. 已知限制

- G3 的大陆无 VPN 到 `vercel.app` 外部托管可达性仍未通过；本阶段依据 D-020 只在 feat 分支推进，不合并 `main`，不宣称 Production 发布。
- 本阶段只完成报名与确认；岗位比较、完工、待结算和 Demo 模拟结算属于 G5。
- 375×812 与 1440×900 已执行真实流程和布局验收；390×844、768×1024 与 Edge 完整回归按计划在 G6 补齐。

## 6. 三方票决

- 产品负责人：无条件同意；
- 技术架构负责人：无条件同意；
- 交付与质量负责人：无条件同意；
- 阶段状态：G4 已完成。依据 D-020 保持在 feat 分支，不合并 `main`，继续继承 G3 外部托管可达性风险。
