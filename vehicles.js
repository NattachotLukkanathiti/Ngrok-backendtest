
let allVehicles = [];

// ================= LOAD =================
async function loadVehicles() {
  if (!TokenStore.get()) {
    const token = await refreshAccessToken();
    if (!token) return;
  }

  const res = await fetchWithAuth(`${BASE_URL}/vehicles`);
  if (!res) return;

  const data = await res.json();
  allVehicles = Array.isArray(data) ? data : [];
  restoreFiltersFromURL();
  applyFilters();
}

// ================= FILTER =================
var debounceTimer = null;

function onFilterChange() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(function() {
    pushFiltersToURL();
    applyFilters();
  }, 100);
}

function applyFilters() {
  var search = document.getElementById("f-search").value.trim().toLowerCase();
  var status = document.getElementById("f-status").value;
  var type   = document.getElementById("f-type").value;
  var driver = document.getElementById("f-driver").value.trim().toLowerCase();

  var filtered = allVehicles.filter(function(v) {
    if (status && v.status !== status) return false;
    if (type   && v.type   !== type)   return false;
    if (driver && !(v.driver_name || "").toLowerCase().includes(driver)) return false;
    if (search) {
      // ✅ ใช้ license_plate แทน plate_number
      var hay = (
        (v.license_plate || "") + " " +
        (v.brand  || "") + " " +
        (v.model  || "") + " " +
        (v.driver_name || "")
      ).toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  renderVehicles(filtered);
}

// ================= RENDER =================
// ================= RENDER =================
// ================= RENDER =================
// ================= RENDER =================
function renderVehicles(list) {
  var el = document.getElementById("vehicle-list");
  if (!list.length) {
    el.innerHTML = "<p>ไม่พบข้อมูล</p>";
    return;
  }

  // 1. ดึง Role ออกมาเช็ค
  var userRole = localStorage.getItem("user_role"); 
  console.log("🔥 Role ที่หน้า Vehicles ดึงได้คือ:", userRole); 

  el.innerHTML = list.map(function(v) {
    var isAdmin = userRole && userRole.toUpperCase() === "ADMIN";

    var deleteBtn = isAdmin 
      ? "<button class='btn-danger' onclick=\"deleteVehicle('" + v.id + "', '" + (v.license_plate || "") + "')\">ลบ</button>" 
      : "";

    // 🌟 พระเอกของเราอยู่ตรงนี้! ดักไว้ก่อนเลยว่าถ้า status ไม่มีค่า ให้เป็น IDLE
    var currentStatus = v.status || "IDLE";

    return "<div class='vehicle-card' data-id='" + v.id + "'>" +
      "<div class='vehicle-card__header'>" +
        "<strong>" + (v.license_plate || "-") + "</strong>" +
        // 🌟 เปลี่ยนมาใช้ currentStatus แทน v.status
        "<span class='badge badge--" + currentStatus.toLowerCase() + "'>" + currentStatus + "</span>" +
      "</div>" +
      "<span>" + (v.type || "-") + " — " + (v.brand || "") + " " + (v.model || "") + "</span>" +
      "<span>👤 " + (v.driver_name || "-") + "</span>" +
      "<span>" + Number(v.mileage_km || 0).toLocaleString() + " km</span>" +
      "<div class='vehicle-card__actions'>" +
        // 🌟 ตรงนี้ก็เปลี่ยนมาใช้ currentStatus ด้วย
        "<button onclick=\"changeStatus('" + v.id + "', '" + currentStatus + "')\">เปลี่ยน Status</button>" +
        "<button onclick=\"viewHistory('" + v.id + "')\">ดู History</button>" +
        deleteBtn + 
      "</div>" +
    "</div>";
  }).join("");
}
// ================= URL REFLECT =================
function pushFiltersToURL() {
  var params = new URLSearchParams();
  var search = document.getElementById("f-search").value.trim();
  var status = document.getElementById("f-status").value;
  var type   = document.getElementById("f-type").value;
  var driver = document.getElementById("f-driver").value.trim();

  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (type)   params.set("type",   type);
  if (driver) params.set("driver", driver);

  var str = params.toString();
  history.replaceState(null, "", location.pathname + (str ? "#" + str : ""));
}

function restoreFiltersFromURL() {
  var hash   = location.hash.replace("#", "");
  var params = new URLSearchParams(hash);
  if (params.get("search")) document.getElementById("f-search").value = params.get("search");
  if (params.get("status")) document.getElementById("f-status").value = params.get("status");
  if (params.get("type"))   document.getElementById("f-type").value   = params.get("type");
  if (params.get("driver")) document.getElementById("f-driver").value = params.get("driver");
}

// ================= MODAL =================
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}

function closeModal(id) {
  document.getElementById(id).style.display = "none";
}

// ================= ADD VEHICLE =================
async function submitAddVehicle() {
  var errEl = document.getElementById("v-error");
  if (errEl) errEl.textContent = "";

  // 1. ดึงค่าจากหน้าเว็บ
  var idEl = document.getElementById("v-id");
  var id = idEl ? idEl.value : ""; 
  
  var license_plate = document.getElementById("v-plate").value.trim();
  var type          = document.getElementById("v-type").value;
  
  var driverEl      = document.getElementById("v-driver-id");
  var driver_id     = driverEl ? driverEl.value.trim() : "";

  var brand           = document.getElementById("v-brand").value.trim();
  var model           = document.getElementById("v-model").value.trim();
  
  var yearEl          = document.getElementById("v-year");
  var year            = yearEl && yearEl.value ? parseInt(yearEl.value) : 0;
  
  var fuelEl          = document.getElementById("v-fuel");
  var fuel_type       = fuelEl ? fuelEl.value : "";
  
  var mileage_km      = parseFloat(document.getElementById("v-mileage").value) || 0;
  
  var lastServiceEl   = document.getElementById("v-lastservice");
  var last_service_km = lastServiceEl && lastServiceEl.value ? parseFloat(lastServiceEl.value) : 0;
  
  var next_service_km = parseFloat(document.getElementById("v-nextservice").value) || 0;

  // 2. จัดโครงสร้างแบบ Flat (แผ่หลา ไม่ต้องมีคำว่า context) ตามที่ Backend ต้องการเป๊ะๆ
  var requestBody = {
    id: id,
    license_plate: license_plate,
    type: type,
    driver_id: driver_id || null,
    brand: brand,
    model: model,
    year: year,
    fuel_type: fuel_type,
    mileage_km: mileage_km,
    last_service_km: last_service_km,
    next_service_km: next_service_km
  };

  // 3. ยิง API
  var res = await fetchWithAuth(`${BASE_URL}/vehicles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  var data = await res.json();

  if (!res.ok) {
    var err = data.error || {};
    errEl.textContent = err.message || "เกิดข้อผิดพลาด";
    if (err.details) {
      errEl.textContent += " — " + JSON.stringify(err.details);
    }
    return;
  }

  // ปิด Modal และเคลียร์ค่า (ถ้าผ่าน)
  closeModal("modal-add-vehicle");
  
  document.getElementById("v-plate").value       = "";
  document.getElementById("v-type").value        = "";
  if (driverEl) driverEl.value                   = "";
  document.getElementById("v-brand").value       = "";
  document.getElementById("v-model").value       = "";
  if (yearEl) yearEl.value                       = "";
  if (fuelEl) fuelEl.value                       = "";
  document.getElementById("v-mileage").value     = "";
  if (lastServiceEl) lastServiceEl.value         = "";
  document.getElementById("v-nextservice").value = "";
  
  loadVehicles();
}

// ================= ADD DRIVER =================
async function submitAddDriver() {
  var errEl = document.getElementById("d-error");
  errEl.textContent = "";

  var name              = document.getElementById("d-name").value.trim();
  var license_number    = document.getElementById("d-license").value.trim();
  var license_expires_at = document.getElementById("d-expiry").value;  // ✅ ชื่อตรง DB
  var phone             = document.getElementById("d-phone").value.trim();

  var res = await fetchWithAuth(`${BASE_URL}/drivers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      license_number,
      license_expires_at,   // ✅ ตรงกับ DB column และ backend
      phone
    })
  });

  var data = await res.json();

  if (!res.ok) {
    var err = data.error || {};
    errEl.textContent = err.message || "เกิดข้อผิดพลาด";
    if (err.details) {
      errEl.textContent += " — " + JSON.stringify(err.details);
    }
    return;
  }

  closeModal("modal-add-driver");
  document.getElementById("d-name").value    = "";
  document.getElementById("d-license").value = "";
  document.getElementById("d-expiry").value  = "";
  document.getElementById("d-phone").value   = "";
  alert("เพิ่ม Driver สำเร็จ");
}

