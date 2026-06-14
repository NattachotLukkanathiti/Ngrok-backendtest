
const formState = {
  vehicle_id: "", driver_id: "", started_at: "",
  origin: "", destination: "", distance_km: "",
  cargo_type: "", cargo_weight_kg: "",
  checkpoints: []
};

let currentStep = 1;
let cpCount = 0;

// ✅ FIX: เก็บ tripId ระดับ module แทน regex parse DOM
let currentTripId = null;

// ============================================================
// LOAD TRIPS
// ============================================================
// ============================================================
// LOAD TRIPS
// ============================================================
async function loadTrips() {
  const res = await fetchWithAuth(`${BASE_URL}/trips`);
  if (!res) return;
  const rawData = await res.json();
  
  // ✅ 1. ดักจับเผื่อข้อมูลถูกห่ออยู่ใน .data
  let trips = Array.isArray(rawData) ? rawData : (rawData.data || []);

  // ✅ 2. กรองข้อมูลขยะทิ้ง (เอาเฉพาะตัวที่เป็น Object จริงๆ)
  trips = trips.filter(t => t && typeof t === 'object');

  trips = await Promise.all(trips.map(async (t) => {
    // ✅ 3. เช็คให้ชัวร์ว่ามี t.id ก่อน ถึงจะยิงไปดึง Detail (ป้องกัน /trips/undefined)
    if (t.status === "IN_PROGRESS" && t.id) {
      try {
        const detailRes = await fetchWithAuth(`${BASE_URL}/trips/${t.id}`);
        if (detailRes && detailRes.ok) {
          const detail = await detailRes.json();
          t.checkpoints = detail.checkpoints || [];
        }
      } catch (e) { console.error("โหลด detail ไม่ได้", e); }
    }
    return t;
  }));

  renderTrips(trips);
}

// ============================================================
// RENDER TRIPS — คำนวณ % แบบละเอียด (1 จุด = 2 สเตป)
// ============================================================
function renderTrips(list) {
  const el = document.getElementById("trip-list");
  if (!list || !list.length) { el.innerHTML = '<p class="loading-text">ไม่มี Trip</p>'; return; }

  el.innerHTML = list.map(t => {
    // ✅ 1. ดักจับ status เผื่อ API ส่งมาแหว่ง (ป้องกัน toLowerCase พัง)
    const status = t.status || "UNKNOWN";
    const statusClass = status.toLowerCase().replace("_", "-");
    const canComplete = status === "IN_PROGRESS";
    
    // ✅ 2. ดักจับ id เผื่อไม่มี
    const tripId = t.id || "";

    let percent = 0;
    let progressText = "";

    if (status === "COMPLETED") {
      percent = 100;
      progressText = `เสร็จสิ้นภารกิจ (${t.distance_km || 0} km)`;
    } else if (status === "IN_PROGRESS" && Array.isArray(t.checkpoints)) {
      let passedSteps = 0;
      const totalSteps = t.checkpoints.length * 2;
      t.checkpoints.forEach(c => {
        const cStatus = c.status || "";
        if (cStatus === "ARRIVED")                               passedSteps += 1;
        else if (cStatus === "DEPARTED" || cStatus === "SKIPPED") passedSteps += 2;
      });
      percent = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0;
      const completedCps = Math.floor(passedSteps / 2);
      progressText = `ผ่านแล้ว ${completedCps} / ${t.checkpoints.length} จุด`;
    } else {
      percent = 0;
      progressText = status === "IN_PROGRESS" ? "กำลังเริ่ม..." : "รอเริ่มเดินทาง";
    }

    percent = Math.min(100, percent);
    const isDone = percent === 100 || status === "COMPLETED";

    let progressHTML = "";
    if (status === "IN_PROGRESS" || status === "COMPLETED") {
      progressHTML = `
        <div class="trip-progress ${isDone ? "trip-progress--done" : ""}">
          <div class="trip-progress__labels"><span>จุดเริ่มต้น</span><span>ปลายทาง</span></div>
          <div class="trip-progress__track">
            <div class="trip-progress__fill" style="width: ${percent}%;">
              <div class="trip-progress__icon">${isDone ? "🏁" : "🚚"}</div>
            </div>
          </div>
          <div class="trip-progress__detail">${progressText} <span>(${percent}%)</span></div>
        </div>`;
    }

    return `
    <div class="trip-card">
      <div class="trip-card__header">
        <div>
          <div class="trip-card__route">${t.origin || "ไม่ระบุต้นทาง"} → ${t.destination || "ไม่ระบุปลายทาง"}</div>
          <div style="margin-top:4px"><span class="badge badge--${statusClass}">${status}</span></div>
        </div>
      </div>
      ${progressHTML}
      <div class="trip-card__meta">
        <span>🚛 ${t.license_plate || "-"} ${t.brand || ""} ${t.model || ""}</span>
        <span>👤 ${t.driver_name || "-"}</span>
        ${t.distance_km ? `<span>📏 ${Number(t.distance_km).toLocaleString()} km</span>` : ""}
        ${t.cargo_type  ? `<span>📦 ${t.cargo_type}</span>` : ""}
        <span>🗓 ${t.started_at ? String(t.started_at).substring(0, 10) : "-"}</span>
      </div>
      <div class="trip-card__actions">
        <button class="btn btn--ghost btn--sm" onclick="openTracker('${tripId}')" ${!tripId ? 'disabled' : ''}>📍 Tracker</button>
        ${canComplete ? `<button class="btn btn--complete btn--sm" onclick="completeTrip('${tripId}')" ${!tripId ? 'disabled' : ''}>✓ Complete</button>` : ""}
      </div>
    </div>`;
  }).join("");
}

