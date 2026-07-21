begin;

create extension if not exists pgcrypto with schema extensions;

-- All data in this migration is synthetic and exists only for the interview Demo.

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  timezone text not null default 'Asia/Shanghai',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, name)
);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id) on delete restrict,
  display_name text not null,
  legal_entity_name text not null,
  payment_entity_name text not null,
  contact_department text not null,
  direct_hire_disclosure text not null,
  fee_disclosure text not null,
  deposit_required boolean not null default false,
  training_fee_required boolean not null default false,
  agency_fee_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, campus_id)
);

create table public.job_templates (
  id uuid primary key default gen_random_uuid(),
  campus_id uuid not null references public.campuses(id) on delete restrict,
  employer_id uuid not null,
  title text not null,
  work_content text not null,
  requirements text not null,
  work_address text not null,
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  relative_week smallint not null check (relative_week in (-1, 1)),
  weekday smallint not null check (weekday between 1 and 7),
  start_local time not null,
  end_local time not null,
  end_day_offset smallint not null default 0 check (end_day_offset between 0 and 1),
  deadline_offset_minutes integer not null check (deadline_offset_minutes > 0),
  pay_type text not null check (pay_type in ('hourly', 'daily')),
  base_rate_cents integer,
  night_bonus_cents integer not null default 0,
  daily_rate_cents integer,
  settlement_timing text not null,
  settlement_conditions text not null,
  default_capacity integer not null check (default_capacity > 0),
  scenario_kind text not null check (scenario_kind in ('main', 'open', 'full', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_templates_employer_campus_fk
    foreign key (employer_id, campus_id)
    references public.employers(id, campus_id)
    on delete restrict,
  constraint job_templates_shift_order_check
    check (end_day_offset = 1 or end_local > start_local),
  constraint job_templates_pay_check
    check (
      (
        pay_type = 'hourly'
        and base_rate_cents is not null
        and base_rate_cents > 0
        and night_bonus_cents >= 0
        and daily_rate_cents is null
      )
      or
      (
        pay_type = 'daily'
        and daily_rate_cents is not null
        and daily_rate_cents > 0
        and base_rate_cents is null
        and night_bonus_cents = 0
      )
    )
);

create unique index job_templates_one_main_per_campus_idx
  on public.job_templates(campus_id)
  where scenario_kind = 'main';

create table public.demo_sessions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  campus_id uuid not null references public.campuses(id) on delete restrict,
  reset_version integer not null default 1 check (reset_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, campus_id)
);

create table public.demo_profiles (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null unique,
  campus_id uuid not null,
  display_name text not null,
  available_start timestamptz not null,
  available_end timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_profiles_session_campus_fk
    foreign key (demo_session_id, campus_id)
    references public.demo_sessions(id, campus_id)
    on delete cascade,
  constraint demo_profiles_availability_check
    check (available_end > available_start),
  unique (id, demo_session_id)
);

create table public.demo_job_instances (
  id uuid primary key default gen_random_uuid(),
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  job_template_id uuid not null references public.job_templates(id) on delete restrict,
  shift_start timestamptz not null,
  shift_end timestamptz not null,
  application_deadline timestamptz not null,
  capacity integer not null check (capacity > 0),
  remaining_slots integer not null,
  lifecycle_status text not null default 'published'
    check (lifecycle_status in ('published', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint demo_job_instances_time_check
    check (shift_end > shift_start and application_deadline <= shift_start),
  constraint demo_job_instances_slots_check
    check (remaining_slots between 0 and capacity),
  unique (demo_session_id, job_template_id),
  unique (id, demo_session_id)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  demo_profile_id uuid not null,
  demo_session_id uuid not null references public.demo_sessions(id) on delete cascade,
  demo_job_instance_id uuid not null,
  status text not null
    check (status in (
      'pending',
      'confirmed',
      'rejected',
      'cancelled',
      'completed',
      'pending_settlement',
      'settled_demo'
    )),
  snapshot_employer_name text not null,
  snapshot_legal_entity_name text not null,
  snapshot_payment_entity_name text not null,
  snapshot_job_title text not null,
  snapshot_work_address text not null,
  snapshot_shift_start timestamptz not null,
  snapshot_shift_end timestamptz not null,
  snapshot_pay_type text not null check (snapshot_pay_type in ('hourly', 'daily')),
  snapshot_base_rate_cents integer,
  snapshot_night_bonus_cents integer not null default 0,
  snapshot_daily_rate_cents integer,
  snapshot_settlement_timing text not null,
  snapshot_settlement_conditions text not null,
  scheduled_minutes integer not null check (scheduled_minutes > 0),
  actual_minutes integer,
  estimated_amount_cents integer not null check (estimated_amount_cents >= 0),
  final_amount_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_profile_session_fk
    foreign key (demo_profile_id, demo_session_id)
    references public.demo_profiles(id, demo_session_id)
    on delete cascade,
  constraint applications_instance_session_fk
    foreign key (demo_job_instance_id, demo_session_id)
    references public.demo_job_instances(id, demo_session_id)
    on delete cascade,
  constraint applications_shift_check
    check (snapshot_shift_end > snapshot_shift_start),
  constraint applications_actual_minutes_check
    check (actual_minutes is null or actual_minutes between 1 and scheduled_minutes),
  constraint applications_final_amount_check
    check (final_amount_cents is null or final_amount_cents >= 0),
  constraint applications_pay_snapshot_check
    check (
      (
        snapshot_pay_type = 'hourly'
        and snapshot_base_rate_cents is not null
        and snapshot_base_rate_cents > 0
        and snapshot_night_bonus_cents >= 0
        and snapshot_daily_rate_cents is null
      )
      or
      (
        snapshot_pay_type = 'daily'
        and snapshot_daily_rate_cents is not null
        and snapshot_daily_rate_cents > 0
        and snapshot_base_rate_cents is null
        and snapshot_night_bonus_cents = 0
      )
    ),
  constraint applications_completion_fields_check
    check (
      (
        status in ('pending', 'confirmed', 'rejected', 'cancelled')
        and actual_minutes is null
        and final_amount_cents is null
      )
      or
      (
        status in ('completed', 'pending_settlement', 'settled_demo')
        and actual_minutes is not null
        and final_amount_cents is not null
      )
    ),
  unique (demo_session_id, demo_job_instance_id)
);

create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  from_status text,
  to_status text not null
    check (to_status in (
      'pending',
      'confirmed',
      'rejected',
      'cancelled',
      'completed',
      'pending_settlement',
      'settled_demo'
    )),
  actor text not null check (actor in ('student', 'employer', 'system')),
  note text,
  created_at timestamptz not null default now(),
  constraint application_events_from_status_check
    check (
      from_status is null
      or from_status in (
        'pending',
        'confirmed',
        'completed',
        'pending_settlement'
      )
    )
);

create table public.settlement_records (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  status text not null check (status in ('pending', 'settled_demo')),
  calculation_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  constraint settlement_records_settled_at_check
    check (
      (status = 'pending' and settled_at is null)
      or (status = 'settled_demo' and settled_at is not null)
    )
);

create index employers_campus_id_idx on public.employers(campus_id);
create index job_templates_campus_id_idx on public.job_templates(campus_id);
create index job_templates_employer_id_idx on public.job_templates(employer_id);
create index demo_sessions_campus_id_idx on public.demo_sessions(campus_id);
create index demo_profiles_campus_id_idx on public.demo_profiles(campus_id);
create index demo_job_instances_session_id_idx on public.demo_job_instances(demo_session_id);
create index demo_job_instances_template_id_idx on public.demo_job_instances(job_template_id);
create index applications_profile_id_idx on public.applications(demo_profile_id);
create index applications_instance_id_idx on public.applications(demo_job_instance_id);
create index applications_session_status_idx on public.applications(demo_session_id, status);
create index application_events_application_created_idx
  on public.application_events(application_id, created_at);

create function public._touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create trigger campuses_touch_updated_at
before update on public.campuses
for each row execute function public._touch_updated_at();

create trigger employers_touch_updated_at
before update on public.employers
for each row execute function public._touch_updated_at();

create trigger job_templates_touch_updated_at
before update on public.job_templates
for each row execute function public._touch_updated_at();

create trigger demo_sessions_touch_updated_at
before update on public.demo_sessions
for each row execute function public._touch_updated_at();

create trigger demo_profiles_touch_updated_at
before update on public.demo_profiles
for each row execute function public._touch_updated_at();

create trigger demo_job_instances_touch_updated_at
before update on public.demo_job_instances
for each row execute function public._touch_updated_at();

create trigger applications_touch_updated_at
before update on public.applications
for each row execute function public._touch_updated_at();

insert into public.campuses (
  id,
  name,
  latitude,
  longitude,
  timezone,
  is_active
) values (
  '10000000-0000-4000-8000-000000000001',
  'XX大学',
  30.263600,
  120.122000,
  'Asia/Shanghai',
  true
);

insert into public.employers (
  id,
  campus_id,
  display_name,
  legal_entity_name,
  payment_entity_name,
  contact_department,
  direct_hire_disclosure,
  fee_disclosure,
  deposit_required,
  training_fee_required,
  agency_fee_required
) values (
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'XX大学校园快递驿站',
  'XX大学校园快递驿站（演示主体）',
  'XX大学校园快递驿站（演示支付主体）',
  '驿站运营组（演示）',
  '演示中招聘、用工与工资支付主体关系已披露；不代表平台完成真实企业认证。',
  '演示岗位不收取押金、培训费或介绍费。',
  false,
  false,
  false
);

insert into public.job_templates (
  id,
  campus_id,
  employer_id,
  title,
  work_content,
  requirements,
  work_address,
  latitude,
  longitude,
  relative_week,
  weekday,
  start_local,
  end_local,
  end_day_offset,
  deadline_offset_minutes,
  pay_type,
  base_rate_cents,
  night_bonus_cents,
  daily_rate_cents,
  settlement_timing,
  settlement_conditions,
  default_capacity,
  scenario_kind
) values
(
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '入库分拣',
  '扫描到件、按货架区域分拣，并协助将包裹放入周转筐。',
  '能连续站立工作；按现场安全要求搬运，单件一般不超过10公斤。',
  'XX大学生活区东侧快递驿站（演示地址）',
  30.265200,
  120.119800,
  1,
  6,
  '14:00',
  '19:00',
  0,
  60,
  'hourly',
  1200,
  0,
  null,
  '核定工时后当日21:00前模拟结算',
  '招聘方确认到岗与实际工时后生成待模拟结算记录。',
  5,
  'main'
),
(
  '30000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '夜间到件分拣',
  '处理夜间集中到件，完成扫码、分区和周转筐整理。',
  '接受夜间班次；能遵守驿站夜间作业和安静通行要求。',
  'XX大学生活区东侧快递驿站（演示地址）',
  30.265200,
  120.119800,
  1,
  6,
  '22:00',
  '01:00',
  1,
  120,
  'hourly',
  1200,
  400,
  null,
  '次日12:00前模拟结算',
  '招聘方核定夜班全部实际分钟后生成待模拟结算记录。',
  3,
  'open'
),
(
  '30000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '上架与出库辅助',
  '将已分区包裹上架，并协助核对取件码和出库区域。',
  '工作细致；能使用手机扫码并遵守个人信息保护要求。',
  'XX大学生活区东侧快递驿站（演示地址）',
  30.265200,
  120.119800,
  1,
  7,
  '08:00',
  '12:00',
  0,
  720,
  'hourly',
  1000,
  0,
  null,
  '当日14:00前模拟结算',
  '招聘方确认到岗与实际工时后生成待模拟结算记录。',
  4,
  'open'
),
(
  '30000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '库区整理',
  '整理货架标签、空周转筐和公共作业区域。',
  '可完成全天班次；按要求进行简单清点和归位。',
  'XX大学生活区东侧快递驿站（演示地址）',
  30.265200,
  120.119800,
  1,
  7,
  '09:00',
  '17:00',
  0,
  720,
  'daily',
  null,
  0,
  8800,
  '次日18:00前模拟结算',
  '招聘方确认完成当日班次后生成固定日薪待模拟结算记录。',
  2,
  'full'
),
(
  '30000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '退件整理',
  '核对退件标签，按处理区域完成分类和暂存。',
  '能准确核对标签；发现异常件时及时交由现场负责人。',
  'XX大学生活区东侧快递驿站（演示地址）',
  30.265200,
  120.119800,
  -1,
  6,
  '14:00',
  '18:00',
  0,
  60,
  'hourly',
  1100,
  0,
  null,
  '原约定当日模拟结算',
  '该岗位为已过期合成样例，不可报名。',
  3,
  'expired'
);

create function public._seed_demo_state(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.demo_sessions%rowtype;
  v_template record;
  v_today date;
  v_next_saturday date;
  v_previous_saturday date;
  v_days_forward integer;
  v_days_back integer;
  v_shift_date date;
  v_shift_start timestamptz;
  v_shift_end timestamptz;
  v_deadline timestamptz;
  v_main_start timestamptz;
  v_main_end timestamptz;
  v_existing_main_start timestamptz;
  v_existing_main_end timestamptz;
begin
  select s.*
    into strict v_session
    from public.demo_sessions as s
   where s.id = p_session_id
   for update;

  select i.shift_start, i.shift_end
    into v_existing_main_start, v_existing_main_end
    from public.demo_job_instances as i
    join public.job_templates as t on t.id = i.job_template_id
   where i.demo_session_id = p_session_id
     and t.scenario_kind = 'main';

  if found then
    insert into public.demo_profiles (
      demo_session_id,
      campus_id,
      display_name,
      available_start,
      available_end
    ) values (
      p_session_id,
      v_session.campus_id,
      '陈同学（演示）',
      v_existing_main_start,
      v_existing_main_end
    )
    on conflict (demo_session_id) do update
      set campus_id = excluded.campus_id,
          display_name = excluded.display_name,
          available_start = excluded.available_start,
          available_end = excluded.available_end;
    return;
  end if;

  if exists (
    select 1
      from public.demo_job_instances as i
     where i.demo_session_id = p_session_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = '演示班次基线不完整，请重置当前Demo';
  end if;

  v_today := (pg_catalog.now() at time zone 'Asia/Shanghai')::date;
  v_days_forward := mod(6 - extract(isodow from v_today)::integer + 7, 7);
  if v_days_forward = 0 then
    v_days_forward := 7;
  end if;
  v_next_saturday := v_today + v_days_forward;

  v_days_back := mod(extract(isodow from v_today)::integer - 6 + 7, 7);
  if v_days_back = 0 then
    v_days_back := 7;
  end if;
  v_previous_saturday := v_today - v_days_back;

  for v_template in
    select t.*
      from public.job_templates as t
     where t.campus_id = v_session.campus_id
     order by t.id
  loop
    if v_template.relative_week < 0 then
      v_shift_date := v_previous_saturday + (v_template.weekday - 6);
    else
      v_shift_date := v_next_saturday + (v_template.weekday - 6);
    end if;

    v_shift_start :=
      (v_shift_date + v_template.start_local) at time zone 'Asia/Shanghai';
    v_shift_end :=
      ((v_shift_date + v_template.end_day_offset) + v_template.end_local)
      at time zone 'Asia/Shanghai';
    v_deadline := v_shift_start
      - pg_catalog.make_interval(mins => v_template.deadline_offset_minutes);

    insert into public.demo_job_instances (
      demo_session_id,
      job_template_id,
      shift_start,
      shift_end,
      application_deadline,
      capacity,
      remaining_slots,
      lifecycle_status
    ) values (
      p_session_id,
      v_template.id,
      v_shift_start,
      v_shift_end,
      v_deadline,
      v_template.default_capacity,
      case
        when v_template.scenario_kind = 'full' then 0
        else v_template.default_capacity
      end,
      'published'
    );

    if v_template.scenario_kind = 'main' then
      v_main_start := v_shift_start;
      v_main_end := v_shift_end;
    end if;
  end loop;

  if v_main_start is null or v_main_end is null then
    raise exception using
      errcode = 'P0001',
      message = '未找到主演示岗位模板';
  end if;

  insert into public.demo_profiles (
    demo_session_id,
    campus_id,
    display_name,
    available_start,
    available_end
  ) values (
    p_session_id,
    v_session.campus_id,
    '陈同学（演示）',
    v_main_start,
    v_main_end
  )
  on conflict (demo_session_id) do update
    set campus_id = excluded.campus_id,
        display_name = excluded.display_name,
        available_start = excluded.available_start,
        available_end = excluded.available_end;
end;
$$;

create function public._demo_session_json(p_session_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'session', pg_catalog.jsonb_build_object(
      'id', s.id,
      'campus_id', s.campus_id,
      'reset_version', s.reset_version,
      'created_at', s.created_at,
      'updated_at', s.updated_at
    ),
    'campus', pg_catalog.jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'latitude', c.latitude,
      'longitude', c.longitude,
      'timezone', c.timezone
    ),
    'profile', pg_catalog.jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'available_start', p.available_start,
      'available_end', p.available_end
    )
  )
  from public.demo_sessions as s
  join public.campuses as c on c.id = s.campus_id
  join public.demo_profiles as p on p.demo_session_id = s.id
  where s.id = p_session_id;
$$;

create function public._application_json(p_application_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', a.id,
    'demo_job_instance_id', a.demo_job_instance_id,
    'status', a.status,
    'snapshot_employer_name', a.snapshot_employer_name,
    'snapshot_legal_entity_name', a.snapshot_legal_entity_name,
    'snapshot_payment_entity_name', a.snapshot_payment_entity_name,
    'snapshot_job_title', a.snapshot_job_title,
    'snapshot_work_address', a.snapshot_work_address,
    'snapshot_shift_start', a.snapshot_shift_start,
    'snapshot_shift_end', a.snapshot_shift_end,
    'snapshot_pay_type', a.snapshot_pay_type,
    'snapshot_base_rate_cents', a.snapshot_base_rate_cents,
    'snapshot_night_bonus_cents', a.snapshot_night_bonus_cents,
    'snapshot_daily_rate_cents', a.snapshot_daily_rate_cents,
    'snapshot_settlement_timing', a.snapshot_settlement_timing,
    'snapshot_settlement_conditions', a.snapshot_settlement_conditions,
    'scheduled_minutes', a.scheduled_minutes,
    'actual_minutes', a.actual_minutes,
    'estimated_amount_cents', a.estimated_amount_cents,
    'final_amount_cents', a.final_amount_cents,
    'created_at', a.created_at,
    'updated_at', a.updated_at,
    'events', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', e.id,
          'from_status', e.from_status,
          'to_status', e.to_status,
          'actor', e.actor,
          'note', e.note,
          'created_at', e.created_at
        ) order by e.created_at, e.id
      )
      from public.application_events as e
      where e.application_id = a.id
    ), '[]'::jsonb),
    'settlement', coalesce((
      select pg_catalog.jsonb_build_object(
        'id', sr.id,
        'amount_cents', sr.amount_cents,
        'status', sr.status,
        'calculation_snapshot', sr.calculation_snapshot,
        'created_at', sr.created_at,
        'settled_at', sr.settled_at
      )
      from public.settlement_records as sr
      where sr.application_id = a.id
    ), 'null'::jsonb)
  )
  from public.applications as a
  where a.id = p_application_id;
