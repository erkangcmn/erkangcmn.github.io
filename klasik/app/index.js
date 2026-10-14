"use strict";

const GITHUB_USER = "erkangcmn";

/* GitHub profilindeki Achievements. (GitHub bunun için API sunmadığından elle girilir;
   yeni rozet kazanınca buraya ekleyin. tier: "x3" gibi çarpan etiketi.) */
const BADGES = [
    { slug: "pair-extraordinaire", name: "Pair Extraordinaire", tier: "x3", img: "pair-extraordinaire-silver-a0b2b472348c" },
    { slug: "pull-shark", name: "Pull Shark", tier: "x2", img: "pull-shark-bronze-a37accb528d1" },
    { slug: "quickdraw", name: "Quickdraw", img: "quickdraw-default-39c6aec8ff89" },
    { slug: "yolo", name: "YOLO", img: "yolo-default-be0bbff04951" },
    { slug: "arctic-code-vault-contributor", name: "Arctic Code Vault Contributor", img: "arctic-code-vault-contributor-default-df8d74122a06" },
];

/* Projelerim — hepsi bana ait.
   link: varsa kart tıklanabilir olur. note: kartın altında küçük etiket ("Yakında", "Özel depo"). */
const PROJECTS = [
    { icon: "🔮", title: "Mistik", tags: ["React Native", "TypeScript", "Claude API", "Zustand"], note: "Özel depo",
      description: "Tarot, günlük burç, doğum haritası ve fal yorumu sunan, kredi/abonelik tabanlı AI destekli mobil uygulama. Google Play Billing entegrasyonu ve modüler mimari." },
    { icon: "💰", title: "Kapi", tags: ["Expo", "React Native", "TypeScript", "Zustand"], note: "Özel depo",
      description: "Türkiye odaklı bireysel ve ticari finans takip uygulaması: borç, gelir-gider, altın/döviz/kripto/BIST birikimleri. Veriler cihazda tutulur, backend gerektirmez." },
    { icon: "🎓", title: "EduFlow", tags: ["Expo", "TypeScript", "NativeWind"], note: "Özel depo",
      description: "Öğretmen ve veliler için eğitim yönetim uygulaması: ders programı, öğrenci listesi, kazanç raporları ve ödeme takibi." },
    { icon: "🛍️", title: "vitrAI", tags: ["React", "Claude API", "Fal.ai"], note: "Özel depo",
      description: "E-ticaret satıcıları için AI ürün açıklaması, Instagram metni, hashtag ve görsel üretici. Trendyol, Hepsiburada, Amazon ve daha fazlası için ton ayarlı içerik." },
    { icon: "📚", title: "Software Library", tags: ["React", "Vercel"], link: "https://developerlibs.vercel.app/",
      description: "Farklı programlama dillerindeki kütüphaneleri tek yerde toplayan, kodlarken işinizi kolaylaştıran uygulama." },
    { icon: "🧱", title: "BlockBlast", tags: ["React", "Tailwind CSS"], note: "Özel depo",
      description: "10x10 ızgarada sürükle-bırak blok oyunu: Zen ve Blitz modları, bombalar, kombo sistemi ve koyu/açık tema." },
    { icon: "🛠️", title: "Live Editör", tags: ["Node.js", "JavaScript"], note: "Özel depo",
      description: "Önizlemede bir elemente tıklayınca kaynak koduna giden, 'incele' mantığıyla çalışan yerel HTML/CSS/JS editörü." },
    { icon: "🍽️", title: "QR Restoran App", tags: ["React", "Node.js"], note: "Yakında",
      description: "Restoranlar için QR menü web uygulaması." },
    { icon: "🖼️", title: "ArtWall", tags: ["React Native", "Node.js", "React"], note: "Yakında",
      description: "Wallpaper mobil uygulaması ve React ile yazılmış admin paneli." },
];

const $ = (s) => document.querySelector(s);

/** Veriyi innerHTML'e güvenle basmak için. */
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function card({ icon, title, tags, link, note, description }) {
    const chips = tags.map((t) => `<span class="chip">${esc(t)}</span>`).join("")
        + (note ? `<span class="chip${note === "Yakında" ? " soon" : " private"}">${esc(note)}</span>` : "");
    const inner = `
        ${icon ? `<div class="icon">${icon}</div>` : ""}
        <h3>${esc(title)}${link ? "<span aria-hidden='true'>↗</span>" : ""}</h3>
        <p>${esc(description)}</p>
        <div class="chips">${chips}</div>`;
    return link
        ? `<a class="card reveal" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${inner}</a>`
        : `<div class="card reveal">${inner}</div>`;
}

function renderBadges() {
    $("#badges").innerHTML = BADGES.map((b) => `
        <li>
            <a href="https://github.com/${GITHUB_USER}?achievement=${b.slug}&tab=achievements" target="_blank" rel="noopener noreferrer" title="${esc(b.name)}">
                <img src="https://github.githubassets.com/assets/${b.img}.png" alt="${esc(b.name)}" loading="lazy"
                     onerror="this.closest('li').remove()" />
            </a>
            ${b.tier ? `<span class="tier">${esc(b.tier)}</span>` : ""}
        </li>`).join("");
}

const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
}, { threshold: 0.1 });

$("#year").textContent = new Date().getFullYear();
renderBadges();
$("#projects-grid").innerHTML = PROJECTS.map(card).join("");
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
