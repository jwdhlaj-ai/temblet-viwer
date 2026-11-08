/* ============ CONFIG ============ */
const SUPABASE_URL = "https://cxenixsjocfvvwbtfaln.supabase.co";
const SUPABASE_KEY = "sb_publishable_JTEI2PGsZ8JIkRb8cyzKgg_P8K-hSAl";
const BRAND = "Templates";
const PAGE_TITLE = "All Templates";
const PAGE_SUBTITLE = "Browse our collection of templates";
const BUCKET = "template-previews";
const DEF_LANGS = ["HTML","CSS","JavaScript","Tailwind","Bootstrap","React","PHP","Python"];

/* ============ STATE + HELPERS ============ */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const safe = u => /^https?:\/\//i.test(u || "") ? u : "#";
const rnd = n => Math.random().toString(36).slice(2, 2 + n);
const slugify = s => String(s).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const XI = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
const MOON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const SUN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" fill="currentColor"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>';
const S = {cats:[],tpls:[],cat:"all",langs:new Set(),q:"",newest:true,loading:true,err:null,user:null,admin:false,tab:"templates",aq:"",ec:null,msg:""};
let sb;
const imgUrl = p => p ? sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl : "";
const pubList = () => S.tpls.filter(t => t.status === "published");
const catById = id => S.cats.find(c => c.id === id);
const activeCat = id => { const c = catById(id); return c && c.is_active ? c : null; };
const fmt = d => { try { return new Date(d).toLocaleDateString(); } catch (e) { return ""; } };

function toast(m, err) {
  const e = document.createElement("div");
  e.className = "ts" + (err ? " e" : ""); e.textContent = m;
  $("#toast").appendChild(e); setTimeout(() => e.remove(), 3000);
}
function getTheme() { try { return localStorage.getItem("theme") || "dark"; } catch (e) { return "dark"; } }
function setTheme(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("theme", t); } catch (e) {} }

/* ============ API (all Supabase calls) ============ */
async function loadData(silent) {
  if (!silent) { S.loading = true; S.err = null; route(); }
  try {
    const [c, t] = await Promise.all([
      sb.from("categories").select("*").order("name"),
      sb.from("templates").select("*").order("created_at", { ascending: false })
    ]);
    if (c.error) throw c.error;
    if (t.error) throw t.error;
    S.cats = c.data; S.tpls = t.data; S.err = null;
  } catch (e) { S.err = e.message || "Could not reach the server."; }
  S.loading = false; route();
}
async function setUser(session) {
  S.user = session ? session.user : null; S.admin = false;
  if (S.user) {
    try {
      const r = await sb.from("profiles").select("is_admin").eq("user_id", S.user.id).maybeSingle();
      S.admin = !!(r.data && r.data.is_admin);
    } catch (e) {}
    if (!S.admin) { S.msg = "This account is not an admin."; await sb.auth.signOut(); S.user = null; await loadData(); return; }
    else await loadData(true);
  }
  route();
}

/* ============ ROUTER ============ */
function route() { location.hash === "#admin" ? renderAdmin() : renderPublic(); }
window.addEventListener("hashchange", () => { route(); if (location.hash === "#admin" && S.admin) loadData(true); else if (location.hash !== "#admin") loadData(true); });