$$;

create function public.initialize_demo_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_campus_id uuid;
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select c.id
    into v_campus_id
    from public.campuses as c
   where c.name = 'XX大学'
     and c.is_active
   limit 1;

  if v_campus_id is null then
    raise exception using errcode = 'P0001', message = '演示校园未启用';
  end if;

  insert into public.demo_sessions (auth_user_id, campus_id)
  values (v_uid, v_campus_id)
  on conflict (auth_user_id) do nothing
  returning id into v_session_id;

  if v_session_id is null then
    select s.id
      into strict v_session_id
      from public.demo_sessions as s
     where s.auth_user_id = v_uid
     for update;
  end if;

  perform public._seed_demo_state(v_session_id);

  return public._demo_session_json(v_session_id);
end;
$$;

create function public.get_current_demo_jobs()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.demo_sessions%rowtype;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.*
    into v_session
    from public.demo_sessions as s
   where s.auth_user_id = v_uid;

  if not found then
    raise exception using errcode = 'P0002', message = '演示会话尚未初始化';
  end if;

  select pg_catalog.jsonb_build_object(
    'session', pg_catalog.jsonb_build_object(
      'id', v_session.id,
      'campus_id', v_session.campus_id,
      'reset_version', v_session.reset_version
    ),
    'campus', pg_catalog.jsonb_build_object(
      'id', c.id,
      'name', c.name,
      'latitude', c.latitude,
      'longitude', c.longitude,
      'timezone', c.timezone
    ),
    'profile', pg_catalog.jsonb_build_object(
      'id', p.id,
      'display_name', p.display_name,
      'available_start', p.available_start,
      'available_end', p.available_end
    ),
    'jobs', coalesce((
      select pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', i.id,
          'template_id', t.id,
          'title', t.title,
          'work_content', t.work_content,
          'requirements', t.requirements,
          'work_address', t.work_address,
          'latitude', t.latitude,
          'longitude', t.longitude,
          'shift_start', i.shift_start,
          'shift_end', i.shift_end,
          'application_deadline', i.application_deadline,
          'pay_type', t.pay_type,
          'base_rate_cents', t.base_rate_cents,
          'night_bonus_cents', t.night_bonus_cents,
          'daily_rate_cents', t.daily_rate_cents,
          'effective_rate_cents', case
            when t.pay_type = 'hourly' then t.base_rate_cents + t.night_bonus_cents
            else null
          end,
          'estimated_amount_cents', case
            when t.pay_type = 'hourly' then pg_catalog.round(
              (t.base_rate_cents + t.night_bonus_cents)::numeric
              * extract(epoch from (i.shift_end - i.shift_start))::numeric
              / 3600
            )::integer
            else t.daily_rate_cents
          end,
          'settlement_timing', t.settlement_timing,
          'settlement_conditions', t.settlement_conditions,
          'capacity', i.capacity,
          'remaining_slots', i.remaining_slots,
          'availability_status', case
            when i.lifecycle_status = 'cancelled' then 'cancelled'
            when pg_catalog.now() >= i.application_deadline then 'expired'
            when i.remaining_slots = 0 then 'full'
            else 'open'
          end,
          'scenario_kind', t.scenario_kind,
          'published_at', i.created_at,
          'employer_name', e.display_name,
          'legal_entity_name', e.legal_entity_name,
          'payment_entity_name', e.payment_entity_name,
          'contact_department', e.contact_department,
          'direct_hire_disclosure', e.direct_hire_disclosure,
          'fee_disclosure', e.fee_disclosure,
          'deposit_required', e.deposit_required,
          'training_fee_required', e.training_fee_required,
          'agency_fee_required', e.agency_fee_required,
          'missing_fields', '[]'::jsonb,
          'risk_flags', '[]'::jsonb,
          'has_applied', a.id is not null,
          'application_id', a.id,
          'application_status', a.status,
          'is_demo', true
        ) order by i.shift_start, t.id
      )
      from public.demo_job_instances as i
      join public.job_templates as t on t.id = i.job_template_id
      join public.employers as e on e.id = t.employer_id
      left join public.applications as a
        on a.demo_session_id = i.demo_session_id
       and a.demo_job_instance_id = i.id
      where i.demo_session_id = v_session.id
    ), '[]'::jsonb)
  )
    into v_result
    from public.campuses as c
    join public.demo_profiles as p
      on p.demo_session_id = v_session.id
   where c.id = v_session.campus_id;

  return v_result;
