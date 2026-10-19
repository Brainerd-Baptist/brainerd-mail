// Brainerd Missions map: draws the interactive map from the data in <script id="mm-data">.
// Used by the live embed at /embed/missions-map. Plain JavaScript, no libraries.
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var D = JSON.parse(document.getElementById("mm-data").textContent);
  var COLOR = { 1: "#00abc9", 2: "#33bc53", 3: "#ff4a53" };
  var root = document.getElementById("mm");

  function h(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function s(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // ---- header ----
  var head = h("div", "mm-head");
  head.appendChild(h("span", "mm-eyebrow", "Brainerd Missions"));
  head.appendChild(h("h2", null, "Engagement Overview", { id: "mm-title" }));
  root.appendChild(head);

  if (!D.countries.length) {
    root.appendChild(h("p", "mm-empty", "The map is being updated. Please check back soon."));
    report();
    return;
  }

  // ---- counters double as filters ----
  var filter = "all", pinned = null;
  var stats = h("div", "mm-stats", null, { role: "group", "aria-label": "Filter countries by engagement level" });
  var statBtns = [];
  [1, 2, 3, "all"].forEach(function (f) {
    var b = h("button", "stat", null, { type: "button", "data-f": String(f), "aria-pressed": f === "all" ? "true" : "false" });
    var lab = h("span", "lab");
    var info = f === "all" ? null : D.levels.filter(function (l) { return l.level === f; })[0];
    if (f !== "all") { b.style.setProperty("--c", COLOR[f]); lab.appendChild(h("i", "dot")); }
    lab.appendChild(document.createTextNode(f === "all" ? "Engaged countries" : info.label));
    b.appendChild(lab);
    var num = h("span", "num", String(f === "all" ? D.counts.total : D.counts[f]));
    if (f !== "all") num.appendChild(h("small", null, D.counts[f] === 1 ? "country" : "countries"));
    b.appendChild(num);
    if (info && info.blurb) b.appendChild(h("span", "bl", info.blurb));
    b.addEventListener("click", function () { setFilter(f === "all" || filter === String(f) ? "all" : String(f)); });
    stats.appendChild(b); statBtns.push(b);
  });
  root.appendChild(stats);

  // ---- map ----
  var wrap = h("div", "mm-map");
  var svg = s("svg", { "class": "map", viewBox: "0 0 " + D.W + " " + D.H, role: "group", "aria-label": "World map of Brainerd's mission engagement" });
  var defs = s("defs", {});
  var pat = s("pattern", { id: "stripe", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  pat.appendChild(s("rect", { width: 2.2, height: 6, fill: "rgba(255,255,255,.38)" }));
  defs.appendChild(pat); svg.appendChild(defs);
  svg.appendChild(s("path", { "class": "land", d: D.base }));
  var hits = s("g", {}); svg.appendChild(hits);
  var byId = {}, els = {};
  D.countries.forEach(function (c) { byId[c.id] = c; });
  D.hit.forEach(function (x) {
    var c = byId[x.id]; if (!c) return;
    var p = s("path", { d: x.d, "class": "c", "data-l": c.level, "data-id": c.id, tabindex: 0, role: "button", "aria-label": c.name + ", " + levelName(c.level) });
    hits.appendChild(p); els[c.id] = { p: p };
    if (c.level === 3) { var hp = s("path", { d: x.d, "class": "hatch" }); hits.appendChild(hp); els[c.id].h = hp; }
  });
  wrap.appendChild(svg);
  var zoomBox = h("div", "zoom");
  var zin = h("button", "zbtn", "+", { type: "button", "aria-label": "Zoom in" });
  var zout = h("button", "zbtn", "−", { type: "button", "aria-label": "Zoom out" });
  var zrs = h("button", "zbtn", "⟲", { type: "button", "aria-label": "Reset map" });
  zoomBox.appendChild(zin); zoomBox.appendChild(zout); zoomBox.appendChild(zrs);
  wrap.appendChild(zoomBox);
  var tip = h("div", "tip", null, { role: "status", "aria-live": "polite" });
  wrap.appendChild(tip);
  root.appendChild(wrap);
  root.appendChild(h("p", "mm-hint", "Hover or tap a highlighted country to see details about Brainerd’s engagement."));

  function levelName(l) { var x = D.levels.filter(function (i) { return i.level === l; })[0]; return x ? x.label : "Level " + l; }

  function setFilter(f) {
    filter = f; hideTip(true);
    statBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-f") === f)); });
    D.countries.forEach(function (c) {
      var on = f === "all" || String(c.level) === f, e = els[c.id]; if (!e) return;
      e.p.classList.toggle("dim", !on); e.p.tabIndex = on ? 0 : -1; if (e.h) e.h.classList.toggle("dim", !on);
    });
  }

  // ---- details card ----
  function fillTip(c) {
    tip.textContent = "";
    var t = h("h3"); var dot = h("i"); dot.style.background = COLOR[c.level]; t.appendChild(dot); t.appendChild(document.createTextNode(c.name));
    tip.appendChild(t);
    var dl = h("dl");
    [["Engagement Level", levelName(c.level)], ["Engaged Since", c.since], ["Primary Religion", c.religion], ["Engaged People Group", c.peopleGroup], ["Unreached People Groups", c.unreachedGroups], ["Unreached Population", c.unreachedPop]]
      .forEach(function (r) { if (r[1] === "") return; dl.appendChild(h("dt", null, r[0])); dl.appendChild(h("dd", null, r[1])); });
    tip.appendChild(dl);
  }
  function place(x, y) {
    if (matchMedia("(max-width:700px)").matches) return;
    var w = wrap.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = x - w.left + 16, top = y - w.top - th - 14;
    if (left + tw > w.width - 8) left = x - w.left - tw - 16;
    if (top < 4) top = y - w.top + 20;
    tip.style.left = Math.max(4, left) + "px"; tip.style.top = Math.max(4, top) + "px";
  }
  function showTip(id, x, y) {
    fillTip(byId[id]); tip.classList.add("show"); place(x, y);
    for (var k in els) els[k].p.classList.remove("on");
    els[id].p.classList.add("on"); report();
  }
  function hideTip(force) {
    if (pinned && !force) return;
    pinned = null; tip.classList.remove("show");
    for (var k in els) els[k].p.classList.remove("on");
    report();
  }
  var drag = { active: false, moved: false };
  hits.addEventListener("pointermove", function (e) {
    if (e.pointerType === "touch" || drag.active) return;
    var p = e.target.closest(".c");
    if (p && !p.classList.contains("dim")) { if (!pinned) showTip(p.getAttribute("data-id"), e.clientX, e.clientY); } else hideTip();
  });
  hits.addEventListener("pointerleave", function () { hideTip(); });
  hits.addEventListener("focusin", function (e) {
    var p = e.target.closest(".c"); if (!p) return;
    var r = p.getBoundingClientRect(); showTip(p.getAttribute("data-id"), r.left + r.width / 2, r.top + r.height / 2);
  });
  hits.addEventListener("focusout", function () { hideTip(); });
  hits.addEventListener("click", function (e) {
    if (drag.moved) return;
    var p = e.target.closest(".c"); if (!p || p.classList.contains("dim")) return;
    var id = p.getAttribute("data-id");
    if (pinned === id) { hideTip(true); return; }
    pinned = id; showTip(id, e.clientX, e.clientY);
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".c") && !e.target.closest(".zbtn")) hideTip(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(true); });

  // ---- zoom and drag ----
  var W = D.W, H = D.H, vb = { x: 0, y: 0, w: W, h: H };
  function setVB() { svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h); }
  function clamp() { vb.w = Math.min(W, Math.max(W / 6, vb.w)); vb.h = vb.w * H / W; vb.x = Math.min(W - vb.w, Math.max(0, vb.x)); vb.y = Math.min(H - vb.h, Math.max(0, vb.y)); }
  function zoom(f) { var cx = vb.x + vb.w / 2, cy = vb.y + vb.h / 2; vb.w /= f; vb.h = vb.w * H / W; vb.x = cx - vb.w / 2; vb.y = cy - vb.h / 2; clamp(); setVB(); hideTip(true); }
  zin.onclick = function () { zoom(1.6); }; zout.onclick = function () { zoom(1 / 1.6); };
  zrs.onclick = function () { vb = { x: 0, y: 0, w: W, h: H }; setVB(); hideTip(true); };
  var sx, sy, sv;
  svg.addEventListener("pointerdown", function (e) { if (vb.w >= W) return; drag.active = true; drag.moved = false; sx = e.clientX; sy = e.clientY; sv = { x: vb.x, y: vb.y, w: vb.w, h: vb.h }; svg.setPointerCapture(e.pointerId); svg.classList.add("drag"); });
  svg.addEventListener("pointermove", function (e) {
    if (!drag.active) return;
    var k = vb.w / svg.getBoundingClientRect().width, dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; hideTip(true); }
    vb.x = sv.x - dx * k; vb.y = sv.y - dy * k; clamp(); setVB();
  });
  function end() { drag.active = false; svg.classList.remove("drag"); setTimeout(function () { drag.moved = false; }, 0); }
  svg.addEventListener("pointerup", end); svg.addEventListener("pointercancel", end);

  // ---- tell the web page around us how tall we are, so the frame fits with no scrollbar ----
  function report() {
    try { if (window.parent !== window) window.parent.postMessage({ source: "brainerd-missions-map", height: document.documentElement.scrollHeight }, "*"); } catch (e) {}
  }
  if (window.ResizeObserver) new ResizeObserver(report).observe(document.body);
  window.addEventListener("load", report); window.addEventListener("resize", report);
  report();
})();
