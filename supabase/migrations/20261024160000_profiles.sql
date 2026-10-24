-- Herkes e-posta ile kayıt olur; daire bilgisi ilk girişte save_profile() ile kaydedilir.
-- Aynı dairede birden fazla kişi (aile üyeleri) kayıtlı olabilir.

alter table public.residents drop constraint residents_apartment_no_key;
create index residents_apartment_no_idx on public.residents (apartment_no);

create function public.save_profile(p_apartment_no int, p_full_name text)
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
  on conflict (user_id) do update set apartment_no = excluded.apartment_no, full_name = excluded.full_name
  returning * into r;
  return r;
end;
$$;

revoke execute on function public.save_profile(int, text) from public, anon;
grant execute on function public.save_profile(int, text) to authenticated;