// ============================================================
// COMPLETE TRIP
// ============================================================
async function completeTrip(tripId) {
  if (!confirm("Complete trip นี้? mileage จะถูกอัปเดตอัตโนมัติ")) return;
  const res = await fetchWithAuth(`${BASE_URL}/trips/${tripId}/complete`, { method: "PATCH" });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) { alert(data.error?.message || "เกิดข้อผิดพลาด"); return; }
  let msg = `✅ Trip completed!\nMileage ใหม่: ${Number(data.new_mileage_km).toLocaleString()} km`;
  if (data.maintenance_triggered) msg += "\n⚠️ " + data.message;
  alert(msg);
  loadTrips();
}

// ============================================================
// MODAL CREATE
// ============================================================
// ============================================================
// MODAL CREATE
// ============================================================
async function openCreateModal() {
  const [vRes, dRes] = await Promise.all([
    fetchWithAuth(`${BASE_URL}/vehicles`),
    fetchWithAuth(`${BASE_URL}/drivers`)
  ]);
  if (!vRes || !dRes) return;
  
  const vehiclesData = await vRes.json();
  const driversData  = await dRes.json();

  const vList = Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData.data || []);
  const dList = Array.isArray(driversData) ? driversData : (driversData.data || []);

  // พิมพ์ข้อมูลออกมาดูใน Console (กด F12) เพื่อเช็คว่า Backend ส่งอะไรมาจริงๆ
  console.log("🚚 ข้อมูลรถจาก Backend:", vList);
  console.log("👤 ข้อมูลคนขับจาก Backend:", dList);

  const vSel = document.getElementById("f-vehicle");
  const dSel = document.getElementById("f-driver");
  
  // 1. จัดการ Dropdown ยานพาหนะ
  vSel.innerHTML = '<option value="">-- เลือกยานพาหนะ --</option>' +
    vList.filter(v => {
      // ดักจับสถานะให้เป็นตัวพิมพ์ใหญ่ก่อนเช็ค เผื่อ Backend ส่งมาเป็นพิมพ์เล็ก
      const st = (v.status || "").toUpperCase();
      // ยอมให้แสดงถ้ารถว่าง (IDLE/AVAILABLE/ACTIVE) หรือไม่มีสถานะแนบมา
      return st === "IDLE" || st === "ACTIVE" || st === "AVAILABLE" || !v.status;
    })
    .map(v => {
      // ดักจับชื่อ Key เผื่อ Backend ใช้ชื่ออื่น
      const plate = v.license_plate || v.plate_number || v.plate || "ไม่ระบุทะเบียน";
      const brand = v.brand || "";
      const model = v.model || "";
      const status = v.status || "UNKNOWN";
      return `<option value="${v.id}">${plate} ${brand} ${model} (${status})</option>`;
    })
    .join("");
         
  // 2. จัดการ Dropdown คนขับ
  dSel.innerHTML = '<option value="">-- เลือกคนขับ --</option>' +
    dList.map(d => {
      // ดักจับชื่อ Key เผื่อ Backend ใช้ชื่ออื่น
      const name = d.name || d.full_name || d.first_name || "ไม่ทราบชื่อ";
      const license = d.license_number || d.license || "-";
      return `<option value="${d.id}">${name} (${license})</option>`;
    })
    .join("");

  if (formState.vehicle_id)      vSel.value = formState.vehicle_id;
  if (formState.driver_id)       dSel.value = formState.driver_id;
  if (formState.started_at)      document.getElementById("f-started_at").value      = formState.started_at;
  if (formState.origin)          document.getElementById("f-origin").value          = formState.origin;
  if (formState.destination)     document.getElementById("f-destination").value     = formState.destination;
  if (formState.distance_km)     document.getElementById("f-distance_km").value     = formState.distance_km;
  if (formState.cargo_type)      document.getElementById("f-cargo_type").value      = formState.cargo_type;
  if (formState.cargo_weight_kg) document.getElementById("f-cargo_weight_kg").value = formState.cargo_weight_kg;

  const container = document.getElementById("checkpoints-container");
  container.innerHTML = "";
  cpCount = 0;
  formState.checkpoints.forEach(cp => addCheckpointRow(cp));
  if (formState.checkpoints.length === 0) addCheckpointRow();

  document.getElementById("modal-create").style.display = "flex";
  goStepRender(1);
}

