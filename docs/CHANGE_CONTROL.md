# 材料性变更控制

## 1. 何时必须提交变更

出现以下任一情况时，停止相关实现并提交变更请求：

- 改变产品定位、用户、角色或 MVP 范围；
- 改变主流程、异常流程或状态机；
- 改变实体关系、金额规则、名额规则或 RLS/API 权限；
- 新增地图、支付、信用评分、正式登录等外部能力；
- 改变视觉原则或发布验收标准；
- 改变硬截止时间、Supabase区域或托管平台；
- 实现发现已批准文档相互冲突或无法落地。

例行实现、缺陷修复、测试补充、文案微调和不改变视觉原则的样式调整无需提交材料性变更。

## 2. 变更请求模板

```text
CR 编号：
提出日期：
提出者：
当前批准规则：
拟议变更：
原因：
影响页面：
影响状态/数据/RLS：
影响测试：
影响交付时间：
替代方案：
回滚点：

产品负责人：同意 / 反对 / 有条件同意
技术架构负责人：同意 / 反对 / 有条件同意
交付与质量负责人：同意 / 反对 / 有条件同意
最终状态：Proposed / Approved / Rejected / Superseded
```

只有三位均为“无条件同意”时，状态才能变为 `Approved`。

## 3. 执行顺序

1. 创建 CR 并停止受影响实现；
2. 分析产品、数据、权限、测试和工期影响；
3. 三方独立表决；
4. 通过后先更新事实来源文档；
5. 再修改 migration、代码和测试；
6. 完成对应阶段的全部回归；
7. 将旧决策标记为 `Superseded`，不得删除历史。

涉及状态机、表结构或 RLS 的变更自动重新打开 G2；涉及主流程或范围的变更自动重新打开 G1。

## 4. 回滚原则

- 自 G3 首个有效版本起，`main` 必须保持可演示；
- 使用 revert 或恢复上一 Vercel deployment，不使用破坏性 git reset；
- 已执行数据库 migration 只追加修正，不直接修改历史文件；
- 破坏性数据变更前保存演示数据快照；
- 种子数据和 Demo 重置必须幂等并版本化。
- 恢复旧应用版本前必须检查它与当前已执行 schema 的兼容性。

CR 统一保存在本文件末尾的“变更记录”章节，编号格式为 `CR-YYYYMMDD-NNN`，不得复用。

## 5. 变更记录

### CR-20260721-001：当前 G3 Preview 分支别名公开例外

- 提出日期：2026-07-21
- 提出者：Codex G3 校准
- 当前批准规则：Vercel Hobby Standard Protection 保护 Preview；G3 必须在大陆无 VPN 普通宽带与手机网络各连续测试3次。
- 拟议变更：仅将 `campus-gig-platform-git-feat-g3-foundation-campus-gig-platform.vercel.app` 加入 Vercel Deployment Protection Exception，使该分支别名不经过 Vercel Authentication 或 `_vercel_share` 分享鉴权即可公开访问。
- 原因：电脑端带分享授权访问正常，而大陆手机蜂窝无 VPN 首次访问超时；Vercel 官方文档说明 Shareable Link 需要额外鉴权，Deployment Protection Exception 可只放行指定 Preview 域名。
- 影响页面：当前 G3 Preview 的所有前端路由。
- 影响状态/数据/RLS：无。Supabase Anonymous Auth、`auth.uid()` 会话隔离、RLS、受控 RPC 和基表403边界保持不变。
- 影响测试：例外启用后使用不带任何 query 的分支别名，重新执行普通宽带和手机蜂窝各3次；阈值仍为应用壳不超过10秒、Auth与首批5条岗位不超过20秒、零错误和零人工重试。
- 影响交付时间：增加一次 Vercel 后台配置和原网络闸门复测；不改变硬截止。
- 替代方案：直接合并 `main` 后用公开 Production 测试会违反“阶段三票后再合并 main”的既定顺序；关闭整个项目的 Vercel Authentication 扩大范围，均不采用。
- 回滚点：Production 公开链接可用并通过验收后，从 Deployment Protection Exceptions 移除该域名，确认 Preview 恢复保护且 Production 仍公开。
- 官方依据：<https://vercel.com/docs/deployment-protection>；<https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/deployment-protection-exceptions>。

票决：

- 产品负责人：无条件同意；
- 技术架构负责人：无条件同意；
- 交付与质量负责人：无条件同意；
- 最终状态：Superseded by CR-20260721-002。Vercel 后台确认该功能只向 Pro + Advanced Deployment Protection 提供，Hobby 无法执行，未产生外部设置变更。

### CR-20260721-002：临时关闭当前项目 Vercel Authentication

- 提出日期：2026-07-21
- 提出者：Codex G3 校准
- 当前批准规则：CR-20260721-001 拟只放行一个 Preview 域名，但 Vercel 后台确认 Deployment Protection Exceptions 在当前 Hobby 计划不可用。
- 拟议变更：关闭 `campus-gig-platform` 项目 Deployment Protection 中的 `Require Log In`，临时公开该项目全部 Preview；不改变团队级设置或其他项目。
- 原因：免费解除 Vercel Authentication 和 Shareable Link 鉴权链路，才能使用无 query 域名完成大陆手机网络真实访问测试；不升级每月150美元的 Pro Advanced Protection。
- 影响页面：当前项目所有 Preview 路由；Production 在 Hobby Standard Protection 下原本即公开。
- 影响状态/数据/RLS：无。Supabase Anonymous Auth、`auth.uid()` 会话隔离、RLS、受控 RPC 和基表403边界保持不变。
- 影响测试：使用无 `_vercel_share`、无 query 的分支别名，重新执行普通宽带和手机蜂窝各3次；阈值和失败判定不变。
- 影响交付时间：增加一次免费项目设置切换和复测；不改变硬截止。
- 替代方案：支付 Pro Advanced Protection 以使用单域名例外，成本与短期合成 Demo 不匹配，不采用。
- 风险：该项目其他 Preview 暂时公开，可能增加匿名会话和免费额度消耗；当前单项目、短周期、全合成数据且无密钥，风险可接受。
- 回滚点：Production 公开链接验收后重新开启 `Require Log In`，复核 Preview 恢复保护且 Production 仍公开。

票决：

- 产品负责人：无条件同意；
- 技术架构负责人：无条件同意；
- 交付与质量负责人：无条件同意；
- 最终状态：Approved。
