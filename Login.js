const BASE_URL =  window.location.origin; // เปลี่ยนพอร์ตให้ตรงกับ Backend ของคุณ; 
const TokenStore = (() => {
  let _token = null;
  return {
    get: () => _token,
    set: (t) => { _token = t; },
    clear: () => { _token = null; }
  };
})();

// ================= LOAD TOKEN FROM LOCALSTORAGE =================
const savedToken = localStorage.getItem("access_token");
if (savedToken) {
  TokenStore.set(savedToken);
}

// ================= ONLOAD MESSAGE =================
window.onload = () => {
  const msg = sessionStorage.getItem("auth_message");
  if (msg) {
    alert(msg);
    sessionStorage.removeItem("auth_message");
  }
};

// ================= LOGIN =================
// ================= LOGIN =================
// ================= LOGIN =================
// ================= LOGIN =================
async function ButtonLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.status !== "success") {
    alert(data.message || "Login failed");
    return;
  }

  // เซฟ Token ตามปกติ
  TokenStore.set(data.access_token);
  localStorage.setItem("access_token",  data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  
  // 👉 เพิ่มโค้ดส่วนนี้: แกะกล่อง Token เพื่อดึง Role ออกมาเซฟ
  try {
    // Token จะมี 3 ส่วนคั่นด้วยจุด (.) เราเอาส่วนที่ 2 (payload) มาถอดรหัส
    const base64Url = data.access_token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payloadObj = JSON.parse(jsonPayload);
    
    // ได้ Role มาแล้ว! จับยัดลง localStorage เลย
    localStorage.setItem("user_role", payloadObj.role); 
    console.log("✅ แกะ Role จาก Token สำเร็จ! ได้สิทธิ์เป็น:", payloadObj.role);

  } catch (err) {
    console.error("❌ แกะ Token ไม่สำเร็จ", err);
  }

  window.location.href = "dashboard.html";
}
// ================= REFRESH =================
async function refreshAccessToken() {
  const refresh_token = localStorage.getItem("refresh_token");

  const res = await  fetch(`${BASE_URL}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token })
  });

  const data = await res.json();

  if (!res.ok || data.force_logout) {
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("access_token");
    TokenStore.clear();
    sessionStorage.setItem("auth_message", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่");
    window.location.href = "Login.html";
    return null;
  }

  // ✅ backend คืน token ที่มี role แล้ว (หลังแก้ /refresh)
  TokenStore.set(data.access_token);
  localStorage.setItem("access_token", data.access_token);

  return data.access_token;
}

// ================= FETCH WITH AUTH =================
async function fetchWithAuth(url, options = {}) {
  if (!options.headers) options.headers = {};
  const token = TokenStore.get() || localStorage.getItem("access_token");
  options.headers["Authorization"] = "Bearer " + token;

  let res = await fetch(url, options);

  if (res.status === 401) {
    // โคลน res ไว้เพื่ออ่านเช็ค error code โดยไม่เสีย stream หลัก
    const cloneRes = res.clone();
    const body = await cloneRes.json().catch(() => ({}));

    if (body.error === "TOKEN_EXPIRED") {
      const newToken = await refreshAccessToken();
      if (newToken) {
        options.headers["Authorization"] = "Bearer " + newToken;
        return await fetch(url, options); // ยิงใหม่แล้ว return ผลลัพธ์เลย
      }
    }
  }
  return res;
}

console.log("Access Token:", TokenStore.get());
console.log("LocalStorage:", localStorage.getItem("access_token"));