/* ============ RENDER PUBLIC ============ */
function renderPublic() {
  document.title = PAGE_TITLE;
  $("#app").innerHTML = `<div class="top"><div class="wrap"><nav class="nav"><b>${esc(BRAND)}</b><button class="ib" id="th" aria-label="Toggle theme">${getTheme() === "dark" ? SUN : MOON}</button></nav><h1>${esc(PAGE_TITLE)}</h1><p>${esc(PAGE_SUBTITLE)}</p></div></div>
  <div class="wrap"><div class="panel"><button class="btn out fb" id="fb">Filters</button><aside id="side"></aside><section><div class="bar"><b id="cnt"></b><input id="q" type="search" placeholder="Search templates..." aria-label="Search templates"><button class="btn out" id="so"></button></div><div class="grid" id="grid"></div></section></div></div>`;
  $("#q").value = S.q;
  $("#th").onclick = () => { setTheme(getTheme() === "dark" ? "light" : "dark"); $("#th").innerHTML = getTheme() === "dark" ? SUN : MOON; };
  $("#fb").onclick = () => $("#side").classList.toggle("open");
  $("#q").oninput = e => { S.q = e.target.value; updPublic(); };
  $("#so").onclick = () => { S.newest = !S.newest; updPublic(); };
  $("#side").onchange = e => {
    if (e.target.name === "cat") S.cat = e.target.value;
    else if (e.target.dataset.l) e.target.checked ? S.langs.add(e.target.dataset.l) : S.langs.delete(e.target.dataset.l);
    updPublic();
  };
  updPublic();
}
function updPublic() {
  if (!$("#grid")) return;
  const pub = pubList();
  const cc = {}, lc = {};
  pub.forEach(t => { if (activeCat(t.category_id)) cc[t.category_id] = (cc[t.category_id] || 0) + 1; (t.technologies || []).forEach(l => lc[l] = (lc[l] || 0) + 1); });
  const cats = S.cats.filter(c => c.is_active);
  $("#side").innerHTML = `<div class="box"><h3>Category</h3><label class="f"><input type="radio" name="cat" value="all" ${S.cat === "all" ? "checked" : ""}>All Templates<span>${pub.length}</span></label>${cats.map(c => `<label class="f"><input type="radio" name="cat" value="${esc(c.id)}" ${S.cat === c.id ? "checked" : ""}>${esc(c.name)}<span>${cc[c.id] || 0}</span></label>`).join("")}</div>
  <div class="box"><h3>Languages</h3>${Object.keys(lc).sort().map(l => `<label class="f"><input type="checkbox" data-l="${esc(l)}" ${S.langs.has(l) ? "checked" : ""}>${esc(l)}<span>${lc[l]}</span></label>`).join("") || '<span class="mut">No languages yet</span>'}</div>`;
  const k = S.q.trim().toLowerCase();
  const list = pub.filter(t => {
    const c = activeCat(t.category_id);
    if (S.cat !== "all" && t.category_id !== S.cat) return false;
    if (S.langs.size && !(t.technologies || []).some(l => S.langs.has(l))) return false;
    return !k || [t.title, t.description, (t.technologies || []).join(" "), c ? c.name : ""].join(" ").toLowerCase().includes(k);
  }).sort((a, b) => S.newest ? new Date(b.created_at) - new Date(a.created_at) : new Date(a.created_at) - new Date(b.created_at));
  $("#cnt").textContent = S.loading ? "Loading..." : list.length + (list.length === 1 ? " template" : " templates");
  $("#so").textContent = S.newest ? "Newest First" : "Oldest First";
  const g = $("#grid");
  if (S.loading) { g.innerHTML = Array(6).fill('<div class="card sk"><div class="img"></div><div class="cb"><h3>&nbsp;</h3><p>&nbsp;</p></div></div>').join(""); return; }
  if (S.err) { g.innerHTML = `<div class="empty"><p class="err">Could not load templates: ${esc(S.err)}</p><button class="btn pr" id="rt">Retry</button></div>`; $("#rt").onclick = () => loadData(); return; }
  if (!list.length) { g.innerHTML = `<div class="empty"><p>${pub.length ? "No templates match your filters." : "No templates yet."}</p>${pub.length ? '<button class="btn pr" id="rf">Reset filters</button>' : ""}</div>`; const r = $("#rf"); if (r) r.onclick = () => { S.cat = "all"; S.langs.clear(); S.q = ""; $("#q").value = ""; updPublic(); }; return; }
  g.innerHTML = list.map(t => {
    const c = activeCat(t.category_id), u = imgUrl(t.thumbnail_path), href = esc(safe(t.preview_url));
    return `<article class="card"><a class="img" href="${href}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(t.title)}">${u ? `<img src="${esc(u)}" alt="${esc(t.title)}" loading="lazy">` : '<span class="ph"></span>'}${c ? `<span class="badge">${esc(c.name)}</span>` : ""}</a><div class="cb"><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p><div class="tags">${(t.technologies || []).map(l => `<span class="tag">${esc(l)}</span>`).join("")}</div><a class="btn pr" href="${href}" target="_blank" rel="noopener noreferrer">View Template</a></div></article>`;
  }).join("");
}

