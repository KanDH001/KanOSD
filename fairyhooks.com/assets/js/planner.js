/*
 * FairyHooks lightweight cut planner.
 * Guillotine bin packing (best area fit). Several sort orders and split
 * rules are tried and the layout with the fewest sheets wins.
 * Kerf is handled by growing every part and the usable sheet by one kerf,
 * so parts may still touch the trimmed sheet edge.
 */
(function (global) {
  "use strict";

  var SORTS = [
    function (a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h) || b.w * b.h - a.w * a.h; },
    function (a, b) { return b.w * b.h - a.w * a.h; },
    function (a, b) { return b.w - a.w || b.h - a.h; },
    function (a, b) { return b.h - a.h || b.w - a.w; }
  ];

  // Returns true to split horizontally (full-width bottom remainder).
  var SPLITS = [
    function (fr, w, h) { return fr.w - w < fr.h - h; },
    function (fr, w, h) { return fr.w - w >= fr.h - h; },
    function () { return true; },
    function () { return false; }
  ];

  function expandParts(parts, sort) {
    var list = [];
    parts.forEach(function (p, idx) {
      for (var i = 0; i < p.qty; i++) {
        list.push({ name: p.name, w: p.w, h: p.h, type: p.type != null ? p.type : idx, copy: i + 1 });
      }
    });
    list.sort(sort || SORTS[0]);
    return list;
  }

  function newSheet(W, H) {
    return { free: [{ x: 0, y: 0, w: W, h: H }], placed: [] };
  }

  function scoreFit(fr, w, h) {
    if (w > fr.w || h > fr.h) return null;
    return { area: fr.w * fr.h - w * h, side: Math.min(fr.w - w, fr.h - h) };
  }

  function better(a, b) {
    return !b || a.area < b.area || (a.area === b.area && a.side < b.side);
  }

  function split(sheet, fi, w, h, rule) {
    var fr = sheet.free[fi];
    var right, bottom;
    if (rule(fr, w, h)) {
      right = { x: fr.x + w, y: fr.y, w: fr.w - w, h: h };
      bottom = { x: fr.x, y: fr.y + h, w: fr.w, h: fr.h - h };
    } else {
      right = { x: fr.x + w, y: fr.y, w: fr.w - w, h: fr.h };
      bottom = { x: fr.x, y: fr.y + h, w: w, h: fr.h - h };
    }
    sheet.free.splice(fi, 1);
    if (right.w > 0 && right.h > 0) sheet.free.push(right);
    if (bottom.w > 0 && bottom.h > 0) sheet.free.push(bottom);
  }

  /**
   * @param {Object} opts
   *   sheetW, sheetH: stock size
   *   kerf: blade width
   *   trim: edge trim on every side
   *   rotate: allow 90 degree rotation
   *   parts: [{name, w, h, qty}]
   */
  function packOnce(opts, sort, rule) {
    var k = Math.max(0, opts.kerf || 0);
    var t = Math.max(0, opts.trim || 0);
    var usableW = opts.sheetW - 2 * t;
    var usableH = opts.sheetH - 2 * t;
    var W = usableW + k;
    var H = usableH + k;
    var sheets = [];
    var unplaced = [];

    if (usableW <= 0 || usableH <= 0) {
      return { sheets: [], unplaced: expandParts(opts.parts), usableW: usableW, usableH: usableH };
    }

    expandParts(opts.parts, sort).forEach(function (part) {
      var pw = part.w + k, ph = part.h + k;
      var best = null;

      sheets.forEach(function (sheet, si) {
        sheet.free.forEach(function (fr, fi) {
          var s = scoreFit(fr, pw, ph);
          if (s && better(s, best)) best = { si: si, fi: fi, w: pw, h: ph, rot: false, area: s.area, side: s.side };
          if (opts.rotate && part.w !== part.h) {
            s = scoreFit(fr, ph, pw);
            if (s && better(s, best)) best = { si: si, fi: fi, w: ph, h: pw, rot: true, area: s.area, side: s.side };
          }
        });
      });

      if (!best) {
        var fresh = newSheet(W, H);
        var fits = scoreFit(fresh.free[0], pw, ph);
        var fitsRot = opts.rotate && scoreFit(fresh.free[0], ph, pw);
        if (!fits && !fitsRot) {
          unplaced.push(part);
          return;
        }
        sheets.push(fresh);
        var useRot = !fits;
        best = { si: sheets.length - 1, fi: 0, w: useRot ? ph : pw, h: useRot ? pw : ph, rot: useRot };
      }

      var sheet = sheets[best.si];
      var fr = sheet.free[best.fi];
      sheet.placed.push({
        name: part.name, type: part.type, copy: part.copy, rot: best.rot,
        x: fr.x + t, y: fr.y + t, w: best.w - k, h: best.h - k
      });
      split(sheet, best.fi, best.w, best.h, rule);
    });

    var sheetArea = opts.sheetW * opts.sheetH;
    sheets.forEach(function (s) {
      s.used = s.placed.reduce(function (a, p) { return a + p.w * p.h; }, 0);
      s.utilization = s.used / sheetArea;
    });

    return { sheets: sheets, unplaced: unplaced, usableW: usableW, usableH: usableH };
  }

  // Fewer sheets wins; ties go to the layout that leaves the last sheet
  // emptiest, which keeps the largest reusable offcut.
  function isBetter(a, b) {
    if (a.sheets.length !== b.sheets.length) return a.sheets.length < b.sheets.length;
    if (!a.sheets.length) return false;
    return a.sheets[a.sheets.length - 1].used < b.sheets[b.sheets.length - 1].used;
  }

  function plan(opts) {
    var best = null;
    SORTS.forEach(function (sort) {
      SPLITS.forEach(function (rule) {
        var r = packOnce(opts, sort, rule);
        if (!best || isBetter(r, best)) best = r;
      });
    });
    return best;
  }

  global.FairyPlanner = { plan: plan };
  if (typeof module !== "undefined") module.exports = { plan: plan };
})(typeof window !== "undefined" ? window : globalThis);
