# G5 完整生命周期验证

- 执行日期：2026-07-21（北京时间）
- 分支：`feat/g5-lifecycle`
- 最终提交：`d6298681eef35809d310a6232b488d80ecb1d3a0`
- 最终 Preview：[campus-gig-platform-eczan77oc-campus-gig-platform.vercel.app](https://campus-gig-platform-eczan77oc-campus-gig-platform.vercel.app)
- 完整生命周期 UAT Preview（同一 G5 实现，后续提交仅调整 J-01 列表排序）：`https://campus-gig-platform-11xt0xx05-campus-gig-platform.vercel.app`
- 网络说明：浏览器验收在可访问 Vercel/Supabase 的环境完成；大陆无 VPN 直连 `vercel.app` 的 D-020 风险仍未关闭。

## 自动门禁

| 检查 | 结果 |
| --- | --- |
| `tsc -b --force --pretty false` | 通过 |
| `eslint src --ext .ts,.tsx --max-warnings 0` | 通过，0 warning |
| Vitest | 4 个文件、23 项用例全绿 |
| 干净 worktree `pnpm install --frozen-lockfile` | 通过；esbuild postinstall 通过 |
| 干净 worktree `pnpm run build` | 通过；Vite 100 modules，JS gzip 126.25 kB，CSS gzip 5.07 kB |
| `git diff --check`、工作树 | 通过、干净 |
| 页面层直接调用 Supabase | 零命中；写入链路为 service → repository → RPC |
| 旧英文模板/PII关键字 | 零命中 |

## 五岗位与筛选比较

最终 Preview 首屏验证：J-01 至 J-05 全部展示，J-01 位于首位；同一 XX大学校园快递驿站直招主体，距离约 0.3 公里。

| 场景 | 期望 | 实际 |
| --- | --- | --- |
| 默认列表 | 5 条 | 5 / 5 |
| 匹配我的空闲时间 | J-01 | 1 / 5，J-01 |
| 日薪筛选 | J-04 | 单独显示 J-04，日薪不折算时薪 |
| 夜班岗位 | J-02 基础 12 + 夜班补贴 4 | 有效时薪 ¥16/小时，补贴构成明确 |
| 5 公里内 | 同一驿站全部保留 | 5 条均约 0.3 公里 |
| 最多比较 | 2–3 条，第四条阻止 | J-01/J-02/J-04 可比较；第 4 条提示“最多比较 3 条岗位” |
| 比较刷新 | URL query 恢复选择 | 3 条比较在刷新后保留 |
| 已满/过期 | 不可报名并解释原因 | J-04 显示“名额已满”，J-05 显示“报名已截止” |

比较页包含班次、距离、计价构成、有效时薪或日薪、预计总收入、结算时间、结算前提和剩余名额；没有生成可信度分或安全承诺。

## 云端生命周期（真实 Supabase）

完整 UAT 在上方 G5 UAT Preview、同一匿名会话完成：

| 步骤 | 当前状态 | 事件 | 名额 | 金额/结算 | 结果 |
| --- | --- | --- | --- | --- | --- |
| 学生提交 J-01 | `pending` | 1：学生提交 | 5 → 4 | 无最终金额 | 通过 |
| 招聘方确认 | `confirmed` | 2：招聘方确认 | 4 | 无最终金额 | 通过 |
| 招聘方录入 270 分钟 | `pending_settlement` | 4：`completed` → `pending_settlement` | 4 | `actual=270`，`final=5400` 分（¥54），唯一 pending settlement | 通过 |
| 招聘方进入独立结算页 | `pending_settlement` | 4 | 4 | 显示 ¥54 与计价快照 | 通过 |
| 确认 Demo 模拟结算 | `settled_demo` | 5：`settled_demo` | 4 | settlement 与 application 同为 `settled_demo` | 通过 |
| 学生回读 | `settled_demo` | 5 条严格时间线 | 4 | 显示 270 分钟、¥54、`已结算（Demo模拟）` | 通过 |

数据库 `complete_application` 在一个事务中计算金额、写入完工事件、唯一待结算记录和待结算事件；`settle_demo` 只允许 `pending_settlement`。前端不能提交最终金额。

## 非法与幂等边界

- UI 对 `301` 分钟显示范围错误并禁用完工按钮；数据库 RPC 同时限制 `1..scheduled_minutes`。
- 状态动作按矩阵显示：`pending` 只能确认，`confirmed` 只能完工，`pending_settlement` 只能模拟结算，`settled_demo` 只读。
- mapper 单测覆盖 `already_completed`、`already_settled`、事件顺序、金额快照和未知状态拒绝；数据库 RPC 已审查行锁、会话归属和幂等返回。
- G4 已验证两匿名会话隔离；G5 继承该约束，未改动 RLS/RPC/schema。

## 刷新、直接路由与响应式

最终 Preview 的 `/`、`/student/jobs`、`/student/compare`、`/student/applications`、`/employer/dashboard`、`/employer/applications`、`/employer/settlements` 均 HTTP 200。

浏览器验收结果：

| 视口 | 页面 | `scrollWidth = clientWidth` | 主要目标 |
| --- | --- | --- | --- |
| 375 × 812 | 岗位列表、岗位比较、学生回读、模拟结算 | 是（浏览器布局 viewport clientWidth 360） | 最小 44px |
| 1440 × 900 | 三列岗位比较、模拟结算 | 是（clientWidth 1425） | 三列比较正常 |

浏览器控制台 `error/warn` 日志：0（页面日志；浏览器工具自身遥测网络提示不属于应用日志）。

## 重置

完整生命周期终态点击“重置当前 Demo”后：

- 报名、5 条事件和 settlement 清空；
- J-01 名额恢复 5；
- 学生可用时间同步到新 J-01 班次；
- 旧岗位实例 ID 不再作为新会话数据使用；
- 学生“我的报名”显示空状态。

## 已知限制（留给 G6/G7）

- 学生取消、招聘方拒绝及拒绝原因、名额释放和异常恢复体验留在 G6。
- 网络失败/超时、并发多标签页、390×844/768×1024/Edge 和键盘焦点全量回归留在 G6。
- D-020：大陆无 VPN 访问 Vercel 的可达性仍需用户使用普通宽带和手机网络最终确认；不把浏览器代理验收宣称为大陆直连通过。
- 当前是匿名演示角色切换，不是生产登录/权限；结算明确为 Demo 模拟，不发生真实支付。

## 三方票决

- 产品负责人：无条件同意
- 技术负责人：无条件同意
- 质量负责人：无条件同意
- 阶段状态：G5 已关闭；三票均确认无需变更控制，进入 G6 前置准备。
