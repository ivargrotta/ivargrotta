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
    if (deep === "arbeid" || deep === "kontakt") setTimeout(() => openPanel(deep), 2600);
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
  const panels = { arbeid: document.getElementById("arbeid"), kontakt: document.getElementById("kontakt") };
  const navLinks = [...document.querySelectorAll(".nav__link")];
  let openRoom = null;

  function openPanel(name, origin) {
    const panel = panels[name];
    if (!panel || openRoom === name) return;
    if (openRoom) closePanel(true);
    if (origin && name === "kontakt") {
      const r = origin.getBoundingClientRect();
      panel.style.setProperty("--mx", `${r.left + r.width / 2}px`);
      panel.style.setProperty("--my", `${r.top + r.height / 2}px`);
    }
    openRoom = name;
    panel.classList.add("is-open");
    panel.setAttribute("aria-hidden", "false");
    document.body.classList.add("panel-open");
    document.body.classList.toggle("panel-dark", name === "kontakt");
    navLinks.forEach((l) => l.setAttribute("aria-expanded", String(l.dataset.panel === name)));
    revealRoom(panel);
    if (name === "kontakt") menuArt.start();
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
    panel.classList.remove("is-open");
    panel.setAttribute("aria-hidden", "true");
    roomObservers.get(panel)?.disconnect();
    openRoom = null;
    setTimeout(() => {
      if (!panel.classList.contains("is-open")) panel.querySelector(".panel__scroll").scrollTop = 0;
      if (wasContact) menuArt.stop();
    }, 1000);
    if (switching) return;
    document.body.classList.remove("panel-open", "panel-dark");
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

  /* ---------------- Clock ---------------- */
  const clock = document.getElementById("clock");
  function updateClock() {
    const time = new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date());
    clock.textContent = time;
  }
  updateClock();
  setInterval(updateClock, 15000);

  /* ---------------- Main loop ---------------- */
  function loop() {
    // cursor
    if (finePointer) {
      ringPos.x = lerp(ringPos.x, mouse.x, 0.18);
      ringPos.y = lerp(ringPos.y, mouse.y, 0.18);
      dot.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
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
