# 领域、数据、状态与安全契约

状态：G2 已批准（产品、技术、质量三方无条件同意）。

## 1. 架构原则

```text
React 页面
  → 业务服务层
  → 数据访问层
  → Supabase Client
  → PostgreSQL / RLS / RPC
```

- 页面不得直接任意读写业务表。
- 合法状态流转由业务服务统一表达，由数据库 RPC/约束再次校验。
- 第一版保留 `campus_id`，不得把 XX 大学写死为不可扩展常量。
- 所有业务数据使用合成演示数据。

## 2. 核心实体

### `campuses`

- `id`
- `name`
- `latitude`
- `longitude`
- `timezone`
- `is_active`

### `employers`

- `id`
- `campus_id`
- `display_name`
- `legal_entity_name`
- `payment_entity_name`
- `contact_department`
- `direct_hire_disclosure`
- `fee_disclosure`

### `job_templates`

- `id`
- `campus_id`
- `employer_id`
- `title`
- `work_content`
- `requirements`
- `work_address`
- `latitude` / `longitude`
- 相对班次规则（周六/周日、开始时间、结束时间、相对周偏移）
- `pay_type`: `hourly | daily`
- `base_rate_cents`
- `night_bonus_cents`
- `daily_rate_cents`
- `settlement_timing`
- `settlement_conditions`
- `default_capacity`
- `scenario_kind`: `main | open | full | expired`

模板是不可变的演示定义，不保存会被访问者修改的名额或班次绝对日期。

### `demo_sessions`

- `id`
- `auth_user_id`
- `campus_id`
- `reset_version`
- `created_at` / `updated_at`

`auth_user_id` 唯一并引用 `auth.users(id)`；首次访问和重置均通过 RPC 初始化当前会话。

### `demo_job_instances`

- `id`
- `demo_session_id`
- `job_template_id`
- `shift_start` / `shift_end`
- `application_deadline`
- `capacity`
- `remaining_slots`
- `lifecycle_status`: `published | cancelled`
- `created_at` / `updated_at`

开放、已满、已过期是根据实例数据计算的 `availability_status`：

1. `lifecycle_status = cancelled` → 已取消；
2. 当前时间不早于 `application_deadline` → 已过期；
3. `remaining_slots = 0` → 已满；
4. 其他情况 → 开放。

不同时持久化 `full/expired` 和推导状态，避免两套真相。

### `demo_profiles`

- `id`
- `demo_session_id`
- `campus_id`
- `display_name`
- `available_start` / `available_end`
- `created_at` / `updated_at`

### `applications`

- `id`
- `demo_profile_id`
- `demo_session_id`
- `demo_job_instance_id`
- `status`
- `snapshot_employer_name`
- `snapshot_legal_entity_name`
- `snapshot_payment_entity_name`
- `snapshot_job_title`
- `snapshot_work_address`
- `snapshot_shift_start` / `snapshot_shift_end`
- `snapshot_pay_type`
- `snapshot_base_rate_cents`
- `snapshot_night_bonus_cents`
- `snapshot_daily_rate_cents`
- `snapshot_settlement_timing`
- `snapshot_settlement_conditions`
- `scheduled_minutes`
- `actual_minutes`
- `estimated_amount_cents`
- `final_amount_cents`
- `created_at` / `updated_at`

### `application_events`

- `id`
- `application_id`
- `from_status`
- `to_status`
- `actor`: `student | employer | system`
- `note`
- `created_at`

### `settlement_records`

- `id`
- `application_id`
- `amount_cents`
- `status`: `pending | settled_demo`
- `calculation_snapshot`
- `created_at` / `settled_at`

## 3. 报名状态机

```text
pending
  ├─ employer → confirmed
  ├─ employer → rejected（终态）
  └─ student  → cancelled（终态）

confirmed
  └─ employer + actual_minutes → completed

completed
  └─ system → pending_settlement

pending_settlement
  └─ employer → settled_demo（终态）
```

“确认完工”必须在同一数据库事务中：

1. 校验当前状态为 `confirmed`；
2. 校验实际工时合理；
3. 写入 `completed` 事件；
4. 计算最终金额；
5. 创建待结算记录；
6. 写入 `pending_settlement` 事件；
7. 将当前状态更新为 `pending_settlement`。

界面时间线显示“已完成→待结算”，即使当前状态最终为待结算。

禁止从 `pending` 直接跳到 `completed`、`pending_settlement` 或 `settled_demo`。

补充规则：

