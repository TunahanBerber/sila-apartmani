# Sıla Apartmanı · Yönetim Paneli

Liquid Glass tasarımlı apartman yönetim paneli.

- **Genel Bakış**: aylık özet, ödeme oranı, 12 aylık gider grafiği, kategori dağılımı, yaklaşan ödemeler
- **Giderler**: ay ay gider takibi, ödendi/bekliyor/gecikti durumu, kategori filtresi, arama. Tekrarlayan bir gider ödendiğinde sonraki dönemin kaydı otomatik açılır.
- **Öneriler**: sakinler öneri gönderir ve oy verir, yönetim durum ve not ekler
- **Duyurular**: sabitlenebilir, önem derecesi olan duyurular

Okuma ve öneri/oy herkese açıktır. Gider, duyuru ve öneri durumu düzenleme **yönetici şifresi** (`ADMIN_TOKEN`) ister.

| Katman | Teknoloji |
| --- | --- |
| Ön yüz | Vue 3 + Vite, saf CSS (Liquid Glass) |
| API | Node.js + Express 5 |
| Veritabanı | PostgreSQL |
| Lokal | Docker Compose |
| Yayın | Vercel (ön yüz + API fonksiyonu) + Neon Postgres |

## Lokal çalıştırma (Docker)

```bash
cp .env.example .env          # şifreleri değiştirin
docker compose up -d --build
```

- Uygulama: http://localhost:8080
- API: http://localhost:4000/api/health

İlk açılışta bugünün tarihine göre örnek veriler yüklenir (`SEED=false` ile kapatılır).

### Docker olmadan geliştirme

```bash
docker compose up -d db                # sadece veritabanı
npm install && npm run dev:api         # API  → :4000
npm install --prefix frontend
npm run dev:web                        # Vite → :5173 (/api otomatik proxy)
```

## Vercel'de yayınlama

1. Projeyi GitHub'a gönderin:
   ```bash
   git init && git add . && git commit -m "Sıla Apartmanı ilk sürüm"
   git branch -M main
   git remote add origin https://github.com/<kullanici-adiniz>/sila-apartmani.git
   git push -u origin main
   ```
2. [vercel.com/new](https://vercel.com/new) adresinde repoyu **Import** edin. Ayarlar `vercel.json`'dan gelir, bir şey değiştirmenize gerek yok.
3. Vercel projesinde **Storage → Create Database → Neon (Postgres)** seçip projeye bağlayın. `DATABASE_URL` kendiliğinden eklenir.
4. **Settings → Environment Variables** altına ekleyin:
   - `ADMIN_TOKEN`: güçlü bir yönetici şifresi
   - `UNIT_COUNT`: daire sayısı (varsayılan 12)
5. **Deployments → Redeploy**. Tablolar ve örnek veriler ilk istekte otomatik oluşur.

Gerçek verilere geçmeden önce örnek kayıtları silmek isterseniz Neon konsolunda şunu çalıştırın:

```sql
TRUNCATE expenses, suggestions, announcements RESTART IDENTITY CASCADE;
```

Ardından `SEED=false` ortam değişkenini ekleyin.

## Proje yapısı

```
api/index.js          Vercel Function → backend/src/app.js
backend/              Express API (Docker imajı da buradan)
  src/app.js          rotalar ve ara katmanlar
  src/routes/         expenses, suggestions, announcements, stats
  src/schema.js       tablo tanımları (açılışta otomatik uygulanır)
  src/seed.js         örnek veriler
frontend/             Vue 3 uygulaması
  src/views/          Genel Bakış, Giderler, Öneriler, Duyurular
  src/assets/main.css Liquid Glass tasarım sistemi
docker-compose.yml    db + api + web (nginx)
vercel.json           Vercel derleme ve yönlendirme ayarları
```
