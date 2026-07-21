# 阶段证据索引

收口复核时间：2026-07-21 12:21:04 +08:00  
执行环境：Windows / `D:\codex\paper_agent\campus-gig-platform`  
复核角色：产品负责人、技术架构负责人、交付与质量负责人  
说明：本索引不记录自身哈希，避免自引用变化。

## 文档版本

| 文件 | SHA-256 |
|---|---|
| `AGENTS.md` | `15FFAC070CA5893AC53F6D663018D8AC303E91D54311C5ED98F060B492DB6CB2` |
| `docs/PRODUCT_SPEC.md` | `16D892DA24A0B2265FC2711A03490D98BB2F8D03A6AE221B2CADA2945836F678` |
| `docs/DOMAIN_AND_DATA.md` | `C6FA45C8A0F86E248B651D60ECCECAD6946C6C88D80E7D068A227525635B7459` |
| `docs/DELIVERY_PLAN.md` | `37D59ECFF2FD46111EC7E5DE13555F6EADC86154CBF3BBAE76BB21B8F9E22512` |
| `docs/QA_MATRIX.md` | `A346A65DC8254BA320E0CFD8161FCC4E53DE16A2C692D4ABC0D03BFFBC30F183` |
| `docs/DECISIONS.md` | `1772F13F1935AEA05E47811AC1A8D45A6889B7DF129804D50536CF752863AAE3` |
| `docs/CHANGE_CONTROL.md` | `225B5B56A4AF1C1D916F4949CBFAFD4A8F0145876D2EF22B6F5AD088E053AE7A` |

## G0：治理基线

### 被审材料

`AGENTS.md`、`DELIVERY_PLAN.md`、`QA_MATRIX.md`、`DECISIONS.md`、`CHANGE_CONTROL.md`。

### 走查结果

- 三方一致机制仅约束材料性决策，例行实现边界明确。
- G0–G7 顺序、退出条件、截止时间和不可裁剪项一致。
- 密钥、数据库 migration、状态流转和阶段越权禁止事项一致。
- 冲突扫描未发现未决 `Proposed`、待表决决策或阶段规则冲突；`CHANGE_CONTROL` 中出现的 `Proposed` 仅为状态模板。
- 当前 Vercel 无关英文模板已记录为 G3 准入阻塞，不被当作交付证据。

### 票决与结论

- 产品负责人：无条件同意。
- 技术架构负责人：无条件同意。
- 交付与质量负责人：无条件同意。
- 对应决策：D-001–D-010、D-016。
- 结果：通过。

### 已知限制

G0 为文档治理验收，不包含构建、数据库或云部署运行证据。

## G1：产品与交互契约

### 被审材料

`PRODUCT_SPEC.md`，并与 `DOMAIN_AND_DATA.md`、`QA_MATRIX.md` 交叉核对。

### 三分钟主路径走查

1. 学生进入 XX 大学岗位发现页。
2. 比较最多3条驿站班次。
3. 查看 J-01 的直招证据、计价和结算规则。
4. 报名后进入“待招聘方确认”。
5. 切换招聘方端并确认报名。
6. 切回学生端看到“报名已确认”。
7. 招聘方核定实际分钟并确认完工。
8. 系统记录完成事件并自动创建待模拟结算。
9. 招聘方在唯一结算处理页确认模拟结算。
10. 学生端看到“已结算（Demo模拟）”和完整时间线。

结果：路径入口、出口、按钮条件和角色切换无断点。

### 文案与误导风险审查

- “直招”仅表示主体关系在合成演示数据中已披露，不宣称真实认证。
- 不显示可信度评分，不输出“骗子”“绝对安全”等结论。
- “已结算”始终带有 Demo 模拟标识，不暗示真实支付。
- 当前所有岗位、校园、学生和招聘方均为合成演示数据。
- 学生只可在 `pending` 取消；招聘方只可在 `pending` 拒绝且理由必填。

### 票决与结论

- 产品负责人：无条件同意。
- 技术架构负责人：无条件同意。
- 交付与质量负责人：无条件同意。
- 对应决策：D-008、D-010、D-011。
- 结果：通过。

### 已知限制

G1 只验证产品和交互契约；视觉成品、浏览器交互和实际耗时在 G3–G7 验证。