end;
$$;

create function public.get_current_demo_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.id
    into v_session_id
    from public.demo_sessions as s
   where s.auth_user_id = v_uid;

  if v_session_id is null then
    raise exception using errcode = 'P0002', message = '演示会话尚未初始化';
  end if;

  select pg_catalog.jsonb_build_object(
    'applications', coalesce(
      pg_catalog.jsonb_agg(
        public._application_json(a.id)
        order by a.created_at desc, a.id
      ),
      '[]'::jsonb
    )
  )
    into v_result
    from public.applications as a
   where a.demo_session_id = v_session_id;

  return v_result;
end;
$$;

create function public.get_current_demo_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.demo_sessions%rowtype;
  v_employer public.employers%rowtype;
  v_jobs jsonb;
  v_applications jsonb;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.*
    into v_session
    from public.demo_sessions as s
   where s.auth_user_id = v_uid;

  if not found then
    raise exception using errcode = 'P0002', message = '演示会话尚未初始化';
  end if;

  select e.*
    into strict v_employer
    from public.employers as e
   where e.campus_id = v_session.campus_id
   order by e.id
   limit 1;

  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'id', i.id,
        'template_id', t.id,
        'title', t.title,
        'shift_start', i.shift_start,
        'shift_end', i.shift_end,
        'capacity', i.capacity,
        'remaining_slots', i.remaining_slots,
        'availability_status', case
          when i.lifecycle_status = 'cancelled' then 'cancelled'
          when pg_catalog.now() >= i.application_deadline then 'expired'
          when i.remaining_slots = 0 then 'full'
          else 'open'
        end,
        'application_count', (
          select count(*)
            from public.applications as a
           where a.demo_session_id = i.demo_session_id
             and a.demo_job_instance_id = i.id
        ),
        'pending_count', (
          select count(*)
            from public.applications as a
           where a.demo_session_id = i.demo_session_id
             and a.demo_job_instance_id = i.id
             and a.status = 'pending'
        )
      ) order by i.shift_start, t.id
    ),
    '[]'::jsonb
  )
    into v_jobs
    from public.demo_job_instances as i
    join public.job_templates as t on t.id = i.job_template_id
   where i.demo_session_id = v_session.id;

  v_applications := public.get_current_demo_applications()->'applications';

  return pg_catalog.jsonb_build_object(
    'session', pg_catalog.jsonb_build_object(
      'id', v_session.id,
      'campus_id', v_session.campus_id,
      'reset_version', v_session.reset_version
    ),
    'employer', pg_catalog.jsonb_build_object(
      'id', v_employer.id,
      'display_name', v_employer.display_name,
      'contact_department', v_employer.contact_department,
      'is_demo', true
    ),
    'jobs', coalesce(v_jobs, '[]'::jsonb),
    'applications', coalesce(v_applications, '[]'::jsonb)
  );
