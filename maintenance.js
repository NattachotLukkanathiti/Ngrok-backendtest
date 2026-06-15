const BASE_URL = "https://mouse-afford-handbrake.ngrok-free.dev"; // เปลี่ยนพอร์ตให้ตรงกับ Backend ของคุณ
/* ─── CONFIG ─── */
const TOKEN_KEY  = "access_token";
const REFRESH_KEY = "refresh_token";

/* ─── STATE ─── */
let maintData     = [];
let alertData     = [];
let maintFilter   = "ALL";
let alertSeverity = "ALL";
let alertRtype    = "ALL";

/* ═══════════════════════════════════════════
   AUTH
═══════════════════════════════════════════ */
function getHeaders() {
  return { "Content-Type": "application/json", "Authorization": "Bearer " + localStorage.getItem(TOKEN_KEY) };
}

async function apiFetch(path) {
  let res = await fetch(`${BASE_URL}${path}`, { headers: getHeaders() });
  if (res.status === 401) {
    const j = await res.json().catch(() => ({}));
    if (j.error === "TOKEN_EXPIRED") {
      const ok = await refreshToken();
      if (ok) res = await fetch(`${BASE_URL}${path}`, { headers: getHeaders() });
    }
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function refreshToken() {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return false;
  const r = await fetch(`${BASE_URL}/refresh`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: rt }),
  });
  const j = await r.json();
  if (j.access_token) { localStorage.setItem(TOKEN_KEY, j.access_token); return true; }
  return false;
}