## G2：状态、数据与安全

### 被审材料

`DOMAIN_AND_DATA.md`，并与 `PRODUCT_SPEC.md`、`QA_MATRIX.md` 交叉核对。

### 状态与约束走查

- 合法状态：`null→pending→confirmed→completed事件→pending_settlement→settled_demo`。
- 终态：`cancelled`、`rejected`、`settled_demo`；禁止跨级和终态后变更。
- `pending` 报名原子占名额；取消/拒绝只释放一次；`confirmed` 后不释放。
- 时薪按分钟四舍五入到分，夜班补贴覆盖全部核定分钟；日薪固定。
- `actual_minutes` 为1到计划分钟的正整数，不支持加班。
- 不可变岗位模板与当前匿名会话班次实例分离，避免不同评测者共享名额和日期。
- 重置只影响当前 `auth.uid()`，并同步学生可用时间和动态周末班次。
- 关键唯一、外键、非空、金额、工时、容量和计价互斥约束已固定。

### RLS/RPC 威胁走查

- Anonymous Auth 成功后数据库角色为 `authenticated`，以 `auth.uid()` 隔离会话。
- 基表不向浏览器开放直接读写；所有读取和业务写入均通过受控 RPC。
- `SECURITY DEFINER` RPC固定安全 `search_path`、使用全限定表名、撤销 `PUBLIC EXECUTE`，仅授权 `authenticated`。
- 前端不能提交 actor、最终金额、事件时间或任意状态。
- `service_role` key、数据库密码和GitHub token禁止进入前端、Vercel客户端变量或公开仓库。
- 幂等和唯一约束防止重复报名、事件、结算和名额扣减。

### 票决与结论

- 产品负责人：无条件同意。
- 技术架构负责人：无条件同意。
- 交付与质量负责人：无条件同意。
- 对应决策：D-006、D-007、D-012–D-015。
- 结果：通过。

### 已知限制

G2 为 migration-ready 契约审查，尚未实际创建 Supabase 表、策略或 RPC；其执行与越权测试属于 G3–G5 证据。

## G3–G7

每阶段完成后追加：commit SHA、执行环境与时间、测试命令、Preview/Production URL、关键截图、数据库检查、已知限制和三方票决。

## G3：工程骨架与云端校准（实网闸门待完成）

复核时间：2026-07-21 14:28:41 +08:00。

执行环境：Windows / `feat/g3-foundation` / Node.js 22（Codex bundled runtime）/ Vercel Preview / Supabase。

- 工程与 migration 提交：`0881711d5e3b969bf3aebf15ec2e7e4c00344cbc`；
- 当前应用与部署提交：`164b50ad865e8c3b6222fa9a034b54e1bc8d98a0`；
- GitHub 远端 `feat/g3-foundation` 与本地提交一致；
- Vercel Deployment Details 显示来源 `feat/g3-foundation`、SHA `164b50a`、状态 `Ready Latest`；
- Preview 基础域名：`https://campus-gig-platform-git-feat-g3-foundation-campus-gig-platform.vercel.app`；
- 依据 D-018，当前 `campus-gig-platform` 项目的 `Require Log In` 已关闭；Preview 基础域名无需 Vercel 登录、分享参数或访问令牌即可公开访问。Production 验收后恢复 Preview 保护。

### 自动检查

| 检查 | 命令/方式 | 结果 |
|---|---|---|
| TypeScript | 本地 `tsc -b --pretty false` | 通过 |
| ESLint | 本地 `eslint src --ext .ts,.tsx --max-warnings 0` | 通过，0 warning |
| Vitest | 本地 `vitest run` | 2个文件、8项测试全部通过 |
| Production build | 本地 `tsc -b && vite build` | 通过，81 modules；JS gzip 112.86kB；CSS gzip 1.91kB |
| 旧模板扫描 | 本地 `dist` 与部署 JS 扫描 `YUVASREE`、`TechFest`、`Python Scraper`、印度注册号和美元技术任务 | 零命中 |
| 密钥扫描 | 实际 `sb_secret_*`、`service_role` JWT claim、数据库连接串及被跟踪真实 `.env` | 零命中；Supabase 客户端库的字面量类型标记不作为密钥命中 |
| 工作树 | `git status --short` | 自动检查前为干净工作树；当前仅本证据回写待提交 |

