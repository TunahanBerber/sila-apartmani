-- Sıla Apartmanı: tablolar, RLS kuralları ve uygulama fonksiyonları.
-- Okuma herkese açık; öneri gönderme ve oy verme (anonim oturum dahil) herkese açık;
-- geri kalan her şey sadece public.admins tablosundaki kullanıcılara açık.

-- ---------------------------------------------------------------- tablolar

create table public.app_settings (
  id          boolean primary key default true check (id),
  unit_count  int not null default 12 check (unit_count > 0)
);
insert into public.app_settings default values;

create table public.admins (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.expenses (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 120),
  category    text not null default 'diger' check (char_length(category) <= 40),
  amount      numeric(12, 2) not null check (amount >= 0 and amount <= 1e10),
  due_date    date not null,
  status      text not null default 'bekliyor' check (status in ('bekliyor', 'odendi')),
  paid_at     date,
  vendor      text check (char_length(vendor) <= 120),
  recurring   text not null default 'none' check (recurring in ('none', 'monthly', 'yearly')),
  notes       text check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now()
);
create index expenses_due_date_idx on public.expenses (due_date);
create index expenses_status_idx on public.expenses (status);

create table public.suggestions (
  id            bigint generated always as identity primary key,
  title         text not null check (char_length(title) between 1 and 120),
  description   text not null check (char_length(description) between 1 and 2000),
  author        text check (char_length(author) <= 60),
  apartment_no  text check (char_length(apartment_no) <= 10),
  category      text not null default 'genel'
                check (category in ('genel', 'guvenlik', 'temizlik', 'peyzaj', 'enerji', 'sosyal', 'teknik')),
  status        text not null default 'yeni'
                check (status in ('yeni', 'inceleniyor', 'onaylandi', 'tamamlandi', 'reddedildi')),
  admin_note    text check (char_length(admin_note) <= 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.suggestion_votes (
  suggestion_id bigint not null references public.suggestions (id) on delete cascade,
  voter_id      text not null,
  created_at    timestamptz not null default now(),
  primary key (suggestion_id, voter_id)
);

create table public.announcements (
  id          bigint generated always as identity primary key,
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null check (char_length(body) between 1 and 3000),
  priority    text not null default 'normal' check (priority in ('normal', 'onemli')),
  pinned      boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- yardımcılar

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create function public.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger suggestions_touch before update on public.suggestions
  for each row execute function public.touch_updated_at();

-- Ödendi bilgisi her zaman durumla tutarlı kalsın.
create function public.expenses_paid_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.status = 'odendi' then
    new.paid_at := coalesce(new.paid_at, current_date);
  else
    new.paid_at := null;
  end if;
  return new;
end;
$$;
create trigger expenses_paid_at before insert or update on public.expenses
  for each row execute function public.expenses_paid_at();

create view public.expenses_view
with (security_invoker = true)
as
  select e.*, (e.status = 'bekliyor' and e.due_date < current_date) as overdue
  from public.expenses e;

-- ---------------------------------------------------------------- RLS

alter table public.app_settings enable row level security;
alter table public.admins enable row level security;
alter table public.expenses enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_votes enable row level security;
alter table public.announcements enable row level security;

create policy "herkes okur" on public.app_settings for select using (true);
create policy "yönetici günceller" on public.app_settings for update
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "kendi kaydını görür" on public.admins for select
  using (user_id = (select auth.uid()));

create policy "herkes okur" on public.expenses for select using (true);
create policy "yönetici ekler" on public.expenses for insert with check ((select public.is_admin()));
create policy "yönetici günceller" on public.expenses for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "yönetici siler" on public.expenses for delete using ((select public.is_admin()));

create policy "herkes okur" on public.suggestions for select using (true);
create policy "herkes öneri gönderir" on public.suggestions for insert
  with check (status = 'yeni' and admin_note is null);
create policy "yönetici günceller" on public.suggestions for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "yönetici siler" on public.suggestions for delete using ((select public.is_admin()));

-- Oylar sadece toggle_vote() ve list_suggestions() üzerinden kullanılır.
create policy "kendi oyunu görür" on public.suggestion_votes for select
  using (voter_id = (select auth.uid())::text);

create policy "herkes okur" on public.announcements for select using (true);
create policy "yönetici ekler" on public.announcements for insert with check ((select public.is_admin()));
create policy "yönetici günceller" on public.announcements for update
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "yönetici siler" on public.announcements for delete using ((select public.is_admin()));

revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
revoke insert, update, delete on public.suggestion_votes from anon, authenticated;

-- ---------------------------------------------------------------- fonksiyonlar

-- Ödendi <-> bekliyor geçişi. Tekrarlayan bir gider ödendiğinde sonraki dönemin kaydı otomatik açılır.
create function public.toggle_expense_paid(p_id bigint)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
declare
  e public.expenses;
  n public.expenses;
  next_due date;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici girişi gerekli.' using errcode = '42501';
  end if;

  update public.expenses
     set status = case status when 'odendi' then 'bekliyor' else 'odendi' end,
         paid_at = null
   where id = p_id
  returning * into e;
  if not found then
    raise exception 'Gider bulunamadı.' using errcode = 'P0002';
  end if;

  if e.status = 'odendi' and e.recurring <> 'none' then
    next_due := (e.due_date + case e.recurring when 'yearly' then interval '1 year' else interval '1 month' end)::date;
    if not exists (
      select 1 from public.expenses x
      where x.title = e.title and x.category = e.category and x.due_date = next_due
    ) then
      insert into public.expenses (title, category, amount, due_date, status, vendor, recurring)
      values (e.title, e.category, e.amount, next_due, 'bekliyor', e.vendor, e.recurring)
      returning * into n;
    end if;
  end if;

  return jsonb_build_object(
    'expense', to_jsonb(e) || jsonb_build_object('overdue', e.status = 'bekliyor' and e.due_date < current_date),
    'next', case when n.id is null then null else to_jsonb(n) || jsonb_build_object('overdue', false) end
  );
end;
$$;

create function public.list_suggestions(p_sort text default 'popular', p_status text default null)
returns table (
  id bigint, title text, description text, author text, apartment_no text, category text,
  status text, admin_note text, created_at timestamptz, updated_at timestamptz,
  votes int, voted boolean
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.title, s.description, s.author, s.apartment_no, s.category,
         s.status, s.admin_note, s.created_at, s.updated_at,
         count(v.voter_id)::int as votes,
         coalesce(bool_or(v.voter_id = (select auth.uid())::text), false) as voted
  from public.suggestions s
  left join public.suggestion_votes v on v.suggestion_id = s.id
  where p_status is null or s.status = p_status
  group by s.id
  order by case when p_sort = 'new' then null else count(v.voter_id) end desc nulls last,
           s.created_at desc
  limit 300;
$$;

create function public.toggle_vote(p_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  voter text := (select auth.uid())::text;
  removed int;
  total int;
begin
  if voter is null then
    raise exception 'Oy vermek için oturum gerekli.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suggestions where id = p_id) then
    raise exception 'Öneri bulunamadı.' using errcode = 'P0002';
  end if;

  delete from public.suggestion_votes where suggestion_id = p_id and voter_id = voter;
  get diagnostics removed = row_count;
  if removed = 0 then
    insert into public.suggestion_votes (suggestion_id, voter_id) values (p_id, voter)
    on conflict do nothing;
  end if;

  select count(*)::int into total from public.suggestion_votes where suggestion_id = p_id;
  return jsonb_build_object('votes', total, 'voted', removed = 0);
end;
$$;

create function public.get_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m date := date_trunc('month', current_date)::date;
  units int := (select unit_count from public.app_settings);
  summary jsonb;
begin
  select jsonb_build_object(
    'month_total',      coalesce(sum(amount) filter (where due_date >= m and due_date < m + interval '1 month'), 0),
    'month_paid',       coalesce(sum(amount) filter (where due_date >= m and due_date < m + interval '1 month' and status = 'odendi'), 0),
    'prev_month_total', coalesce(sum(amount) filter (where due_date >= m - interval '1 month' and due_date < m), 0),
    'overdue_amount',   coalesce(sum(amount) filter (where status = 'bekliyor' and due_date < current_date), 0),
    'overdue_count',    count(*) filter (where status = 'bekliyor' and due_date < current_date),
    'pending_total',    coalesce(sum(amount) filter (where status = 'bekliyor'), 0),
    'pending_count',    count(*) filter (where status = 'bekliyor'),
    'year_total',       coalesce(sum(amount) filter (where due_date >= m - interval '11 months' and due_date < m + interval '1 month'), 0)
  ) into summary
  from public.expenses;

  summary := summary || jsonb_build_object('per_unit', (summary->>'month_total')::numeric / units);

  return jsonb_build_object(
    'units', units,
    'summary', summary,
    'monthly', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.month), '[]')
      from (
        select to_char(g, 'YYYY-MM') as month,
               coalesce(sum(e.amount), 0) as total,
               coalesce(sum(e.amount) filter (where e.status = 'odendi'), 0) as paid
        from generate_series(m - interval '11 months', m, interval '1 month') as g
        left join public.expenses e on e.due_date >= g and e.due_date < g + interval '1 month'
        group by g
      ) x
    ),
    'byCategory', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.total desc), '[]')
      from (
        select category, sum(amount) as total, count(*)::int as count
        from public.expenses
        where due_date >= m - interval '11 months' and due_date < m + interval '1 month'
        group by category
      ) x
    ),
    'upcoming', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.due_date, x.id), '[]')
      from (
        select e.*, (e.due_date < current_date) as overdue
        from public.expenses e
        where e.status = 'bekliyor'
        order by e.due_date, e.id
        limit 6
      ) x
    ),
    'suggestions', (
      select coalesce(jsonb_object_agg(status, n), '{}')
      from (select status, count(*)::int as n from public.suggestions group by status) x
    ),
    'topSuggestions', (
      select coalesce(jsonb_agg(row_to_json(x) order by x.votes desc, x.created_at desc), '[]')
      from (
        select s.id, s.title, s.status, s.category, s.created_at, count(v.voter_id)::int as votes
        from public.suggestions s
        left join public.suggestion_votes v on v.suggestion_id = s.id
        where s.status not in ('tamamlandi', 'reddedildi')
        group by s.id
        order by votes desc, s.created_at desc
        limit 4
      ) x
    ),
    'announcements', (
      select coalesce(jsonb_agg(to_jsonb(x) order by x.pinned desc, x.created_at desc), '[]')
      from (
        select * from public.announcements order by pinned desc, created_at desc limit 3
      ) x
    )
  );
end;
$$;

revoke execute on function public.toggle_expense_paid(bigint) from public, anon;
grant execute on function public.toggle_expense_paid(bigint) to authenticated;
revoke execute on function public.toggle_vote(bigint) from public, anon;
grant execute on function public.toggle_vote(bigint) to authenticated;