function closeCreateModal() {
  document.getElementById("modal-create").style.display = "none";
}

function goStep(n) {
  if (n < 1 || n > 3) return;
  if (n > currentStep && !validateStep(currentStep)) return;
  saveStepState(currentStep);
  goStepRender(n);
}

function goStepRender(n) {
  currentStep = n;
  [1, 2, 3].forEach(i => {
    document.getElementById(`step-${i}`).style.display = i === n ? "block" : "none";
    const ind = document.getElementById(`step-ind-${i}`);
    ind.className = "step" + (i === n ? " step--active" : i < n ? " step--done" : "");
  });
}

function validateStep(n) {
  clearErrors();
  if (n === 1) {
    let ok = true;
    if (!document.getElementById("f-vehicle").value)    { showErr("err-vehicle",    "กรุณาเลือกยานพาหนะ"); ok = false; }
    if (!document.getElementById("f-driver").value)     { showErr("err-driver",     "กรุณาเลือกคนขับ"); ok = false; }
    if (!document.getElementById("f-started_at").value) { showErr("err-started_at", "กรุณาระบุวันที่เริ่มต้น"); ok = false; }
    return ok;
  }
  if (n === 2) {
    let ok = true;
    if (!document.getElementById("f-origin").value.trim())      { showErr("err-origin",      "กรุณาระบุต้นทาง"); ok = false; }
    if (!document.getElementById("f-destination").value.trim()) { showErr("err-destination", "กรุณาระบุปลายทาง"); ok = false; }
    return ok;
  }
  return true;
}

