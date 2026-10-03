"use strict";

/* Mouse'u takip eden parçacık ağı — koyu temada beyaz noktalar ve çizgiler. */
(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    canvas.id = "bg";
    canvas.setAttribute("aria-hidden", "true");
    document.body.prepend(canvas);
    const ctx = canvas.getContext("2d");

    const LINK_DIST = 130;   // noktalar arası çizgi mesafesi
    const MOUSE_DIST = 170;  // fareye bağlanma mesafesi
    const mouse = { x: null, y: null };
    let w, h, points = [];

    const spawn = () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
    });

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const count = Math.min(Math.round((w * h) / 14000), 110);
        while (points.length < count) points.push(spawn());
        points.length = count;
    }

    function frame() {
        ctx.clearRect(0, 0, w, h);

        for (const p of points) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;

            if (mouse.x !== null) {
                const dx = mouse.x - p.x, dy = mouse.y - p.y;
                const d = Math.hypot(dx, dy);
                if (d < MOUSE_DIST) {
                    // Fareye doğru hafifçe çekilsin, çok yaklaşınca dursun.
                    if (d > 60) { p.x += dx * 0.004; p.y += dy * 0.004; }
                    ctx.strokeStyle = `rgba(255,255,255,${(1 - d / MOUSE_DIST) * 0.55})`;
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.stroke();
                }
            }

            ctx.fillStyle = "rgba(255,255,255,0.65)";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
            ctx.fill();
        }

        for (let i = 0; i < points.length; i++) {
            for (let j = i + 1; j < points.length; j++) {
                const a = points[i], b = points[j];
                const d = Math.hypot(a.x - b.x, a.y - b.y);
                if (d < LINK_DIST) {
                    ctx.strokeStyle = `rgba(255,255,255,${(1 - d / LINK_DIST) * 0.22})`;
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            }
        }

        requestAnimationFrame(frame);
    }

    const setMouse = (x, y) => { mouse.x = x; mouse.y = y; };
    window.addEventListener("mousemove", (e) => setMouse(e.clientX, e.clientY), { passive: true });
    window.addEventListener("touchmove", (e) => setMouse(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    window.addEventListener("mouseout", () => setMouse(null, null));
    window.addEventListener("touchend", () => setMouse(null, null));
    window.addEventListener("resize", resize);

    resize();
    requestAnimationFrame(frame);
})();