- 创建报名时写入 `null → pending` 事件，`actor = student`。
- 学生只可在 `pending` 取消；招聘方只可在 `pending` 拒绝。
- 拒绝原因必填并保存在事件 `note`。
- `cancelled`、`rejected`、`settled_demo` 为终态。
- 取消或拒绝后，当前会话不可再次报名同一班次；只有重置后可以重新演示。
- 对已处于目标状态的重复请求返回当前结果，不重复写事件；对其他非法状态返回明确错误。

## 4. 计价规则

### 时薪

- 有效时薪 = 基础时薪 + 夜班补贴。
- 预计金额 = 有效时薪 × 计划分钟数 ÷ 60。
- 最终模拟金额 = 有效时薪 × 核定实际分钟数 ÷ 60。

### 日薪

- 预计金额和最终模拟金额均为固定日薪。
- 日薪不得再次乘以工作小时数。
- 实际工时仍记录，用于解释履约，但不改变日薪金额。

所有金额以分存储。时薪计算使用 `round(rate_cents::numeric * minutes / 60)` 四舍五入到分；前端不得提交任意最终金额。

- `actual_minutes` 必须是正整数，且 `1 <= actual_minutes <= scheduled_minutes`；MVP 不支持加班。
- 夜班岗位的夜班补贴作用于全部核定分钟。
- 日薪岗位仍要求有效的正数实际工时，但金额保持固定日薪。

报名时保存岗位、时薪/日薪、夜班补贴和结算规则快照，避免岗位后续修改改变历史报名。

## 5. 会话班次和名额规则

- 首次初始化或重置时，RPC 基于不可变 `job_templates` 为当前 `auth.uid()` 创建独立 `demo_job_instances`。
- 开放班次使用 Asia/Shanghai 的“下一个周六/周日”；过期样例使用上一个周六；不存在“下一个周末或固定演示时钟”的未决分支。
- 只有 `availability_status = open` 的会话班次可报名。
- 同一 Demo 学生不能重复报名同一会话班次。
- 成功提交报名后以原子操作减少剩余名额。
- `pending` 即占用名额；拒绝或 `pending` 取消只释放一次名额。
- `confirmed` 后不再释放名额。
- 剩余名额不得小于 0。
- 释放后若 `remaining_slots > 0`，派生的可用状态自动从已满恢复开放。
- 报名、拒绝、取消和重置均须幂等。
- 一个会话只能有一组当前版本班次；重置在事务中清理当前会话报名/事件/结算/班次后按新版本重建。

## 6. 距离规则

- 默认使用 XX 大学校园中心演示坐标 `30.263600, 120.122000`，仅参考杭州高校校园尺度，不对应真实招聘信息。
- XX 大学校园快递驿站演示坐标固定为 `30.265200, 120.119800`；同一驿站发布的班次共用该工作地点。
- 岗位保存自身经纬度。
- 前端使用 Haversine 公式计算直线距离，并明确标注“直线距离”。
- 浏览器定位只能作为可选增强；拒绝定位权限时主流程仍完整可用。
- 当前 MVP 不依赖地图 API 或通勤路线。

## 6.1 动态日期确定规则

- 以数据库中的 Asia/Shanghai 当前日期为准。
- “下一个周六”指严格晚于当前本地日期的第一个周六；即使访问发生在周六，也生成下一周六，避免主班次当天过期。
- 下一个周日为该周六的次日；“上一个周六”固定为严格早于当前本地日期的最近一个周六。若访问日正好是周六，则取7天前，确保过期样例稳定成立。
- J-01报名截止为班次当日13:00；J-02为当日20:00；J-03为前一日20:00；J-04通过初始名额0形成已满；J-05使用上一个周六且报名截止已过去。
- 所有绝对时间以 `timestamptz` 保存，前端按 Asia/Shanghai 显示。

## 7. 匿名身份与角色切换

- 首次访问使用 Supabase Anonymous Auth 创建不可见身份；获得 JWT 后数据库角色为 `authenticated`，不与未登录的 Postgres `anon` 角色混称。
- `auth.uid()` 关联当前 Demo profile 和当前浏览器的报名数据。
- 学生端/招聘方端切换属于同一匿名会话中的演示视角，不构成生产级招聘方权限。
- 生产化时需改为正式账号、招聘方成员关系和真实角色授权，但不得重构核心业务实体。

## 8. RLS 与 API 边界

