# Müşteri Defteri: Dekorasyon & İnşaat

Dekorasyon, tadilat ve inşaat firmalarının müşteri ve proje hesaplarını tutmak için web uygulaması.
Telefondan veya bilgisayardan tarayıcıyla açılır. Telefonda "Ana ekrana ekle" denirse uygulama gibi
tam ekran çalışır.

## Sayfalar

| Sayfa | Ne var |
|---|---|
| **Genel Bakış** | Toplam alacak, bu ayın iş/hakediş, tahsilat, masraf ve kâr rakamları (geçen ayla birlikte), son 6 ay grafiği, en çok alacaklı olunan müşteriler, devam eden projeler ve teslim süreleri, son hareketler |
| **Müşteriler** | Arama, durum filtresi (Teklif / Devam ediyor / Tamamlandı), müşteri kartları |
| **Ortak Avansları** | Hangi ortağın (Cihad, Mücahid, Emir) hangi projeden ne kadar aldığı; Excel'e aktarılabilir |
| **Ayarlar** | Firma bilgileri ve logo (ekstre antedine basılır), IBAN, ekstre alt notu, açık / koyu / sistem teması |

## Müşteri kartı

Üstte proje adı, sözleşme bedeli, faturalanan yüzde, kalan iş ve teslim tarihine kalan gün görünür.
Altında bakiye, toplam iş, tahsilat, masraf, kâr ve ortak avansı kartları vardır.

| Sekme | Ne işe yarar | Müşteri görür mü? |
|---|---|---|
| **Sohbet** | Ne olduğunu düz yazıyla yazarsınız; tutar, tür ve tarih çıkarılıp listeye eklenir. PDF / fotoğraf yüklenirse yazısı okunur ve her kalem ayrı eklenir | Hayır |
| **Hesap** | İş / hakediş (borç) ve tahsilatlar, yürüyen bakiye | Ekstre olarak |
| **Masraflar** | Bu proje için sizin giderleriniz, kategori dağılımı ve kâr | **Hayır** (size özel) |
| **Avanslar** | Ortakların bu projeden aldığı avanslar; kâr − avans = kalan | **Hayır** |
| **Ekstre** | Antetli hesap ekstresi: WhatsApp ile gönder, yazdır / PDF, metni kopyala | Evet |

Kartın sağ üstündeki indirme düğmesi, müşterinin bütün kayıtlarını Excel'de açılan bir dosyaya aktarır.

Masraf kategorileri: Malzeme, İşçilik / Taşeron, Nakliye, Ekipman / Kiralama, Yakıt, Yemek,
Hafriyat / Moloz, Diğer. Sohbette yazılan metinden kategori otomatik seçilir.

## Sohbet örnekleri

| Yazdığınız | Eklenen kayıt |
|---|---|
| `1. hakediş 150.000` | İş / Hakediş 150.000 ₺ (müşteri borcu) |
| `Hakediş ödemesi geldi 100 bin` | Tahsilat 100.000 ₺ |
| `Ayşe hanım 10 bin kapora verdi` | Tahsilat 10.000 ₺ |
| `Dün çimento aldım 4.500, usta yevmiyesi 1500` | İki masraf (Malzeme, İşçilik), dünün tarihiyle |
| `İskele kirası 3000` / `Moloz dökümü 2500` | Masraf (Ekipman / Kiralama, Hafriyat / Moloz) |
| `15.09 mutfak tadilatı 40000` | 15 Eylül tarihli iş |
| `Cihad 5000 avans aldı` / `Emir'e 3 bin verdim` | Ortak avansı (müşteri bakiyesini etkilemez) |
| `Perdeler cuma takılacak` | Tutar yok, not olarak kalır |

- Yazarken altta neyin anlaşıldığı görünür.
- Eklenen kayda tıklayarak türünü, tutarını, kategorisini veya tarihini düzeltebilirsiniz.

## Teknik

- React + Vite + TypeScript + Tailwind. Veritabanı, giriş ve dosya deposu **Supabase**
  (`vvydeobqoeegsqhebztv`, Frankfurt).
- Şema `supabase/migrations/` altındadır. Her kayıt sahibine aittir ve RLS sayesinde kullanıcı yalnızca kendi verisini görür.
- Yazı tanıma (OCR) tarayıcıda çalışır (tesseract.js), belgeler dışarı gönderilmez.
- Tema renkleri `src/theme.css` içindeki CSS değişkenleridir. Grafik renkleri renk körlüğüne göre
  açık ve koyu tema için ayrı ayrı doğrulanmıştır.
- `npm run dev` geliştirme sunucusunu açar, `npm test` ayrıştırıcı testlerini çalıştırır, `npm run build` üretim çıktısını alır.
- `main`'e gönderilen her değişiklik GitHub Actions ile test edilip **GitHub Pages**'te yayınlanır
  (`https://<kullanıcı>.github.io/dekorasyon-defteri/`).
