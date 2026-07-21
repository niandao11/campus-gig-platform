# G6 异常、体验与质量验证

- 执行日期：2026-07-21（北京时间）
- 分支：`feat/g6-quality`
- 应用实现提交：`995d72a747a001123020826fc9a271db6878f459`
- 测试补充提交：`92c069f`
- Preview：[campus-gig-platform-ioytlibe3-campus-gig-platform.vercel.app](https://campus-gig-platform-ioytlibe3-campus-gig-platform.vercel.app)
- 网络说明：Preview 浏览器验收使用可访问 Vercel/Supabase 的代理环境；不得写成中国大陆无 VPN 直连通过。D-020 保留至 G7。

## 自动门禁

| 检查 | 结果 |
| --- | --- |
| `tsc -b --force --pretty false` | 通过 |
| `eslint src --ext .ts,.tsx --max-warnings 0` | 通过，0 warning |
| Vitest | 5 个文件、26 项用例全绿 |
| `pnpm run build` | 通过；Vite 100 modules，JS gzip 127.50 kB，CSS gzip 5.20 kB |
| 页面层直接调用 Supabase | 零命中；仍为 page → service → repository → RPC |
| migration/state machine | 未修改；SHA-256 见下文 |
| 实际密钥模式 | 未发现实际 `sb_secret_*`、数据库连接串或 `service_role` JWT；治理文档中的禁止性文字不作为密钥命中 |

新增测试覆盖：拒绝原因 trim 后 1–500 字、匿名 Auth/云端连接失败不伪造 ready、中文安全错误和通用重试文案。

## 学生取消异常流

真实 Supabase、同一匿名会话验证：

1. 学生报名 J-01 后为 `pending`，J-01 名额从 5 降为 4；
2. “我的报名”只在 `pending` 显示“取消报名”；
3. 二次确认弹层明确终态和名额规则；
4. 调用 `cancel_application` 后回读 `cancelled`；
5. 时间线严格为 `pending`（student）→ `cancelled`（student），note 为“学生取消演示报名”；
6. 取消按钮消失，页面显示终态只读说明；
7. RPC 已审查重复 cancelled 返回 `already_cancelled=true`，不会重复事件或释放名额。

## 招聘方拒绝异常流

真实 Supabase、重置后的同一匿名会话验证：

1. 招聘方仅在 `pending` 看到“拒绝报名”；
2. 空原因时“确认拒绝报名”禁用；输入“该班次临时调整为需要夜间作业经验”后可提交；
3. 回读 `rejected`，时间线新增 `pending → rejected`，actor 为 employer，note 原样保留；
4. 招聘方终态只读，不再显示确认、拒绝、完工或结算按钮；
5. 学生端显示“报名未通过”和相同原因；
6. 返回岗位列表后 J-01 名额为 5/5；
7. RPC 已审查重复 rejected 返回 `already_applied=true`，不会重复事件或释放名额。

## 非法状态与既有异常

- 招聘方确认报名后，学生端显示“当前不可取消”，DOM 中“取消报名”按钮数量为 0。
- `confirmed`、`pending_settlement`、`settled_demo`、`rejected`、`cancelled` 不渲染非法取消入口。
- 非 `pending` 不渲染拒绝入口；数据库 RPC 同时拒绝跨级调用。
- J-04 已满、J-05 过期继续显示明确禁用原因；重复报名由 `hasApplied` 和 RPC 幂等双层阻止。
- 取消、拒绝、确认、完工和模拟结算的成功提示改为等待云端重新读取后出现，避免成功提示与旧状态短暂冲突。

## 网络、加载、错误和空态

- `bootstrapDemoSession` 单测确认匿名登录/云端失败返回 `ready=false`，保留中文安全原因或通用“云端连接失败，请稍后重试”，不会显示静态岗位。
- 首次加载失败使用 Foundation/PageFeedback 的错误与重试；已有数据刷新失败保留上次真实数据并显示错误。
- 取消、拒绝、完工、结算和重置失败路径均重新启用按钮、保留原始状态；拒绝原因在失败时不清空。
- Microsoft Edge DevTools Protocol 对真实 Preview 执行 `Network.setBlockedURLs('*supabase.co/*')`：取消 mutation 失败后仍为 `pending`，错误与重试可见，按钮恢复；解除阻断后同一弹层重试成功进入 `cancelled`。
- 对已有 `rejected` 数据阻断 Supabase 后点击“刷新状态”：出现“刷新失败”，原报名状态和拒绝原因继续显示，不伪造成功或清空数据。
- 清除当前域名会话数据并阻断 Supabase 后重新加载：Foundation 显示“云端连接失败”和“重新连接”；解除阻断后重试恢复 5 条岗位。

## 响应式与可用性

| 视口 | 结果 |
| --- | --- |
| 375 × 812 | `scrollWidth = clientWidth = 360`；筛选单列 |
| 390 × 844 | 取消/拒绝弹层和完整异常流可操作；页面无横向溢出 |
| 768 × 1024 | `scrollWidth = clientWidth = 753`；筛选两列 |
| 1440 × 900 | `scrollWidth = clientWidth = 1425`；筛选四列 |

- 可见主要按钮、链接、输入控件最小高度 44px；
- 新增弹层支持 Escape 关闭（提交中除外），提交中按钮禁用；
- Chromium 自动化与 Microsoft Edge `150.0.4078.65` 均完成主路径、取消、拒绝和错误态验收；
- 最新 Preview 首屏 J-01 位于首位，控制台应用 error/warn 为 0；
- `/`、学生三条路由、招聘方三条路由均 HTTP 200。

## Edge 截图与哈希

Edge QA 脚本：`scripts/edge-g6-qa.mjs`；结构化结果：`docs/evidence/g6/screenshots/edge-g6-results.json`。

| 截图 | 场景 | SHA-256 |
| --- | --- | --- |
| `01-jobs-390.png` | 390 岗位首页 | `df4ff436307c3d4837594fbd8acb780a44c2d150e0ef0affc768b01b300053a1` |
| `02-cancel-pending-390.png` | pending 取消入口 | `72bbf616917b765b93acc13e5f499949738f6a54284a3bfd5e868119e50ab302` |
| `03-cancel-network-error-390.png` | 取消 mutation 网络失败 | `31cf0b4851d51f0c4b5b37714011618b5c7998d59dbd49e0afe70e5937ab045b` |
| `04-cancelled-390.png` | cancelled 终态 | `850b0907271f0e830bac436e2777777525e51e3c0b229d2544668a85b852e9cd` |
| `05-reject-empty-390.png` | 拒绝原因必填 | `6e1083775d88687566cca57a686eda2c2ecd3273cd97b848481b3c508c215b18` |
| `06-rejected-employer-390.png` | 招聘方 rejected 终态 | `a6799e9eea06cff8148d5850bbb1e5be049748ed3466d2d9ba14608ad71796a6` |
| `07-rejected-student-390.png` | 学生回读拒绝原因 | `09b597859b650482eff08c3a06006c76b107c13643678e80347472d9cc991905` |
| `08-refresh-network-error-390.png` | 已有数据刷新失败 | `8aaa053b66774c6f539a7fa1d61a8aa60a1c01b0195b88dfc7304b47ba794bb1` |
| `09-bootstrap-network-error-390.png` | 首次会话连接失败 | `0fa53b7dc01b2feb0e6654f0c3f8d6f0eb6448667ca145220f161afa2b8628d9` |
| `10-jobs-375.png` | 375×812 | `a48c88910133fdfb880abc666be6ce744f07a1fdaf36d3527cff6eae2ed2646f` |
| `11-jobs-768.png` | 768×1024 | `edd1ea2a088d0fa2782e1b7e072048685d2944c8ed695ca2438f2338c4db2065` |
| `12-jobs-1440.png` | 1440×900 | `c3e23a66e3510a5d5cad3e104b92ae1f9e85dafee956b8a8baefaa6ad02db3d1` |

## 冻结契约哈希

- migration：`25FAFB6E7C3818D158F91F7E7DEA611FB1E85111FD60DE283FEBC8B2051539A1`
- `stateMachine.ts`：`21E4047AF1D3BE7E9C9C0A76E34EFE6A536AC428EBFF7044170565E730EB13F9`
- `stateMachine.test.ts`：`A696A0342D1999F8E63C60DB71F51E09011DB30F41786A88309E45F2A648617B`

G6 没有新增状态、修改金额、RLS、RPC、schema 或 migration。

## 已知限制

- D-020：中国大陆无 VPN 到当前 Vercel 域名的外部可达性仍未通过，G7 必须优先处理 Production 短域名与备用托管候选。
- 当前已完成 Edge 请求阻断、恢复、四视口和异常流程；G7 仍需在用户真实无 VPN 网络复测托管域名可达性。
- 当前角色切换仍为演示权限，结算仍为 Demo 模拟，不发生真实支付。

## 三方票决

- 产品负责人：待最终校准
- 技术负责人：待最终校准
- 质量负责人：待最终校准
- 阶段状态：三票均无条件同意后关闭 G6。
