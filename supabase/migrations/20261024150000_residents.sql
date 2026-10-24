-- Sakin hesapları: her daire için bir hesap (daire no + şifre ile giriş).
-- Hesaplar `register` edge function'ı ile açılır; uygulama artık sadece giriş yapanlara açıktır.

create table public.residents (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  apartment_no  int not null unique check (apartment_no > 0),
  full_name     text not null check (char_length(full_name) between 2 and 60),
  created_at    timestamptz not null default now()
);

alter table public.residents enable row level security;

create policy "kendi kaydını ya da yönetici hepsini görür" on public.residents for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Ekleme sadece edge function (service role) ile; daireyi boşaltmak için
-- Supabase panelinde Authentication → Users'tan kullanıcı silinir (kayıt da silinir).
revoke insert, update, delete on public.residents from anon, authenticated;

-- Okuma artık sadece giriş yapmış kullanıcılara açık (app_settings hariç: kayıt ekranı daire sayısını okur).
drop policy "herkes okur" on public.expenses;
drop policy "herkes okur" on public.suggestions;
drop policy "herkes okur" on public.announcements;
drop policy "herkes öneri gönderir" on public.suggestions;

create policy "giriş yapan okur" on public.expenses for select to authenticated using (true);
create policy "giriş yapan okur" on public.suggestions for select to authenticated using (true);
create policy "giriş yapan okur" on public.announcements for select to authenticated using (true);
create policy "giriş yapan öneri gönderir" on public.suggestions for insert to authenticated
  with check (status = 'yeni' and admin_note is null);

-- Öneri sahibi bilgisi istemciden değil, sakin kaydından gelir.
create function public.suggestions_author()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.residents;
begin
  select * into r from public.residents where user_id = (select auth.uid());
  if found then
    new.author := r.full_name;
    new.apartment_no := r.apartment_no::text;
  elsif not public.is_admin() then
    new.author := null;
    new.apartment_no := null;
  end if;
  return new;
end;
$$;
create trigger suggestions_author before insert on public.suggestions
  for each row execute function public.suggestions_author();

revoke execute on function public.get_stats() from public, anon;
grant execute on function public.get_stats() to authenticated;
revoke execute on function public.list_suggestions(text, text) from public, anon;
grant execute on function public.list_suggestions(text, text) to authenticated;
revoke execute on function public.suggestions_author() from public, anon, authenticated;

