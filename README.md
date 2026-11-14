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