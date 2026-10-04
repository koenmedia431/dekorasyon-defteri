# Müşteri Defteri (Dekorasyon)

Dekorasyon işindeki müşterilerin hesaplarını tutmak için web uygulaması.
Telefon ve bilgisayardan tarayıcıyla açılır.

Her müşterinin kartında dört bölüm var:

| Bölüm | Ne işe yarar | Müşteri görür mü? |
|---|---|---|
| **Sohbet** | Ne olduğunu düz yazıyla yazarsınız, tutar/tür/tarih çıkarılıp listeye eklenir | Hayır |
| **Hesap** | İş/fatura (borç) ve tahsilatlar, yürüyen bakiye | Ekstre olarak |
| **Masraflar** | Bu müşteri için sizin giderleriniz ve kâr hesabı | **Hayır** (size özel) |
| **Avanslar** | Ortakların (Cihad, Mücahid, Emir) bu projeden aldığı avanslar, kâr − avans = kalan | **Hayır** |
| **Ekstre** | Müşteriye gönderilecek hesap dökümü: WhatsApp ile gönder, yazdır / PDF | Evet |

Kenar çubuğundaki **Ortak Avansları** sayfası, hangi ortağın hangi projeden ne kadar aldığını
tablo hâlinde gösterir (Tümü / Bu Yıl / Bu Ay).

## Sohbet örnekleri

| Yazdığınız | Eklenen kayıt |
|---|---|
| `Salon boya işçiliği 18.000 TL` | İş / Fatura 18.000 ₺ (müşteri borcu) |
| `Ayşe hanım 10 bin kapora verdi` | Tahsilat 10.000 ₺ |
| `Dün boya aldım 3.250, usta yevmiyesi 1500` | İki masraf, dünün tarihiyle |
| `15.09 mutfak tadilatı 40000` | 15 Eylül tarihli iş |
| `Cihad 5000 avans aldı` / `Emir'e 3 bin verdim` | Ortak avansı (müşteri bakiyesini etkilemez) |
| `Perdeler cuma takılacak` | Tutar yok → not olarak kalır |

- Yazarken altta neyin anlaşıldığı görünür.
- Eklenen kayda tıklayarak türünü, tutarını veya tarihini düzeltebilirsiniz.
- Tür anahtar kelimelerden bulunur: işçilik/fatura/tadilat → borç, ödedi/kapora/havale → tahsilat,
  malzeme/boya aldım/usta/nakliye → masraf.

## Teknik

- React + Vite + TypeScript + Tailwind, veritabanı ve giriş **Supabase** (`vvydeobqoeegsqhebztv`, Frankfurt).
- Şema: `supabase/migrations/`. Her kayıt sahibine aittir; RLS ile kullanıcı yalnızca kendi verisini görür.
- `npm run dev` geliştirme, `npm test` ayrıştırıcı testleri, `npm run build` üretim çıktısı.
- `main`'e gönderilen her değişiklik GitHub Actions ile test edilip **GitHub Pages**'te yayınlanır
  (`https://<kullanıcı>.github.io/dekorasyon-defteri/`).