end;
$$;

create function public.apply_to_job(p_instance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_profile_id uuid;
  v_job record;
  v_existing_application_id uuid;
  v_application_id uuid;
  v_scheduled_minutes integer;
  v_estimated_amount integer;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.id, p.id
    into v_session_id, v_profile_id
    from public.demo_sessions as s
    join public.demo_profiles as p on p.demo_session_id = s.id
   where s.auth_user_id = v_uid;

  if v_session_id is null then
    raise exception using errcode = 'P0002', message = '演示会话尚未初始化';
  end if;

  select
    i.id,
    i.shift_start,
    i.shift_end,
    i.application_deadline,
    i.remaining_slots,
    i.lifecycle_status,
    t.title,
    t.work_address,
    t.pay_type,
    t.base_rate_cents,
    t.night_bonus_cents,
    t.daily_rate_cents,
    t.settlement_timing,
    t.settlement_conditions,
    e.display_name,
    e.legal_entity_name,
    e.payment_entity_name
    into v_job
    from public.demo_job_instances as i
    join public.job_templates as t on t.id = i.job_template_id
    join public.employers as e on e.id = t.employer_id
   where i.id = p_instance_id
     and i.demo_session_id = v_session_id
     and t.campus_id = (
       select s.campus_id
         from public.demo_sessions as s
        where s.id = v_session_id
     )
   for update of i;

  if not found then
    raise exception using errcode = 'P0002', message = '岗位不存在或不属于当前演示会话';
  end if;

  select a.id
    into v_existing_application_id
    from public.applications as a
   where a.demo_session_id = v_session_id
     and a.demo_job_instance_id = p_instance_id;

  if v_existing_application_id is not null then
    return pg_catalog.jsonb_build_object(
      'application', public._application_json(v_existing_application_id),
      'already_existed', true
    );
  end if;

  if v_job.lifecycle_status <> 'published' then
    raise exception using errcode = 'P0001', message = '岗位已取消，无法报名';
  end if;
  if pg_catalog.now() >= v_job.application_deadline then
    raise exception using errcode = 'P0001', message = '岗位已过期，无法报名';
  end if;
  if v_job.remaining_slots <= 0 then
    raise exception using errcode = 'P0001', message = '岗位已满，无法报名';
  end if;

  v_scheduled_minutes := (
    extract(epoch from (v_job.shift_end - v_job.shift_start)) / 60
  )::integer;

  if v_job.pay_type = 'hourly' then
    v_estimated_amount := pg_catalog.round(
      (v_job.base_rate_cents + v_job.night_bonus_cents)::numeric
      * v_scheduled_minutes::numeric
      / 60
    )::integer;
  else
    v_estimated_amount := v_job.daily_rate_cents;
  end if;

  insert into public.applications (
    demo_profile_id,
    demo_session_id,
    demo_job_instance_id,
    status,
    snapshot_employer_name,
    snapshot_legal_entity_name,
    snapshot_payment_entity_name,
    snapshot_job_title,
    snapshot_work_address,
    snapshot_shift_start,
    snapshot_shift_end,
    snapshot_pay_type,
    snapshot_base_rate_cents,
    snapshot_night_bonus_cents,
    snapshot_daily_rate_cents,
    snapshot_settlement_timing,
    snapshot_settlement_conditions,
    scheduled_minutes,
    estimated_amount_cents
  ) values (
    v_profile_id,
    v_session_id,
    p_instance_id,
    'pending',
    v_job.display_name,
    v_job.legal_entity_name,
    v_job.payment_entity_name,
    v_job.title,
    v_job.work_address,
    v_job.shift_start,
    v_job.shift_end,
    v_job.pay_type,
    v_job.base_rate_cents,
    v_job.night_bonus_cents,
    v_job.daily_rate_cents,
    v_job.settlement_timing,
    v_job.settlement_conditions,
    v_scheduled_minutes,
    v_estimated_amount
  )
  returning id into v_application_id;

  insert into public.application_events (
    application_id,
    from_status,
    to_status,
    actor,
    note
  ) values (
    v_application_id,
    null,
    'pending',
    'student',
    '学生提交演示报名'
  );

  update public.demo_job_instances
     set remaining_slots = remaining_slots - 1
   where id = p_instance_id;

  return pg_catalog.jsonb_build_object(
    'application', public._application_json(v_application_id),
    'already_existed', false
  );
end;
$$;

create function public.decide_application(
  p_application_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_application public.applications%rowtype;
  v_instance public.demo_job_instances%rowtype;
  v_target_status text;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;
  if p_decision is null or p_decision not in ('confirm', 'reject') then
    raise exception using errcode = '22023', message = '处理决定只能是confirm或reject';
  end if;
  if p_decision = 'reject' and nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = '拒绝原因必填';
  end if;
  if p_decision = 'reject' and pg_catalog.char_length(pg_catalog.btrim(p_reason)) > 500 then
    raise exception using errcode = '22023', message = '拒绝原因不能超过500字';
  end if;
  if p_decision = 'confirm' and nullif(pg_catalog.btrim(p_reason), '') is not null then
    raise exception using errcode = '22023', message = '确认报名时无需填写拒绝原因';
  end if;

  select s.id
    into v_session_id
    from public.demo_sessions as s
   where s.auth_user_id = v_uid;

  select a.*
    into v_application
    from public.applications as a
   where a.id = p_application_id
     and a.demo_session_id = v_session_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = '报名不存在或不属于当前演示会话';
  end if;

  v_target_status := case when p_decision = 'confirm' then 'confirmed' else 'rejected' end;

  if v_application.status = v_target_status then
    return pg_catalog.jsonb_build_object(
      'application', public._application_json(v_application.id),
      'already_applied', true
    );
  end if;
  if v_application.status <> 'pending' then
    raise exception using errcode = 'P0001', message = '当前报名状态不允许该操作';
  end if;

  select i.*
    into strict v_instance
    from public.demo_job_instances as i
   where i.id = v_application.demo_job_instance_id
   for update;

  update public.applications
     set status = v_target_status
   where id = v_application.id;

  insert into public.application_events (
    application_id,
    from_status,
    to_status,
    actor,
    note
  ) values (
    v_application.id,
    'pending',
    v_target_status,
    'employer',
    case when p_decision = 'reject' then pg_catalog.btrim(p_reason) else '招聘方确认演示报名' end
  );

  if p_decision = 'reject' then
    update public.demo_job_instances
       set remaining_slots = least(capacity, remaining_slots + 1)
     where id = v_instance.id;
  end if;

  return pg_catalog.jsonb_build_object(
    'application', public._application_json(v_application.id),
    'already_applied', false
  );
end;
$$;

create function public.cancel_application(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_application public.applications%rowtype;
  v_instance public.demo_job_instances%rowtype;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.id
    into v_session_id
    from public.demo_sessions as s
   where s.auth_user_id = v_uid;

  select a.*
    into v_application
    from public.applications as a
   where a.id = p_application_id
     and a.demo_session_id = v_session_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = '报名不存在或不属于当前演示会话';
  end if;
  if v_application.status = 'cancelled' then
    return pg_catalog.jsonb_build_object(
      'application', public._application_json(v_application.id),
      'already_cancelled', true
    );
  end if;
  if v_application.status <> 'pending' then
    raise exception using errcode = 'P0001', message = '仅待招聘方确认的报名可取消';
  end if;

  select i.*
    into strict v_instance
    from public.demo_job_instances as i
   where i.id = v_application.demo_job_instance_id
   for update;

  update public.applications
     set status = 'cancelled'
   where id = v_application.id;

  insert into public.application_events (
    application_id,
    from_status,
    to_status,
    actor,
    note
  ) values (
    v_application.id,
    'pending',
    'cancelled',
    'student',
    '学生取消演示报名'
  );

  update public.demo_job_instances
     set remaining_slots = least(capacity, remaining_slots + 1)
   where id = v_instance.id;

  return pg_catalog.jsonb_build_object(
    'application', public._application_json(v_application.id),
    'already_cancelled', false
  );
end;
$$;

create function public.complete_application(
  p_application_id uuid,
  p_actual_minutes integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_application public.applications%rowtype;
  v_final_amount integer;
  v_completed_at timestamptz := pg_catalog.clock_timestamp();
  v_pending_settlement_at timestamptz;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.id
    into v_session_id
    from public.demo_sessions as s
   where s.auth_user_id = v_uid;

  select a.*
    into v_application
    from public.applications as a
   where a.id = p_application_id
     and a.demo_session_id = v_session_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = '报名不存在或不属于当前演示会话';
  end if;
  if v_application.status in ('pending_settlement', 'settled_demo') then
    return pg_catalog.jsonb_build_object(
      'application', public._application_json(v_application.id),
      'already_completed', true
    );
  end if;
  if v_application.status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = '仅已确认报名可核定完工';
  end if;
  if p_actual_minutes is null
     or p_actual_minutes < 1
     or p_actual_minutes > v_application.scheduled_minutes then
    raise exception using errcode = '22023', message = '实际分钟必须介于1和计划分钟之间';
  end if;

  if v_application.snapshot_pay_type = 'hourly' then
    v_final_amount := pg_catalog.round(
      (
        v_application.snapshot_base_rate_cents
        + v_application.snapshot_night_bonus_cents
      )::numeric
      * p_actual_minutes::numeric
      / 60
    )::integer;
  else
    v_final_amount := v_application.snapshot_daily_rate_cents;
  end if;

  -- now() is transaction-stable. Use an explicit microsecond offset so the
  -- completed event always precedes pending_settlement in the UI timeline.
  v_pending_settlement_at := v_completed_at + interval '1 microsecond';

  insert into public.application_events (
    application_id,
    from_status,
    to_status,
    actor,
    note,
    created_at
  ) values (
    v_application.id,
    'confirmed',
    'completed',
    'employer',
    '招聘方核定完工：' || p_actual_minutes::text || '分钟',
    v_completed_at
  );

  insert into public.settlement_records (
    application_id,
    amount_cents,
    status,
    calculation_snapshot
  ) values (
    v_application.id,
    v_final_amount,
    'pending',
    pg_catalog.jsonb_build_object(
      'pay_type', v_application.snapshot_pay_type,
      'base_rate_cents', v_application.snapshot_base_rate_cents,
      'night_bonus_cents', v_application.snapshot_night_bonus_cents,
      'daily_rate_cents', v_application.snapshot_daily_rate_cents,
      'actual_minutes', p_actual_minutes,
      'rounding_rule', 'round_to_cent',
      'amount_cents', v_final_amount,
      'is_demo', true
    )
  );

  insert into public.application_events (
    application_id,
    from_status,
    to_status,
    actor,
    note,
    created_at
  ) values (
    v_application.id,
    'completed',
    'pending_settlement',
    'system',
    '系统自动生成待模拟结算记录',
    v_pending_settlement_at
  );

  update public.applications
     set status = 'pending_settlement',
         actual_minutes = p_actual_minutes,
         final_amount_cents = v_final_amount
   where id = v_application.id;

  return pg_catalog.jsonb_build_object(
    'application', public._application_json(v_application.id),
    'already_completed', false
  );
end;
$$;

create function public.settle_demo(p_application_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
  v_application public.applications%rowtype;
  v_settlement public.settlement_records%rowtype;
  v_settled_at timestamptz := pg_catalog.now();
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.id
    into v_session_id
    from public.demo_sessions as s
   where s.auth_user_id = v_uid;

  select a.*
    into v_application
    from public.applications as a
   where a.id = p_application_id
     and a.demo_session_id = v_session_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = '报名不存在或不属于当前演示会话';
  end if;

  select sr.*
    into v_settlement
    from public.settlement_records as sr
   where sr.application_id = v_application.id
   for update;

  if v_application.status = 'settled_demo'
     and v_settlement.status = 'settled_demo' then
    return pg_catalog.jsonb_build_object(
      'application', public._application_json(v_application.id),
      'already_settled', true
    );
  end if;
  if v_application.status <> 'pending_settlement'
     or v_settlement.id is null
     or v_settlement.status <> 'pending' then
    raise exception using errcode = 'P0001', message = '当前报名没有可确认的待模拟结算记录';
  end if;

  update public.settlement_records
     set status = 'settled_demo',
         settled_at = v_settled_at
   where id = v_settlement.id;

  update public.applications
     set status = 'settled_demo'
   where id = v_application.id;

  insert into public.application_events (
    application_id,
    from_status,
    to_status,
    actor,
    note,
    created_at
  ) values (
    v_application.id,
    'pending_settlement',
    'settled_demo',
    'employer',
    '招聘方确认Demo模拟结算',
    v_settled_at
  );

  return pg_catalog.jsonb_build_object(
    'application', public._application_json(v_application.id),
    'already_settled', false
  );
end;
$$;

create function public.reset_demo_session()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session_id uuid;
begin
  if v_uid is null then
    raise exception using errcode = '28000', message = '请先建立匿名演示身份';
  end if;

  select s.id
    into v_session_id
    from public.demo_sessions as s
   where s.auth_user_id = v_uid
   for update;

  if v_session_id is null then
    return public.initialize_demo_session();
  end if;

  delete from public.demo_job_instances
   where demo_session_id = v_session_id;

  update public.demo_sessions
     set reset_version = reset_version + 1
   where id = v_session_id;

  perform public._seed_demo_state(v_session_id);

  return public._demo_session_json(v_session_id);
end;
$$;

alter table public.campuses enable row level security;
alter table public.employers enable row level security;
alter table public.job_templates enable row level security;
alter table public.demo_sessions enable row level security;
alter table public.demo_profiles enable row level security;
alter table public.demo_job_instances enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.settlement_records enable row level security;

create policy campuses_current_session_select
on public.campuses
for select
to authenticated
using (
  exists (
    select 1
      from public.demo_sessions as s
     where s.auth_user_id = auth.uid()
       and s.campus_id = campuses.id
  )
);

create policy employers_current_session_select
on public.employers
for select
to authenticated
using (
  exists (
    select 1
      from public.demo_sessions as s
     where s.auth_user_id = auth.uid()
       and s.campus_id = employers.campus_id
  )
);

create policy job_templates_current_session_select
on public.job_templates
for select
to authenticated
using (
  exists (
    select 1
      from public.demo_sessions as s
     where s.auth_user_id = auth.uid()
       and s.campus_id = job_templates.campus_id
  )
);

create policy demo_sessions_own_select
on public.demo_sessions
for select
to authenticated
using (auth_user_id = auth.uid());

create policy demo_profiles_own_select
on public.demo_profiles
for select
to authenticated
using (
  exists (
    select 1
      from public.demo_sessions as s
     where s.id = demo_profiles.demo_session_id
       and s.auth_user_id = auth.uid()
  )
);

create policy demo_job_instances_own_select
on public.demo_job_instances
for select
to authenticated
using (
  exists (
    select 1
      from public.demo_sessions as s
     where s.id = demo_job_instances.demo_session_id
       and s.auth_user_id = auth.uid()
  )
);

create policy applications_own_select
on public.applications
for select
to authenticated
using (
  exists (
    select 1
      from public.demo_sessions as s
     where s.id = applications.demo_session_id
       and s.auth_user_id = auth.uid()
  )
);

create policy application_events_own_select
on public.application_events
for select
to authenticated
using (
  exists (
    select 1
      from public.applications as a
      join public.demo_sessions as s on s.id = a.demo_session_id
     where a.id = application_events.application_id
       and s.auth_user_id = auth.uid()
  )
);

create policy settlement_records_own_select
on public.settlement_records
for select
to authenticated
using (
  exists (
    select 1
      from public.applications as a
      join public.demo_sessions as s on s.id = a.demo_session_id
     where a.id = settlement_records.application_id
       and s.auth_user_id = auth.uid()
  )
);

revoke all on table
  public.campuses,
  public.employers,
  public.job_templates,
  public.demo_sessions,
  public.demo_profiles,
  public.demo_job_instances,
  public.applications,
  public.application_events,
  public.settlement_records
from public, anon, authenticated;

revoke all on function public._touch_updated_at() from public, anon, authenticated;
revoke all on function public._seed_demo_state(uuid) from public, anon, authenticated;
revoke all on function public._demo_session_json(uuid) from public, anon, authenticated;
revoke all on function public._application_json(uuid) from public, anon, authenticated;

revoke all on function public.initialize_demo_session() from public, anon, authenticated;
revoke all on function public.get_current_demo_jobs() from public, anon, authenticated;
revoke all on function public.get_current_demo_applications() from public, anon, authenticated;
revoke all on function public.get_current_demo_dashboard() from public, anon, authenticated;
revoke all on function public.apply_to_job(uuid) from public, anon, authenticated;
revoke all on function public.decide_application(uuid, text, text) from public, anon, authenticated;
revoke all on function public.cancel_application(uuid) from public, anon, authenticated;
revoke all on function public.complete_application(uuid, integer) from public, anon, authenticated;
revoke all on function public.settle_demo(uuid) from public, anon, authenticated;
revoke all on function public.reset_demo_session() from public, anon, authenticated;

grant execute on function public.initialize_demo_session() to authenticated;
grant execute on function public.get_current_demo_jobs() to authenticated;
grant execute on function public.get_current_demo_applications() to authenticated;
grant execute on function public.get_current_demo_dashboard() to authenticated;
grant execute on function public.apply_to_job(uuid) to authenticated;
grant execute on function public.decide_application(uuid, text, text) to authenticated;
grant execute on function public.cancel_application(uuid) to authenticated;
grant execute on function public.complete_application(uuid, integer) to authenticated;
grant execute on function public.settle_demo(uuid) to authenticated;
grant execute on function public.reset_demo_session() to authenticated;

commit;
