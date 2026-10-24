-- Bugünün tarihine göre son 12 ayı kapsayan gerçekçi örnek veriler.
-- Gerçek verilere geçmeden önce:
--   truncate expenses, suggestions, announcements restart identity cascade;

do $$
declare
  today date := current_date;
  m0 date := date_trunc('month', current_date)::date;
  gas int[] := array[17800, 16200, 12400, 7600, 3900, 2100, 1700, 1650, 2300, 5200, 10800, 15900];
  m date;
  mon int;
  sid bigint;
  s record;
  a record;
begin
  perform setseed(0.42);

  create temp table seed_rows (
    title text, category text, amount numeric, due date, vendor text,
    recurring text, notes text, force_pending bool default false, force_paid bool default false
  ) on commit drop;

  for i in -11..1 loop
    m := (m0 + make_interval(months => i))::date;
    mon := extract(month from m);
    insert into seed_rows (title, category, amount, due, vendor, recurring, force_pending) values
      ('Görevli maaşı ve SGK', 'personel', 28500, m, null, 'monthly', false),
      ('Asansör periyodik bakımı', 'asansor', 2750, m + 4, 'Kone Asansör', 'monthly', false),
      ('Temizlik malzemeleri', 'temizlik', round((1150 + random() * 650) / 10) * 10, m + 7, 'Metro Toptan', 'monthly', false),
      ('Ortak alan elektriği', 'elektrik', round((1850 + random() * 750) / 10) * 10, m + 11, 'Enerjisa', 'monthly', false),
      -- Bu ayın su faturası gecikmiş olarak bırakılır ki takip ekranında görünsün.
      ('Ortak alan suyu', 'su', round((900 + random() * 480) / 10) * 10, m + 17, 'İSKİ', 'monthly',
        i = 0 and extract(day from today) > 18),
      ('Merkezi doğalgaz', 'dogalgaz', round((gas[mon] + random() * 900) / 10) * 10, m + 19, 'İGDAŞ', 'monthly', false);
    if mon between 4 and 9 then
      insert into seed_rows (title, category, amount, due, vendor, recurring)
      values ('Bahçe ve peyzaj bakımı', 'bahce', 3500, m + 14, 'Yeşil Vadi Peyzaj', 'monthly');
    end if;
  end loop;

  insert into seed_rows (title, category, amount, due, vendor, recurring, notes, force_paid) values
    ('Bina sigortası (DASK + konut)', 'sigorta', 14800, (m0 - interval '7 months')::date + 2, 'Anadolu Sigorta', 'yearly', 'Yıllık poliçe yenilemesi', false),
    ('Çatı su yalıtımı onarımı', 'bakim', 38500, (m0 - interval '5 months')::date + 21, 'Usta Yapı', 'none', 'Kuzey cephe, 2 ustalık iş günü', false),
    ('Güvenlik kamerası yenileme', 'bakim', 21900, (m0 - interval '2 months')::date + 8, 'Optik Güvenlik', 'none', '8 kanal NVR + 6 adet kamera', false),
    ('Hidrofor pompa değişimi', 'bakim', 12400, (m0 - interval '1 month')::date + 13, 'Akış Mekanik', 'none', null, false),
    ('Yangın tüpü dolumu', 'bakim', 3600, m0 + 2, 'Ateş Söndürme Ltd.', 'none', null, true),
    ('Merdiven boşluğu boyası', 'bakim', 16750, m0 + 27, 'Renk Dekorasyon', 'none', 'Zemin kattan 5. kata kadar', false),
    ('Kombi bacası kontrolü', 'bakim', 2400, (m0 + interval '1 month')::date + 5, null, 'none', null, false);

  insert into expenses (title, category, amount, due_date, status, paid_at, vendor, recurring, notes)
  select title, category, amount, due,
         case when paid then 'odendi' else 'bekliyor' end,
         case when paid then least(due + floor(random() * 3)::int, today) end,
         vendor, recurring, notes
  from (
    select *, not force_pending and (force_paid or due < today) as paid from seed_rows
  ) r
  order by due;

  for s in
    select * from (values
      ('Çatıya güneş paneli kurulumu', 'Ortak alan elektriğini karşılamak için çatıya 5 kW güneş paneli kurulabilir. Yaklaşık 4 yılda kendini amorti eder.', 'Mehmet K.', '7', 'enerji', 'inceleniyor', 'Üç firmadan teklif istendi.', 23, 12),
      ('Otoparka şarj istasyonu', 'Elektrikli araç sahipleri için otoparka ortak kullanımlı bir şarj ünitesi konulmasını öneriyorum.', 'Elif S.', '3', 'teknik', 'yeni', null, 9, 3),
      ('Giriş kapısına yüz tanıma', 'Kartlı sistem yerine yüz tanımalı ve uygulamadan açılabilen bir kapı sistemi güvenliği artırır.', 'Ahmet Y.', '11', 'guvenlik', 'onaylandi', 'Ocak ayı bütçesine eklendi.', 17, 20),
      ('Bahçeye oturma grubu', 'Arka bahçeye pergole ve oturma grubu yapılırsa yaz akşamları komşularla vakit geçirebiliriz.', 'Zeynep A.', '2', 'peyzaj', 'tamamlandi', 'Haziranda tamamlandı, teşekkürler!', 14, 95),
      ('Merdiven ışıklarına sensör', 'Merdiven ışıkları gün boyu açık kalıyor. Hareket sensörlü LED ile ciddi tasarruf sağlanır.', 'Can D.', '9', 'enerji', 'yeni', null, 12, 1),
      ('Aylık geri dönüşüm günü', 'Her ayın ilk cumartesi atık pil, cam ve elektronik atıklar toplanabilir.', 'Ayşe T.', '5', 'temizlik', 'reddedildi', 'Belediye zaten haftalık topluyor.', 4, 40)
    ) as t (title, description, author, apt, category, status, note, votes, age)
  loop
    insert into suggestions (title, description, author, apartment_no, category, status, admin_note, created_at, updated_at)
    values (s.title, s.description, s.author, s.apt, s.category, s.status, s.note,
            now() - make_interval(days => s.age), now() - make_interval(days => s.age))
    returning id into sid;
    insert into suggestion_votes (suggestion_id, voter_id)
    select sid, 'seed-voter-' || g from generate_series(1, s.votes) g;
  end loop;

  for a in
    select * from (values
      ('Merdiven boyası çalışması', 'Bu ayın son haftasında merdiven boşluğu boyanacaktır. Çalışma saatlerinde (09:00-17:00) merdivenleri kullanırken dikkatli olunuz.', 'onemli', true, 2),
      ('Kalorifer sezonu başlıyor', 'Merkezi ısıtma sistemi bu hafta sonu devreye alınacaktır. Peteklerinizin hava tahliyesini yapmanızı rica ederiz.', 'normal', false, 6),
      ('Olağan genel kurul toplantısı', 'Yıllık olağan genel kurul toplantımız bir sonraki ayın ilk pazar günü saat 14:00''te sığınak katında yapılacaktır.', 'normal', false, 15)
    ) as t (title, body, priority, pinned, age)
  loop
    insert into announcements (title, body, priority, pinned, created_at)
    values (a.title, a.body, a.priority, a.pinned, now() - make_interval(days => a.age));
  end loop;
end;
$$;
