# Umaykut Online 2 – Sunucu başlangıç paketi

Bu depo, ortak dünya MMORPG altyapısının ilk sunucu iskeletidir.

## Gerekenler
- Node.js 20 veya üzeri
- PostgreSQL

## Yerel kurulum
1. `npm install`
2. `.env.example` dosyasını `.env` olarak kopyalayın.
3. `.env` içindeki `DATABASE_URL` ve en az 32 karakterlik `JWT_SECRET` değerlerini ayarlayın.
4. PostgreSQL üzerinde `sql/schema.sql` dosyasını çalıştırın.
5. `npm run dev`
6. `http://localhost:3000/health` adresini kontrol edin.

## API
- `GET /health` – servis/veritabanı kontrolü
- `POST /api/auth/register` – JSON: `{"username":"oyuncu1","password":"en-az-8-karakter"}`
- `POST /api/auth/login` – JWT token döndürür
- `GET /api/world` – Bearer token ile şehirleri listeler
- `GET /api/city/me` – oyuncunun şehrini getirir
- `GET /api/factions` – üç devletin hikâye/başlangıç yurdu/bonus tanımlarını getirir
- `GET /api/faction/me` – giriş yapan oyuncunun kalıcı devlet seçimini getirir
- `POST /api/faction/select` – `{ "factionId": "selcuk|hun|gokturk" }` ile ilk devlet seçimini kaydeder; seçim kilitlidir

Socket.IO bağlantısı `auth: { token }` ile doğrulanır; başarılı bağlantıda `world:connected` olayı gelir.

## Devlet sistemi

İlk girişte Selçuk, Hun veya Göktürk devletlerinden biri seçilir. Seçim PostgreSQL üzerindeki `players.faction_id` alanına kaydedilir ve API üzerinden tekrar değiştirilmesi engellenir. Bonuslar sunucu tarafından tek bir tanım kaynağından sunulur: Selçuk (+%3 saldırı, +%3 savunma, +%2 maksimum HP), Hun (+%5 saldırı, +%3 hareket hızı), Göktürk (+%5 savunma, +%3 maksimum HP). Bu sürümde savaş/karakter stat hesaplama sistemi henüz bulunmadığından bonuslar seçim ekranında ve API yanıtında tanımlıdır; henüz savaş hesaplamalarına uygulanmaz.

## Geliştirme durumu
Bu kod henüz canlıya alınmış veya üretim güvenliği açısından denetlenmiş değildir. Şehir koordinatlarının çakışmasını önleme, kaynak üretimi, binalar, ordu, savaş, ittifaklar, rate limit, parola sıfırlama, istemci entegrasyonu ve otomatik testler sonraki aşamalardır. Gizli anahtarları GitHub'a yüklemeyin.

## Devletlere özel asker kataloğu

- Her devlet için 7 asker tanımı bulunur: Kışla Seviye 1, Okçu, Kışla Seviye 5, Kışla Seviye 10, Ahır Seviye 1, Ahır Seviye 5 ve Ahır Seviye 10.
- Beş değer kesin olarak şu sıradadır: saldırı; piyadelere karşı savunma (normal kalkan); atlılara karşı savunma (mor kalkan); hareket hızı; yağmaya gönderilen bir askerin toplam ganimet taşıma kapasitesi (altın simgesi). Son değer üretim maliyeti veya altın değildir.
- `GET /api/units` tüm devletlerin katalog tanımlarını; `GET /api/units/me` giriş yapan oyuncunun devletine ait 7 birimi getirir.
- Köyde Kışla/Ahır binalarına veya Ordu Birlikleri başlığına dokununca asker kataloğu açılır.
- Bu aşama katalog ve istatistik gösterimidir. Asker üretimi, kuyruk, kaynak düşümü, birlik envanteri ve savaş hesabı henüz etkin değildir.

## Kalıcı ordu mevcudu (ilk altyapı)

- `player_army` tablosu her oyuncunun kendi devletine ait 7 asker türünü ayrı ayrı saklar.
- `GET /api/army/me` giriş yapan oyuncunun asker mevcudunu döndürür; ilk istekte 7 birlik sıfır adetle oluşturulur.
- Köydeki ordu şeridi artık sabit örnek sayılar yerine veritabanından gelen gerçek birlik adetlerini gösterir.
- Bu adım yalnızca ordu envanterinin kalıcı temelidir. Asker üretimi, kaynak maliyeti, üretim süresi ve kuyruk henüz etkin değildir; son sütunun kaynağı/işlevi teyit edilmeden kaynak düşümü yapılmaz.

## Asker eğitimi kuyruğu (test sürümü)

- `POST /api/training/start` ile oyuncu kendi devletine ait bir asker türünden 1–100 adet için eğitim başlatır.
- Her oyuncu için aynı anda tek aktif eğitim bulunur. Süreler test amaçlı asker başına 20–60 saniyedir; adet arttıkça toplam süre doğrusal artar.
- `GET /api/training/me` sunucu saatine göre tamamlanan eğitimi sonuçlandırır ve askerleri kalıcı ordu envanterine ekler. Oyuncu oyundan çıksa da bitiş zamanı kaybolmaz.
- Kışla/Ahır ekranında aktif eğitim geri sayımı, asker adedi ve ordudaki mevcut gösterilir.
- Bu test aşamasında kaynak düşümü uygulanmaz. Beşinci asker değeri üretim bedeli değil, yağma taşıma kapasitesidir. Üretim maliyetleri ayrıca tasarlanıp onaylanacaktır.
- Gerçek zamanlı otomatik tamamlama, oyuncu eğitim ekranını yeniden açtığında veya eğitim durumu API'si sorgulandığında işlenir; ayrı arka plan worker henüz yoktur.