function saveStepState(n) {
  if (n === 1) {
    formState.vehicle_id = document.getElementById("f-vehicle").value;
    formState.driver_id  = document.getElementById("f-driver").value;
    formState.started_at = document.getElementById("f-started_at").value;
  }
  if (n === 2) {
    formState.origin          = document.getElementById("f-origin").value.trim();
    formState.destination     = document.getElementById("f-destination").value.trim();
    formState.distance_km     = document.getElementById("f-distance_km").value;
    formState.cargo_type      = document.getElementById("f-cargo_type").value;
    formState.cargo_weight_kg = document.getElementById("f-cargo_weight_kg").value;
  }
  if (n === 3) { formState.checkpoints = collectCheckpoints(); }
}

function clearErrors() {
  document.querySelectorAll(".field-error").forEach(el => el.textContent = "");
  document.getElementById("submit-error").textContent = "";
}
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}

// ============================================================
// CHECKPOINTS
// ============================================================
function addCheckpoint() {
  formState.checkpoints = collectCheckpoints();
  addCheckpointRow();
}

function addCheckpointRow(data = {}) {
  cpCount++;
  const container = document.getElementById("checkpoints-container");
  const div = document.createElement("div");
  div.className = "cp-item";
  div.innerHTML = `
    <div class="cp-item__header">
      <span class="cp-item__num">จุดที่ ${cpCount}</span>
      <button class="btn btn--ghost btn--sm" onclick="removeCheckpoint(this)">✕</button>
    </div>
    <div class="cp-item__grid">
      <div class="form-group" style="grid-column:span 2">
        <label>ชื่อสถานที่ <span class="req">*</span></label>
        <input type="text" name="cp-location" placeholder="เช่น ด่านขนส่งนครสวรรค์" value="${data.location_name || ""}">
      </div>
      <div class="form-group">
        <label>Latitude</label>
        <input type="number" name="cp-lat" step="any" value="${data.latitude || ""}">
      </div>
      <div class="form-group">
        <label>Longitude</label>
        <input type="number" name="cp-lng" step="any" value="${data.longitude || ""}">
      </div>
      <div class="form-group">
        <label>วัตถุประสงค์</label>
        <select name="cp-purpose">
          <option value="">--</option>
          ${["FUEL","REST","DELIVERY","PICKUP","INSPECTION"].map(p =>
            `<option${data.purpose === p ? " selected" : ""}>${p}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>หมายเหตุ</label>
        <input type="text" name="cp-notes" value="${data.notes || ""}">
      </div>
    </div>`;
  container.appendChild(div);
}

function removeCheckpoint(btn) {
  btn.closest(".cp-item").remove();
  document.querySelectorAll(".cp-item .cp-item__num").forEach((el, i) => {
    el.textContent = `จุดที่ ${i + 1}`;
  });
}

function collectCheckpoints() {
  return Array.from(document.querySelectorAll(".cp-item")).map(item => ({
    location_name: item.querySelector('[name="cp-location"]').value.trim(),
    latitude:  item.querySelector('[name="cp-lat"]').value     || null,
    longitude: item.querySelector('[name="cp-lng"]').value     || null,
    purpose:   item.querySelector('[name="cp-purpose"]').value || null,
    notes:     item.querySelector('[name="cp-notes"]').value   || null,
  }));
}

// ============================================================
// SUBMIT TRIP
// ============================================================
async function submitTrip() {
  saveStepState(3);
  const cps = formState.checkpoints.length ? formState.checkpoints : collectCheckpoints();

  if (!cps.length || !cps[0].location_name) {
    showErr("err-checkpoints", "กรุณาเพิ่ม Checkpoint อย่างน้อย 1 จุด");
    return;
  }
  for (const cp of cps) {
    if (!cp.location_name) { showErr("err-checkpoints", "กรุณาระบุชื่อสถานที่ทุก Checkpoint"); return; }
  }

  const body = {
    vehicle_id:      formState.vehicle_id,
    driver_id:       formState.driver_id,
    started_at:      formState.started_at,
    origin:          formState.origin,
    destination:     formState.destination,
    distance_km:     formState.distance_km     ? parseFloat(formState.distance_km)     : null,
    cargo_type:      formState.cargo_type      || null,
    cargo_weight_kg: formState.cargo_weight_kg ? parseFloat(formState.cargo_weight_kg) : null,
    checkpoints:     cps,
  };

  const res = await fetchWithAuth(`${BASE_URL}/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res) return;
  const data = await res.json();
  if (!res.ok) {
    const err = data.error || {};
    document.getElementById("submit-error").textContent =
      err.message + (err.details ? " — " + JSON.stringify(err.details) : "");
    return;
  }

  Object.assign(formState, {
    vehicle_id:"", driver_id:"", started_at:"",
    origin:"", destination:"", distance_km:"",
    cargo_type:"", cargo_weight_kg:"", checkpoints:[]
  });
  cpCount = 0;
  closeCreateModal();
  loadTrips();
}