// ================= DELETE VEHICLE =================
async function deleteVehicle(vehicleId, plate) {
  if (!confirm("ลบ " + plate + " ใช่ไหม?")) return;

  var res = await fetchWithAuth(`${BASE_URL}/vehicles/${vehicleId}`, {
    method: "DELETE"
  });

  var data = await res.json();

  if (!res.ok) {
    alert(data.error ? data.error.message : "เกิดข้อผิดพลาด");
    return;
  }

  allVehicles = allVehicles.filter(function(v) { return v.id !== vehicleId; });
  applyFilters();
}

// ================= VIEW HISTORY =================
async function viewHistory(vehicleId) {
  openModal("modal-history");
  document.getElementById("history-list").innerHTML = "<p>กำลังโหลด...</p>";

  var res = await fetchWithAuth(`${BASE_URL}/vehicles/${vehicleId}/history`);
  if (!res) return;

  var data = await res.json();
  var list = data.history || [];

  if (!list.length) {
    document.getElementById("history-list").innerHTML = "<p>ไม่มีประวัติ</p>";
    return;
  }

  document.getElementById("history-list").innerHTML = list.map(function(item) {
    if (item.type === "trip") {
      return "<div class='history-item history-item--trip'>" +
        "<span class='badge badge--trip'>TRIP</span>" +
        "<span>" + (item.origin || "-") + " → " + (item.destination || "-") + "</span>" +
        "<span>" + item.status + "</span>" +
        "<span>" + (item.date ? item.date.substring(0, 10) : "-") + "</span>" +
        "<span>👤 " + (item.driver_name || "-") + "</span>" +
      "</div>";
    } else {
      return "<div class='history-item history-item--maintenance'>" +
        "<span class='badge badge--maintenance'>MAINTENANCE</span>" +
        "<span>" + (item.maintenance_type || "-") + " — " + (item.note || "-") + "</span>" +
        "<span>" + item.status + "</span>" +
        "<span>" + (item.date ? item.date.substring(0, 10) : "-") + "</span>" +
      "</div>";
    }
  }).join("");
}

