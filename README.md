# Sıla Apartmanı · Yönetim Paneli

Liquid Glass tasarımlı apartman yönetim paneli.

- **Genel Bakış**: aylık özet, ödeme oranı, 12 aylık gider grafiği, kategori dağılımı, yaklaşan ödemeler
- **Giderler**: ay ay gider takibi, ödendi/bekliyor/gecikti durumu, kategori filtresi, arama. Tekrarlayan bir gider ödendiğinde sonraki dönemin kaydı otomatik açılır.
- **Aidat**: 12 daire × 12 ay tablosu; yönetici hücreye dokunarak ödendi/ödenmedi işaretler, aylık aidat tutarını belirler. Onay bekleyen sakinler ve sakin listesi de burada (sadece yönetici).
- **Öneriler**: sakinler öneri gönderir ve oy verir, yönetim durum ve not ekler
- **Duyurular**: sabitlenebilir, önem derecesi olan duyurular

Uygulama sadece onaylı hesaplara açıktır. Sakinler **e-posta + şifre** ile kayıt olur, ilk girişte daire numarası ve adını girer (aynı dairede birden fazla kişi olabilir). **Yönetici onaylayana kadar** hiçbir veriyi göremezler. Öneriler bu bilgiyle gönderilir, herkes bir öneriye bir kez oy verir. Gider, duyuru ve öneri durumu düzenlemek **yönetici hesabı** ister.

| Katman | Teknoloji |
| --- | --- |
| Ön yüz | Vue 3 + Vite, saf CSS (Liquid Glass) |
| Backend | Supabase: Postgres, RLS kuralları, RPC fonksiyonları, Auth |
| Yayın | Vercel (sadece ön yüz) |
| Lokal | Supabase CLI (Docker) + Docker Compose (nginx) |

Backend kodu `supabase/` klasöründedir:

- `migrations/`: tablolar, RLS kuralları ve fonksiyonlar (`get_stats`, `list_suggestions`, `toggle_vote`, `toggle_expense_paid`, `toggle_due`, `save_profile`, `review_resident`, `is_member`, `is_admin`)
- `functions/register`: kayıt (e-posta doğrulaması beklemeden hesap açar)
- `seed.sql`: bugünün tarihine göre son 12 ayın örnek verileri

## Yönetici ekleme

1. Uygulamadan normal şekilde kayıt olun (ya da Supabase panelinde **Authentication → Users → Add user**).
2. **SQL Editor**'de çalıştırın:
   ```sql
   insert into admins (user_id)
   select id from auth.users where email = 'yonetici@ornek.com';
   ```
3. Bu e-posta ve şifreyle girin. Yöneticilerden daire bilgisi istenmez.

Sakinleri **Aidat** sekmesinden onaylayın, reddedin ya da erişimlerini kaldırın. Hesabı tamamen silmek için Supabase panelinde **Authentication → Users**'ı kullanın.

Daire sayısı (aidat hesaplaması için) `app_settings` tablosundadır:

```sql
update app_settings set unit_count = 16;
```

## Lokal geliştirme

Uzak Supabase projesiyle:

```bash
cp .env.example frontend/.env.local   # URL ve publishable key'i doldurun
npm install --prefix frontend
npm run dev                            # http://localhost:5173
```

Tamamen lokal (Docker gerekir):

```bash
npm run db:start      # Supabase'i Docker'da başlatır, migration + seed uygular
npx supabase status   # API URL ve publishable key burada
```

Bu değerleri `frontend/.env.local` dosyasına yazıp `npm run dev` çalıştırın. Şemayı ve verileri sıfırlamak için: `npm run db:reset`.

Ön yüzü nginx ile Docker'da sunmak için:

```bash
cp .env.example .env    # değerleri doldurun
docker compose up -d --build   # http://localhost:8080
```

## Vercel'de yayınlama

1. Repoyu [vercel.com/new](https://vercel.com/new) adresinde **Import** edin. **Root Directory** olarak `frontend` seçin (framework: Vite).
2. **Settings → Environment Variables** altına `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` ekleyin.
3. **Deploy**.

Gerçek verilere geçmeden önce örnek kayıtları silmek için SQL Editor'de:

```sql
truncate expenses, suggestions, announcements restart identity cascade;
```

## Proje yapısı

```
supabase/             Backend: migration, seed, lokal Supabase ayarları
frontend/             Vue 3 uygulaması
  src/supabase.js     Supabase istemcisi
  src/api.js          tüm veri erişimi (tablolar + RPC)
  src/views/          Genel Bakış, Giderler, Öneriler, Duyurular
  src/assets/main.css Liquid Glass tasarım sistemi
docker-compose.yml    ön yüz (nginx)
```
