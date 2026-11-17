# Umaykut Online 2 — V2 Baştan Kurulum Planı

## Amaç
Oyunu yeni bir mimariyle sıfırdan geliştirmek. Mevcut canlı sürüm, yeni sürüm doğrulanana kadar korunur; V2 çalışmaları ayrı dalda yürütülür. Eski oyuncu verileri ve ekonomi, kullanıcı onayı ve göç planı olmadan silinmez veya değiştirilmez.

## Sabit ürün yönü
- Tür: Türk/bozkır-Selçuklu temalı, mobil öncelikli çevrimiçi strateji oyunu.
- Görsel yön: Kullanıcının paylaştığı dairesel taş surlu Selçuklu şehri; ortada baskın merkez yapı, çevresinde düzenli binalar, taş yollar, kuleli sur ve büyük kapı; dış çevrede doğal orman/arazi.
- Köy sahnesi: İlk aşamada tek bir yüksek kaliteli şehir illüstrasyonu/arka planı ve onun üzerine konumlandırılmış etkileşimli bina alanları. Gerçek zamanlı 3D motor zorunlu değil.
- Dil: Türkçe.
- Cihaz önceliği: Android telefon ekranları; küçük ekranlarda tüm köy görünür, kontrollü yakınlaştırma ve kaydırma.
- Görsel arayüz: koyu lacivert/orman yeşili, taş dokular, Selçuklu turkuazı ve altın vurgular.

## Oyun alanları
1. Hesap oluşturma, giriş, güvenli oturum ve oyuncu profili.
2. İlk açılış/rehber ve devlet seçimi (Selçuk, Hun, Göktürk); mevcut üç devlet konsepti başlangıç taslağıdır.
3. Köy: merkez binası ve 9 çevre bina yuvası; her binada seviye 1–10, bilgi, inşa/yükseltme durumu.
4. Ekonomi: altın, odun, tahıl, taş, demir, at; sunucu zamanına bağlı üretim ve işçi dağılımı.
5. Binalar: inşa, yükseltme, kilitler, süreler ve bina etkileri.
6. Ordu: birlik kataloğu, eğitim, kalıcı envanter ve birlik detayları.
7. Dünya haritası: oyuncu şehirleri, kaynak noktaları, keşif ve sefer altyapısı.
8. Pazar/envanter, görevler, başarımlar, bildirimler ve ayarlar.
9. Çok oyunculu altyapı: gerçek zamanlı olaylar, şehir durumları ve ileride ittifak/savaş sistemleri.

## Teknik mimari hedefi
- İstemci ve API sınırları net, sürümlenmiş JSON API.
- Sunucu otoriter oyun mantığı: kaynak, süre, yükseltme, asker ve ödül hesapları istemciye bırakılmaz.
- PostgreSQL kalıcı veri; şema sürümleri/migration dosyaları.
- Socket.IO yalnızca gerçek zamanlı güncellemeler için; temel işlemler API üzerinden.
- Modüler servisler: auth, players, factions, city, buildings, economy, workers, army, training, world, market, quests.
- Test katmanları: birim testleri, API/entegrasyon testleri, migration doğrulaması ve mobil ekran kontrol listesi.
- Gizli anahtarlar ve veritabanı bağlantıları yalnızca Render ortam değişkenlerinde tutulur.

## Uygulama sırası
### Faz 0 — Temel ve güvenlik
Yeni V2 dalı, klasör sınırları, konfigürasyon doğrulama, hata yönetimi, health/readiness, migration altyapısı ve otomatik test komutları.

### Faz 1 — Oynanabilir ilk sürüm
Kayıt/giriş, devlet seçimi, oyuncu başlangıç şehri, şehir görseli üzerinde 10 bina noktası (merkez + 9 yuva), bina detay/yükseltme akışı ve kaynak çubuğu.

### Faz 2 — Ekonomi ve işçiler
Kaynak üretimi, işçi atama, çevrimdışı üretim, sunucu tarafı doğrulama ve ekonomi testleri.

### Faz 3 — Ordu ve eğitim
Asker kataloğu, eğitim, ordu envanteri, bina gereksinimleri ve kaynak maliyetleri. Denge değerleri kullanıcı onayı olmadan değiştirilmez.

### Faz 4 — Dünya ve çok oyunculu
Dünya haritası, şehir konumları, kaynak noktaları, keşif/sefer ve gerçek zamanlı güncellemeler.

### Faz 5 — İçerik ve canlıya geçiş
Görevler, başarımlar, pazar, envanter, performans/güvenlik kontrolleri, yedekleme ve kontrollü veri geçişi.

## Tamamlanma ölçütleri
- Telefon ekranında köyün tamamı okunabilir; ana bina ve 9 yuva görünür.
- Bina, kaynak, işçi ve asker işlemleri sunucuda kalıcıdır.
- Aynı isteğin tekrarı çift harcama/çift ödül üretmez.
- Yetkisiz kullanıcı başka oyuncunun verisini değiştiremez.
- Kritik API ve ekonomi akışları otomatik testten geçer.
- Canlıya geçiş ancak testler başarılı ve Render deploy durumu `live` olarak doğrulandıktan sonra duyurulur.

## İlk uygulama adımı
V2 için bağımsız uygulama iskeletini ve test altyapısını oluştur; eski canlı arayüz/API'yi bu aşamada değiştirme. İlk oynanabilir köy ekranı, kullanıcının sağladığı şehir görseli üzerine etkileşimli bina noktaları yerleştirilerek kurulacak.