// ================= STATUS TRANSITION =================
var TRANSITIONS = {
  IDLE:        ["ACTIVE"],
  ACTIVE:      ["IDLE", "MAINTENANCE"],
  MAINTENANCE: ["IDLE"]
};

async function changeStatus(vehicleId, currentStatus) {
  var allowed = TRANSITIONS[currentStatus];

  if (!allowed || allowed.length === 0) {
    alert("ไม่สามารถเปลี่ยน status จาก " + currentStatus + " ได้");
    return;
  }

  var newStatus = prompt(
    "Status ปัจจุบัน: " + currentStatus +
    "\nเปลี่ยนได้เป็น: " + allowed.join(", ") +
    "\n\nพิมพ์ status ที่ต้องการ:"
  );

  if (!newStatus) return;

  var upper = newStatus.trim().toUpperCase();

  if (!allowed.includes(upper)) {
    alert(
      "ไม่สามารถเปลี่ยนจาก " + currentStatus + " → " + upper + " ได้\n" +
      "Transition ที่ทำได้ตอนนี้: " + currentStatus + " → " + allowed.join(" หรือ ")
    );
    return;
  }

  var res = await fetchWithAuth(`${BASE_URL}/vehicles/${vehicleId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: upper })
  });

  if (!res) return;

  var data = await res.json();

  if (!res.ok) {
    var errMsg = data.error
      ? data.error.message +
        (data.error.details?.allowed_transitions
          ? "\nทำได้: " + data.error.details.allowed_transitions.join(", ")
          : "")
      : "เกิดข้อผิดพลาด";
    alert(errMsg);
    return;
  }

  var found = allVehicles.find(function(v) { return v.id === vehicleId; });
  if (found) found.status = upper;
  applyFilters();
}

// ================= EVENT LISTENERS =================
document.getElementById("f-search").addEventListener("input",  onFilterChange);
document.getElementById("f-status").addEventListener("change", onFilterChange);
document.getElementById("f-type").addEventListener("change",   onFilterChange);
document.getElementById("f-driver").addEventListener("input",  onFilterChange);

window.addEventListener("DOMContentLoaded", function() {
  loadVehicles();
  loadDriversForDropdown(); // 👈 ต้องปลุกมันขึ้นมาทำงานด้วยครับ!
});
// ================= LOAD DRIVERS FOR DROPDOWN =================
async function loadDriversForDropdown() {
  // ยิง API ไปขอดึงข้อมูลคนขับ (สมมติว่า Endpoint คือ /drivers)
  var res = await fetchWithAuth(`${BASE_URL}/drivers`);
  if (!res) return;

  var data = await res.json();
  
  // เช็คว่า API ส่งกลับมาเป็น Array เลย หรือซ้อนอยู่ใน object (เช่น data.data)
  var driversList = Array.isArray(data) ? data : (data.data || []);

  var driverSelect = document.getElementById("v-driver-id");
  if (!driverSelect) return;

  // สร้างตัวเลือก (Option) โดยเอา ID เป็น value ซ่อนไว้ และเอาชื่อมาโชว์ให้คนดู
  var optionsHTML = '<option value="">เลือกคนขับ (ไม่มีคนขับ)</option>';
  driversList.forEach(function(driver) {
    // โชว์ชื่อ และ ทะเบียนใบขับขี่เผื่อชื่อซ้ำ
    optionsHTML += '<option value="' + driver.id + '">' + driver.name + ' (' + driver.license_number + ')</option>';
  });

  driverSelect.innerHTML = optionsHTML;
}
