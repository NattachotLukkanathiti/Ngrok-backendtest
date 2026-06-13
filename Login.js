const BASE_URL =  "https://mouse-afford-handbrake.ngrok-free.dev";
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
// 📄 แก้ไขใน Login.js (บรรทัดแถวๆ 100+)
function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem("access_token");
    
    // สร้างวัตถุ Headers ขึ้นมาใหม่เพื่อรวมทุกอย่างเข้าด้วยกันอย่างปลอดภัย
    const headers = new Headers(options.headers || {});
    
    // 🌟 บังคับใส่ตั๋วผ่านทาง ngrok ทุกครั้ง ไม่ว่าจะยิงจากหน้าไหน
    headers.set("ngrok-skip-browser-warning", "true");
    
    // ถ้ามี Token ให้แนบเข้าไปด้วย
    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }
    
    // เอา Headers ที่รวมกันเสร็จแล้วใส่กลับเข้าไปใน options
    options.headers = headers;
    
    return fetch(url, options);
}
console.log("Access Token:", TokenStore.get());
console.log("LocalStorage:", localStorage.getItem("access_token"));
