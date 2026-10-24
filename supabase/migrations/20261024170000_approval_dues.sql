-- 1) Yönetici onayı: sakinler kayıttan sonra onaylanana kadar hiçbir veriyi göremez.
-- 2) Aidat: daire × ay ödeme takibi.

-- ---------------------------------------------------------------- onay

alter table public.residents
  add column status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  add column reviewed_at timestamptz;

-- Uygulamayı kullanabilen herkes: yönetici ya da onaylı sakin.
create function public.is_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_admin()
      or exists (select 1 from public.residents where user_id = (select auth.uid()) and status = 'approved');
$$;

drop policy "giriş yapan okur" on public.expenses;
drop policy "giriş yapan okur" on public.suggestions;
drop policy "giriş yapan okur" on public.announcements;
drop policy "giriş yapan öneri gönderir" on public.suggestions;

create policy "üye okur" on public.expenses for select to authenticated using ((select public.is_member()));
create policy "üye okur" on public.suggestions for select to authenticated using ((select public.is_member()));
create policy "üye okur" on public.announcements for select to authenticated using ((select public.is_member()));
create policy "üye öneri gönderir" on public.suggestions for insert to authenticated
  with check ((select public.is_member()) and status = 'yeni' and admin_note is null);

-- Daire bilgisi değişirse kayıt yeniden onaya düşer.
create or replace function public.save_profile(p_apartment_no int, p_full_name text)
returns public.residents
language plpgsql security definer set search_path = ''
as $$
declare
  units int := (select unit_count from public.app_settings);
  name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  r public.residents;
begin
  if (select auth.uid()) is null then
    raise exception 'Giriş yapmanız gerekli.' using errcode = '42501';
  end if;
  if p_apartment_no is null or p_apartment_no < 1 or p_apartment_no > units then
    raise exception 'Daire numarası 1 ile % arasında olmalıdır.', units using errcode = 'P0001';
  end if;
  if char_length(name) < 2 or char_length(name) > 60 then
    raise exception 'Ad soyad 2-60 karakter olmalıdır.' using errcode = 'P0001';
  end if;

  insert into public.residents (user_id, apartment_no, full_name)
  values ((select auth.uid()), p_apartment_no, name)
  on conflict (user_id) do update
    set apartment_no = excluded.apartment_no,
        full_name = excluded.full_name,
        status = 'pending',
        reviewed_at = null
  returning * into r;
  return r;
end;
$$;

create function public.list_residents()
returns table (
  user_id uuid, email text, apartment_no int, full_name text, status text,
  created_at timestamptz, reviewed_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici girişi gerekli.' using errcode = '42501';
  end if;
  return query
    select r.user_id, u.email::text, r.apartment_no, r.full_name, r.status, r.created_at, r.reviewed_at
    from public.residents r
    join auth.users u on u.id = r.user_id
    order by (r.status = 'pending') desc, r.apartment_no, r.full_name;
end;
$$;

create function public.review_resident(p_user_id uuid, p_status text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici girişi gerekli.' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'rejected', 'pending') then
    raise exception 'Geçersiz durum.' using errcode = 'P0001';
  end if;
  update public.residents set status = p_status, reviewed_at = now() where user_id = p_user_id;
  if not found then
    raise exception 'Sakin bulunamadı.' using errcode = 'P0002';
  end if;
end;
$$;

-- Okuma fonksiyonları security definer olduğu için üyelik kontrolü içeride yapılır.
create or replace function public.list_suggestions(p_sort text default 'popular', p_status text default null)
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
  where public.is_member() and (p_status is null or s.status = p_status)
  group by s.id
  order by case when p_sort = 'new' then null else count(v.voter_id) end desc nulls last,
           s.created_at desc
  limit 300;
$$;

create or replace function public.toggle_vote(p_id bigint)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  voter text := (select auth.uid())::text;
  removed int;
  total int;
begin
  if voter is null or not public.is_member() then
    raise exception 'Oy vermek için onaylı bir hesap gerekli.' using errcode = '42501';
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

-- get_stats'in başına üyelik kontrolü eklenir (gövde aynı kalır).
alter function public.get_stats() rename to get_stats_unchecked;
revoke execute on function public.get_stats_unchecked() from public, anon, authenticated;

create function public.get_stats()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'Bu sayfayı görmek için hesabınızın onaylanması gerekli.' using errcode = '42501';
  end if;
  return public.get_stats_unchecked();
end;
$$;

-- ---------------------------------------------------------------- aidat

alter table public.app_settings add column dues_amount numeric(12, 2) not null default 0 check (dues_amount >= 0);

create table public.dues_payments (
  apartment_no  int not null check (apartment_no > 0),
  month         date not null check (extract(day from month) = 1),
  amount        numeric(12, 2) not null check (amount >= 0),
  paid_at       date not null default current_date,
  created_at    timestamptz not null default now(),
  primary key (apartment_no, month)
);

alter table public.dues_payments enable row level security;
create policy "üye okur" on public.dues_payments for select to authenticated using ((select public.is_member()));
revoke insert, update, delete on public.dues_payments from anon, authenticated;

-- Ödendi <-> ödenmedi. Ödeme, o anki aidat tutarıyla kaydedilir.
create function public.toggle_due(p_apartment_no int, p_month date)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  m date := date_trunc('month', p_month)::date;
  units int := (select unit_count from public.app_settings);
  p public.dues_payments;
begin
  if not public.is_admin() then
    raise exception 'Bu işlem için yönetici girişi gerekli.' using errcode = '42501';
  end if;
  if p_apartment_no < 1 or p_apartment_no > units then
    raise exception 'Geçersiz daire numarası.' using errcode = 'P0001';
  end if;

  delete from public.dues_payments where apartment_no = p_apartment_no and month = m;
  if found then
    return jsonb_build_object('paid', false);
  end if;

  insert into public.dues_payments (apartment_no, month, amount)
  values (p_apartment_no, m, (select dues_amount from public.app_settings))
  returning * into p;
  return jsonb_build_object('paid', true, 'payment', to_jsonb(p));
end;
$$;

-- ---------------------------------------------------------------- yetkiler

revoke execute on function public.is_member() from public, anon;
grant execute on function public.is_member() to authenticated;
revoke execute on function public.list_residents() from public, anon;
grant execute on function public.list_residents() to authenticated;
revoke execute on function public.review_resident(uuid, text) from public, anon;
grant execute on function public.review_resident(uuid, text) to authenticated;
revoke execute on function public.get_stats() from public, anon;
grant execute on function public.get_stats() to authenticated;
revoke execute on function public.toggle_due(int, date) from public, anon;
grant execute on function public.toggle_due(int, date) to authenticated;
