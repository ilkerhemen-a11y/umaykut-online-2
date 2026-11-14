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

Socket.IO bağlantısı `auth: { token }` ile doğrulanır; başarılı bağlantıda `world:connected` olayı gelir.

## Geliştirme durumu
Bu kod henüz canlıya alınmış veya üretim güvenliği açısından denetlenmiş değildir. Şehir koordinatlarının çakışmasını önleme, kaynak üretimi, binalar, ordu, savaş, ittifaklar, rate limit, parola sıfırlama, istemci entegrasyonu ve otomatik testler sonraki aşamalardır. Gizli anahtarları GitHub'a yüklemeyin.