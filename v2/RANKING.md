# Umaykut Online 2 — Sıralama Puanı

Sıralama, oyuncu verilerinden sunucu tarafında her istekte yeniden hesaplanır. İstemci puanları belirleyemez veya göndererek değiştiremez.

## Genel puan

Dört alan eşit ağırlıktadır:

| Alan | Ağırlık |
| --- | ---: |
| Bina gelişimi | %25 |
| Ordu gücü | %25 |
| Bölge hâkimiyeti | %25 |
| Ekonomi | %25 |

Genel puan, bu dört 0–100 puanın ağırlıklı ortalamasıdır. Eşitlikte önce bina, ordu, bölge ve ekonomi puanları; son olarak oyuncu adı karşılaştırılır.

## Alanların hesaplanması

### Bina gelişimi
Dokuz sabit bina yuvası eşit ağırlıktadır. Her yuvanın seviyesi 1–10 aralığındadır. Dokuz binanın tamamı 10. seviyedeyse alan puanı 100 olur. 9 numaralı yuva **Okçu** binasıdır. Eski kayıtlardaki `warehouse` türü 9. yuva için geriye dönük Okçu kabul edilir; seviyesi korunur.

### Ordu gücü
Evdeki birlikler, yürüyen veya dönüşteki saldırı birlikleri, aktif casus görevindeki sağ kalan birlikler ve sahip olunan/aktif geçici hâkimiyet altındaki bölge garnizonları birlikte sayılır. Her birlik için sunucudaki devlet kataloğundan alınan saldırı gücü ile piyade ve süvari savunmasının ortalaması toplanır. 10.000 toplam güç 100 puana ulaşır.

### Bölge hâkimiyeti
Yalnızca kalıcı olarak fethedilmiş bölgeler sayılır. Dört saatlik geçici garnizon iddiası puan getirmez. 24 kalıcı bölge 100 puandır.

### Ekonomi
Mevcut kaynak bakiyeleri altı kaynak türünde eşit ağırlıkla değerlendirilir. Her kaynak kendi hedef miktarına ulaştığında o kaynak için tam katkı verir; hedefin üzerindeki miktar ek puan sağlamaz.

| Kaynak | Hedef |
| --- | ---: |
| Altın | 20.000 |
| Odun | 20.000 |
| Yiyecek | 20.000 |
| Taş | 20.000 |
| Demir | 20.000 |
| At | 1.000 |

Bu sürümde ekonomi puanı mevcut stokları ölçer. Okçu binası depo değildir; bina seviyesinden depolama kapasitesi veya ekonomi bonusu üretilmez.

## API

- `GET /api/game/rankings`
- Geçerli oyuncu oturumu gerektirir.
- Yanıtta sıralama listesi, oyuncunun kendi kimliği, puan ağırlıkları ve normalizasyon hedefleri bulunur.
