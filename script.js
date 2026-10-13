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

  /* ---------------- Statement: per-word scroll highlight ---------------- */
  const statement = document.getElementById("statement");
  const highlight = ["følelse.", "husker.", "lek"];
  statement.innerHTML = statement.textContent.trim().split(/\s+/)
    .map((w) => `<span class="word${highlight.includes(w) ? " hl" : ""}">${w}</span>`)
    .join(" ");
  const statementWords = [...statement.querySelectorAll(".word")];

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
  }

  /* ---------------- Custom cursor ---------------- */
  const cursor = document.querySelector(".cursor");
  const ring = document.querySelector(".cursor__ring");
  const dot = document.querySelector(".cursor__dot");
  const label = document.querySelector(".cursor__label");
  const ringPos = { x: mouse.x, y: mouse.y };

  if (finePointer) {
    document.addEventListener("pointerover", (e) => {
      const target = e.target.closest("a, button, [data-cursor], .cap");
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
      const target = e.target.closest("a, button, [data-cursor], .cap");
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
    let startTime = 0, burst = false, fontSize = 200;
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
      if (!started) return;
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

  /* ---------------- Reveal on scroll ---------------- */
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      if (e.target.dataset.count) countUp(e.target);
      revealIO.unobserve(e.target);
    });
  }, { threshold: 0.2 });
  document.querySelectorAll(".split:not(.hero .split), .reveal-up:not(.hero .reveal-up), .card, [data-count]")
    .forEach((el) => revealIO.observe(el));

  function countUp(el) {
    const end = +el.dataset.count;
    const start = performance.now();
    const dur = 1800;
    (function step(now) {
      const t = clamp((now - start) / dur, 0, 1);
      el.textContent = Math.round((1 - Math.pow(1 - t, 4)) * end);
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  /* ---------------- Card tilt ---------------- */
  document.querySelectorAll(".tilt").forEach((card) => {
    const media = card.querySelector(".card__media");
    card.addEventListener("pointermove", (e) => {
      const r = media.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      card.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
      card.style.setProperty("--rx", `${(0.5 - py) * 14}deg`);
      card.style.setProperty("--gx", `${px * 100}%`);
      card.style.setProperty("--gy", `${py * 100}%`);
      card._mx = px; card._my = py;
    });
    card.addEventListener("pointerenter", () => { card._hover = true; });
    card.addEventListener("pointerleave", () => {
      card._hover = false;
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });

  /* ---------------- Generative card art ---------------- */
  const arts = [...document.querySelectorAll(".card__art")].map((canvas) => {
    const card = canvas.closest(".card");
    const cs = getComputedStyle(card);
    const colors = ["--c1", "--c2", "--c3"].map((v) => cs.getPropertyValue(v).trim());
    const bg = cs.getPropertyValue("--cbg").trim() || "#ecebe6";
    return { canvas, ctx: canvas.getContext("2d"), card, colors, bg, type: canvas.dataset.art, visible: false, energy: 0, w: 0, h: 0 };
  });

  function sizeArt(a) {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    a.w = a.canvas.clientWidth;
    a.h = a.canvas.clientHeight;
    a.canvas.width = a.w * dpr;
    a.canvas.height = a.h * dpr;
    a.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  arts.forEach(sizeArt);
  addEventListener("resize", () => arts.forEach(sizeArt));

  const artIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => { arts.find((a) => a.canvas === e.target).visible = e.isIntersecting; });
  });
  arts.forEach((a) => artIO.observe(a.canvas));

  const drawers = {
    waves(a, t) {
      const { ctx, w, h, colors } = a;
      ctx.fillStyle = a.bg; ctx.fillRect(0, 0, w, h);
      const mx = a.card._mx ?? 0.5, my = a.card._my ?? 0.5;
      for (let i = 0; i < 22; i++) {
        ctx.beginPath();
        const amp = 18 + a.energy * 40 + i * 1.5;
        for (let x = 0; x <= w; x += 6) {
          const y = h * (0.15 + i * 0.035) + Math.sin(x * 0.012 + t * 1.4 + i * 0.35 + mx * 4) * amp * Math.sin(t * 0.5 + i * 0.2 + my * 3);
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = colors[i % 3];
        ctx.globalAlpha = 0.2 + (i / 22) * 0.7;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    orbits(a, t) {
      const { ctx, w, h, colors } = a;
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = a.bg;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      const cx = w * (a.card._mx ?? 0.5), cy = h * (a.card._my ?? 0.5);
      const speed = 1 + a.energy * 2.5;
      for (let i = 0; i < 60; i++) {
        const ang = t * speed * (0.3 + (i % 7) * 0.08) + i * 2.4;
        const rad = 20 + i * (Math.min(w, h) / 120) * (1 + a.energy * 0.3);
        const x = w / 2 + (cx - w / 2) * 0.3 + Math.cos(ang) * rad;
        const y = h / 2 + (cy - h / 2) * 0.3 + Math.sin(ang * 1.1) * rad;
        ctx.beginPath();
        ctx.arc(x, y, 2 + (i % 4), 0, Math.PI * 2);
        ctx.fillStyle = colors[i % 3];
        ctx.fill();
      }
    },
    grid(a, t) {
      const { ctx, w, h, colors } = a;
      ctx.fillStyle = a.bg; ctx.fillRect(0, 0, w, h);
      const step = 26;
      const mx = (a.card._mx ?? 0.5) * w, my = (a.card._my ?? 0.5) * h;
      for (let y = step / 2; y < h; y += step) {
        for (let x = step / 2; x < w; x += step) {
          const d = Math.hypot(x - mx, y - my);
          const wave = Math.sin(d * 0.03 - t * 3);
          const s = 2 + (wave + 1) * (3 + a.energy * 5) * Math.max(0, 1 - d / (w * 1.2));
          ctx.fillStyle = colors[(wave > 0.3) ? 0 : (wave > -0.3 ? 1 : 2)];
          ctx.globalAlpha = 0.35 + (wave + 1) * 0.3;
          ctx.fillRect(x - s / 2, y - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
    },
    blobs(a, t) {
      const { ctx, w, h, colors } = a;
      ctx.fillStyle = a.bg; ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "multiply";
      for (let i = 0; i < 5; i++) {
        const x = w * (0.5 + Math.sin(t * (0.5 + i * 0.13) + i) * 0.32) + ((a.card._mx ?? 0.5) - 0.5) * w * 0.3;
        const y = h * (0.5 + Math.cos(t * (0.4 + i * 0.11) + i * 2) * 0.32) + ((a.card._my ?? 0.5) - 0.5) * h * 0.3;
        const r = Math.min(w, h) * (0.35 + a.energy * 0.15);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, colors[i % 3]);
        g.addColorStop(1, colors[i % 3] + "00");
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    },
  };

  /* ---------------- Capability hover preview ---------------- */
  const capPreview = document.querySelector(".cap-preview");
  const capInner = document.querySelector(".cap-preview__inner");
  const capPos = { x: mouse.x, y: mouse.y, rot: 0 };
  document.querySelectorAll(".cap").forEach((cap) => {
    cap.addEventListener("pointerenter", () => {
      capInner.style.setProperty("--pc", cap.dataset.color);
      capPreview.classList.add("is-on");
    });
    cap.addEventListener("pointerleave", () => capPreview.classList.remove("is-on"));
  });

  /* ---------------- Menu ---------------- */
  const menuBtn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");
  function setMenu(open) {
    const r = menuBtn.getBoundingClientRect();
    menu.style.setProperty("--mx", `${r.left + r.width / 2}px`);
    menu.style.setProperty("--my", `${r.top + r.height / 2}px`);
    document.body.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menu.setAttribute("aria-hidden", String(!open));
    menuBtn.dataset.cursor = open ? "Lukk" : "Åpne";
    if (finePointer) label.textContent = menuBtn.dataset.cursor;
    if (open) menuArt.start(); else setTimeout(menuArt.stop, 1000);
  }
  menuBtn.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
  document.querySelectorAll("[data-open-menu]").forEach((b) => b.addEventListener("click", () => setMenu(true)));
  menu.querySelectorAll("a[href^='#']").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

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
      stop() { if (!document.body.classList.contains("menu-open")) on = false; },
    };
  })();

  /* ---------------- Clock ---------------- */
  const clock = document.getElementById("clock");
  function updateClock() {
    const time = new Intl.DateTimeFormat("no-NO", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Oslo" }).format(new Date());
    clock.textContent = `Norge ${time}`;
  }
  updateClock();
  setInterval(updateClock, 15000);

  /* ---------------- Main loop ---------------- */
  const marqueeRows = [...document.querySelectorAll(".marquee__row")].map((row) => {
    const track = row.querySelector(".marquee__track");
    // duplicate content for a seamless loop
    for (let i = 0; i < 3; i++) row.appendChild(track.cloneNode(true));
    return { row, track, dir: +row.dataset.speed, x: 0 };
  });

  let lastScroll = scrollY, velocity = 0, time = 0;

  function loop() {
    time += 0.016;

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

    // scroll velocity
    const s = scrollY;
    velocity = lerp(velocity, s - lastScroll, 0.1);
    lastScroll = s;

    // marquee
    if (!reduceMotion) {
      marqueeRows.forEach((m) => {
        const tw = m.track.offsetWidth;
        m.x -= (1.2 + Math.abs(velocity) * 0.4) * m.dir * (velocity < -0.5 ? -1 : 1);
        if (m.x <= -tw) m.x += tw;
        if (m.x > 0) m.x -= tw;
        m.row.style.transform = `translate3d(${m.x}px,0,0) skewX(${clamp(-velocity * 0.3, -12, 12)}deg)`;
      });
    }

    // statement words
    const sr = statement.getBoundingClientRect();
    const p = clamp((innerHeight * 0.85 - sr.top) / (sr.height + innerHeight * 0.35), 0, 1);
    const lit = Math.floor(p * statementWords.length);
    statementWords.forEach((wd, i) => wd.classList.toggle("on", i < lit));

    // card art
    arts.forEach((a) => {
      a.energy = lerp(a.energy, a.card._hover ? 1 : 0, 0.06);
      if (a.visible) drawers[a.type](a, time);
    });

    // capability preview
    if (finePointer) {
      const dx = mouse.x - capPos.x;
      capPos.x = lerp(capPos.x, mouse.x, 0.12);
      capPos.y = lerp(capPos.y, mouse.y, 0.12);
      capPos.rot = lerp(capPos.rot, clamp(dx * 0.15, -15, 15), 0.1);
      capPreview.style.translate = `${capPos.x}px ${capPos.y}px`;
      capPreview.style.rotate = `${capPos.rot}deg`;
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
