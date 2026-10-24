// İlk açılışta, bugünün tarihine göre son 12 ayı kapsayan gerçekçi örnek veriler üretir.

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GAS_BY_MONTH = [17800, 16200, 12400, 7600, 3900, 2100, 1700, 1650, 2300, 5200, 10800, 15900];

export async function seed(pool) {
  const random = rng(42);
  const vary = (base, spread) => Math.round((base + random() * spread) / 10) * 10;
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dateOf = (offset, day) => new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, day));
  const iso = (d) => d.toISOString().slice(0, 10);

  const expenses = [];
  const add = (e) => {
    const due = e.date;
    const paid = e.forcePending ? false : e.forcePaid || due < today;
    const paidAt = new Date(due);
    paidAt.setUTCDate(paidAt.getUTCDate() + Math.floor(random() * 3));
    expenses.push({
      ...e,
      due_date: iso(due),
      status: paid ? 'odendi' : 'bekliyor',
      paid_at: paid ? iso(paidAt > today ? today : paidAt) : null,
    });
  };

  for (let offset = -11; offset <= 1; offset++) {
    const monthIndex = (((now.getMonth() + offset) % 12) + 12) % 12;
    const isCurrent = offset === 0;
    const monthly = (title, category, amount, day, vendor, extra = {}) =>
      add({ title, category, amount, date: dateOf(offset, day), vendor, recurring: 'monthly', ...extra });

    monthly('Görevli maaşı ve SGK', 'personel', 28500, 1, null);
    monthly('Asansör periyodik bakımı', 'asansor', 2750, 5, 'Kone Asansör');
    monthly('Temizlik malzemeleri', 'temizlik', vary(1150, 650), 8, 'Metro Toptan');
    monthly('Ortak alan elektriği', 'elektrik', vary(1850, 750), 12, 'Enerjisa');
    // Bu ayın su faturası gecikmiş olarak bırakılır ki takip ekranında görünsün.
    monthly('Ortak alan suyu', 'su', vary(900, 480), 18, 'İSKİ', { forcePending: isCurrent && now.getDate() > 18 });
    monthly('Merkezi doğalgaz', 'dogalgaz', vary(GAS_BY_MONTH[monthIndex], 900), 20, 'İGDAŞ');
    if (monthIndex >= 3 && monthIndex <= 8) monthly('Bahçe ve peyzaj bakımı', 'bahce', 3500, 15, 'Yeşil Vadi Peyzaj');
  }

  const once = (title, category, amount, offset, day, vendor, notes = null, extra = {}) =>
    add({ title, category, amount, date: dateOf(offset, day), vendor, recurring: 'none', notes, ...extra });

  once('Bina sigortası (DASK + konut)', 'sigorta', 14800, -7, 3, 'Anadolu Sigorta', 'Yıllık poliçe yenilemesi', { recurring: 'yearly' });
  once('Çatı su yalıtımı onarımı', 'bakim', 38500, -5, 22, 'Usta Yapı', 'Kuzey cephe, 2 ustalık iş günü');
  once('Güvenlik kamerası yenileme', 'bakim', 21900, -2, 9, 'Optik Güvenlik', '8 kanal NVR + 6 adet kamera');
  once('Hidrofor pompa değişimi', 'bakim', 12400, -1, 14, 'Akış Mekanik');
  once('Yangın tüpü dolumu', 'bakim', 3600, 0, 3, 'Ateş Söndürme Ltd.', null, { forcePaid: true });
  once('Merdiven boşluğu boyası', 'bakim', 16750, 0, 28, 'Renk Dekorasyon', 'Zemin kattan 5. kata kadar');
  once('Kombi bacası kontrolü', 'bakim', 2400, 1, 6, null);

  for (const e of expenses) {
    await pool.query(
      `INSERT INTO expenses (title, category, amount, due_date, status, paid_at, vendor, recurring, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [e.title, e.category, e.amount, e.due_date, e.status, e.paid_at, e.vendor || null, e.recurring, e.notes || null],
    );
  }

  const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
  const suggestions = [
    ['Çatıya güneş paneli kurulumu', 'Ortak alan elektriğini karşılamak için çatıya 5 kW güneş paneli kurulabilir. Yaklaşık 4 yılda kendini amorti eder.', 'Mehmet K.', '7', 'enerji', 'inceleniyor', 'Üç firmadan teklif istendi.', 23, 12],
    ['Otoparka şarj istasyonu', 'Elektrikli araç sahipleri için otoparka ortak kullanımlı bir şarj ünitesi konulmasını öneriyorum.', 'Elif S.', '3', 'teknik', 'yeni', null, 9, 3],
    ['Giriş kapısına yüz tanıma', 'Kartlı sistem yerine yüz tanımalı ve uygulamadan açılabilen bir kapı sistemi güvenliği artırır.', 'Ahmet Y.', '11', 'guvenlik', 'onaylandi', 'Ocak ayı bütçesine eklendi.', 17, 20],
    ['Bahçeye oturma grubu', 'Arka bahçeye pergole ve oturma grubu yapılırsa yaz akşamları komşularla vakit geçirebiliriz.', 'Zeynep A.', '2', 'peyzaj', 'tamamlandi', 'Haziranda tamamlandı, teşekkürler!', 14, 95],
    ['Merdiven ışıklarına sensör', 'Merdiven ışıkları gün boyu açık kalıyor. Hareket sensörlü LED ile ciddi tasarruf sağlanır.', 'Can D.', '9', 'enerji', 'yeni', null, 12, 1],
    ['Aylık geri dönüşüm günü', 'Her ayın ilk cumartesi atık pil, cam ve elektronik atıklar toplanabilir.', 'Ayşe T.', '5', 'temizlik', 'reddedildi', 'Belediye zaten haftalık topluyor.', 4, 40],
  ];
  for (const [title, description, author, apt, category, status, note, votes, age] of suggestions) {
    const { rows } = await pool.query(
      `INSERT INTO suggestions (title, description, author, apartment_no, category, status, admin_note, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) RETURNING id`,
      [title, description, author, apt, category, status, note, daysAgo(age)],
    );
    for (let i = 0; i < votes; i++) {
      await pool.query('INSERT INTO suggestion_votes (suggestion_id, voter_id) VALUES ($1, $2)', [rows[0].id, `seed-voter-${i}`]);
    }
  }

  const announcements = [
    ['Merdiven boyası çalışması', 'Bu ayın son haftasında merdiven boşluğu boyanacaktır. Çalışma saatlerinde (09:00-17:00) merdivenleri kullanırken dikkatli olunuz.', 'onemli', true, 2],
    ['Kalorifer sezonu başlıyor', 'Merkezi ısıtma sistemi bu hafta sonu devreye alınacaktır. Peteklerinizin hava tahliyesini yapmanızı rica ederiz.', 'normal', false, 6],
    ['Olağan genel kurul toplantısı', 'Yıllık olağan genel kurul toplantımız bir sonraki ayın ilk pazar günü saat 14:00\'te sığınak katında yapılacaktır.', 'normal', false, 15],
  ];
  for (const [title, body, priority, pinned, age] of announcements) {
    await pool.query(
      'INSERT INTO announcements (title, body, priority, pinned, created_at) VALUES ($1, $2, $3, $4, $5)',
      [title, body, priority, pinned, daysAgo(age)],
    );
  }
}