/* ============ RENDER ADMIN ============ */
function renderAdmin() {
  document.title = "Admin";
  if (!S.user || !S.admin) {
    $("#app").innerHTML = `<form class="login" id="lf"><h2>Admin sign in</h2><label class="fl" for="le">Email</label><input id="le" type="email" required autocomplete="username"><label class="fl" for="lp">Password</label><input id="lp" type="password" required autocomplete="current-password"><div class="ferr" id="lm">${esc(S.msg)}</div><div class="row"><button class="btn pr" id="lb" style="flex:1">Sign in</button><a class="btn out" href="#" onclick="location.hash='';return false">Back</a></div></form>`;
    $("#lf").onsubmit = async e => {
      e.preventDefault(); S.msg = ""; $("#lb").disabled = true;
      try {
        const r = await sb.auth.signInWithPassword({ email: $("#le").value.trim(), password: $("#lp").value });
        if (r.error) throw r.error;
      } catch (x) { $("#lm").textContent = x.message || "Sign in failed"; $("#lb").disabled = false; }
    };
    return;
  }
  $("#app").innerHTML = `<div class="wrap adm"><div class="ab"><h2>Admin</h2><button class="btn out" data-a="site">View Site</button><button class="btn out" data-a="logout">Logout</button></div><div class="tabs"><button class="tab ${S.tab === "templates" ? "on" : ""}" data-a="tab" data-t="templates">Templates</button><button class="tab ${S.tab === "categories" ? "on" : ""}" data-a="tab" data-t="categories">Categories</button></div><div id="tabc"></div></div>`;
  S.tab === "templates" ? tabTpl() : tabCat();
}
function tabTpl() {
  $("#tabc").innerHTML = `<div class="tb"><input id="aq" type="search" placeholder="Search templates..." aria-label="Search templates" value="${esc(S.aq)}"><button class="btn pr" data-a="add" style="white-space:nowrap">+ Add Template</button></div><div class="tbl"><div class="tr th"><span></span><span>Name</span><span>Category</span><span>Languages</span><span>Status</span><span>Added</span><span>Actions</span></div><div id="rows"></div></div>`;
  $("#aq").oninput = e => { S.aq = e.target.value; rows(); };
  rows();
}
function rows() {
  const k = S.aq.toLowerCase();
  const l = S.tpls.filter(t => !k || ((t.title || "") + " " + (t.description || "") + " " + (t.technologies || []).join(" ")).toLowerCase().includes(k));
  $("#rows").innerHTML = l.map(t => {
    const c = catById(t.category_id), u = imgUrl(t.thumbnail_path), p = t.status === "published";
    return `<div class="tr">${u ? `<img src="${esc(u)}" alt="">` : '<span class="ph"></span>'}<b>${esc(t.title)}</b><span>${c ? esc(c.name) : "-"}</span><span>${esc((t.technologies || []).join(", "))}</span><span class="st ${p ? "p" : "d"}">${p ? "Published" : "Draft"}</span><span class="mut">${fmt(t.created_at)}</span><span class="acts"><button class="btn out sm" data-a="edit" data-id="${t.id}">Edit</button><button class="btn out sm" data-a="tog" data-id="${t.id}">${p ? "Unpublish" : "Publish"}</button><button class="btn danger sm" data-a="del" data-id="${t.id}">Delete</button></span></div>`;
  }).join("") || '<div class="empty">No templates yet. Add your first one.</div>';
}
function tabCat() {
  $("#tabc").innerHTML = `<form class="tb" id="cf"><input id="cn" placeholder="New category name" maxlength="40" aria-label="New category name"><button class="btn pr" style="white-space:nowrap">Add Category</button></form><div class="cl">${S.cats.map(c => {
    const n = S.tpls.filter(t => t.category_id === c.id).length, ed = S.ec === c.id;
    return `<div class="cr">${ed ? `<input class="ci" id="ce" value="${esc(c.name)}" maxlength="40">` : `<b>${esc(c.name)}</b>`}<span class="mut">${n} template${n === 1 ? "" : "s"}</span><label class="sw"><input type="checkbox" data-a="act" data-id="${c.id}" ${c.is_active ? "checked" : ""}>${c.is_active ? "Visible" : "Hidden"}</label><button class="btn out sm" data-a="ren" data-id="${c.id}">${ed ? "Save" : "Rename"}</button><button class="btn danger sm" data-a="dc" data-id="${c.id}">Delete</button></div>`;
  }).join("") || '<div class="empty">No categories yet. Add one above.</div>'}</div>`;
  $("#cf").onsubmit = async e => {
    e.preventDefault();
    const name = $("#cn").value.trim(); if (!name) return;
    const base = slugify(name) || "category";
    let r = await sb.from("categories").insert({ name, slug: base });
    if (r.error && r.error.code === "23505") r = await sb.from("categories").insert({ name, slug: base + "-" + rnd(4) });
    if (r.error) return toast(r.error.message, true);
    toast("Category added"); loadData(true);
  };
  const ce = $("#ce");
  if (ce) { ce.focus(); ce.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); saveCatName(S.ec); } if (e.key === "Escape") { e.stopPropagation(); S.ec = null; tabCat(); } }; }
}
async function saveCatName(id) {
  const name = $("#ce").value.trim(); if (!name) return toast("Name cannot be empty", true);
  const r = await sb.from("categories").update({ name }).eq("id", id);
  if (r.error) return toast(r.error.message, true);
  S.ec = null; toast("Category renamed"); loadData(true);
}