- 所有公共 schema 业务表显式启用 RLS。
- 浏览器登录后只通过经过筛选的只读 RPC 获取校园、招聘方公开字段、会话班次和当前会话记录；不直接读取含内部字段的基表。
- 业务表不向 `anon` 或 `authenticated` 开放直接 `INSERT/UPDATE/DELETE`。
- 报名、事件、结算只允许当前 `auth.uid()` 通过只读 RPC 读取。
- 报名、确认、拒绝、完工、模拟结算和重置通过受控 RPC 执行。
- RPC 固定为：`initialize_demo_session`、`apply_to_job`、`decide_application`、`cancel_application`、`complete_application`、`settle_demo`、`reset_demo_session`。
- RPC 必须校验 `auth.uid()`、会话归属、当前状态、目标状态、参数范围和幂等行为。
- `actor`、最终金额和事件时间由数据库函数写入，不接受前端自由传值。
- 使用 `SECURITY DEFINER` 的函数必须固定安全 `search_path`、使用全限定表名、撤销默认 `PUBLIC EXECUTE`，并只授权 `authenticated`。
- `service_role` key 不得进入浏览器、Vercel 客户端变量或公开仓库。

## 9. Demo 重置

- 重置只影响当前 `auth.uid()` 对应的会话班次、报名、事件和结算记录。
- 不可变岗位模板、校园和招聘方数据不被删除。
- 重置重新生成班次后，必须在同一事务把 `demo_profiles.available_start/end` 同步到新 J-01 的周六14:00–19:00。
- 重置操作幂等；重复点击不会产生重复数据。
- 两个角色在重置后重新读取同一基线。
- 重置失败必须有明确提示，不得显示已成功。

## 10. 多校园扩展

- 业务实体均通过 `campus_id` 关联校园。
- 当前前端只启用 XX 大学，不开发校园切换 UI。
- 未来新增校园时通过种子数据和权限关系扩展，不修改已有状态机。

## 11. Migration 级约束

- 主键统一使用 UUID，并设置数据库默认值；所有外键明确 `ON DELETE` 行为。
- `demo_sessions.auth_user_id` 唯一且非空，并 `references auth.users(id) on delete cascade`。
- `demo_job_instances` 唯一约束为 `(demo_session_id, job_template_id)`。
- `applications` 唯一约束为 `(demo_session_id, demo_job_instance_id)`。
- `settlement_records.application_id` 唯一且非空。
- `application_events` 只追加，不允许更新或删除，重置 RPC 的会话级清理除外。
- `capacity > 0`，且 `0 <= remaining_slots <= capacity`。
- `shift_end > shift_start`，`application_deadline <= shift_start`。
- `scheduled_minutes > 0`；`actual_minutes` 为空或满足 `1..scheduled_minutes`。
- 金额字段非负。
- 时薪岗位要求基础时薪为正、日薪为空；日薪岗位要求日薪为正、时薪和夜班补贴不参与金额计算。
- 校园、招聘方、模板、会话、班次和学生必须通过直接或会话/模板间接关系保持相同 `campus_id` 归属，RPC 再次校验。
- 所有状态字段使用 `text + check constraint`；终态不可再变更。
- 报名和结算创建采用唯一约束与行锁/条件更新防止重复和超额。

## 12. Migration 字段契约

所有表默认包含 `created_at timestamptz not null default now()`；可更新实体另含 `updated_at timestamptz not null default now()`。

| 表 | 字段类型与关键约束 |
|---|---|
| `campuses` | `id uuid primary key default gen_random_uuid()`；`name text not null unique`；`latitude numeric(9,6) not null`；`longitude numeric(9,6) not null`；`timezone text not null default 'Asia/Shanghai'`；`is_active boolean not null default true` |
| `employers` | `id uuid primary key`；`campus_id uuid not null references campuses(id) on delete restrict`；主体、支付主体、部门和披露文案均为非空 `text`；`deposit_required/training_fee_required/agency_fee_required boolean not null default false` |
| `job_templates` | `id uuid primary key`；`campus_id/employer_id` 非空外键且 `on delete restrict`；标题、工作内容、要求、文本地址和结算字段非空；坐标 `numeric(9,6)`；`relative_week smallint`；`weekday smallint check 1..7`；`start_local/end_local time`；`end_day_offset smallint check 0..1`；`deadline_offset_minutes integer`；计价、场景和容量按本文约束 |
| `demo_sessions` | `id uuid primary key`；`auth_user_id uuid not null unique references auth.users(id) on delete cascade`；`campus_id uuid not null references campuses(id) on delete restrict`；`reset_version integer not null default 1 check > 0` |
| `demo_profiles` | `id uuid primary key`；`demo_session_id uuid not null unique references demo_sessions(id) on delete cascade`；`campus_id uuid not null references campuses(id) on delete restrict`；`display_name text not null`；可用时间非空且结束晚于开始 |
| `demo_job_instances` | `id uuid primary key`；`demo_session_id uuid not null references demo_sessions(id) on delete cascade`；`job_template_id uuid not null references job_templates(id) on delete restrict`；绝对班次、截止时间非空；容量/名额满足约束；`lifecycle_status text not null check in ('published','cancelled')`；`unique(demo_session_id, job_template_id)` |
| `applications` | `id uuid primary key`；profile/session/instance 非空外键，session 删除时级联；`status text not null` 且只允许本文状态；主体、标题、地址、班次、计价类型和结算文本快照非空；价格快照按计价类型允许互斥空值；`actual_minutes` 与 `final_amount_cents` 可空直到完工；`unique(demo_session_id, demo_job_instance_id)` |
| `application_events` | `id uuid primary key`；`application_id uuid not null references applications(id) on delete cascade`；`from_status text null`；`to_status text not null`；`actor text not null check in ('student','employer','system')`；`note text null`；只追加 |
| `settlement_records` | `id uuid primary key`；`application_id uuid not null unique references applications(id) on delete cascade`；`amount_cents integer not null check >= 0`；`status text not null check in ('pending','settled_demo')`；`calculation_snapshot jsonb not null`；`settled_at timestamptz null` |