// ============================================================
// TRACKER
// ============================================================
async function openTracker(tripId) {
  currentTripId = tripId; // ✅ set ก่อนเปิด modal
  document.getElementById("modal-tracker").style.display = "flex";
  await renderTracker(tripId);
}

function closeTracker() {
  document.getElementById("modal-tracker").style.display = "none";
  currentTripId = null;
}

async function renderTracker(tripId) {
  const el = document.getElementById("tracker-content");
  el.innerHTML = '<p class="loading-text">กำลังโหลด...</p>';

  const res = await fetchWithAuth(`${BASE_URL}/trips/${tripId}`);
  if (!res) return;
  const trip = await res.json();
  if (trip.error) { el.innerHTML = `<p class="loading-text">${trip.error.message}</p>`; return; }

  const cps = trip.checkpoints || [];

  // คำนวณ % แบบละเอียดสำหรับ tracker modal (1 จุด = 2 สเตป)
  let passedSteps = 0;
  const totalSteps = cps.length * 2;
  cps.forEach(c => {
    if (c.status === "ARRIVED")                               passedSteps += 1;
    else if (c.status === "DEPARTED" || c.status === "SKIPPED") passedSteps += 2;
  });
  const percent = totalSteps > 0 ? Math.round((passedSteps / totalSteps) * 100) : 0;

  el.innerHTML = `
    <div class="tracker-header">
      <div class="tracker-title">${trip.origin} → ${trip.destination}</div>
      <div class="tracker-meta">
        <span class="badge badge--${trip.status.toLowerCase().replace("_","-")}">${trip.status}</span>
        <span>🚛 ${trip.license_plate||""} ${trip.brand||""} ${trip.model||""}</span>
        <span>👤 ${trip.driver_name||"-"}</span>
        ${trip.distance_km ? `<span>📏 ${Number(trip.distance_km).toLocaleString()} km</span>` : ""}
        ${trip.cargo_type  ? `<span>📦 ${trip.cargo_type}</span>` : ""}
      </div>
    </div>

    <div class="trip-progress" style="margin: 20px 0;">
      <div class="trip-progress__track">
        <div class="trip-progress__fill" style="width: ${percent}%;">
          <div class="trip-progress__icon">${percent === 100 ? "🏁" : "🚚"}</div>
        </div>
      </div>
      <div class="trip-progress__detail" style="text-align:center; margin-top:8px">
        ความคืบหน้า <strong>${percent}%</strong>
      </div>
    </div>

    <div class="checkpoint-steps" id="cp-steps">
      ${cps.map((cp, i) => renderCpStep(cp, i, trip.status === "IN_PROGRESS")).join("")}
    </div>
    ${trip.status === "IN_PROGRESS" ? `
      <div class="tracker-complete-btn">
        <button class="btn btn--complete" onclick="completeTrip('${trip.id}');closeTracker()">
          ✓ Complete Trip
        </button>
      </div>` : ""}
  `;
}