### Supabase 与权限证据

- 用户已在 Supabase SQL Editor 执行 `202607210001_init_demo.sql`，结果为 `Success. No rows returned`；
- Anonymous Sign-ins 已开启；
- 匿名注册返回有效会话，`initialize_demo_session()` 返回 `XX大学` 和有效会话ID；
- `get_current_demo_jobs()` 返回恰好5条且均有实例ID；前端只有在上述全部条件满足时才显示“工程骨架与云端已连接”；
- 两个新匿名会话各返回5条班次，实例ID交集为0；
- 重置会话A后，A的5条班次全部重建，会话B的5条班次ID全部保持不变；
- 浏览器令牌直接读取 `demo_sessions` 基表返回HTTP 403；直接写入同一基表也返回HTTP 403；
- 测试只使用公开 publishable key，未读取或使用数据库密码、Secret key 或 `service_role` key。

### Vercel 浏览器与响应式证据

- 带分享授权的 Preview 在未登录 Vercel 的新浏览器环境中可访问，页面标题为“校园零工平台”；
- 根路由正确进入 `/student/jobs`，中文工程壳约1.4秒可见；
- `/student/jobs` 与 `/employer/dashboard` 可直接访问，约2.1秒内显示云端连接成功，无404；
- `/employer/dashboard` 刷新后仍保持招聘方角色、招聘方导航和云端连接状态；
- 学生端点击“招聘方端”可进入 `/employer/dashboard`；
- 浏览器控制台 warning/error 为0；
- 375×812、390×844、768×1024、1440×900：`scrollWidth <= clientWidth`，无越界元素；
- 四个视口的学生端/招聘方端角色按钮高度均为44px；
- [375×812 本地截图](evidence/g3-local-375x812.jpg)；
- [1440×900 本地截图](evidence/g3-local-1440x900.jpg)；
- 用户提供的 Vercel 与云端成功截图作为本轮对话证据保留，未复制包含分享访问令牌的截图到公开仓库。

### 三方正式表决前预审

- 产品负责人：产品范围、中文演示属性、角色与页面认知未发现新阻塞；
- 技术架构负责人：工程分层、Supabase/RPC/RLS、会话隔离和部署未发现新阻塞；
- 交付与质量负责人：自动化、路由、四视口、控制台、安全与旧模板扫描未发现新阻塞；
- 三方对原G3实现预审均未发现新代码阻塞。D-019曾将风险判断为特定手机蜂窝，后续直连证据证明大陆PC无代理也失败，D-020据此替代D-019：G3保留外部托管可达性阻塞，但允许派生feat分支推进G4–G6。

### 中国大陆无 VPN 实网记录

手机蜂窝失败记录：

- 网络：用户手机蜂窝网络，中国大陆，无VPN；
- URL：公开且无query的 `https://campus-gig-platform-git-feat-g3-foundation-campus-gig-platform.vercel.app`；
- 前置排除：Vercel Authentication 已关闭；外部未登录检查返回HTTP 200、标题“校园零工平台”，约0.75秒，未跳转 `vercel.com/login`；电脑端打开正常且速度较快；
- 现象：手机端等待约15–20秒后显示无法打开页面，应用壳未出现；
- 判定：最初记录为D-019风险；后被范围更准确的D-020替代，不标记为通过；G7复测Production短域名和一个经批准的备用托管候选。

### D-020 外部托管风险与阶段顺序例外

- 关闭Vercel Authentication后，代理环境外部未登录检查返回HTTP 200、标题“校园零工平台”，约0.75秒；
- 本机显式绕过系统代理时，首次HTTPS请求失败；目标域名443直连失败，DNS解析返回异常地址；
- 电脑浏览器快速打开依赖 `127.0.0.1:10090` VPN代理，不能作为大陆无VPN通过证据；
- 用户手机蜂窝无VPN等待约15–20秒后无法打开；
- 产品、技术、质量三方均无条件同意D-020：G3保持外部托管可达性阻塞，不合并main；允许在派生feat分支推进G4–G6，所有证据必须注明代理条件；
- G7优先验证Production短域名与经批准的备用托管候选。若最终仍不可达，交付材料说明部分大陆网络可能无法直连及实际所需网络条件，不能写“PC可用”。

