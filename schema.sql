-- JuniorStart BG - Supabase schema
-- Run this whole file once in Supabase -> SQL Editor.
-- It intentionally contains NO example jobs.

create extension if not exists pgcrypto;

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 120),
  company text not null check (char_length(company) between 2 and 120),
  city text not null check (city in (
    'София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Плевен', 'Дистанционно'
  )),
  job_type text not null check (job_type in ('Стаж', 'Junior', 'Практика')),
  sector text not null check (sector in (
    'ИТ', 'Дизайн', 'Маркетинг', 'Финанси', 'Продажби',
    'Инженерство', 'Администрация', 'Друг'
  )),
  description text not null check (char_length(description) between 20 and 5000),
  requirements text[] not null default '{}',
  apply_url text not null check (
    apply_url ~* '^(https?://|mailto:).+'
  ),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'expired')),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at date null
);

create index if not exists jobs_public_feed_idx
  on public.jobs (status, created_at desc);

create index if not exists jobs_city_idx
  on public.jobs (city);

create index if not exists jobs_type_idx
  on public.jobs (job_type);

create index if not exists jobs_sector_idx
  on public.jobs (sector);

alter table public.jobs enable row level security;

-- Start from least privilege.
revoke all on table public.jobs from anon, authenticated;

-- Visitors only need SELECT access. RLS below limits rows to approved/non-expired jobs.
grant select on table public.jobs to anon, authenticated;

drop policy if exists "Public can read approved active jobs" on public.jobs;

create policy "Public can read approved active jobs"
on public.jobs
for select
to anon, authenticated
using (
  status = 'approved'
  and (expires_at is null or expires_at >= current_date)
);

-- Public submissions go through an RPC function rather than direct INSERT permission.
-- This prevents a browser client from setting status='approved' or featured=true.

create or replace function public.submit_job(
  p_title text,
  p_company text,
  p_city text,
  p_job_type text,
  p_sector text,
  p_description text,
  p_requirements text[],
  p_apply_url text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if char_length(trim(p_title)) < 2 or char_length(trim(p_title)) > 120 then
    raise exception 'Invalid title';
  end if;

  if char_length(trim(p_company)) < 2 or char_length(trim(p_company)) > 120 then
    raise exception 'Invalid company';
  end if;

  if p_city not in ('София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Плевен', 'Дистанционно') then
    raise exception 'Invalid city';
  end if;

  if p_job_type not in ('Стаж', 'Junior', 'Практика') then
    raise exception 'Invalid job type';
  end if;

  if p_sector not in (
    'ИТ', 'Дизайн', 'Маркетинг', 'Финанси', 'Продажби',
    'Инженерство', 'Администрация', 'Друг'
  ) then
    raise exception 'Invalid sector';
  end if;

  if char_length(trim(p_description)) < 20 or char_length(trim(p_description)) > 5000 then
    raise exception 'Invalid description';
  end if;

  if p_apply_url !~* '^(https?://|mailto:).+' then
    raise exception 'Invalid application URL';
  end if;

  insert into public.jobs (
    title,
    company,
    city,
    job_type,
    sector,
    description,
    requirements,
    apply_url,
    status,
    featured
  )
  values (
    trim(p_title),
    trim(p_company),
    p_city,
    p_job_type,
    p_sector,
    trim(p_description),
    coalesce(p_requirements, '{}'),
    trim(p_apply_url),
    'pending',
    false
  )
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.submit_job(
  text, text, text, text, text, text, text[], text
) from public;

grant execute on function public.submit_job(
  text, text, text, text, text, text, text[], text
) to anon, authenticated;

-- Optional: allow the Dashboard/service role to manage everything as normal.
-- Do NOT place the service_role/secret key in frontend code.
