(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const mouse = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { mouse.active = false; });
  addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") mouse.active = false; }, { passive: true });
  addEventListener("pointercancel", () => { mouse.active = false; }, { passive: true });

  /* ---------------- Split text into words ---------------- */
  document.querySelectorAll("[data-split]").forEach((el) => {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((w, i) => `<span class="w"><span style="--i:${i}">${w}</span></span>`)
      .join(" ");
    // brand full stop on headings
    if (el.hasAttribute("data-dot")) el.insertAdjacentHTML("beforeend", '<span class="tdot"></span>');
  });

  /* ---------------- Preloader ---------------- */
  const loader = document.querySelector(".loader");
  const loaderCount = document.getElementById("loaderCount");
  const loaderBar = document.getElementById("loaderBar");
  let progress = 0;
  const loadStart = performance.now();
  const loadDuration = reduceMotion ? 200 : 1600;

  const ldots = [document.getElementById("ldotA"), document.getElementById("ldotB")];

  function tickLoader(now) {
    const t = clamp((now - loadStart) / loadDuration, 0, 1);
    const e = 1 - Math.pow(1 - t, 3);
    progress = Math.round(e * 100);
    loaderCount.textContent = String(progress).padStart(3, "0");
    loaderBar.style.width = progress + "%";
    // the two dots circle each other and land side by side at exactly 100
    const ang = Math.PI + e * Math.PI * 4;
    const rad = 40 * (1 + 0.6 * Math.sin(e * Math.PI));
    ldots.forEach((d, i) => {
      const a = ang + i * Math.PI;
      d.style.transform = `translate(${Math.cos(a) * rad}px, ${Math.sin(a) * rad * 0.9}px)`;
    });
    if (t < 1) requestAnimationFrame(tickLoader);
    else setTimeout(revealSite, 250);
  }
  requestAnimationFrame(tickLoader);

  function revealSite() {
    loader.classList.add("is-done");
    document.body.classList.remove("is-loading");
    hero.start();
    setTimeout(() => {
      document.querySelectorAll(".hero .split, .hero .reveal-up").forEach((el) => el.classList.add("is-in"));
    }, 400);
    setTimeout(() => loader.remove(), 1400);
    setTimeout(typeCoords, reduceMotion ? 0 : 1500);
    const deep = location.hash.slice(1);
    if (deep === "arbeid" || deep === "kontakt" || deep === "tid" || deep === "kart") setTimeout(() => openPanel(deep), 2600);
    if (document.getElementById("folder-" + deep)) setTimeout(() => { openPanel("arbeid"); setTimeout(() => openFolder(deep), 700); }, 2600);
  }

  /* ---------------- Oslo coordinates: typewriter ---------------- */
  function typeCoords() {
    const el = document.getElementById("coords");
    if (!el) return;
    const text = el.dataset.text;
    if (reduceMotion) { el.textContent = text; return; }
    let i = 0;
    el.classList.add("is-typing");
    (function next() {
      el.textContent = text.slice(0, ++i);
      if (i >= text.length) { el.classList.remove("is-typing"); return; }
      const ch = text[i - 1];
      // a human rhythm: quick digits, a beat after symbols and spaces
      const delay = ch === " " ? 220 : /[°′″NE]/.test(ch) ? 140 : 55 + Math.random() * 70;
      setTimeout(next, delay);
    })();
  }

  /* ---------------- Custom cursor ---------------- */
  const cursor = document.querySelector(".cursor");
  const ring = document.querySelector(".cursor__ring");
  const dot = document.querySelector(".cursor__dot");
  const label = document.querySelector(".cursor__label");
  const ringPos = { x: mouse.x, y: mouse.y };

  if (finePointer) {
    document.addEventListener("pointerover", (e) => {
      const target = e.target.closest("a, button, [data-cursor]");
      if (!target) return;
      const text = target.dataset.cursor;
      if (text) {
        label.textContent = text;
        cursor.classList.add("is-label");
      } else {
        cursor.classList.add("is-hover");
      }
    });
    document.addEventListener("pointerout", (e) => {
      const target = e.target.closest("a, button, [data-cursor]");
      if (!target || target.contains(e.relatedTarget)) return;
      cursor.classList.remove("is-label", "is-hover");
    });
    addEventListener("pointerdown", () => cursor.classList.add("is-down"));
    addEventListener("pointerup", () => cursor.classList.remove("is-down"));
  }

  /* ---------------- Magnetic elements ---------------- */
  const magnets = [...document.querySelectorAll(".magnetic")].map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
  if (finePointer && !reduceMotion) {
    magnets.forEach((m) => {
      m.el.addEventListener("pointermove", (e) => {
        const r = m.el.getBoundingClientRect();
        m.tx = (e.clientX - (r.left + r.width / 2)) * 0.35;
        m.ty = (e.clientY - (r.top + r.height / 2)) * 0.35;
      });
      m.el.addEventListener("pointerleave", () => { m.tx = 0; m.ty = 0; });
    });
  }

  /* ---------------- Hero: two dots become "ivar." ---------------- */
  // Story: the two brand dots from the loader sit side by side, then fly to
  // their places (the dot over the i and the full stop) and burst into the
  // particles that build the letters between them.
  const hero = (() => {
    const canvas = document.getElementById("heroCanvas");
    const ctx = canvas.getContext("2d");
    let w, h, dpr, particles = [], running = false, started = false, breath = 1.5;
    let startTime = 0, burst = false, fontSize = 200, paused = false;
    const letterColors = ["#15171b", "#15171b", "#15171b", "#15171b", "#2b2e35", "#3c4a5e"];
    const dotColors = ["#22406b", "#b8352f"];
    const PAIR_GAP = 40, LOADER_R = 11, PAIR_TIME = reduceMotion ? 0 : 1300;
    const dots = dotColors.map((c, i) => ({
      x: 0, y: 0, vx: 0, vy: 0, hx: 0, hy: 0, r: LOADER_R, tr: LOADER_R, c, i, hop: 0,
    }));

    function build() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw the dotless word offscreen and sample its pixels
      const off = document.createElement("canvas");
      off.width = w; off.height = h;
      const o = off.getContext("2d");
      const word = "ıvar";
      let size = Math.min(h * 0.42, w * 0.4);
      o.font = `700 ${size}px "Space Grotesk", Inter, sans-serif`;
      // word + room for the full stop must fit in 86% of the width
      const fit = (o.measureText(word).width + size * 0.3) / (w * 0.86);
      if (fit > 1) size /= fit;
      fontSize = size;
      o.font = `700 ${size}px "Space Grotesk", Inter, sans-serif`;
      o.textBaseline = "alphabetic";
      o.fillStyle = "#fff";
      const wordW = o.measureText(word).width;
      const totalW = wordW + size * 0.3;
      const x0 = (w - totalW) / 2;
      const baseline = h * 0.47 + size * 0.36;
      o.fillText(word, x0, baseline);

      // Brand dots: over the ı and as the full stop
      const dotR = size * 0.062;
      const iW = o.measureText("ı").width;
      dots[0].hx = x0 + iW / 2;
      dots[0].hy = baseline - size * 0.645;
      dots[1].hx = x0 + wordW + size * 0.04 + dotR;
      dots[1].hy = baseline - dotR;
      dots.forEach((d) => { d.homeR = dotR; });

      const data = o.getImageData(0, 0, w, h).data;
      const mobile = w < 700;
      const maxParticles = mobile ? 2600 : 3600;
      let gap = Math.max(mobile ? 2 : 3, Math.round(size / 34));
      let targets;
      do {
        targets = [];
        for (let y = 0; y < h; y += gap) {
          for (let x = 0; x < w; x += gap) {
            if (data[(y * w + x) * 4 + 3] > 128) targets.push([x, y]);
          }
        }
        gap++;
      } while (targets.length > maxParticles);
      gap--;
      breath = Math.min(1.5, gap * 0.3);

      const old = particles;
      const midX = (dots[0].hx + dots[1].hx) / 2;
      particles = targets.map(([x, y], i) => {
        const p = old[i];
        const from = x < midX ? 0 : 1;
        return {
          x: p ? p.x : 0, y: p ? p.y : 0, vx: 0, vy: 0, hx: x, hy: y, from,
          r: gap * 0.38 * (0.85 + Math.random() * 0.3),
          c: letterColors[(Math.random() * letterColors.length) | 0],
          f: 0.03 + Math.random() * 0.04,
          born: p ? p.born : false,
        };
      });
      if (burst) {
        particles.forEach((p) => { if (!p.born) { p.born = true; p.x = p.hx; p.y = p.hy; } });
        dots.forEach((d) => { d.tr = d.homeR; });
      }
    }

    function pairHome() {
      // Same spot as the loader dots, so the hand-off is seamless
      dots[0].hx0 = w / 2 - PAIR_GAP; dots[1].hx0 = w / 2 + PAIR_GAP;
      dots.forEach((d) => { d.x = d.hx0; d.y = h / 2; });
    }

    function doBurst() {
      burst = true;
      dots.forEach((d) => { d.tr = d.homeR; });
      particles.forEach((p, i) => {
        const d = dots[p.from];
        p.born = true;
        p.x = d.x + (Math.random() - 0.5) * 6;
        p.y = d.y + (Math.random() - 0.5) * 6;
        const a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 22;
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      });
    }

    function explode(cx, cy) {
      particles.forEach((p) => {
        const dx = p.x - cx, dy = p.y - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const force = 40 + Math.random() * 40;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      });
      // the dots jump with joy
      dots.forEach((d, i) => { d.vy -= 28 + i * 6; d.vx += (i ? 1 : -1) * 6; });
    }

    let t = 0, nextHop = 4;
    function frame(now) {
      if (!running) return;
      t += 0.01;
      ctx.clearRect(0, 0, w, h);
      const rect = canvas.getBoundingClientRect();
      const mx = mouse.x - rect.left;
      const my = mouse.y - rect.top;
      const radius = Math.min(170, w * 0.2);
      const elapsed = now - startTime;

      if (!burst && elapsed > PAIR_TIME) doBurst();

      // Particles
      if (burst) {
        for (const p of particles) {
          const hx = p.hx + Math.sin(t * 2 + p.hy * 0.02) * breath;
          const hy = p.hy + Math.cos(t * 2 + p.hx * 0.02) * breath;
          p.vx += (hx - p.x) * p.f;
          p.vy += (hy - p.y) * p.f;
          if (mouse.active) {
            const dx = p.x - mx, dy = p.y - my;
            const d2 = dx * dx + dy * dy;
            if (d2 < radius * radius) {
              const d = Math.sqrt(d2) || 1;
              const force = (1 - d / radius) * 9;
              p.vx += (dx / d) * force - (dy / d) * force * 0.5;
              p.vy += (dy / d) * force + (dx / d) * force * 0.5;
            }
          }
          p.vx *= 0.84; p.vy *= 0.84;
          p.x += p.vx; p.y += p.vy;

          const speed = Math.min(Math.hypot(p.vx, p.vy), 20);
          // while travelling, a particle still carries its parent dot's colour
          ctx.fillStyle = speed > 2.5 ? dotColors[p.from] : p.c;
          ctx.globalAlpha = 0.85 + Math.min(speed / 20, 0.15);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + speed * 0.1, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Idle: every few seconds the dots take turns doing a little hop
      if (burst && t > nextHop && !reduceMotion) {
        dots[0].vy -= fontSize * 0.07;
        setTimeout(() => { dots[1].vy -= fontSize * 0.07; }, 180);
        nextHop = t + 5 + Math.random() * 3;
      }

      // Dots
      for (const d of dots) {
        let hx, hy;
        if (!burst) {
          // breathing side by side, exactly where the loader left them
          hx = d.hx0; hy = h / 2 + Math.sin(elapsed / 180 + d.i * Math.PI) * 3;
        } else {
          hx = d.hx; hy = d.hy;
          // curious: lean toward the cursor when it comes close
          if (mouse.active) {
            const dx = mx - hx, dy = my - hy, dist = Math.hypot(dx, dy);
            const reach = fontSize * 1.2;
            if (dist < reach) {
              const pull = (1 - dist / reach) * fontSize * 0.18;
              hx += (dx / (dist || 1)) * pull;
              hy += (dy / (dist || 1)) * pull;
            }
          }
        }
        d.vx += (hx - d.x) * (burst ? 0.05 : 0.2);
        d.vy += (hy - d.y) * (burst ? 0.05 : 0.2);
        d.vx *= 0.82; d.vy *= 0.82;
        d.x += d.vx; d.y += d.vy;
        d.r = lerp(d.r, d.tr, 0.06);
        // squash & stretch with speed
        const sp = Math.min(Math.hypot(d.vx, d.vy) / 30, 0.35);
        const ang = Math.atan2(d.vy, d.vx);
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(ang);
        ctx.scale(1 + sp, 1 - sp * 0.6);
        ctx.shadowColor = "rgba(21, 30, 45, 0.18)";
        ctx.shadowBlur = d.r * 0.8;
        ctx.shadowOffsetY = d.r * 0.25;
        ctx.fillStyle = d.c;
        ctx.beginPath();
        ctx.arc(0, 0, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }

    new IntersectionObserver(([entry]) => {
      if (!started || paused) return;
      if (entry.isIntersecting && !running) { running = true; requestAnimationFrame(frame); }
      else if (!entry.isIntersecting) running = false;
    }).observe(canvas);

    let resizeTimer;
    addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 150);
    });

    canvas.parentElement.addEventListener("click", (e) => {
      if (e.target.closest("a, button")) return;
      const r = canvas.getBoundingClientRect();
      explode(e.clientX - r.left, e.clientY - r.top);
    });

    return {
      // stop drawing while a room covers the hero, pick up again when it closes
      pause() { paused = true; running = false; },
      resume() {
        paused = false;
        if (started && !running) { running = true; requestAnimationFrame(frame); }
      },
      start() {
        const go = () => {
          build();
          pairHome();
          started = true;
          running = true;
          startTime = performance.now();
          if (reduceMotion) {
            doBurst();
            particles.forEach((p) => { p.x = p.hx; p.y = p.hy; p.vx = p.vy = 0; });
            dots.forEach((d) => { d.x = d.hx; d.y = d.hy; d.r = d.tr; });
          }
          requestAnimationFrame(frame);
        };
        if (document.fonts && document.fonts.load) {
          document.fonts.load('700 100px "Space Grotesk"', "ıvar").then(go, go);
        } else go();
      },
    };
  })();

  /* ---------------- Rotating hero words ---------------- */
  const rotator = document.getElementById("rotator");
  if (rotator) {
    const count = rotator.children.length;
    let idx = 0;
    setInterval(() => {
      idx++;
      rotator.style.transition = "";
      rotator.style.transform = `translateY(-${idx * 1.5}em)`;
      if (idx === count - 1) {
        setTimeout(() => {
          rotator.style.transition = "none";
          rotator.style.transform = "translateY(0)";
          idx = 0;
        }, 850);
      }
    }, 2200);
  }

  /* ---------------- Reveal inside rooms ---------------- */
  // Each time a room opens its content animates in again, observed within the room's own scroller
  const roomObservers = new Map();
  function revealRoom(panel) {
    const scroller = panel.querySelector(".panel__scroll");
    const items = panel.querySelectorAll(".split, .reveal-up");
    items.forEach((el) => el.classList.remove("is-in"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      });
    }, { root: scroller, threshold: 0.15 });
    setTimeout(() => items.forEach((el) => io.observe(el)), reduceMotion ? 0 : 380);
    roomObservers.set(panel, io);
  }

  /* ---------------- Rooms: Arbeid & Kontakt ---------------- */
  const panels = { arbeid: document.getElementById("arbeid"), kontakt: document.getElementById("kontakt"), tid: document.getElementById("tid"), kart: document.getElementById("kart") };
  const navLinks = [...document.querySelectorAll(".nav__link")];
  let openRoom = null;

  function openPanel(name, origin) {
    const panel = panels[name];
    if (!panel || openRoom === name) return;
    if (openRoom) closePanel(true);
    if (origin && (name === "kontakt" || name === "tid" || name === "kart")) {
      const r = origin.getBoundingClientRect();
      panel.style.setProperty("--mx", `${r.left + r.width / 2}px`);
      panel.style.setProperty("--my", `${r.top + r.height / 2}px`);
    }
    openRoom = name;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("panel-open");
    document.body.classList.toggle("panel-dark", name === "kontakt");
    document.body.classList.toggle("panel-clock", name === "tid");
    document.body.classList.toggle("panel-map", name === "kart");
    navLinks.forEach((l) => l.setAttribute("aria-expanded", String(l.dataset.panel === name)));
    revealRoom(panel);
    if (name === "kontakt") menuArt.start();
    if (name === "tid") clockWorld.start();
    if (name === "kart") mapRoom.open();
    // the hero keeps playing under the opening animation, then rests
    setTimeout(() => { if (openRoom) hero.pause(); }, 1000);
    if (history.replaceState) history.replaceState(null, "", "#" + name);
  }

  function closePanel(switching) {
    if (!openRoom) return;
    closeLightbox();
    closeFolder();
    const panel = panels[openRoom];
    const wasContact = openRoom === "kontakt";
    const wasClock = openRoom === "tid";
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    roomObservers.get(panel)?.disconnect();
    openRoom = null;
    setTimeout(() => {
      const scroller = panel.querySelector(".panel__scroll");
      if (scroller && !panel.classList.contains("is-open")) scroller.scrollTop = 0;
      if (wasContact) menuArt.stop();
      if (wasClock && openRoom !== "tid") clockWorld.stop();
    }, 1000);
    if (switching) return;
    document.body.classList.remove("panel-open", "panel-dark", "panel-clock", "panel-map");
    navLinks.forEach((l) => l.setAttribute("aria-expanded", "false"));
    hero.resume();
    if (history.replaceState) history.replaceState(null, "", location.pathname + location.search);
  }

  document.querySelectorAll("[data-panel]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    const name = b.dataset.panel;
    if (openRoom === name && b.classList.contains("nav__link")) closePanel();
    else openPanel(name, b);
  }));
  document.querySelectorAll("[data-close-panel]").forEach((b) => b.addEventListener("click", (e) => {
    e.preventDefault();
    closePanel();
  }));
  /* ---------------- Folders & lightbox ---------------- */
  let openFolderEl = null;
  function openFolder(name) {
    const view = document.getElementById("folder-" + name);
    if (!view) return;
    openFolderEl = view;
    view.querySelector(".folder-view__scroll").scrollTop = 0;
    view.querySelectorAll(".split").forEach((el) => el.classList.remove("is-in"));
    view.classList.add("is-open");
    view.setAttribute("aria-hidden", "false");
    setTimeout(() => view.querySelectorAll(".split").forEach((el) => el.classList.add("is-in")), 300);
    // films in the grid play silently while the folder is open
    if (!reduceMotion) view.querySelectorAll(".photo video").forEach((v) => { v.preload = "auto"; v.play().catch(() => {}); });
    if (history.replaceState) history.replaceState(null, "", "#" + name);
  }
  function closeFolder() {
    if (!openFolderEl) return;
    openFolderEl.querySelectorAll(".photo video").forEach((v) => v.pause());
    openFolderEl.classList.remove("is-open");
    openFolderEl.setAttribute("aria-hidden", "true");
    openFolderEl = null;
    if (openRoom && history.replaceState) history.replaceState(null, "", "#" + openRoom);
  }
  document.querySelectorAll("[data-folder]").forEach((b) => b.addEventListener("click", () => openFolder(b.dataset.folder)));
  document.querySelectorAll("[data-folder-back]").forEach((b) => b.addEventListener("click", closeFolder));

  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightboxImg");
  const lbCount = document.getElementById("lightboxCount");
  const lbVideo = document.getElementById("lightboxVideo");
  const lbTitle = document.getElementById("lightboxTitle");
  let lbPhotos = [], lbIndex = 0;
  function showPhoto(i) {
    lbIndex = (i + lbPhotos.length) % lbPhotos.length;
    const item = lbPhotos[lbIndex];
    const pad = (n) => String(n).padStart(2, "0");
    lbCount.textContent = `${pad(lbIndex + 1)} / ${pad(lbPhotos.length)}`;
    lbTitle.textContent = item.dataset.title || "";
    lbImg.classList.remove("is-ready");
    lbVideo.classList.remove("is-ready");
    lbVideo.pause();
    if (item.dataset.type === "video") {
      lbImg.hidden = true;
      lbVideo.hidden = false;
      // reuse the grid film's sources (mp4 first, webm as fallback)
      lbVideo.innerHTML = item.querySelector("video").innerHTML;
      lbVideo.load();
      lbVideo.muted = false;
      lbVideo.play().catch(() => { lbVideo.muted = true; lbVideo.play().catch(() => {}); });
      requestAnimationFrame(() => lbVideo.classList.add("is-ready"));
      return;
    }
    lbVideo.hidden = true;
    lbImg.hidden = false;
    const src = item.querySelector("img");
    const img = new Image();
    img.onload = () => { lbImg.src = src.src; lbImg.alt = src.alt; requestAnimationFrame(() => lbImg.classList.add("is-ready")); };
    img.src = src.src;
  }
  function openLightbox(photo) {
    lbPhotos = [...photo.parentElement.querySelectorAll(".photo")];
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    showPhoto(lbPhotos.indexOf(photo));
  }
  function closeLightbox() {
    lbVideo.pause();
    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
  }
  const lbOpen = () => lightbox.classList.contains("is-open");
  document.querySelectorAll(".photo").forEach((p) => p.addEventListener("click", () => openLightbox(p)));
  lightbox.querySelectorAll("[data-lb]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); showPhoto(lbIndex + +b.dataset.lb); }));
  lightbox.querySelector("[data-lb-close]").addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  // swipe between photos on touch screens
  let touchX = null;
  lightbox.addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) showPhoto(lbIndex + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  // Esc steps back one layer at a time: photo → folder → room
  addEventListener("keydown", (e) => {
    if (lbOpen()) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowRight") showPhoto(lbIndex + 1);
      else if (e.key === "ArrowLeft") showPhoto(lbIndex - 1);
      return;
    }
    if (e.key !== "Escape") return;
    if (openFolderEl) closeFolder();
    else closePanel();
  });

  // Flowing lines in the menu background
  const menuArt = (() => {
    const c = document.getElementById("menuCanvas");
    const ctx = c.getContext("2d");
    let on = false, t = 0;
    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function draw() {
      if (!on) return;
      t += 0.006;
      const w = c.clientWidth, h = c.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const mx = mouse.x / w, my = mouse.y / h;
      for (let i = 0; i < 40; i++) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const n = Math.sin(x * 0.004 + t * 3 + i * 0.15) + Math.sin(x * 0.0017 - t * 2 + i * 0.07 + mx * 3);
          const y = h * (0.2 + i * 0.016) + n * (40 + my * 80);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        const hue = 210 + i * 0.5 + Math.sin(t) * 8;
        ctx.strokeStyle = `hsla(${hue}, 25%, 75%, ${0.04 + i * 0.003})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // the two brand dots drift through the menu, nudged by the cursor
      ["110, 139, 168", "184, 53, 47"].forEach((rgb, i) => {
        const a = t * 1.5 + i * Math.PI;
        const x = w * (0.72 + Math.cos(a) * 0.12) + (mx - 0.5) * 80 * (i ? -1 : 1);
        const y = h * (0.3 + Math.sin(a * 1.3) * 0.12) + (my - 0.5) * 80;
        const r = Math.min(w, h) * 0.22;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb}, 0.28)`);
        g.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      });
      requestAnimationFrame(draw);
    }
    addEventListener("resize", () => on && size());
    return {
      start() { if (on || reduceMotion) return; on = true; size(); requestAnimationFrame(draw); },
      stop() { if (openRoom !== "kontakt") on = false; },
    };
  })();

  /* ---------------- Tid: the clockwork universe ---------------- */
  // A skeleton clock floating in a starry dark, showing the visitor's own time.
  // Brass gears mesh in three depth layers behind it and tick forward once a second;
  // the two brand dots orbit the dial, and everything leans with the cursor.
  const clockWorld = (() => {
    const c = document.getElementById("clockCanvas");
    const ctx = c.getContext("2d");
    const TAU = Math.PI * 2;
    const BRASS = { back: "#3a3124", mid: "#7d6237", front: "#c9a35c" };
    const LAYER = { back: { alpha: 0.55, par: 10 }, mid: { alpha: 0.8, par: 22 }, front: { alpha: 1, par: 44 } };
    const DOT_A = "#8fa8c4", DOT_B = "#d9675f", PAPER = "#f4f3ef";
    const RING_TEXT = "59°54′50″N · 10°45′08″E · ıvar · ";
    const ROMAN = ["XII", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];

    // Gear train, in units of the module m (tooth size). Each child meshes with its parent.
    const train = [
      { teeth: 60, layer: "back" },
      { parent: 0, at: -0.6, teeth: 24, layer: "mid" },
      { parent: 1, at: -1.5, teeth: 40, layer: "back" },
      { parent: 2, at: -2.5, teeth: 18, layer: "front" },
      { parent: 0, at: 2.3, teeth: 20, layer: "mid" },
      { parent: 4, at: 2.9, teeth: 46, layer: "back" },
      { parent: 5, at: 2.0, teeth: 14, layer: "front" },
      { parent: 5, at: 3.9, teeth: 26, layer: "mid" },
      { parent: 0, at: 0.9, teeth: 30, layer: "mid" },
      { parent: 8, at: 0.3, teeth: 52, layer: "back" },
      { parent: 9, at: 1.2, teeth: 16, layer: "front" },
      { parent: 9, at: -0.5, teeth: 22, layer: "mid" },
    ];

    let w, h, R, m, on = false, opened = 0, stars = [];

    function size() {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(w, h) * (w < 700 ? 0.36 : 0.3);
      m = R * 0.024;
      // lay out the gear centres
      train.forEach((g, i) => {
        if (i === 0) { g.x = 0; g.y = 0; return; }
        const p = train[g.parent];
        const d = (p.teeth + g.teeth) / 2 * m;
        g.x = p.x + Math.cos(g.at) * d;
        g.y = p.y + Math.sin(g.at) * d;
      });
      stars = Array.from({ length: Math.round(w * h / 6000) }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + 0.3,
        p: Math.random() * TAU, s: 0.5 + Math.random() * 1.5, z: Math.random(),
      }));
    }

    function gearPath(teeth, angle) {
      const rp = teeth * m / 2, ro = rp + m, ri = rp - 1.25 * m;
      const step = TAU / teeth;
      ctx.beginPath();
      for (let i = 0; i < teeth; i++) {
        const a = angle + i * step;
        const pts = [[ri, a - 0.5 * step], [ri, a - 0.27 * step], [ro, a - 0.14 * step], [ro, a + 0.14 * step], [ri, a + 0.27 * step]];
        pts.forEach(([r, t], k) => {
          const x = Math.cos(t) * r, y = Math.sin(t) * r;
          (i === 0 && k === 0) ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
      }
      ctx.closePath();
      // spoked windows and the axle hole
      const r1 = rp * 0.34, r2 = ri - m * 1.1;
      if (r2 - r1 > m * 1.5) {
        // spokes keep an even width, like real wheel crossings
        const n = teeth > 34 ? 6 : 4, half = m * 0.8;
        const go = half / r2, gi = half / r1;
        for (let k = 0; k < n; k++) {
          const base = angle + k * TAU / n, next = base + TAU / n;
          ctx.moveTo(Math.cos(base + go) * r2, Math.sin(base + go) * r2);
          ctx.arc(0, 0, r2, base + go, next - go);
          ctx.lineTo(Math.cos(next - gi) * r1, Math.sin(next - gi) * r1);
          ctx.arc(0, 0, r1, next - gi, base + gi, true);
          ctx.closePath();
        }
      }
      ctx.moveTo(rp * 0.12, 0);
      ctx.arc(0, 0, rp * 0.12, 0, TAU, true);
    }

    function drawGear(g, angle, layer) {
      ctx.save();
      ctx.translate(g.x, g.y);
      gearPath(g.teeth, angle);
      ctx.globalAlpha = LAYER[layer].alpha;
      ctx.fillStyle = BRASS[layer];
      ctx.fill("evenodd");
      ctx.lineWidth = 1;
      ctx.strokeStyle = layer === "front" ? "rgba(255, 236, 190, .45)" : "rgba(255, 236, 190, .12)";
      ctx.stroke();
      ctx.restore();
    }

    // The heartbeat: a balance wheel swinging back and forth with its hairspring
    function drawBalance(x, y, r, swing) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = BRASS.front;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      for (let a = 0; a < TAU * 4; a += 0.15) {
        const rr = r * 0.12 + (a / (TAU * 4)) * r * 0.55;
        const t = a + swing * 0.6;
        a === 0 ? ctx.moveTo(Math.cos(t) * rr, Math.sin(t) * rr) : ctx.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
      }
      ctx.stroke();
      ctx.rotate(swing);
      ctx.lineWidth = r * 0.12;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = r * 0.06;
      for (let k = 0; k < 3; k++) {
        const a = k * TAU / 3;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
      }
      ctx.restore();
    }

    function hand(angle, len, width, tail, color, tip) {
      ctx.save();
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.shadowColor = "rgba(0,0,0,.5)"; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
      ctx.beginPath();
      ctx.moveTo(-width / 2, tail);
      ctx.lineTo(-width * 0.18, -len);
      ctx.lineTo(width * 0.18, -len);
      ctx.lineTo(width / 2, tail);
      ctx.closePath();
      ctx.fill();
      if (tip) {
        ctx.shadowBlur = 0;
        ctx.fillStyle = tip;
        ctx.beginPath(); ctx.arc(0, -len, width * 0.9, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }

    function drawDial(now, intro) {
      // glass
      const g = ctx.createRadialGradient(-R * 0.3, -R * 0.4, R * 0.1, 0, 0, R * 1.05);
      g.addColorStop(0, "rgba(255,255,255,.06)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();

      // rims
      ctx.strokeStyle = BRASS.front; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.75; ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.9, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;

      // minute track
      for (let i = 0; i < 60; i++) {
        const a = i / 60 * TAU, five = i % 5 === 0;
        const r0 = five ? R * 0.9 : R * 0.94, r1 = R * 0.985;
        ctx.strokeStyle = five ? PAPER : "rgba(244,243,239,.45)";
        ctx.lineWidth = five ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
        ctx.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
        ctx.stroke();
      }

      // roman hours
      ctx.fillStyle = PAPER;
      ctx.font = `500 ${Math.round(R * 0.085)}px "Space Grotesk", Inter, sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ROMAN.forEach((txt, i) => {
        const a = i / 12 * TAU;
        ctx.fillText(txt, Math.sin(a) * R * 0.76, -Math.cos(a) * R * 0.76);
      });

      // Oslo's coordinates engraved on a slowly turning outer ring
      ctx.save();
      ctx.rotate(now / 60000 * TAU * -0.25);
      ctx.font = `400 ${Math.max(9, Math.round(R * 0.042))}px "IBM Plex Mono", monospace`;
      ctx.fillStyle = "rgba(201,163,92,.75)";
      const text = RING_TEXT.repeat(3), rr = R * 1.07;
      for (let i = 0; i < text.length; i++) {
        const a = i / text.length * TAU;
        ctx.save();
        ctx.rotate(a);
        ctx.translate(0, -rr);
        ctx.fillText(text[i], 0, 0);
        ctx.restore();
      }
      ctx.restore();

      // hands, from the visitor's own clock; on opening they sweep in from twelve
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds() / 1000;
      const mi = d.getMinutes() + s / 60;
      const hr = (d.getHours() % 12) + mi / 60;
      const e = 1 - Math.pow(1 - intro, 4);
      hand(hr / 12 * TAU * e, R * 0.48, R * 0.05, R * 0.08, PAPER, DOT_A);
      hand(mi / 60 * TAU * e, R * 0.72, R * 0.032, R * 0.1, PAPER, DOT_B);
      // second hand: ticks like a real movement, with a tiny overshoot
      const x = Math.min(1, (s % 1) / 0.18), c1 = 2.2;
      const tick = Math.floor(s) - 1 + 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
      ctx.save();
      ctx.rotate((tick / 60 * TAU) * e);
      ctx.strokeStyle = DOT_B; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, R * 0.16); ctx.lineTo(0, -R * 0.86); ctx.stroke();
      ctx.fillStyle = DOT_B;
      ctx.beginPath(); ctx.arc(0, R * 0.16, R * 0.025, 0, TAU); ctx.fill();
      ctx.restore();

      // centre boss
      ctx.fillStyle = BRASS.front;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.04, 0, TAU); ctx.fill();
      ctx.fillStyle = DOT_B;
      ctx.beginPath(); ctx.arc(0, 0, R * 0.015, 0, TAU); ctx.fill();
    }

    function frame(now) {
      if (!on) return;
      const intro = Math.min(1, (now - opened) / 1800);
      const mx = mouse.active && !reduceMotion ? (mouse.x / w - 0.5) : 0;
      const my = mouse.active && !reduceMotion ? (mouse.y / h - 0.5) : 0;
      const cx = w / 2, cy = h / 2;

      // the deep
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
      bg.addColorStop(0, "#151b28");
      bg.addColorStop(1, "#06080c");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      [["143,168,196", -0.25, -0.2], ["217,103,95", 0.3, 0.25]].forEach(([rgb, ox, oy], i) => {
        const x = cx + w * ox + Math.sin(now / 9000 + i) * 60, y = cy + h * oy + Math.cos(now / 11000 + i) * 40;
        const neb = ctx.createRadialGradient(x, y, 0, x, y, R * 1.6);
        neb.addColorStop(0, `rgba(${rgb},.10)`);
        neb.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = neb;
        ctx.fillRect(0, 0, w, h);
      });
      for (const st of stars) {
        ctx.globalAlpha = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now / 1000 * st.s + st.p))) * intro;
        ctx.fillStyle = PAPER;
        ctx.fillRect(st.x - mx * 8 * st.z - st.r / 2, st.y - my * 8 * st.z - st.r / 2, st.r, st.r);
      }
      ctx.globalAlpha = 1;

      // the movement: one tick a second, settling with a small overshoot
      // seconds into the (UTC) day keep the angles small enough for exact trigonometry
      const T = (Date.now() / 1000) % 86400;
      const f = T % 1;
      const settle = f < 0.2 ? 1 - Math.pow(1 - f / 0.2, 3) : 1;
      const drive = (Math.floor(T) - 1 + settle) * (TAU / 90) + (1 - intro) * -2;
      const angles = [drive];
      train.forEach((g, i) => {
        if (i === 0) return;
        const p = train[g.parent];
        angles[i] = -(angles[g.parent] - g.at) * p.teeth / g.teeth + g.at + Math.PI + Math.PI / g.teeth;
      });

      const scale = 0.86 + 0.14 * (1 - Math.pow(1 - intro, 3));
      ["back", "mid"].forEach((layer) => {
        ctx.save();
        ctx.translate(cx - mx * LAYER[layer].par, cy - my * LAYER[layer].par);
        ctx.scale(scale, scale);
        train.forEach((g, i) => { if (g.layer === layer) drawGear(g, angles[i], layer); });
        ctx.restore();
      });

      // the two brand dots, in orbit
      ctx.save();
      ctx.translate(cx - mx * 30, cy - my * 30);
      [[DOT_A, 1.32, 0.42, 47000, 0], [DOT_B, 1.5, 0.36, 61000, 2.2]].forEach(([col, rx, ry, period, ph]) => {
        ctx.save();
        ctx.rotate(-0.35);
        ctx.strokeStyle = "rgba(244,243,239,.07)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, 0, R * rx, R * rx * ry * 2.2, 0, 0, TAU); ctx.stroke();
        const a = now / period * TAU + ph;
        for (let k = 12; k >= 0; k--) {   // a fading trail
          const ak = a - k * 0.035;
          ctx.globalAlpha = (1 - k / 13) * 0.9 * intro;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.arc(Math.cos(ak) * R * rx, Math.sin(ak) * R * rx * ry * 2.2, R * 0.03 * (1 - k / 20), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      });
      ctx.restore();
      ctx.globalAlpha = 1;

      // the dial itself
      ctx.save();
      ctx.translate(cx - mx * 6, cy - my * 6);
      ctx.scale(scale, scale);
      ctx.globalAlpha = intro;
      drawDial(now, intro);
      ctx.restore();

      // a few gears and the balance wheel in front of the glass
      ctx.save();
      ctx.translate(cx - mx * LAYER.front.par, cy - my * LAYER.front.par);
      ctx.scale(scale, scale);
      train.forEach((g, i) => { if (g.layer === "front") drawGear(g, angles[i], "front"); });
      drawBalance(R * 0.98, R * 0.78, R * 0.13, reduceMotion ? 0 : Math.sin(now / 1000 * TAU * 1.25) * 1.3);
      ctx.restore();

      requestAnimationFrame(frame);
    }

    addEventListener("resize", () => { if (on) size(); });
    return {
      start() {
        if (on) return;
        on = true;
        size();
        opened = performance.now();
        requestAnimationFrame(frame);
      },
      stop() { on = false; },
    };
  })();

  /* ---------------- Kart: central Oslo ---------------- */
  // MapLibre (self-hosted, loaded on first visit) with OpenFreeMap's open vector tiles,
  // recoloured to the site's palette, with 3D buildings and a live coordinate readout.
  const mapRoom = (() => {
    const STYLE = "https://tiles.openfreemap.org/styles/positron";
    const OSLO = [10.7522, 59.9139];
    const HOME = { center: OSLO, zoom: 15.6, pitch: 55, bearing: -18 };
    const readout = document.getElementById("mapCoords");
    const errorBox = document.getElementById("mapError");
    let map = null, lib = null, is3D = true;

    function loadLib() {
      if (window.maplibregl) return Promise.resolve();
      if (lib) return lib;
      lib = new Promise((resolve, reject) => {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "vendor/maplibre-gl/maplibre-gl.css";
        document.head.appendChild(css);
        const js = document.createElement("script");
        js.src = "vendor/maplibre-gl/maplibre-gl.js";
        js.onload = resolve;
        js.onerror = reject;
        document.head.appendChild(js);
      });
      return lib;
    }

    const pad = (n) => String(n).padStart(2, "0");
    function dms(v, pos, neg) {
      const a = Math.abs(v);
      let d = Math.floor(a), m = Math.floor((a - d) * 60), s = Math.round(((a - d) * 60 - m) * 60);
      if (s === 60) { s = 0; m += 1; }
      if (m === 60) { m = 0; d += 1; }
      return `${d}°${pad(m)}′${pad(s)}″${v >= 0 ? pos : neg}`;
    }
    function updateReadout() {
      const c = map.getCenter();
      readout.textContent = `${dms(c.lat, "N", "S")}  ${dms(c.lng, "E", "W")}`;
    }

    function set(layer, prop, value) { try { map.setPaintProperty(layer, prop, value); } catch (e) { /* layer lacks this property */ } }

    // Paper, ink, fjord: bring the base map into the site's palette
    function restyle() {
      for (const l of map.getStyle().layers) {
        const id = l.id.toLowerCase();
        if (l.type === "background") set(l.id, "background-color", "#f4f3ef");
        else if (/water/.test(id) && l.type === "fill") set(l.id, "fill-color", "#cdd9e4");
        else if (/water/.test(id) && l.type === "line") set(l.id, "line-color", "#b7c8d8");
        else if (/park|grass|wood|forest|green|landcover|cemetery|pitch/.test(id) && l.type === "fill") set(l.id, "fill-color", "#e2e8dc");
        else if (/building/.test(id) && l.type === "fill") set(l.id, "fill-color", "#e7e4dd");
        else if (l.type === "symbol") {
          set(l.id, "text-color", "#3a3d44");
          set(l.id, "text-halo-color", "#f4f3ef");
        }
      }
    }

    function add3D() {
      const sources = map.getStyle().sources;
      const src = Object.keys(sources).find((k) => sources[k].type === "vector");
      if (!src || map.getLayer("ivar-3d")) return;
      const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol");
      map.addLayer({
        id: "ivar-3d",
        type: "fill-extrusion",
        source: src,
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["get", "render_height"], 10], 0, "#ece9e2", 40, "#dfe3e8", 120, "#c9d3de"],
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 14, 0, 15.2, ["coalesce", ["get", "render_height"], 10]],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.88,
        },
      }, firstSymbol && firstSymbol.id);
    }

    function showError() {
      errorBox.hidden = false;
      document.querySelector(".map-ui").hidden = true;
    }

    function init() {
      map = new maplibregl.Map({
        container: "map",
        style: STYLE,
        center: OSLO,
        zoom: reduceMotion ? HOME.zoom : 12.4,
        pitch: reduceMotion ? HOME.pitch : 0,
        bearing: reduceMotion ? HOME.bearing : 0,
        minZoom: 10.5,
        maxZoom: 19,
        maxBounds: [[10.45, 59.8], [11.05, 60.02]],
        attributionControl: false,
      });
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution: '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      }), "bottom-right");

      // if the style never arrives, say so instead of showing an empty room
      const timeout = setTimeout(() => { if (!map.isStyleLoaded()) showError(); }, 15000);

      map.on("load", () => {
        clearTimeout(timeout);
        restyle();
        add3D();
        const pin = document.createElement("div");
        pin.className = "map-pin";
        pin.innerHTML = "<i></i><i></i>";
        new maplibregl.Marker({ element: pin }).setLngLat(OSLO).addTo(map);
        if (!reduceMotion) map.flyTo({ ...HOME, duration: 4200, curve: 1.6, essential: true });
      });
      map.on("move", updateReadout);
    }

    document.querySelectorAll("[data-map]").forEach((b) => b.addEventListener("click", () => {
      if (!map) return;
      const action = b.dataset.map;
      if (action === "in") map.zoomIn();
      else if (action === "out") map.zoomOut();
      else if (action === "home") map.flyTo({ ...HOME, pitch: is3D ? HOME.pitch : 0, duration: reduceMotion ? 0 : 2200, essential: true });
      else if (action === "tilt") {
        is3D = !is3D;
        b.textContent = is3D ? "3D" : "2D";
        b.setAttribute("aria-pressed", String(is3D));
        if (map.getLayer("ivar-3d")) map.setLayoutProperty("ivar-3d", "visibility", is3D ? "visible" : "none");
        map.easeTo({ pitch: is3D ? HOME.pitch : 0, bearing: is3D ? map.getBearing() : 0, duration: 900 });
      }
    }));

    return {
      open() {
        loadLib().then(() => {
          if (!map) init();
          else map.resize();
        }).catch(showError);
      },
    };
  })();

  /* ---------------- Clock ---------------- */
  const clock = document.getElementById("clock");
  function updateClock() {
    const time = new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    clock.textContent = time;
  }
  updateClock();
  setInterval(updateClock, 15000);

  /* ---------------- Main loop ---------------- */
  const ambient = document.querySelector(".ambient");
  const ambientPos = { x: 0, y: 0 };

  function loop() {
    // cursor
    if (finePointer) {
      ringPos.x = lerp(ringPos.x, mouse.x, 0.18);
      ringPos.y = lerp(ringPos.y, mouse.y, 0.18);
      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
    }

    // the soft shapes behind everything lean a little toward the cursor
    if (!reduceMotion) {
      ambientPos.x = lerp(ambientPos.x, (mouse.x / innerWidth - 0.5) * -40, 0.03);
      ambientPos.y = lerp(ambientPos.y, (mouse.y / innerHeight - 0.5) * -40, 0.03);
      ambient.style.transform = `translate3d(${ambientPos.x}px, ${ambientPos.y}px, 0)`;
    }

    // magnets
    magnets.forEach((m) => {
      m.x = lerp(m.x, m.tx, 0.15);
      m.y = lerp(m.y, m.ty, 0.15);
      m.el.style.transform = `translate3d(${m.x}px, ${m.y}px, 0)`;
    });

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