计价互斥约束：

- `pay_type='hourly'`：`base_rate_cents > 0`、`night_bonus_cents >= 0`、`daily_rate_cents is null`。
- `pay_type='daily'`：`daily_rate_cents > 0`、`base_rate_cents is null`、`night_bonus_cents = 0`。
- 报名快照使用相同互斥约束：时薪快照要求基础时薪为正、夜班补贴非负、日薪为空；日薪快照要求日薪为正、基础时薪为空、夜班补贴为0。

索引至少覆盖：所有外键、`demo_sessions(auth_user_id)`、`demo_job_instances(demo_session_id)`、`applications(demo_session_id,status)`、`application_events(application_id,created_at)`。

## 13. RPC 契约与幂等语义

| RPC | 输入 | 数据库职责 | 重复请求语义 |
|---|---|---|---|
| `initialize_demo_session()` | 无 | 校验 `auth.uid()`；若不存在则创建会话、学生身份和当前演示班次 | 已存在则返回现有会话，不重复播种 |
| `apply_to_job(p_instance_id uuid)` | 会话班次ID | 锁定实例；校验归属、开放、名额；创建快照、`null→pending`事件；扣减名额 | 已报名则返回现有报名并标记已存在，不重复扣名额 |
| `decide_application(p_application_id uuid,p_decision text,p_reason text)` | `confirm/reject`及拒绝原因 | 校验当前会话、`pending`；确认或拒绝；拒绝时原子释放名额并写原因 | 当前状态已等于本次目标（`confirmed/rejected`）返回已有结果；其他状态报错 |
| `cancel_application(p_application_id uuid)` | 报名ID | 仅允许当前会话的 `pending`；写取消事件并原子释放名额 | 已取消返回当前结果；其他终态报错 |
| `complete_application(p_application_id uuid,p_actual_minutes integer)` | 报名ID和核定分钟 | 锁定 `confirmed` 报名；校验工时；写完成事件、计算金额、唯一创建结算、写待结算事件并更新状态 | 已待结算/已结算返回现有结果，不重复事件或结算 |
| `settle_demo(p_application_id uuid)` | 报名ID | 仅允许 `pending_settlement`；同一事务更新 `applications.status` 与 `settlement_records.status` 为 `settled_demo`，写模拟结算事件并记录 `settled_at` | 已结算返回当前结果，不重复事件 |
| `reset_demo_session()` | 无 | 锁定当前会话；清理会话实例及级联数据；增加版本；按相对日期重新播种 | 重复调用安全，版本可递增，但对用户可见的业务基线一致 |

所有 RPC 均拒绝空的 `auth.uid()`。`p_reason` 只在拒绝时必填；确认时必须为空。前端不传 `actor`、事件时间、最终金额或状态目标之外的内部字段。

## 14. 只读输出契约

前端只通过三个受控只读 RPC 读取经过筛选的安全输出：

- `get_current_demo_jobs()`：当前 `auth.uid()` 的会话班次、公开岗位模板、招聘方透明字段和派生可用状态；
- `get_current_demo_applications()`：当前会话报名、事件时间线和结算摘要；
- `get_current_demo_dashboard()`：当前会话招聘方视角所需的班次与报名聚合。

这些 RPC 不返回数据库内部凭据或其他会话数据。它们采用与写 RPC 相同的 `auth.uid()`、安全 `search_path`、全限定表名、撤销 `PUBLIC EXECUTE` 和只授权 `authenticated` 规则。基表不向浏览器角色开放直接读取。