/* ============ MODALS ============ */
let mo = null;
function openModal(o) {
  const prev = document.activeElement;
  const el = document.createElement("div");
  el.className = "ov" + (o.small ? " small" : "");
  el.innerHTML = `<div class="bd"></div><div class="mp" role="dialog" aria-modal="true" aria-label="${esc(o.title)}"><div class="mh"><h2>${esc(o.title)}</h2><button class="xbtn" aria-label="Close" data-close>${XI}</button></div><div class="mb">${o.body}</div><div class="mf">${o.foot}</div></div>`;
  const m = { el, o, prev, parent: mo };
  el.querySelector(".bd").onclick = () => closeReq(m);
  el.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => closeReq(m)));
  (o.small ? document.body : $("#modal")).appendChild(el);
  mo = m;
  const f = el.querySelector("input,textarea,select,button.btn"); if (f) f.focus();
  return m;
}
function closeModal(m) { m.el.remove(); if (mo === m) mo = m.parent; if (m.prev && m.prev.focus) m.prev.focus(); }
async function closeReq(m) {
  if (m.o.dirty && m.o.dirty() && !(await confirmBox("Close without saving?", "Close", true))) return;
  closeModal(m);
}
function confirmBox(msg, ok, plain) {
  return new Promise(res => {
    const m = openModal({ title: msg, small: true, body: "", foot: `<button class="btn out" data-close>Cancel</button><button class="btn ${plain ? "pr" : "danger"}" id="cok">${esc(ok)}</button>` });
    m.o.dirty = null; m.cb = res;
    m.el.querySelector("#cok").onclick = () => { closeModal(m); res(true); };
    m.el.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => res(false)));
    m.el.querySelector(".bd").addEventListener("click", () => res(false));
    m.el.querySelector(".mb").remove();
  });
}
document.addEventListener("keydown", e => {
  if (!mo) return;
  if (e.key === "Escape") { e.preventDefault(); const m = mo; if (m.cb) { closeModal(m); m.cb(false); } else closeReq(m); }
  if (e.key === "Tab") {
    const f = [...mo.el.querySelectorAll("button,input,select,textarea,a[href]")].filter(x => !x.disabled && x.offsetParent !== null);
    if (!f.length) return;
    const a = f[0], z = f[f.length - 1];
    if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
  }
});

