"use strict";
/* ═══════════════════════════════════════════════════════════════════
   ORTAK SİTE VERİSİ — 3D salon (index.html) ve klasik site (klasik/) aynı listeyi kullanır.
   Proje eklemek/değiştirmek için yalnızca burayı düzenleyin. Sıra: salondaki ve klasik sitedeki sıra.
   title: proje adı (index.html'deki görsel ayarlar bu adla eşleşir) · icon: klasik site kart simgesi
   link: canlı demo ya da yok · github: depo ya da yok · note: küçük etiket ("Yakında", "Özel depo")
   ═══════════════════════════════════════════════════════════════════ */
const SITE_PROJECTS = [
  { icon: "🔮", title: "Mistik", tags: ["React Native", "TypeScript", "Claude API", "Zustand"], note: "Özel depo",
    description: "Tarot, günlük burç, doğum haritası ve fal yorumu sunan, kredi/abonelik tabanlı yapay zekâ destekli mobil uygulama. Google Play Billing entegrasyonu ve modüler mimari." },
  { icon: "💰", title: "Kapi", tags: ["Expo", "React Native", "TypeScript", "Zustand"], note: "Özel depo",
    description: "Türkiye odaklı bireysel ve ticari finans takip uygulaması: borç, gelir-gider, altın/döviz/kripto/BIST birikimleri. Veriler cihazda tutulur, backend gerektirmez." },
  { icon: "🎓", title: "EduFlow", tags: ["Expo", "TypeScript", "NativeWind"], note: "Özel depo",
    description: "Öğretmen ve veliler için eğitim yönetim uygulaması: ders programı, öğrenci listesi, kazanç raporları ve ödeme takibi." },
  { icon: "🛍️", title: "vitrAI", tags: ["React", "Claude API", "Fal.ai"], note: "Özel depo",
    description: "E-ticaret satıcıları için yapay zekâ destekli ürün açıklaması, Instagram metni, hashtag ve görsel üretici. Trendyol, Hepsiburada, Amazon ve daha fazlası için ton ayarlı içerik." },
  { icon: "📚", title: "Software Library", tags: ["React", "Vercel"], link: "https://developerlibs.vercel.app/", github: "https://github.com/erkangcmn/Software-Library-With-React",
    description: "Farklı programlama dillerindeki kütüphaneleri tek yerde toplayan, kod yazarken işinizi kolaylaştıran uygulama." },
  { icon: "🧱", title: "BlockBlast", tags: ["React", "Tailwind CSS"], note: "Özel depo",
    description: "10x10 ızgarada sürükle-bırak blok oyunu: Zen ve Blitz modları, bombalar, kombo sistemi ve koyu/açık tema." },
  { icon: "🛠️", title: "Live Editör", tags: ["Node.js", "JavaScript"], note: "Özel depo",
    description: "Önizlemede bir elemente tıklayınca kaynak koduna giden, tarayıcıdaki 'incele' mantığıyla çalışan yerel HTML/CSS/JS editörü." },
  { icon: "🍽️", title: "QR Restoran", tags: ["React", "Node.js"], note: "Yakında",
    description: "Restoranlar için QR menü web uygulaması." },
  { icon: "🖼️", title: "ArtWall", tags: ["React Native", "Node.js", "React"], note: "Yakında",
    description: "Duvar kâğıdı mobil uygulaması ve React ile yazılmış yönetim paneli." },
];

/* GitHub Achievements. GitHub bunun için API sunmadığından elle girilir; yeni rozet kazanınca
   buraya ekleyin. tier: "x3" gibi çarpan etiketi · color: salondaki panoda vurgu/yedek madalyon rengi. */
const GITHUB_USER = "erkangcmn";
const BADGES = [
  { slug: "pair-extraordinaire", name: "Pair Extraordinaire", tier: "x3", img: "pair-extraordinaire-silver-a0b2b472348c", color: "#b9c4d6" },
  { slug: "pull-shark", name: "Pull Shark", tier: "x2", img: "pull-shark-bronze-a37accb528d1", color: "#d99a5b" },
  { slug: "quickdraw", name: "Quickdraw", img: "quickdraw-default-39c6aec8ff89", color: "#ffd23f" },
  { slug: "yolo", name: "YOLO", img: "yolo-default-be0bbff04951", color: "#ff7ad9" },
  { slug: "arctic-code-vault-contributor", name: "Arctic Code Vault Contributor", img: "arctic-code-vault-contributor-default-df8d74122a06", color: "#8fd8ff" },
];
const badgeUrl = (b) => b.url || `https://github.com/${GITHUB_USER}?achievement=${b.slug}&tab=achievements`;
const badgeImgUrl = (b) => `https://github.githubassets.com/assets/${b.img}.png`;