/* ═══════════════════════════════════════════
   FETCH
═══════════════════════════════════════════ */
async function fetchMaintenance() {
  try {
    const vehicles = await apiFetch("/vehicles");
    const all = [];
    await Promise.all(vehicles.map(async (v) => {
      try {
        const h = await apiFetch("/vehicles/" + v.id + "/history");
        for (const rec of h.history || []) {
          if (rec.type === "maintenance")
            all.push({ ...rec, vehicle_id: v.id, license_plate: v.license_plate, brand: v.brand, model: v.model });
        }
      } catch (_) {}
    }));
    maintData = all;
    renderMaintenance();
    updateStats();
  } catch (e) {
    document.getElementById("maint-list").innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

async function fetchAlerts() {
  try {
    const params = [];
    if (alertSeverity !== "ALL") params.push("severity=" + alertSeverity);
    if (alertRtype    !== "ALL") params.push("resource_type=" + alertRtype);
    const data = await apiFetch("/alerts" + (params.length ? "?" + params.join("&") : ""));
    alertData = data.alerts || [];
    renderAlerts();
  } catch (e) {
    document.getElementById("alert-list").innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

/* ═══════════════════════════════════════════
   CLASSIFY
═══════════════════════════════════════════ */
function classifyMaint(rec) {
  if (rec.status === "COMPLETED") return "COMPLETED";
  
  // 🌟 คำนวณจาก scheduled_at เทียบกับปัจจุบัน (แปลงเป็นหน่วย "วัน")
  const targetDate = new Date(rec.scheduled_at || rec.date);
  const diffDays = Math.ceil((targetDate - Date.now()) / 86400000);
  
  if (diffDays < 0)  return "OVERDUE";   // เลยกำหนด (Overdue)
  if (diffDays <= 7) return "DUE_SOON";  // ภายใน 7 วัน (Due Soon)
  return "NORMAL";                       // ปกติ
}

function diffLabel(rec) {
  const diffDays = Math.ceil((new Date(rec.date || rec.scheduled_at) - Date.now()) / 86400000);
  if (rec.status === "COMPLETED") return { label: "completed", cls: "day-normal" };
  if (diffDays < 0)  return { label: Math.abs(diffDays) + "d overdue", cls: "day-overdue" };
  if (diffDays === 0) return { label: "today", cls: "day-soon" };
  return { label: "in " + diffDays + "d", cls: "day-normal" };
}

/* ═══════════════════════════════════════════
   RENDER: MAINTENANCE
═══════════════════════════════════════════ */
function renderMaintenance() {
  const list = document.getElementById("maint-list");
  const order = { OVERDUE: 0, DUE_SOON: 1, NORMAL: 2, COMPLETED: 3 };
  const CHIP = { OVERDUE: "chip-overdue", DUE_SOON: "chip-soon", COMPLETED: "chip-completed", NORMAL: "chip-normal" };
  const CARD = { OVERDUE: "overdue", DUE_SOON: "due-soon" };

  let filtered = maintData
    .filter((r) => maintFilter === "ALL" || classifyMaint(r) === maintFilter)
    .sort((a, b) => order[classifyMaint(a)] - order[classifyMaint(b)]);

  if (!filtered.length) { list.innerHTML = '<div class="empty">no records found</div>'; return; }

  list.innerHTML = filtered.map((rec) => {
    const cls = classifyMaint(rec);
    const { label, cls: dayCls } = diffLabel(rec);
    const date = new Date(rec.date || rec.scheduled_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "2-digit" });
    return `
    <div class="m-card ${CARD[cls] || "normal"}">
      <div class="m-card-top">
        <div>
          <div class="m-card-id">#${(rec.id || "").slice(0, 8)}</div>
          <div class="m-card-type">${rec.maintenance_type || rec.type || "—"}</div>
          <div class="m-card-vehicle">${rec.license_plate || ""}${rec.brand ? " · " + rec.brand + " " + (rec.model || "") : ""}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="m-card-status-chip ${CHIP[cls] || "chip-normal"}">${rec.status || "—"}</span>
          <span class="day-label ${dayCls}">${label}</span>
        </div>
      </div>
      <div class="m-card-meta">
        <div class="m-meta-item"><span class="m-meta-label">scheduled</span><span class="m-meta-value">${date}</span></div>
        <div class="m-meta-item"><span class="m-meta-label">note</span><span class="m-meta-value" style="color:var(--text2)">${rec.note || "—"}</span></div>
      </div>
    </div>`;
  }).join("");
}

/* ═══════════════════════════════════════════
   RENDER: ALERTS
═══════════════════════════════════════════ */
function renderAlerts() {
  const list    = document.getElementById("alert-list");
  const countEl = document.getElementById("alert-count");
  const critCount = alertData.filter((a) => a.severity === "CRITICAL").length;

  countEl.textContent = alertData.length;
  countEl.className = "badge " + (critCount > 0 ? "badge-red" : alertData.length > 0 ? "badge-yellow" : "badge-green");

  if (!alertData.length) { list.innerHTML = '<div class="empty">no active alerts</div>'; return; }

  const sorted = [...alertData].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "CRITICAL" ? -1 : 1
  );

  list.innerHTML = sorted.map((a) => `
  <div class="alert-card alert-${a.severity.toLowerCase()}">
    <div class="alert-top">
      <span class="alert-severity sev-${a.severity.toLowerCase()}">${a.severity}</span>
      <span class="alert-rtype">${a.affected_resource_type}</span>
    </div>
    <div class="alert-msg">${a.message}</div>
    <div class="alert-time">${new Date(a.triggered_at).toLocaleTimeString("th-TH")} · ${(a.affected_resource_id || "").slice(0, 8)}</div>
  </div>`).join("");
}

/* ═══════════════════════════════════════════
   STATS
═══════════════════════════════════════════ */
function updateStats() {
  const active = maintData.filter((r) => r.status !== "COMPLETED");
  document.getElementById("s-overdue").textContent = active.filter((r) => classifyMaint(r) === "OVERDUE").length;
  document.getElementById("s-soon").textContent    = active.filter((r) => classifyMaint(r) === "DUE_SOON").length;
  document.getElementById("s-total").textContent   = maintData.filter((r) => r.status === "SCHEDULED").length;
}

/* ═══════════════════════════════════════════
   FILTER HANDLERS
═══════════════════════════════════════════ */
function setFilter(btn, f) {
  document.querySelectorAll(".filter-btn[data-f]").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  maintFilter = f;
  renderMaintenance();
}

function setAlertFilter(btn, s) {
  document.querySelectorAll(".af-btn[data-s]").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  alertSeverity = s;
  document.getElementById("alert-list").innerHTML = '<div class="loader"><div class="spin"></div>loading...</div>';
  fetchAlerts();
}

function setAlertRtype(btn, r) {
  document.querySelectorAll(".af-btn[data-r]").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  alertRtype = r;
  document.getElementById("alert-list").innerHTML = '<div class="loader"><div class="spin"></div>loading...</div>';
  fetchAlerts();
}

/* ═══════════════════════════════════════════
   REFRESH
═══════════════════════════════════════════ */
async function refreshAll() {
  document.getElementById("last-refresh").textContent = "refreshing...";
  document.getElementById("maint-list").innerHTML = '<div class="loader"><div class="spin"></div>loading...</div>';
  document.getElementById("alert-list").innerHTML = '<div class="loader"><div class="spin"></div>loading...</div>';
  await Promise.all([fetchMaintenance(), fetchAlerts()]);
  document.getElementById("last-refresh").textContent = "updated " + new Date().toLocaleTimeString("th-TH");
}

/* ═══════════════════════════════════════════
   INIT
═══════════════════════════════════════════ */
// localStorage.setItem("access_token",  "YOUR_TOKEN_HERE");
// localStorage.setItem("refresh_token", "YOUR_REFRESH_TOKEN_HERE");

document.getElementById("conn-dot").style.background = localStorage.getItem(TOKEN_KEY) ? "var(--green)" : "var(--red)";
refreshAll();
setInterval(refreshAll, 60000);
