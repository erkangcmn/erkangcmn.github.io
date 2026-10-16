"use strict";

/* Projeler (SITE_PROJECTS) ve GitHub rozetleri (BADGES, GITHUB_USER, badgeUrl) ../data/site-data.js'te:
   3D salonla ortak liste, proje/rozet eklemek için orayı düzenleyin. */

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
            <a href="${badgeUrl(b)}" target="_blank" rel="noopener noreferrer" title="${esc(b.name)}">
                <img src="${badgeImgUrl(b)}" alt="${esc(b.name)}" loading="lazy"
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
$("#projects-grid").innerHTML = SITE_PROJECTS.map((p) => card(p)).join("");
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
