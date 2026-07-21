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
