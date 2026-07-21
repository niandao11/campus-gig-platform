# 校园零工平台

面向在校学生的校园零工双角色演示产品。评测者可在同一个链接内切换“学生端 / 招聘方端”，完成校园快递驿站零工从岗位决策、报名确认、工时核定到 Demo 模拟结算的完整闭环。

> 所有校园、招聘方、学生和岗位均为合成演示数据，不构成真实招聘、企业认证或支付服务。当前 `vercel.app` 域名在部分中国大陆无 VPN 网络上可能无法直连；若出现 15–20 秒超时，请使用可访问 Vercel 与 Supabase 的网络环境。此限制不应被理解为“PC 一定可用”。

## 在线体验

- 已验证发布部署：[campus-gig-platform-dsuy15830-campus-gig-platform.vercel.app](https://campus-gig-platform-dsuy15830-campus-gig-platform.vercel.app)
- 计划短域名：`campus-gig-platform.vercel.app`；完成 Vercel Production Alias 切换前不要使用该短域名
- 默认入口：学生端“找零工”
- 建议开始前点击右上角“重置 Demo”，恢复当前浏览器的独立演示基线
- 完整三分钟操作说明：[docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)

## 产品定位

目标用户是一名本周六 14:00–19:00 有空的 XX 大学学生，希望在校园附近 5 公里内寻找时薪透明、结算条件明确的短期零工。当前场景只启用“XX大学”和“XX大学校园快递驿站”，数据结构保留多校园扩展能力。

产品重点不是岗位数量，而是把以下决策和履约链路做成可验证闭环：

- 在同一页面理解时间、距离、计价、预计收入、剩余名额和结算条件；
- 通过招聘主体、实际用工地点、支付主体和收费项等字段判断信息透明度；
- 学生与招聘方读取同一条云端报名，状态变化写入完整事件时间线；
- 最终金额由数据库按核定分钟和岗位快照计算，前端不能自由提交金额。

## 三分钟主流程

1. 点击“重置 Demo”，在学生端浏览 J-01–J-05 五条班次。
2. 选择 2–3 条岗位进入“岗位比较”，然后打开 J-01“入库分拣”详情并确认报名。
3. 切换“招聘方端”→“报名处理”，进入 J-01 报名并点击“确认报名”。
4. 在同一报名中录入 `270` 分钟，点击“确认完工并生成待结算”。
5. 进入“模拟结算”，点击“确认 Demo 模拟结算”。
6. 切回学生端“我的报名”，核对 ¥54 和五段事件时间线。

状态顺序固定为：

```text
待招聘方确认 → 报名已确认 → 工作已完成 → 待模拟结算 → 已结算（Demo模拟）
```

## 已实现

- 五条合成岗位：白班时薪、夜班溢价、日薪、已满和已过期样例；
- 时间、距离、计价和结算筛选，最多三条岗位比较；
- 岗位详情与逐项直招信息透明度证据；
- Supabase Anonymous Auth 下的当前浏览器匿名会话隔离；
- 学生报名、pending 取消、招聘方确认或填写原因拒绝；
- 招聘方核定实际分钟、数据库计价、唯一待结算记录和模拟结算；
- 双端一致的事件时间线、刷新回读和当前会话重置；
- 已满、过期、重复操作、无效工时和网络失败反馈；
- 中文移动优先界面，已验收 375、390、768 和 1440 四类视口。

## 架构与数据边界

```text
Vercel
  └─ React + Vite + TypeScript
       └─ 页面 → 业务服务 → 数据访问层
            └─ Supabase Anonymous Auth
                 └─ 受控只读/写入 RPC → PostgreSQL + RLS
```

- 页面不直接读写 Supabase 业务表；业务写入只经过受控 RPC。
- RPC 校验 `auth.uid()`、当前会话归属、状态、参数与幂等。
- 基表不向浏览器开放直接读写，金额、事件角色和时间由数据库生成。
- 浏览器和 Vercel 客户端只使用 publishable key；仓库不包含数据库密码、GitHub Token 或 `service_role` key。
- 岗位模板不可变，每个匿名会话拥有独立班次实例、名额、报名、事件和结算记录。

## 本地运行

要求 Node.js 20+ 和 pnpm。

```bash
pnpm install --frozen-lockfile
copy .env.example .env.local
pnpm dev
```

在 `.env.local` 中填写：

```dotenv
VITE_SUPABASE_URL=你的Project URL
VITE_SUPABASE_PUBLISHABLE_KEY=你的Publishable Key
```

首次创建数据库时，在 Supabase SQL Editor 执行版本化 migration：

```text
supabase/migrations/202607210001_init_demo.sql
```

然后在 Supabase 开启 Anonymous Sign-ins。不要把 `.env.local`、数据库密码或 Secret/`service_role` key 提交到仓库。

## 验证与部署

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Vercel 使用 Vite、`npm run build`、输出目录 `dist`、根目录 `./`；`vercel.json` 将全部业务子路由回退到 `index.html`。Production branch 为 `main`，环境变量使用与本地相同的两个 `VITE_` 参数。

阶段证据：

- [G4 双端报名确认](docs/evidence/G4_VERIFICATION.md)
- [G5 完整生命周期](docs/evidence/G5_VERIFICATION.md)
- [G6 异常与响应式质量](docs/evidence/G6_VERIFICATION.md)
- [G7 Production UAT](docs/evidence/G7_VERIFICATION.md)

## 明确未实现

- 正式注册登录、生产级学生/招聘方权限与企业成员关系；
- 多招聘方管理和岗位发布后台；
- 真实招聘数据、真实企业认证、信用评分或反诈结论；
- 真实支付、银行卡、资金托管、发票或税务；
- GPS、地图路线、实时聊天和通知；
- 多评测者协作、申诉和复杂工资管理。

“直招”只表示合成字段中的主体关系已披露；“已结算”始终是 Demo 模拟，不发生真实资金流转。

## 后续路线

1. 接入正式登录、校园成员关系和招聘方权限。
2. 增加招聘方岗位发布、审核与运营治理能力。
3. 评估国内可达的静态托管或自定义域名，降低 `vercel.app` 网络可达性风险。
4. 在不改变状态机核心的前提下扩展多校园、地图、消息和真实支付对接。
