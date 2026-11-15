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

- İlk girişte Selçuk, Hun veya Göktürk devletlerinden biri seçilir. Seçim ekranında devletin hikâyesi, başlangıç şehri/yurdu ve bonusları karşılaştırılır; oyuncu ayrıca onay verir.
- Seçim PostgreSQL üzerindeki `players.faction_id` alanına kalıcı kaydedilir. Aynı işlemde `player_cities.city_name` seçilen devletin başlangıç şehri/yurdu olarak ayarlanır. API, seçilmiş devletin normal koşullarda değiştirilmesini reddeder. İleride özel görevle değişim bu sürümde tasarlanmış veya açılmış değildir.
- Bonus bütçeleri tek kaynakta tanımlanır ve uygulama açılırken doğrulanır: Selçuk saldırı +%3, savunma +%3, maksimum HP +%2; Hun saldırı +%5, hareket hızı +%3; Göktürk savunma +%5, maksimum HP +%3. Her devletin toplamı %8'dir.
- `src/factionBonuses.js`, devlet yüzdesini yalnızca ham karakter temel değerlerine uygulayan; seviye ve ekipman katkılarını bundan sonra sabit değer olarak ekleyen bir hesaplayıcı ve tekrar uygulamayı aynı çalışma akışında engelleyen koruma içerir. `npm test` ile bu kurallar doğrulanır.
- **Entegrasyon sınırı:** Mevcut depoda henüz kalıcı oyuncu-karakter istatistik modeli, seviye stat ilerlemesi, ekipman bonusu modeli veya savaş çözümleyicisi yoktur. Bu nedenle hesaplayıcı test edilmiştir ancak henüz canlı karakter/savaş akışına bağlanmamıştır; devlet bonusları asker kataloğunun devletlere özgü ham değerlerine ikinci kez uygulanmaz. Karakter modeli eklendiğinde tek merkezî stat hesaplama noktasından çağrılmalıdır.

## Şehir işçileri ve harita kaynakları (ilk ekonomi sürümü)

- Her yeni şehrin başlangıç işçi havuzu **1.800** kişidir. İşçiler şehir binalarında çalışmaz; haritadaki kaynak noktalarına atanır.
- Her şehir için altı kaynak noktası oluşturulur: tahıl, odun, taş, demir, altın ve at. Noktalar şehrin çevresindeki koordinatlarda gösterilir.
- Merkez Binası Seviye 1 iken her kaynak noktasına en fazla **300 işçi** atanabilir. İlk sürümde bu sınır merkez seviyesi × 300 olarak hesaplanır. Böylece Seviye 1'de altı noktanın toplam kapasitesi 1.800 işçidir.
- İşçi atamaları şehir bazında kalıcıdır. Toplam atanan işçi sayısı şehir havuzunu aşamaz; boşta kalan işçiler başka kaynaklara gönderilebilir.
- Kaynak üretimi sunucu saatine göre çevrimdışı da devam eder. İlk denge değerleri: tahıl/odun/taş/demir işçi başına saatte 1; altın saatte 0,5; at saatte 0,25 birim. Bu değerler test ekonomisi için başlangıç ayarıdır ve oyun dengesi testleriyle değiştirilecektir.
- Merkez seviyesi düşürülürse, sonraki ekonomi işlemi sırasında her kaynak noktasındaki atama yeni kapasiteye indirilir; boşa çıkan işçiler havuzda kullanılabilir hale gelir.
- API: `GET /api/economy/me` üretim, kaynak noktaları ve işçi dağılımını getirir. `POST /api/economy/assign` gövdesi `{ "nodeId": 1, "workers": 300 }` biçimindedir.
- Köyde **İşçiler / Üretim** düğmesi bu yönetim ekranını açar. Kaynak sayacı sunucu verisiyle güncellenir.

## Geliştirme durumu
Bu kod henüz canlıya alınmış veya üretim güvenliği açısından denetlenmiş değildir. Şehir koordinatlarının çakışmasını önleme, kaynak üretimi, binalar, ordu, savaş, ittifaklar, rate limit, parola sıfırlama, istemci entegrasyonu ve otomatik testler sonraki aşamalardır. Gizli anahtarları GitHub'a yüklemeyin.

