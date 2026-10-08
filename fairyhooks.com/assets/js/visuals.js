/*
 * FairyHooks landing page visuals:
 *  - isometric assembly player (hero card + assembly section)
 *  - animated cut plan in the hero app mockup
 *  - reveal-on-scroll
 */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.classList.add("js");

  function svgEl(tag, attrs, text) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function f(c) { return Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt); }
    return "rgb(" + f(r) + "," + f(g) + "," + f(b) + ")";
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  /* ---------- Bookshelf model (mm). x right, y up, z toward viewer ---------- */
  var W = 800, H = 1800, D = 300, T = 18, KICK = 80;
  var COLOR = { A: "#8fbf7a", B: "#e9b872", C: "#c98f6b", D: "#a7c4d9" };
  var inner = W - 2 * T;
  var bottomY = KICK;
  var gap = (H - T - (bottomY + T)) / 4;

  var PARTS = [
    { letter: "A", step: 0, box: [0, 0, 0, T, H, D], from: [-450, 0, 0] },
    { letter: "B", step: 1, box: [T, bottomY, 0, inner, T, D], from: [0, 0, 700] },
    { letter: "D", step: 1, box: [T, 0, D - T - 12, inner, KICK, T], from: [0, 0, 700] },
    { letter: "B", step: 2, box: [T, H - T, 0, inner, T, D], from: [0, 600, 0] }
  ];
  for (var s = 1; s <= 3; s++) {
    PARTS.push({ letter: "C", step: 3, box: [T, bottomY + T + gap * s - T / 2, 10, inner, T, D - 10], from: [0, 0, 800] });
  }
  PARTS.push({ letter: "A", step: 4, box: [W - T, 0, 0, T, H, D], from: [500, 0, 0] });

  var STEPS = [
    { title: "Lay out the left side", detail: "Side panel A, inside face up. Mark the bottom at 80 mm." },
    { title: "Fix the bottom and kick plate", detail: "Bottom B and kick plate D. 4 screws, glue on the joints." },
    { title: "Add the top", detail: "Top B flush with the side. 2 screws." },
    { title: "Slide in the shelves", detail: "Three shelves C on shelf pins, 421 mm apart." },
    { title: "Close with the right side", detail: "Side panel A. 4 screws, check the diagonals for square." },
    { title: "Done. Stand it up", detail: "8 parts from 1 sheet. Fit the back panel and wall anchor." }
  ];

  // Three-quarter view from front-right, above: width runs almost
  // horizontally so the open front of the piece faces the reader.
  function project(x, y, z) {
    return [x * 0.95 - z * 0.55, x * 0.22 + z * 0.4 - y];
  }

  function faces(b) {
    var x = b[0], y = b[1], z = b[2], x1 = x + b[3], y1 = y + b[4], z1 = z + b[5];
    return {
      top: [[x, y1, z], [x1, y1, z], [x1, y1, z1], [x, y1, z1]],
      front: [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]],
      right: [[x1, y, z], [x1, y, z1], [x1, y1, z1], [x1, y1, z]]
    };
  }

  function pts(poly) {
    return poly.map(function (p) { var q = project(p[0], p[1], p[2]); return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ");
  }

  // Painter's order for axis-aligned boxes: a box goes first when it lies
  // entirely on the low side of another box along some axis.
  function behind(a, b) {
    var aLow = false, bLow = false;
    for (var i = 0; i < 3; i++) {
      if (a[i] + a[i + 3] <= b[i] + 0.5) aLow = true;
      if (b[i] + b[i + 3] <= a[i] + 0.5) bLow = true;
    }
    if (aLow !== bLow) return aLow;
    return (a[0] + a[1] + a[2]) < (b[0] + b[1] + b[2]);
  }

  function order(items) {
    var out = [], left = items.slice();
    while (left.length) {
      var idx = 0;
      for (var i = 0; i < left.length; i++) {
        var ok = true;
        for (var j = 0; j < left.length; j++) {
          if (i !== j && behind(left[j].box, left[i].box) && !behind(left[i].box, left[j].box)) { ok = false; break; }
        }
        if (ok) { idx = i; break; }
      }
      out.push(left.splice(idx, 1)[0]);
    }
    return out;
  }

  function viewBox(pad) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    PARTS.forEach(function (p) {
      var f = faces(p.box);
      [f.top, f.front, f.right].forEach(function (poly) {
        poly.forEach(function (pt) {
          var q = project(pt[0], pt[1], pt[2]);
          minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
          minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
        });
      });
    });
    return [minX - pad, minY - pad, maxX - minX + 2 * pad, maxY - minY + 2 * pad];
  }

  function Assembly(svg, opts) {
    this.svg = svg;
    this.opts = opts || {};
    this.step = 0;
    this.progress = 1;
    this.timer = null;
    this.playing = false;
    var vb = viewBox(this.opts.pad || 140);
    svg.setAttribute("viewBox", vb.join(" "));
    svg.appendChild(svgEl("polygon", {
      points: pts([[-120, 0, -60], [W + 120, 0, -60], [W + 120, 0, D + 160], [-120, 0, D + 160]]),
      fill: "rgba(47,74,58,.08)"
    }));
    this.layer = svgEl("g", {});
    svg.appendChild(this.layer);
  }

  Assembly.prototype.render = function () {
    var self = this, step = this.step;
    var g = this.layer;
    while (g.firstChild) g.removeChild(g.firstChild);
    var ghosts = svgEl("g", { fill: "none", stroke: "#8a7a66", "stroke-width": 3, "stroke-dasharray": "14 10", opacity: ".45" });
    g.appendChild(ghosts);

    var live = [];
    PARTS.forEach(function (p, i) {
      if (p.step > step) {
        var f = faces(p.box);
        [f.top, f.front, f.right].forEach(function (poly) { ghosts.appendChild(svgEl("polygon", { points: pts(poly) })); });
        return;
      }
      var t = 1;
      if (p.step === step) {
        var k = PARTS.filter(function (q) { return q.step === step; }).indexOf(p);
        t = ease(Math.max(0, Math.min(1, self.progress * 1.4 - k * 0.2)));
      }
      var box = p.box.slice();
      box[0] += p.from[0] * (1 - t); box[1] += p.from[1] * (1 - t); box[2] += p.from[2] * (1 - t);
      live.push({ p: p, box: box, t: t, i: i, current: p.step === step });
    });

    var labels = [];
    order(live).forEach(function (it) {
      var c = COLOR[it.p.letter];
      var f = faces(it.box);
      var grp = svgEl("g", { opacity: (0.25 + 0.75 * it.t).toFixed(2), stroke: "#4a3b2b", "stroke-width": 2.2, "stroke-linejoin": "round" });
      grp.appendChild(svgEl("polygon", { points: pts(f.right), fill: shade(c, -0.22) }));
      grp.appendChild(svgEl("polygon", { points: pts(f.front), fill: c }));
      grp.appendChild(svgEl("polygon", { points: pts(f.top), fill: shade(c, 0.3) }));
      g.appendChild(grp);
      if (it.current && self.opts.labels !== false) {
        var b = it.box;
        var tall = b[4] > b[3];
        var q = tall ? project(b[0] + b[3], b[1] + b[4] * 0.62, b[2] + b[5] / 2)
          : b[5] < 60 ? project(b[0] + b[3] * 0.75, b[1] + b[4] / 2, b[2] + b[5])
          : project(b[0] + b[3] * 0.4, b[1] + b[4], b[2] + b[5] * 0.5);
        labels.push({ q: q, letter: it.p.letter, t: it.t });
      }
    });

    labels.forEach(function (l) {
      var r = self.opts.labelSize || 52;
      var grp = svgEl("g", { opacity: l.t.toFixed(2) });
      grp.appendChild(svgEl("circle", { cx: l.q[0], cy: l.q[1], r: r, fill: "#2f4a3a", stroke: "#fff", "stroke-width": r * 0.14 }));
      grp.appendChild(svgEl("text", { x: l.q[0], y: l.q[1] + r * 0.36, "text-anchor": "middle", "font-size": r, "font-weight": 700,
        "font-family": "Inter, sans-serif", fill: "#fff" }, l.letter));
      g.appendChild(grp);
    });
  };

  Assembly.prototype.go = function (step, instant) {
    var self = this;
    this.step = (step + STEPS.length) % STEPS.length;
    if (this.opts.onStep) this.opts.onStep(this.step);
    if (instant || reduceMotion) { this.progress = 1; this.render(); return; }
    var start = null, dur = 1100;
    cancelAnimationFrame(this.raf);
    function frame(ts) {
      if (start === null) start = ts;
      self.progress = Math.min(1, (ts - start) / dur);
      self.render();
      if (self.progress < 1) self.raf = requestAnimationFrame(frame);
    }
    this.raf = requestAnimationFrame(frame);
  };

  Assembly.prototype.play = function () {
    var self = this;
    if (this.playing) return;
    this.playing = true;
    if (this.opts.onPlay) this.opts.onPlay(true);
    (function tick() {
      self.timer = setTimeout(function () {
        if (!self.playing) return;
        self.go(self.step + 1);
        tick();
      }, self.step === STEPS.length - 1 ? 3200 : 2300);
    })();
  };

  Assembly.prototype.pause = function () {
    this.playing = false;
    clearTimeout(this.timer);
    if (this.opts.onPlay) this.opts.onPlay(false);
  };

  function whenVisible(node, onIn, onOut) {
    if (!("IntersectionObserver" in window)) { onIn(); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) onIn(); else if (onOut) onOut(); });
    }, { threshold: 0.25 }).observe(node);
  }

  /* ---------- Hero mini assembly card ---------- */
  var heroSvg = document.getElementById("hero-assembly");
  if (heroSvg) {
    var heroCaption = document.getElementById("hero-assembly-step");
    var heroAsm = new Assembly(heroSvg, {
      pad: 90, labels: false,
      onStep: function (i) { if (heroCaption) heroCaption.textContent = "Step " + (i + 1) + " of " + STEPS.length + ": " + STEPS[i].title; }
    });
    if (reduceMotion) heroAsm.go(STEPS.length - 1, true);
    else {
      heroAsm.go(0, true);
      whenVisible(heroSvg, function () { heroAsm.play(); }, function () { heroAsm.pause(); });
    }
  }

  /* ---------- Assembly section player ---------- */
  var stage = document.getElementById("assembly-stage");
  if (stage) {
    var list = document.getElementById("assembly-steps");
    var playBtn = document.getElementById("asm-play");
    var bar = document.getElementById("asm-progress");
    STEPS.forEach(function (st, i) {
      var li = document.createElement("li");
      li.innerHTML = '<button type="button" data-step="' + i + '"><span class="n">' + (i + 1) + '</span><span><b></b><small></small></span></button>';
      li.querySelector("b").textContent = st.title;
      li.querySelector("small").textContent = st.detail;
      list.appendChild(li);
    });
    var asm = new Assembly(stage, {
      pad: 160, labelSize: 56,
      onStep: function (i) {
        Array.prototype.forEach.call(list.children, function (li, j) {
          li.classList.toggle("active", j === i);
          li.classList.toggle("done", j < i);
        });
        if (bar) bar.style.width = ((i + 1) / STEPS.length * 100) + "%";
      },
      onPlay: function (on) {
        playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
        playBtn.classList.toggle("is-playing", on);
      }
    });
    asm.go(0, true);
    var userPaused = false;
    list.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-step]");
      if (!b) return;
      userPaused = true; asm.pause(); asm.go(+b.dataset.step);
    });
    document.getElementById("asm-prev").addEventListener("click", function () { userPaused = true; asm.pause(); asm.go(asm.step - 1); });
    document.getElementById("asm-next").addEventListener("click", function () { userPaused = true; asm.pause(); asm.go(asm.step + 1); });
    playBtn.addEventListener("click", function () {
      if (asm.playing) { userPaused = true; asm.pause(); }
      else { userPaused = false; if (asm.step === STEPS.length - 1) asm.go(0); asm.play(); }
    });
    if (!reduceMotion) {
      whenVisible(stage, function () { if (!userPaused) asm.play(); }, function () { asm.pause(); });
    }
  }

  /* ---------- Hero animated cut plan ---------- */
  var heroSheet = document.getElementById("hero-sheet");
  if (heroSheet && window.FairyPlanner) {
    var SW = 2440, SH = 1220;
    var parts = [
      { name: "Side", w: 1800, h: 300, qty: 2, letter: "A" },
      { name: "Top / bottom", w: 764, h: 300, qty: 2, letter: "B" },
      { name: "Shelf", w: 762, h: 290, qty: 3, letter: "C" },
      { name: "Kick plate", w: 764, h: 80, qty: 1, letter: "D" }
    ];
    var res = window.FairyPlanner.plan({ sheetW: SW, sheetH: SH, kerf: 3, trim: 5, rotate: false, parts: parts });
    var sheet = res.sheets[0];
    heroSheet.setAttribute("viewBox", "0 0 " + SW + " " + SH);
    heroSheet.appendChild(svgEl("rect", { x: 0, y: 0, width: SW, height: SH, fill: "#efd9b4" }));
    var grain = svgEl("g", { stroke: "#ddbf90", "stroke-width": 4, fill: "none", opacity: ".8" });
    for (var gy = 40; gy < SH; gy += 70) {
      grain.appendChild(svgEl("path", { d: "M0 " + gy + " C 600 " + (gy - 25) + ", 1200 " + (gy + 25) + ", 1800 " + gy + " S 2440 " + (gy - 15) + ", 2440 " + gy }));
    }
    heroSheet.appendChild(grain);

    var partNodes = [];
    sheet.placed.slice().sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (p) {
      var letter = parts[p.type].letter;
      var g = svgEl("g", { "class": "hp" });
      g.style.transformOrigin = (p.x + p.w / 2) + "px " + (p.y + p.h / 2) + "px";
      g.appendChild(svgEl("rect", { x: p.x, y: p.y, width: p.w, height: p.h, rx: 6, fill: COLOR[letter], stroke: "#fff", "stroke-width": 6 }));
      if (p.h >= 200) {
        g.appendChild(svgEl("text", { x: p.x + p.w / 2, y: p.y + p.h / 2 - 10, "text-anchor": "middle", "font-size": 92, "font-weight": 700,
          "font-family": "Inter, sans-serif", fill: "#1f3328" }, letter + " · " + parts[p.type].name));
        g.appendChild(svgEl("text", { x: p.x + p.w / 2, y: p.y + p.h / 2 + 80, "text-anchor": "middle", "font-size": 64,
          "font-family": "Inter, sans-serif", fill: "#1f3328" }, p.w + " × " + p.h));
      } else {
        g.appendChild(svgEl("text", { x: p.x + p.w / 2, y: p.y + p.h / 2 + 22, "text-anchor": "middle", "font-size": 60, "font-weight": 700,
          "font-family": "Inter, sans-serif", fill: "#1f3328" }, letter));
      }
      heroSheet.appendChild(g);
      partNodes.push(g);
    });

    // Cut lines along part edges that are not on the sheet border.
    var cuts = svgEl("g", { stroke: "#c0392b", "stroke-width": 8, "stroke-linecap": "round", fill: "none" });
    var seen = {};
    sheet.placed.forEach(function (p) {
      [[p.x, p.y + p.h + 1.5, p.x + p.w, p.y + p.h + 1.5], [p.x + p.w + 1.5, p.y, p.x + p.w + 1.5, p.y + p.h]].forEach(function (l) {
        if (l[1] > SH - 10 || l[0] > SW - 10) return;
        var key = l.map(Math.round).join(",");
        if (seen[key]) return;
        seen[key] = 1;
        var len = Math.hypot(l[2] - l[0], l[3] - l[1]);
        var line = svgEl("line", { x1: l[0], y1: l[1], x2: l[2], y2: l[3], "class": "hc" });
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        cuts.appendChild(line);
      });
    });
    heroSheet.appendChild(cuts);

    var used = Math.round(sheet.utilization * 100);
    var heroStat = document.getElementById("hero-stat");
    if (heroStat) heroStat.textContent = res.sheets.length + " sheet · " + sheet.placed.length + " parts · " + used + "% used";
    var mock = document.querySelector(".app-window");

    function runHero() {
      mock.classList.remove("done");
      partNodes.forEach(function (n) { n.classList.remove("in"); });
      Array.prototype.forEach.call(cuts.children, function (c) { c.classList.remove("in"); });
      partNodes.forEach(function (n, i) { setTimeout(function () { n.classList.add("in"); }, 300 + i * 260); });
      var t0 = 300 + partNodes.length * 260 + 300;
      Array.prototype.forEach.call(cuts.children, function (c, i) { setTimeout(function () { c.classList.add("in"); }, t0 + i * 120); });
      setTimeout(function () { mock.classList.add("done"); }, t0 + cuts.children.length * 120 + 300);
    }

    if (reduceMotion) {
      partNodes.forEach(function (n) { n.classList.add("in"); });
      Array.prototype.forEach.call(cuts.children, function (c) { c.classList.add("in"); });
      mock.classList.add("done");
    } else {
      var heroLoop = null;
      whenVisible(heroSheet, function () {
        if (heroLoop) return;
        runHero();
        heroLoop = setInterval(runHero, 9000);
      }, function () { clearInterval(heroLoop); heroLoop = null; });
    }
  }

  /* ---------- Reveal on scroll ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    Array.prototype.forEach.call(reveals, function (n) { n.classList.add("visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    Array.prototype.forEach.call(reveals, function (n) { io.observe(n); });
  }
})();
