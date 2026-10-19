// Brainerd Missions map: draws the interactive map from the data in <script id="mm-data">.
// Phone first: pinch and drag, big tap targets, a list view, quick region jumps. Plain JavaScript, no libraries.
(function () {
  var NS = "http://www.w3.org/2000/svg";
  var D = JSON.parse(document.getElementById("mm-data").textContent);
  var COLOR = { 1: "#00abc9", 2: "#33bc53", 3: "#ff4a53" };
  var REGIONS = [
    { name: "World", vb: { x: 0, y: 20, w: D.W, id: 0 } },
    { name: "Americas", vb: { x: 0, y: 60, w: 720 } },
    { name: "Europe & Middle East", vb: { x: 395, y: 74, w: 347 } },
    { name: "Africa", vb: { x: 312, y: 170, w: 459 } },
    { name: "Asia & Pacific", vb: { x: 582, y: 126, w: 395 } }
  ];
  var root = document.getElementById("mm");
  var phone = window.matchMedia("(max-width:700px)");
  var reduce = window.matchMedia("(prefers-reduced-motion:reduce)").matches;

  function h(tag, cls, text, attrs) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function s(tag, attrs) { var e = document.createElementNS(NS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function levelName(l) { var x = D.levels.filter(function (i) { return i.level === l; })[0]; return x ? x.label : "Level " + l; }
  function facts(c) {
    return [["Engagement Level", levelName(c.level)], ["Engaged Since", c.since], ["Primary Religion", c.religion], ["Engaged People Group", c.peopleGroup], ["Unreached People Groups", c.unreachedGroups], ["Unreached Population", c.unreachedPop]]
      .filter(function (r) { return r[1] !== ""; });
  }
  function factList(c) {
    var dl = h("dl");
    facts(c).forEach(function (r) { dl.appendChild(h("dt", null, r[0])); dl.appendChild(h("dd", null, r[1])); });
    return dl;
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

  var filter = "all", pinned = null, view = "map", query = "";
  var byId = {}, els = {};
  D.countries.forEach(function (c) { byId[c.id] = c; });

  // ---- level counters double as filters ----
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

  // ---- view switch + region jumps ----
  var bar = h("div", "mm-bar");
  var seg = h("div", "seg", null, { role: "group", "aria-label": "How to look at the countries" });
  var bMap = h("button", "segbtn", "Map", { type: "button", "aria-pressed": "true" });
  var bList = h("button", "segbtn", "List", { type: "button", "aria-pressed": "false" });
  seg.appendChild(bMap); seg.appendChild(bList); bar.appendChild(seg);
  var regionsBox = h("div", "regions", null, { role: "group", "aria-label": "Jump to a part of the world" });
  var regionBtns = REGIONS.map(function (r) {
    var b = h("button", "chip", r.name, { type: "button", "aria-label": r.name === "World" ? "Show the whole world" : "Zoom to " + r.name });
    b.addEventListener("click", function () { jump(r); });
    regionsBox.appendChild(b); return b;
  });
  bar.appendChild(regionsBox);

  // ---- map ----
  var wrap = h("div", "mm-map");
  var svg = s("svg", { "class": "map", viewBox: "0 0 " + D.W + " " + D.H, role: "group", "aria-label": "World map of Brainerd's mission engagement" });
  var defs = s("defs", {});
  var pat = s("pattern", { id: "stripe", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  pat.appendChild(s("rect", { width: 2.2, height: 6, fill: "rgba(255,255,255,.38)" }));
  defs.appendChild(pat); svg.appendChild(defs);
  svg.appendChild(s("path", { "class": "land", d: D.base }));
  var hits = s("g", {}); svg.appendChild(hits);
  D.hit.forEach(function (x) {
    var c = byId[x.id]; if (!c) return;
    var p = s("path", { d: x.d, "class": "c", "data-l": c.level, "data-id": c.id, tabindex: 0, role: "button", "aria-label": c.name + ", " + levelName(c.level) });
    hits.appendChild(p); els[c.id] = { p: p };
    if (c.level === 3) { var hp = s("path", { d: x.d, "class": "hatch" }); hits.appendChild(hp); els[c.id].h = hp; }
  });
  // Small countries get an invisible, wider tap area so a fingertip can find them.
  D.hit.forEach(function (x) {
    var e = els[x.id]; if (!e) return;
    var b = e.p.getBBox();
    if (Math.max(b.width, b.height) < 26) {
      var halo = s("path", { d: x.d, "class": "halo", "data-id": x.id });
      hits.appendChild(halo); e.halo = halo;
    }
  });
  wrap.appendChild(svg);
  var zoomBox = h("div", "zoom");
  var zin = h("button", "zbtn", "+", { type: "button", "aria-label": "Zoom in" });
  var zout = h("button", "zbtn", "−", { type: "button", "aria-label": "Zoom out" });
  zoomBox.appendChild(zin); zoomBox.appendChild(zout);
  wrap.appendChild(zoomBox);
  var tip = h("div", "tip", null, { role: "region", "aria-live": "polite" });
  wrap.appendChild(tip);

  // ---- list view ----
  var list = h("div", "mm-list"); list.hidden = true;
  var search = h("input", "search", null, { type: "search", placeholder: "Search countries", "aria-label": "Search countries", autocomplete: "off", enterkeyhint: "search" });
  var listBody = h("div", "list-body");
  list.appendChild(search); list.appendChild(listBody);

  var hint = h("p", "mm-hint", "Tap a highlighted country to see details about Brainerd’s engagement.");
  root.appendChild(bar); root.appendChild(stats); root.appendChild(wrap); root.appendChild(list); root.appendChild(hint);
  hint.textContent = phone.matches ? "Tap a highlighted country, pinch to zoom, or switch to the list." : "Hover over a highlighted country to see details about Brainerd’s engagement.";

  // ---- filtering ----
  function visible(c) { return filter === "all" || String(c.level) === filter; }
  function setFilter(f) {
    filter = f; hideTip(true);
    statBtns.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-f") === f)); });
    D.countries.forEach(function (c) {
      var on = visible(c), e = els[c.id]; if (!e) return;
      e.p.classList.toggle("dim", !on); e.p.tabIndex = on ? 0 : -1;
      if (e.h) e.h.classList.toggle("dim", !on);
      if (e.halo) e.halo.classList.toggle("dim", !on);
    });
    renderList();
  }

  // ---- details card (floating on a computer, under the map on a phone) ----
  function fillTip(c) {
    tip.textContent = "";
    var t = h("h3"); var dot = h("i"); dot.style.background = COLOR[c.level]; t.appendChild(dot);
    t.appendChild(h("span", null, c.name));
    var x = h("button", "tipx", "×", { type: "button", "aria-label": "Close details" });
    x.addEventListener("click", function (e) { e.stopPropagation(); hideTip(true); });
    t.appendChild(x);
    tip.appendChild(t); tip.appendChild(factList(c));
  }
  function place(x, y) {
    if (phone.matches) return;
    var w = wrap.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var left = x - w.left + 16, top = y - w.top - th - 14;
    if (left + tw > w.width - 8) left = x - w.left - tw - 16;
    if (top < 4) top = y - w.top + 20;
    tip.style.left = Math.max(4, left) + "px"; tip.style.top = Math.max(4, top) + "px";
  }
  function mark(id) { for (var k in els) els[k].p.classList.toggle("on", k === id); }
  function showTip(id, x, y) { fillTip(byId[id]); tip.classList.add("show"); place(x, y); mark(id); report(); }
  function hideTip(force) {
    if (pinned && !force) return;
    pinned = null; tip.classList.remove("show"); mark(null); report();
  }
  function idOf(el) { var n = el && el.closest ? el.closest(".c,.halo") : null; return n && !n.classList.contains("dim") ? n.getAttribute("data-id") : null; }

  var drag = { moved: false };
  hits.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse" || ptrs.size) return;
    var id = idOf(e.target);
    if (id) { if (!pinned) showTip(id, e.clientX, e.clientY); } else hideTip();
  });
  hits.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse") hideTip(); });
  hits.addEventListener("focusin", function (e) {
    var p = e.target.closest(".c"); if (!p) return;
    var r = p.getBoundingClientRect(); showTip(p.getAttribute("data-id"), r.left + r.width / 2, r.top + r.height / 2);
  });
  hits.addEventListener("focusout", function () { hideTip(); });
  hits.addEventListener("click", function (e) {
    if (drag.moved) return;
    var id = idOf(e.target); if (!id) return;
    if (pinned === id) { hideTip(true); return; }
    pinned = id; showTip(id, e.clientX, e.clientY);
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".c,.halo,.zbtn,.tip")) hideTip(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") hideTip(true); });

  // ---- zoom and pan: buttons, pinch, drag, double-tap, trackpad pinch ----
  // The world map has empty ocean at the very bottom; start a little lower and crop it so the map fills its frame.
  var W = D.W, H = D.H - 62, Y0 = 20, vb = { x: 0, y: Y0, w: W, h: H }, anim = 0;
  svg.setAttribute("viewBox", "0 " + Y0 + " " + W + " " + H);
  var fromJump = false;
  function setVB() {
    svg.setAttribute("viewBox", vb.x + " " + vb.y + " " + vb.w + " " + vb.h);
    svg.classList.toggle("zoomed", vb.w < W - 1);
    if (!fromJump && vb.w < W - 1) markRegionClear();
    if (vb.w >= W - 1 && !fromJump) markRegion(0);
  }
  function markRegionClear() { regionBtns.forEach(function (b) { b.classList.remove("on"); b.setAttribute("aria-pressed", "false"); }); }
  function clamp(v) { v.w = Math.min(W, Math.max(W / 8, v.w)); v.h = v.w * H / W; v.x = Math.min(W - v.w, Math.max(0, v.x)); v.y = Math.min(D.H - v.h, Math.max(Y0 - 4, v.y)); return v; }
  function rect() { return svg.getBoundingClientRect(); }
  // Zoom by factor f keeping the point under (px, py), in screen pixels, where it is.
  function zoomAt(f, px, py) {
    var r = rect(), u = (px - r.left) / r.width, v = (py - r.top) / r.height;
    var gx = vb.x + u * vb.w, gy = vb.y + v * vb.h;
    vb.w /= f; vb.h = vb.w * H / W; clamp(vb);
    vb.x = gx - u * vb.w; vb.y = gy - v * vb.h; clamp(vb); setVB();
  }
  function zoomCenter(f) { var r = rect(); zoomAt(f, r.left + r.width / 2, r.top + r.height / 2); hideTip(true); }
  function markRegion(i) {
    regionBtns.forEach(function (b, k) { b.classList.toggle("on", k === i); b.setAttribute("aria-pressed", String(k === i)); });
    if (i < 0) return;
    var b = regionBtns[i], bx = regionsBox;
    var left = b.offsetLeft - (bx.clientWidth - b.offsetWidth) / 2;
    try { bx.scrollTo({ left: left, behavior: reduce ? "auto" : "smooth" }); } catch (e) { bx.scrollLeft = left; }
  }
  function jump(r) {
    hideTip(true); markRegion(REGIONS.indexOf(r));
    var whole = r.vb.id === 0, k0 = whole ? 1 : D.H / H;
    var nw = r.vb.w * k0, th = nw * H / W, cx = r.vb.x + r.vb.w / 2, cy = r.vb.y + r.vb.w * (D.H / D.W) / 2;
    var to = clamp({ x: whole ? 0 : cx - nw / 2, y: whole ? Y0 : cy - th / 2, w: nw, h: th });
    fromJump = true;
    if (reduce) { vb = to; setVB(); fromJump = false; return; }
    var from = { x: vb.x, y: vb.y, w: vb.w }, t0 = null, id = ++anim;
    (function step(t) {
      if (id !== anim) return; if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / 280), e = 1 - Math.pow(1 - k, 3);
      vb = clamp({ x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, w: from.w + (to.w - from.w) * e, h: 0 }); setVB();
      if (k < 1) requestAnimationFrame(step); else fromJump = false;
    })(performance.now());
  }
  zin.onclick = function () { zoomCenter(1.7); };
  zout.onclick = function () { zoomCenter(1 / 1.7); };

  var ptrs = new Map(), g = null; // g: gesture start state
  function mid() { var a = Array.from(ptrs.values()); return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; }
  svg.addEventListener("pointerdown", function (e) {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag.moved = false; anim++; fromJump = false;
    if (ptrs.size === 2) { var m = mid(); g = { two: true, d: m.d, x: m.x, y: m.y, vb: { x: vb.x, y: vb.y, w: vb.w, h: vb.h } }; drag.moved = true; hideTip(true); }
    else g = { two: false, x: e.clientX, y: e.clientY, vb: { x: vb.x, y: vb.y, w: vb.w, h: vb.h }, started: false };
  });
  svg.addEventListener("pointermove", function (e) {
    if (!ptrs.has(e.pointerId) || !g) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    var r = rect();
    if (ptrs.size >= 2 && g.two) {
      var m = mid(), f = m.d / g.d;
      var nw = Math.min(W, Math.max(W / 8, g.vb.w / f)), nh = nw * H / W;
      var u0 = (g.x - r.left) / r.width, v0 = (g.y - r.top) / r.height;
      var gx = g.vb.x + u0 * g.vb.w, gy = g.vb.y + v0 * g.vb.h;
      var u1 = (m.x - r.left) / r.width, v1 = (m.y - r.top) / r.height;
      vb = clamp({ x: gx - u1 * nw, y: gy - v1 * nh, w: nw, h: nh }); setVB();
    } else if (ptrs.size === 1 && !g.two && vb.w < W - 1) {
      var dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.started && Math.abs(dx) + Math.abs(dy) > 6) { g.started = true; drag.moved = true; hideTip(true); try { svg.setPointerCapture(e.pointerId); } catch (x) {} svg.classList.add("drag"); }
      if (g.started) { var k = g.vb.w / r.width; vb = clamp({ x: g.vb.x - dx * k, y: g.vb.y - dy * k, w: g.vb.w, h: g.vb.h }); setVB(); }
    }
  });
  function up(e) {
    ptrs.delete(e.pointerId);
    if (ptrs.size === 1) { var a = Array.from(ptrs.values())[0]; g = { two: false, x: a.x, y: a.y, vb: { x: vb.x, y: vb.y, w: vb.w, h: vb.h }, started: true }; }
    else if (!ptrs.size) { g = null; svg.classList.remove("drag"); setTimeout(function () { drag.moved = false; }, 0); }
  }
  svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", up);
  svg.addEventListener("wheel", function (e) { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomAt(Math.exp(-e.deltaY * 0.012), e.clientX, e.clientY); }, { passive: false });
  svg.addEventListener("dblclick", function (e) { if (idOf(e.target)) return; zoomAt(e.shiftKey ? 1 / 2 : 2, e.clientX, e.clientY); });

  // ---- list view ----
  function renderList() {
    listBody.textContent = "";
    var q = query.trim().toLowerCase(), any = false;
    [1, 2, 3].forEach(function (lv) {
      var items = D.countries.filter(function (c) { return c.level === lv && visible(c) && (!q || c.name.toLowerCase().indexOf(q) > -1); }).sort(function (a, b) { return a.name.localeCompare(b.name); });
      if (!items.length) return; any = true;
      var sec = h("section", "grp");
      var gh = h("h3", null, null); var dot = h("i"); dot.style.background = COLOR[lv]; gh.appendChild(dot);
      gh.appendChild(document.createTextNode(levelName(lv) + " · " + items.length));
      sec.appendChild(gh);
      items.forEach(function (c) {
        var row = h("div", "row");
        var b = h("button", "rowbtn", null, { type: "button", "aria-expanded": "false" });
        b.appendChild(h("span", "nm", c.name));
        if (c.since) b.appendChild(h("span", "mt", "Since " + c.since));
        b.appendChild(h("span", "chev", "›"));
        var panel = h("div", "rowdet"); panel.hidden = true; panel.appendChild(factList(c));
        b.addEventListener("click", function () { var o = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(o)); panel.hidden = !o; report(); });
        row.appendChild(b); row.appendChild(panel); sec.appendChild(row);
      });
      listBody.appendChild(sec);
    });
    if (!any) listBody.appendChild(h("p", "mm-empty", "No countries match."));
    report();
  }
  search.addEventListener("input", function () { query = search.value; renderList(); });

  function setView(v) {
    view = v; hideTip(true);
    bMap.setAttribute("aria-pressed", String(v === "map")); bList.setAttribute("aria-pressed", String(v === "list"));
    wrap.hidden = v !== "map"; list.hidden = v !== "list"; regionsBox.hidden = v !== "map"; hint.hidden = v !== "map";
    root.classList.toggle("is-list", v === "list"); report();
  }
  bMap.onclick = function () { setView("map"); }; bList.onclick = function () { setView("list"); };
  phone.addEventListener ? phone.addEventListener("change", function () { hint.textContent = phone.matches ? "Tap a highlighted country, pinch to zoom, or switch to the list." : "Hover over a highlighted country to see details about Brainerd’s engagement."; hideTip(true); }) : null;

  // ---- tell the web page around us how tall we are, so the frame fits with no scrollbar ----
  function report() {
    try { if (window.parent !== window) window.parent.postMessage({ source: "brainerd-missions-map", height: document.documentElement.scrollHeight }, "*"); } catch (e) {}
  }
  if (window.ResizeObserver) new ResizeObserver(report).observe(document.body);
  window.addEventListener("load", report); window.addEventListener("resize", report);

  setVB(); renderList();
  if (D.initial && (D.initial.level === 1 || D.initial.level === 2 || D.initial.level === 3)) setFilter(String(D.initial.level));
  if (D.initial && D.initial.view === "list") setView("list");
  report();
})();