### 当前结论与未关闭闸门

- G3工程、数据库、Preview、RLS/RPC、路由和响应式骨架已校准，但外部托管可达性仍未通过；
- 依据D-020，允许从当前分支派生feat分支推进G4–G6，不得将G3标记完成或合并main；
- G4–G6仍须各自满足全部退出条件并完成三方票决，同时注明继承G3公网风险；
- 通过三票后才能合并 `main`，并继续核对 Production SHA 与 GitHub `main` 一致、旧生产模板被覆盖；
- Edge最新稳定版完整主流程证据按既定G6质量阶段补充；移动端响应式与移动浏览器功能仍必须在G6通过，D-020只改变阶段顺序，不豁免产品功能或安全验收。

## G4：最小真实双端纵向切片

复核时间：2026-07-21 19:17 +08:00。

- 实现分支：`feat/g4-vertical-slice`；
- 最终实现 commit：`8a4af1db458631fdb93203f161c62a60d955472e`；
- 对应 Preview：`https://campus-gig-platform-l2mrer1kb-campus-gig-platform.vercel.app`；
- 网络条件：Codex 浏览器及当前系统 VPN/代理路径；不作为大陆无 VPN 直连通过证据；
- 详细执行矩阵、截图、哈希与限制：[G4_VERIFICATION.md](evidence/G4_VERIFICATION.md)。

### 退出条件证据

- 学生读取 J-01、完整透明度证据并报名；云端写入 `null → pending`，名额 5→4；
- 招聘方重新读取同一报名并确认；学生重新读取 `confirmed` 和严格两条事件；
- 快速双击报名/确认不产生重复报名、扣减或事件；
- 刷新、直接子路由、角色切换后状态保持；路由切换回到页首；
- 重置取消不改变状态；确认重置后名额恢复5、报名清空、实例重建；
- 独立匿名会话 A 重置不影响会话 B 的已确认报名和事件；
- TypeScript、ESLint、3文件15项Vitest、production build、密钥与旧模板扫描全部通过；
- 375×812 与 1440×900 均无横向溢出，主要触控目标不小于44px，控制台 warning/error 0；
- `confirmed` 明确显示“当前状态不可取消”；完工与模拟结算明确属于 G5，未提前伪造。

### 三方正式票决

- 产品负责人：无条件同意；
- 技术架构负责人：无条件同意；
- 交付与质量负责人：无条件同意；
- 最终结论：G4 已完成。依据 D-020 不合并 `main`，G3 外部托管可达性风险继续保留到 G7。

## G5：完整业务生命周期

- 最终实现提交：`d6298681eef35809d310a6232b488d80ecb1d3a0`；
- 五岗位、筛选、最多三条比较、招聘方完工、数据库计价、唯一模拟结算和学生五事件回读全部通过；
- 时薪、夜班、日薪、分钟舍入、名额、幂等和非法跨级均按冻结契约验证；
- 详细命令、Preview、浏览器 UAT 与三方票决：[G5_VERIFICATION.md](evidence/G5_VERIFICATION.md)；
- 产品、技术、质量三方均无条件同意，G5 已完成；依据 D-020 不合并 `main`。

## G6：异常、响应式与视觉质量

- 最终应用提交：`c4de0aeef402a46f3d503c4032ae13279aa354e8`；最终 Edge 证据提交：`7716298`；
- 学生 pending 取消、招聘方 pending 拒绝及原因回读、终态只读、网络失败保留真实状态和恢复重试全部通过；
- Microsoft Edge `150.0.4078.65` 对真实 Preview 完成请求阻断、恢复、四视口和 12 张截图验收，结构化结果 `passed=true`；
- TypeScript、ESLint、5 文件 27 项 Vitest、100 modules production build、冻结哈希、旧模板和密钥扫描全部通过；
- 详细命令、Preview、截图哈希与票决：[G6_VERIFICATION.md](evidence/G6_VERIFICATION.md)；
- 产品、技术、质量三方均无条件同意，G6 已完成；D-020 继续留在 G7，当前不合并 `main`。