function resize(f) {
  return new Promise((ok, no) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const w = Math.min(800, im.width), h = Math.round(im.height * w / im.width), c = document.createElement("canvas");
        c.width = w; c.height = h;
        const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        c.toBlob(b => b ? ok(b) : no(new Error("Image conversion failed")), "image/jpeg", 0.82);
      };
      im.onerror = () => no(new Error("Unreadable image"));
      im.src = r.result;
    };
    r.onerror = () => no(new Error("Could not read the file"));
    r.readAsDataURL(f);
  });
}

function openTpl(id) {
  if (!S.cats.length) { toast("Add a category first", true); S.tab = "categories"; renderAdmin(); return; }
  const t = id ? S.tpls.find(x => x.id === id) : null;
  let dirty = false, file = null;
  const L = new Set(t ? t.technologies || [] : []);
  const all = [...DEF_LANGS]; L.forEach(l => { if (!all.includes(l)) all.push(l); });
  const body = `<div class="tf"><div><label class="fl">Image</label><div class="drop" id="dz" tabindex="0" role="button" aria-label="Choose image"></div><input type="file" id="fi" accept="image/*" hidden></div>
  <div><label class="fl" for="fn">Name *</label><input id="fn" maxlength="120" value="${esc(t ? t.title : "")}">
  <label class="fl" for="fu">Template Link *</label><input id="fu" type="url" placeholder="https://" value="${esc(t ? t.preview_url : "")}">
  <label class="fl" for="fd">Description</label><textarea id="fd" rows="3">${esc(t ? t.description : "")}</textarea>
  <label class="fl" for="fc">Category *</label><select id="fc">${S.cats.map(c => `<option value="${esc(c.id)}" ${t && t.category_id === c.id ? "selected" : ""}>${esc(c.name)}${c.is_active ? "" : " (hidden)"}</option>`).join("")}</select>
  <label class="fl">Languages</label><div class="tg" id="lg"></div><div class="row"><input id="lc" placeholder="Add another language" maxlength="30"><button type="button" class="btn out sm" id="la">Add</button></div>
  <label class="pubrow"><input type="checkbox" id="fp" ${!t || t.status === "published" ? "checked" : ""}>Published (visible to clients)</label><div class="ferr" id="fe"></div></div></div>`;
  const m = openModal({ title: t ? "Edit Template" : "Add Template", body, foot: `<button class="btn out" data-close>Cancel</button><button class="btn pr" id="sv">Save</button>`, dirty: () => dirty });
  const q = s => m.el.querySelector(s);
  const dz = q("#dz");
  const drawImg = src => { dz.innerHTML = src ? `<img src="${esc(src)}" alt="Preview">` : "Click or drop an image here"; };
  drawImg(t ? imgUrl(t.thumbnail_path) : "");
  const drawL = () => { q("#lg").innerHTML = all.map(l => `<button type="button" class="lt ${L.has(l) ? "on" : ""}" data-l="${esc(l)}" aria-pressed="${L.has(l)}">${esc(l)}</button>`).join(""); };
  drawL();
  q("#lg").onclick = e => { const b = e.target.closest("[data-l]"); if (!b) return; const l = b.dataset.l; L.has(l) ? L.delete(l) : L.add(l); dirty = true; drawL(); };
  const addL = () => { const v = q("#lc").value.trim(); if (!v) return; if (!all.some(x => x.toLowerCase() === v.toLowerCase())) all.push(v); const ex = all.find(x => x.toLowerCase() === v.toLowerCase()); L.add(ex); q("#lc").value = ""; dirty = true; drawL(); };
  q("#la").onclick = addL;
  q("#lc").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); addL(); } };
  const pick = f => {
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("Choose an image file", true);
    file = f; dirty = true;
    const r = new FileReader(); r.onload = () => drawImg(r.result); r.readAsDataURL(f);
  };
  dz.onclick = () => q("#fi").click();
  dz.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); q("#fi").click(); } };
  q("#fi").onchange = e => pick(e.target.files[0]);
  dz.ondragover = e => { e.preventDefault(); dz.classList.add("on"); };
  dz.ondragleave = () => dz.classList.remove("on");
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove("on"); pick(e.dataTransfer.files[0]); };
  m.el.querySelector(".tf").addEventListener("input", () => dirty = true);
  q("#sv").onclick = async () => {
    const err = q("#fe"), btn = q("#sv"); err.textContent = "";
    const title = q("#fn").value.trim(), url = q("#fu").value.trim();
    if (!title) return err.textContent = "Name is required.";
    if (!/^https?:\/\//i.test(url)) return err.textContent = "The link must start with http:// or https://";
    btn.disabled = true; btn.textContent = "Saving...";
    let newPath = null;
    try {
      const row = { title, preview_url: url, description: q("#fd").value.trim(), category_id: q("#fc").value, technologies: [...L], status: q("#fp").checked ? "published" : "draft" };
      if (file) {
        const blob = await resize(file);
        newPath = Date.now() + "-" + rnd(6) + ".jpg";
        const up = await sb.storage.from(BUCKET).upload(newPath, blob, { contentType: "image/jpeg" });
        if (up.error) { newPath = null; throw up.error; }
        row.thumbnail_path = newPath;
      }
      let r;
      if (t) r = await sb.from("templates").update(row).eq("id", t.id);
      else r = await sb.from("templates").insert({ ...row, slug: (slugify(title) || "template") + "-" + rnd(5), created_by: S.user.id });
      if (r.error) throw r.error;
      if (t && newPath && t.thumbnail_path) await sb.storage.from(BUCKET).remove([t.thumbnail_path]);
      dirty = false; closeModal(m); toast("Template saved"); loadData(true);
    } catch (x) {
      if (newPath) await sb.storage.from(BUCKET).remove([newPath]);
      err.textContent = "Could not save: " + (x.message || x);
      btn.disabled = false; btn.textContent = "Save";
    }
  };
}