// ── render checkpoint step ──
function renderCpStep(cp, index, canEdit) {
  const st = cp.status.toLowerCase();
  const purposeColor = {
    FUEL:"#ffb340", REST:"#6b7491", DELIVERY:"#00e5b0",
    PICKUP:"#4f8bff", INSPECTION:"#ff4d6a"
  };
  const purposeTag = cp.purpose
    ? `<span class="cp-step__purpose" style="color:${purposeColor[cp.purpose]||"#6b7491"}">${cp.purpose}</span>`
    : "";

  let statusText = "";
  if (st === "arrived")  statusText = `<span class="cp-step__status cp-step__status--arrived">✈ มาถึง ${cp.arrived_at  ? new Date(cp.arrived_at).toLocaleString("th-TH")  : ""}</span>`;
  if (st === "departed") statusText = `<span class="cp-step__status cp-step__status--departed">✓ ออกแล้ว ${cp.departed_at ? new Date(cp.departed_at).toLocaleString("th-TH") : ""}</span>`;
  if (st === "pending")  statusText = `<span class="cp-step__status">รอ</span>`;
  if (st === "skipped")  statusText = `<span class="cp-step__status cp-step__status--skipped">ข้ามจุดนี้</span>`;

  let actions = "";
  if (canEdit) {
    if (st === "pending")
      actions = `
        <button class="btn btn--ghost btn--sm" onclick="updateCheckpoint('${cp.id}','ARRIVED',this)">📍 Arrived</button>
        <button class="btn btn--ghost btn--sm" onclick="updateCheckpoint('${cp.id}','SKIPPED',this)">⏭ Skip</button>`;
    if (st === "arrived")
      actions = `<button class="btn btn--primary btn--sm" onclick="updateCheckpoint('${cp.id}','DEPARTED',this)">🚀 Departed</button>`;
  }

  return `
    <div class="cp-step cp-step--${st}" id="cp-step-${cp.id}">
      <div class="cp-step__icon">${index + 1}</div>
      <div class="cp-step__body">
        <div class="cp-step__top">
          <span class="cp-step__name">${cp.location_name}</span>
          ${purposeTag}
        </div>
        ${statusText}
        <div class="cp-step__actions" id="cp-actions-${cp.id}">${actions}</div>
        <div id="cp-error-${cp.id}"></div>
      </div>
    </div>`;
}

// ============================================================
// UPDATE CHECKPOINT (optimistic + rollback)
// ============================================================
async function updateCheckpoint(cpId, newStatus, btnEl) {
  const stepEl    = document.getElementById(`cp-step-${cpId}`);
  const actionsEl = document.getElementById(`cp-actions-${cpId}`);
  const errorEl   = document.getElementById(`cp-error-${cpId}`);

  const oldClass   = stepEl.className;
  const oldActions = actionsEl.innerHTML;

  // optimistic UI
  stepEl.className = `cp-step cp-step--${newStatus.toLowerCase()} cp-step--optimistic cp-step--loading`;
  actionsEl.innerHTML = `<span style="color:var(--muted);font-size:12px">กำลังอัปเดต...</span>`;
  errorEl.innerHTML = "";

  const res = await fetchWithAuth(`${BASE_URL}/checkpoints/${cpId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus })
  });

  if (!res || !res.ok) {
    const data = res ? await res.json() : {};
    stepEl.className    = oldClass;
    actionsEl.innerHTML = oldActions;
    errorEl.innerHTML = `<div class="cp-error">❌ ${data.error?.message || "เกิดข้อผิดพลาด"}</div>`;
    setTimeout(() => { if (errorEl) errorEl.innerHTML = ""; }, 5000);
    return;
  }

  stepEl.classList.remove("cp-step--optimistic", "cp-step--loading");

  // ✅ FIX: ใช้ currentTripId ตรงๆ ไม่ต้อง regex parse DOM
  if (currentTripId) await renderTracker(currentTripId);
  await loadTrips();
}

// ============================================================
// INIT
// ============================================================
window.addEventListener("DOMContentLoaded", loadTrips);
