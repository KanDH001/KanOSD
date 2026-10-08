(function () {
  "use strict";

  /* ---------- Navigation ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.getElementById("nav-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    menu.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        menu.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Early access form (mailto, no backend needed) ---------- */
  var accessForm = document.getElementById("access-form");
  if (accessForm) {
    accessForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!accessForm.reportValidity()) return;
      var d = new FormData(accessForm);
      var body = "Name: " + d.get("name") + "\nEmail: " + d.get("email") +
        "\nI build: " + d.get("role") + "\n\n" + (d.get("message") || "");
      window.location.href = "mailto:hello@fairyhooks.com?subject=" +
        encodeURIComponent("FairyHooks early access") + "&body=" + encodeURIComponent(body);
      document.getElementById("form-note").textContent =
        "Thanks! Your email app should open now. If it does not, write to hello@fairyhooks.com.";
    });
  }

  /* ---------- Cut planner ---------- */
  var form = document.getElementById("planner-form");
  if (!form || !window.FairyPlanner) return;

  var MM_PER_IN = 25.4;
  var COLORS = ["#8fbf7a", "#e9b872", "#c98f6b", "#a7c4d9", "#d6a2b8", "#b7b06a", "#9ec9be", "#e3a07d"];

  // Presets are defined in millimeters (18 mm sheet goods).
  var PRESETS = {
    bookshelf: [
      ["Side", 1800, 300, 2], ["Top / bottom", 764, 300, 2],
      ["Shelf", 762, 290, 3], ["Kick plate", 764, 80, 1]
    ],
    cabinet: [
      ["Side", 720, 560, 2], ["Bottom", 564, 560, 1], ["Stretcher", 564, 100, 2],
      ["Shelf", 562, 520, 1], ["Door", 716, 596, 1]
    ],
    desk: [
      ["Top", 1400, 700, 1], ["Leg panel", 720, 650, 2],
      ["Modesty panel", 1364, 300, 1], ["Shelf", 1364, 250, 1]
    ],
    custom: [["Part", 600, 300, 1]]
  };

  var el = {
    units: document.getElementById("units"),
    preset: document.getElementById("preset"),
    sheetW: document.getElementById("sheet-w"),
    sheetH: document.getElementById("sheet-h"),
    kerf: document.getElementById("kerf"),
    trim: document.getElementById("trim"),
    rotate: document.getElementById("rotate"),
    parts: document.getElementById("parts"),
    add: document.getElementById("add-part"),
    csv: document.getElementById("export-csv"),
    stats: document.getElementById("stats"),
    warnings: document.getElementById("warnings"),
    sheets: document.getElementById("sheets")
  };

  var units = "mm";
  var lastResult = null;

  function round(v) {
    return units === "in" ? Math.round(v * 16) / 16 : Math.round(v * 10) / 10;
  }
  function fromMm(v) { return units === "in" ? round(v / MM_PER_IN) : v; }
  function fmt(v) {
    if (units === "mm") return String(Math.round(v * 10) / 10);
    var whole = Math.floor(v + 1e-9);
    var six = Math.round((v - whole) * 16);
    if (six === 16) { whole += 1; six = 0; }
    if (!six) return whole + "″";
    var num = six, den = 16;
    while (num % 2 === 0) { num /= 2; den /= 2; }
    return (whole ? whole + " " : "") + num + "/" + den + "″";
  }

  function addPartRow(name, w, h, qty) {
    var row = document.createElement("div");
    row.className = "part-row";
    row.innerHTML =
      '<b class="chip" aria-hidden="true"></b>' +
      '<input aria-label="Part name" class="p-name" type="text" maxlength="40">' +
      '<input aria-label="Length" class="p-w" type="number" min="0" step="any">' +
      '<input aria-label="Width" class="p-h" type="number" min="0" step="any">' +
      '<input aria-label="Quantity" class="p-q" type="number" min="1" step="1">' +
      '<button type="button" class="remove-part" aria-label="Remove part">×</button>';
    row.querySelector(".p-name").value = name;
    row.querySelector(".p-w").value = w;
    row.querySelector(".p-h").value = h;
    row.querySelector(".p-q").value = qty;
    el.parts.appendChild(row);
    relabel();
    return row;
  }

  function letter(i) { return i < 26 ? String.fromCharCode(65 + i) : String(i + 1); }

  function relabel() {
    Array.prototype.forEach.call(el.parts.children, function (row, i) {
      var chip = row.querySelector(".chip");
      chip.textContent = letter(i);
      chip.style.setProperty("--c", COLORS[i % COLORS.length]);
      row.dataset.type = i;
    });
  }

  function loadPreset(key) {
    el.parts.innerHTML = "";
    PRESETS[key].forEach(function (p) {
      addPartRow(p[0], fromMm(p[1]), fromMm(p[2]), p[3]);
    });
  }

  function readParts() {
    return Array.prototype.map.call(el.parts.querySelectorAll(".part-row"), function (row, i) {
      return {
        type: i,
        name: row.querySelector(".p-name").value.trim() || "Part",
        w: parseFloat(row.querySelector(".p-w").value),
        h: parseFloat(row.querySelector(".p-h").value),
        qty: Math.min(200, parseInt(row.querySelector(".p-q").value, 10))
      };
    }).filter(function (p) { return p.w > 0 && p.h > 0 && p.qty > 0; });
  }

  function svgEl(tag, attrs, text) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }

  function renderSheet(sheet, i, total, W, H) {
    var wrap = document.createElement("div");
    wrap.className = "sheet";
    var title = document.createElement("h4");
    title.innerHTML = "Sheet " + (i + 1) + " of " + total +
      " <span>" + Math.round(sheet.utilization * 100) + "% used</span>";
    wrap.appendChild(title);

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Cutting layout for sheet " + (i + 1) });
    svg.appendChild(svgEl("rect", { x: 0, y: 0, width: W, height: H, fill: "#efd9b4" }));
    var stroke = Math.max(W, H) / 400;
    var order = 0;

    sheet.placed.forEach(function (p) {
      var g = svgEl("g", { "class": "part", "data-type": p.type });
      g.style.setProperty("--d", (Math.min(order++, 30) * 0.05) + "s");
      g.appendChild(svgEl("rect", { x: p.x, y: p.y, width: p.w, height: p.h,
        fill: COLORS[p.type % COLORS.length], "stroke-width": stroke }));
      var label = letter(p.type) + " · " + p.name + " " + fmt(p.w) + " × " + fmt(p.h) + (p.rot ? " (rotated)" : "");
      g.appendChild(svgEl("title", {}, label));
      var fs = Math.min(p.h * 0.28, p.w / Math.max(6, (p.name.length + 4) * 0.62), Math.max(W, H) / 32);
      if (fs > Math.max(W, H) / 140) {
        g.appendChild(svgEl("text", { x: p.x + p.w / 2, y: p.y + p.h / 2, "font-size": fs,
          "text-anchor": "middle", "dominant-baseline": "middle", fill: "#1f3328",
          "font-family": "Inter, sans-serif", "font-weight": 600 }, letter(p.type) + " · " + p.name));
        if (p.h > fs * 3) {
          g.appendChild(svgEl("text", { x: p.x + p.w / 2, y: p.y + p.h / 2 + fs * 1.2, "font-size": fs * 0.75,
            "text-anchor": "middle", "dominant-baseline": "middle", fill: "#1f3328",
            "font-family": "Inter, sans-serif" }, fmt(p.w) + " × " + fmt(p.h)));
        }
      }
      svg.appendChild(g);
    });
    wrap.appendChild(svg);
    return wrap;
  }

  function stat(value, label) {
    return '<div class="stat"><b>' + value + "</b><span>" + label + "</span></div>";
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function calculate() {
    var W = parseFloat(el.sheetW.value), H = parseFloat(el.sheetH.value);
    var parts = readParts();
    el.warnings.innerHTML = "";
    el.sheets.innerHTML = "";
    el.stats.innerHTML = "";

    if (!(W > 0 && H > 0)) {
      el.sheets.innerHTML = '<p class="empty">Enter a valid sheet size.</p>';
      return;
    }
    if (!parts.length) {
      el.sheets.innerHTML = '<p class="empty">Add at least one part with a length, width and quantity.</p>';
      return;
    }

    var res = window.FairyPlanner.plan({
      sheetW: W, sheetH: H,
      kerf: parseFloat(el.kerf.value) || 0,
      trim: parseFloat(el.trim.value) || 0,
      rotate: el.rotate.checked,
      parts: parts
    });
    lastResult = { res: res, parts: parts, W: W, H: H };

    var placedCount = res.sheets.reduce(function (a, s) { return a + s.placed.length; }, 0);
    var used = res.sheets.reduce(function (a, s) { return a + s.used; }, 0);
    var util = res.sheets.length ? used / (res.sheets.length * W * H) : 0;
    var areaUnit = units === "mm" ? "m²" : "ft²";
    var areaDiv = units === "mm" ? 1e6 : 144;

    el.stats.innerHTML =
      stat(res.sheets.length, "sheets needed") +
      stat(placedCount, "parts placed") +
      stat(Math.round(util * 100) + "%", "material used") +
      stat((Math.round((res.sheets.length * W * H - used) / areaDiv * 100) / 100) + " " + areaUnit, "offcut area");

    if (res.unplaced.length) {
      var names = {};
      res.unplaced.forEach(function (p) { names[p.name] = (names[p.name] || 0) + 1; });
      el.warnings.innerHTML = '<div class="warning">Too large for the usable sheet area (' +
        fmt(res.usableW) + " × " + fmt(res.usableH) + "): " +
        Object.keys(names).map(function (n) { return escapeHtml(n) + " ×" + names[n]; }).join(", ") +
        (el.rotate.checked ? "" : ". Try allowing rotation.") + "</div>";
    }

    res.sheets.forEach(function (s, i) {
      el.sheets.appendChild(renderSheet(s, i, res.sheets.length, W, H));
    });
  }

  function exportCsv() {
    if (!lastResult) calculate();
    if (!lastResult) return;
    var rows = [["Sheet", "Part", "Length (" + units + ")", "Width (" + units + ")", "X", "Y", "Rotated"]];
    lastResult.res.sheets.forEach(function (s, i) {
      s.placed.forEach(function (p) {
        rows.push([i + 1, p.name, round(p.w), round(p.h), round(p.x), round(p.y), p.rot ? "yes" : "no"]);
      });
    });
    lastResult.res.unplaced.forEach(function (p) {
      rows.push(["not placed", p.name, p.w, p.h, "", "", ""]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fairyhooks-cut-list.csv";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  // Remembers the value before conversion so switching units back and
  // forth restores the exact number the user typed.
  function convertInput(input, factor) {
    var v = parseFloat(input.value);
    if (isNaN(v)) return;
    var prev = input.dataset.prev, prevConverted = input.dataset.converted;
    var next = prevConverted !== undefined && String(v) === prevConverted ? prev : String(round(v * factor));
    input.dataset.prev = String(v);
    input.dataset.converted = next;
    input.value = next;
  }

  el.units.addEventListener("change", function () {
    var next = el.units.value;
    if (next === units) return;
    var factor = next === "in" ? 1 / MM_PER_IN : MM_PER_IN;
    units = next;
    [el.sheetW, el.sheetH, el.kerf, el.trim].forEach(function (i) { convertInput(i, factor); });
    // Snap the standard full sheet to its nominal size in each system.
    var snap = units === "in" ? [[2440, 96], [1220, 48]] : [[96, 2440], [48, 1220]];
    [el.sheetW, el.sheetH].forEach(function (i) {
      snap.forEach(function (pair) {
        if (Math.abs(parseFloat(i.value) - round(pair[0] * factor)) < 0.01) i.value = pair[1];
      });
    });
    el.parts.querySelectorAll(".p-w, .p-h").forEach(function (i) { convertInput(i, factor); });
    calculate();
  });

  el.preset.addEventListener("change", function () { loadPreset(el.preset.value); calculate(); });
  el.add.addEventListener("click", function () {
    addPartRow("Part " + (el.parts.children.length + 1), "", "", 1).querySelector(".p-w").focus();
  });
  el.parts.addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-part")) {
      e.target.parentNode.remove();
      relabel();
      calculate();
    }
  });

  // Hovering or focusing a part row highlights its pieces on the sheets.
  function highlight(type) {
    el.sheets.classList.toggle("dim", type != null);
    Array.prototype.forEach.call(el.parts.children, function (row) {
      row.classList.toggle("hl", type != null && row.dataset.type === String(type));
    });
    el.sheets.querySelectorAll(".part").forEach(function (n) {
      n.classList.toggle("hl", type != null && n.getAttribute("data-type") === String(type));
    });
  }
  el.parts.addEventListener("mouseover", function (e) {
    var row = e.target.closest(".part-row");
    highlight(row ? row.dataset.type : null);
  });
  el.parts.addEventListener("mouseleave", function () { highlight(null); });
  el.parts.addEventListener("focusin", function (e) {
    var row = e.target.closest(".part-row");
    if (row) highlight(row.dataset.type);
  });
  el.parts.addEventListener("focusout", function () { highlight(null); });
  el.sheets.addEventListener("mouseover", function (e) {
    var g = e.target.closest && e.target.closest(".part");
    highlight(g ? g.getAttribute("data-type") : null);
  });
  el.sheets.addEventListener("mouseleave", function () { highlight(null); });
  el.csv.addEventListener("click", exportCsv);
  form.addEventListener("submit", function (e) { e.preventDefault(); calculate(); });

  loadPreset("bookshelf");
  calculate();
})();