/* ============ ADMIN ACTIONS ============ */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a, id = b.dataset.id;
  if (a === "tab") { S.tab = b.dataset.t; S.ec = null; renderAdmin(); }
  else if (a === "site") location.hash = "";
  else if (a === "logout") { await sb.auth.signOut(); S.msg = ""; }
  else if (a === "add") openTpl();
  else if (a === "edit") openTpl(id);
  else if (a === "tog") {
    const t = S.tpls.find(x => x.id === id);
    const r = await sb.from("templates").update({ status: t.status === "published" ? "draft" : "published" }).eq("id", id);
    r.error ? toast(r.error.message, true) : (toast("Status updated"), loadData(true));
  } else if (a === "del") {
    const t = S.tpls.find(x => x.id === id);
    if (!await confirmBox("Delete this template?", "Delete")) return;
    const r = await sb.from("templates").delete().eq("id", id);
    if (r.error) return toast(r.error.message, true);
    if (t.thumbnail_path) await sb.storage.from(BUCKET).remove([t.thumbnail_path]);
    toast("Template deleted"); loadData(true);
  } else if (a === "act") {
    const r = await sb.from("categories").update({ is_active: b.checked }).eq("id", id);
    r.error ? toast(r.error.message, true) : loadData(true);
  } else if (a === "ren") {
    if (S.ec === id) saveCatName(id); else { S.ec = id; tabCat(); }
  } else if (a === "dc") {
    if (S.tpls.some(t => t.category_id === id)) return toast("Move its templates first", true);
    if (!await confirmBox("Delete this category?", "Delete")) return;
    const r = await sb.from("categories").delete().eq("id", id);
    r.error ? toast(r.error.message, true) : (toast("Category deleted"), loadData(true));
  }
});

/* ============ INIT ============ */
(async function init() {
  setTheme(getTheme());
  if (!window.supabase) { $("#app").innerHTML = '<p class="empty err">Could not load the Supabase library. Check your connection.</p>'; return; }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  sb.auth.onAuthStateChange((ev, session) => setTimeout(() => setUser(session), 0));
  const r = await sb.auth.getSession();
  if (!r.data.session) loadData();
})();