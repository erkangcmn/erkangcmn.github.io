# erkangcmn.github.io

Erkan Göçmen'in kişisel portfolyo sitesi: https://erkangcmn.github.io/

## Yapı

- `index.html` — sayfa iskeleti ve meta etiketleri
- `css/style.css` — tüm stiller
- `app/index.js` — projeler ve GitHub rozetleri (veri burada, kartlar JS ile üretilir)
- `app/bg.js` — fareyi takip eden parçacık arka planı
- `oyunlar/yildiz-pilotu.js` — Oyun Köşesi'ndeki tam ekran pinball (bağımsız modül, kendi ses motoru ve müziği)

## Güncelleme

- Yeni proje eklemek için `data/site-data.js` içindeki `SITE_PROJECTS` dizisine bir kayıt ekle (3D salon ve klasik site ortak kullanır; salondaki makine görünümü `index.html` içindeki `PROJECTS`'te).
- Yeni GitHub rozeti için `data/site-data.js` içindeki `BADGES` dizisine ekle.
- Bio metni `index.html` içindeki `#bio` paragrafında.

Saf HTML/CSS/JS, derleme adımı yok. GitHub Pages ile doğrudan yayınlanır.