## Devletlere özel asker kataloğu

- Her devlet için 9 birlik tanımı bulunur: mevcut 7 kışla/ahır askeri ile Mancınık ve Topçu kuşatma birlikleri.
- Beş değer kesin olarak şu sıradadır: saldırı; piyadelere karşı savunma (normal kalkan); atlılara karşı savunma (mor kalkan); hareket hızı; yağmaya gönderilen bir askerin toplam ganimet taşıma kapasitesi (altın simgesi). Son değer üretim maliyeti veya altın değildir.
- `GET /api/units` tüm devletlerin katalog tanımlarını; `GET /api/units/me` giriş yapan oyuncunun devletine ait 9 birimi getirir.
- Köyde Kışla/Ahır binalarına veya Ordu Birlikleri başlığına dokununca asker kataloğu açılır.
- Asker kataloğu devlet bazında dokuz birimi ve beş temel istatistiği sunar. Üretim kuyruğu ve kalıcı birlik envanteri aşağıdaki bölümlerde açıklanır; kaynak maliyetleri ve savaş hesabı henüz etkin değildir.

## Kalıcı ordu mevcudu (ilk altyapı)

- `player_army` tablosu her oyuncunun kendi devletine ait 9 birlik türünü ayrı ayrı saklar.
- `GET /api/army/me` giriş yapan oyuncunun asker mevcudunu döndürür; ilk istekte 9 birlik sıfır adetle oluşturulur.
- Köydeki ordu şeridi artık sabit örnek sayılar yerine veritabanından gelen gerçek birlik adetlerini gösterir.
- Ordu envanteri kalıcıdır. `GET /api/army/me` her asker türünün adetini ve `totalCarryCapacity` alanını döndürür. Toplam kapasite, her tür için asker adedi × o askerin birim taşıma kapasitesi toplamıdır. Köyde toplam yağma taşıma kapasitesi ayrıca gösterilir. Kaynak maliyetleri ve yağma seferi henüz etkin değildir.

## Asker eğitimi kuyruğu (test sürümü)

- `POST /api/training/start` ile oyuncu kendi devletine ait bir asker türünden 1–100 adet için eğitim başlatır.
- Her oyuncu için aynı anda tek aktif eğitim bulunur. Süreler test amaçlı asker başına 20–60 saniyedir; adet arttıkça toplam süre doğrusal artar.
- `GET /api/training/me` sunucu saatine göre tamamlanan eğitimi sonuçlandırır ve askerleri kalıcı ordu envanterine ekler. Oyuncu oyundan çıksa da bitiş zamanı kaybolmaz.
- Kışla/Ahır ekranında aktif eğitim geri sayımı, asker adedi ve ordudaki mevcut gösterilir.
- Bu test aşamasında kaynak düşümü uygulanmaz. Beşinci asker değeri üretim bedeli değil, yağma taşıma kapasitesidir. Üretim maliyetleri ayrıca tasarlanıp onaylanacaktır.
- Gerçek zamanlı otomatik tamamlama, oyuncu eğitim ekranını yeniden açtığında veya eğitim durumu API'si sorgulandığında işlenir; ayrı arka plan worker henüz yoktur.


## Kuşatma birlikleri (ilk entegrasyon)

- Her devletin kataloğuna Mancınık ve Topçu eklendi; mevcut yedi asker türü korunur.
- Birlikler ordu envanterinde ayrı adetlerle saklanır ve mevcut asker eğitim ekranından eğitilebilir.
- Mancınık eğitim süresi test dengesi olarak birim başına 90 saniye, Topçu 120 saniyedir.
- Saldırı/savunma değerleri ilk denge değerleridir; kuşatma savaşı hesaplaması henüz oyunda bulunmadığından bu aşamada gerçek kale hasarı uygulanmaz.
- Portreler, kullanıcının gönderdiği savaş ekranı görselinden alınmıştır.
