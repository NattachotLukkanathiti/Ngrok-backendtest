/* ================= app.js ================= */

const API_URL = "https://mouse-afford-handbrake.ngrok-free.dev"; // เปลี่ยนพอร์ตให้ตรงกับ Backend ของคุณ
const token = localStorage.getItem("access_token");
const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${token}` };

let statusChartInstance = null;
let trendChartInstance = null;

// ตั้งค่า Global Font ให้ใช้ร่วมกับหน้าเว็บ (อย่าลืมโหลด Font ใน HTML ด้วยนะครับ)
Chart.defaults.font.family = "'IBM Plex Sans Thai', sans-serif";
Chart.defaults.color = "#a1a7b3"; // สีตัวอักษรบนกราฟ (Soft Grey)

// ตรวจสอบ Token ถ้าไม่มีอาจจะเด้งไปหน้า login
if (!token) {
  alert("กรุณาเข้าสู่ระบบก่อน!");
  window.location.href = "Login.html"; 
}

// เช็ค Role ว่าเป็น ADMIN หรือ DISPATCHER
try {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  const userData = JSON.parse(decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')));
  const filterUserNode = document.getElementById("filter-username");
  if (userData.role === "DISPATCHER" && filterUserNode) {
    filterUserNode.style.display = "none";
  }
} catch(e) { console.warn("ไม่สามารถอ่าน Token ได้", e); }

// Helper สำหรับแปลสถานะเป็นไทย
const statusMap = { 'ACTIVE': 'ใช้งานอยู่', 'IDLE': 'ว่าง', 'MAINTENANCE': 'ซ่อมบำรุง' };

// ================= ฟังก์ชันสลับ TAB =================
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabName).classList.add('active');
  document.getElementById('nav-' + tabName).classList.add('active');
  if (tabName === 'dashboard') initDashboard();
  if (tabName === 'audit') loadAuditLogs();
}

// ================= Plugin สำหรับเขียนข้อความตรงกลาง Doughnut Chart =================
const doughnutCenterTextPlugin = {
  id: 'doughnutCenterText',
  afterDraw: function(chart) {
    if (chart.config.type === 'doughnut') {
      const { ctx, data } = chart;
      const text = data.datasets[0].data.reduce((a, b) => a + b, 0); // ผลรวมทั้งหมด
      const lbl = 'คัน';
      
      ctx.save();
      const centerX = (chart.chartArea.left + chart.chartArea.right) / 2;
      const centerY = (chart.chartArea.top + chart.chartArea.bottom) / 2;

      // วาดตัวเลข (ใหญ่)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "500 28px 'IBM Plex Mono'"; // ใช้ Mono สำหรับตัวเลข
      ctx.fillStyle = '#fff'; // สีขาว
      ctx.fillText(text, centerX, centerY - 5);

      // วาดคำว่า "คัน" (เล็ก)
      ctx.font = "400 13px 'IBM Plex Sans Thai'";
      ctx.fillStyle = '#a1a7b3'; // สีเทาอ่อน
      ctx.fillText(lbl, centerX, centerY + 18);
      ctx.restore();
    }
  }
};

// ================= ฟังก์ชันโหลด DASHBOARD =================
async function initDashboard() {
  try {
    const resSum = await fetch(`${API_URL}/dashboard/summary`, { headers });
    if (resSum.ok) {
      const data = await resSum.json();
      document.getElementById("card-vehicles").textContent = data.total_vehicles || 0;
      document.getElementById("card-trips").textContent = data.active_trips_today || 0;
      document.getElementById("card-distance").textContent = parseFloat(data.total_distance_today || 0).toFixed(1);
      document.getElementById("card-maintenance").textContent = data.maintenance_overdue || 0;
    }

    const resChart = await fetch(`${API_URL}/dashboard/charts`, { headers });
    if (resChart.ok) {
      const data = await resChart.json();
      
      // ลบกราฟเก่าทิ้งก่อนวาดใหม่
      if(statusChartInstance) statusChartInstance.destroy();
      
      // 🌟 [ปรับปรุง] กราฟโดนัท (Vehicles Status)
      const ctxStatus = document.getElementById('statusChart').getContext('2d');
      statusChartInstance = new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
          // แปลง label เป็นไทย
          labels: data.vehiclesByStatus.map(v => statusMap[v.status] || v.status),
          datasets: [{ 
            data: data.vehiclesByStatus.map(v => v.count), 
            // ใช้สีที่ดู Soft และทันสมัยขึ้น (Green, Yellow, Red)
            backgroundColor: ['#2ac98f', '#ffc107', '#ef5350'], 
            borderWidth: 6, // ทำช่องว่างขาวๆ ระหว่าง Segments
            borderColor: '#13161e', // สีพื้นหลัง (Dark)
            borderRadius: 6, // ทำมุมมนให้ Segments (Chart.js v3+)
            hoverOffset: 12 // เพิ่ม effect ตอนเอาเมาส์ไปชี้
          }]
        },
        plugins: [doughnutCenterTextPlugin], // ใส่ Plugin เขียนข้อความตรงกลาง
        options: { 
          responsive: true, 
          cutout: '75%', // ทำวงกลมให้บางลง ดูคลีนๆ
          plugins: { 
            title: { display: true, text: 'สัดส่วนสถานะรถยนต์', color: '#fff', font: { size: 15, weight: '500' }, padding: { bottom: 20 } },
            legend: { 
              display: true, 
              position: 'bottom', 
              labels: { 
                usePointStyle: true, // ใช้จุดวงกลมแทนสี่เหลี่ยม
                padding: 15, 
                color: '#a1a7b3',
                font: { size: 12 }
              } 
            },
            tooltip: { // ปรับแต่ง Tooltip ให้สวยงาม
              backgroundColor: '#212636',
              titleColor: '#fff',
              bodyColor: '#fff',
              borderColor: '#2a2f3f',
              borderWidth: 1,
              padding: 10,
              displayColors: true,
              usePointStyle: true
            }
          } 
        }
      });

      if(trendChartInstance) trendChartInstance.destroy();
      
      // 🌟 [ปรับปรุง] กราฟแท่ง (Distance Trend) พร้อม Gradient และ Rounded Corners
      const ctxTrend = document.getElementById('trendChart').getContext('2d');
      
      // สร้าง Gradient Color (สีฟ้าอ่อน -> ฟ้าเข้ม)
      const gradient = ctxTrend.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, '#3498db'); // สีบน (อ่อน)
      gradient.addColorStop(1, '#0277bd'); // สีล่าง (เข้ม)

      trendChartInstance = new Chart(ctxTrend, {
        type: 'bar',
        data: {
          labels: data.distanceTrend.map(d => new Date(d.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })),
          datasets: [{ 
            label: 'ระยะทาง (km)', 
            data: data.distanceTrend.map(d => d.total_distance), 
            backgroundColor: gradient, // ใช้สี Gradient
            hoverBackgroundColor: '#81d4fa', // สีตอน hover
            borderRadius: 8, // ทำมุมมนด้านบนของแท่ง (Chart.js v3+)
            borderSkipped: false,
            maxBarWidth: 35 // จำกัดความกว้างไม่ให้แท่งใหญ่เกินไป
          }]
        },
        options: { 
          responsive: true, 
          maintainAspectRatio: false, // เพื่อให้กำหนดความสูงใน CSS ได้
          plugins: { 
            title: { display: true, text: 'แนวโน้มระยะทาง 7 วันล่าสุด', color: '#fff', font: { size: 15, weight: '500' }, padding: { bottom: 20 } },
            legend: { display: false }, // ซ่อน Legend เพื่อความคลีน
            tooltip: {
              backgroundColor: '#212636',
              padding: 12,
              callbacks: {
                label: function(context) { return ` ${context.parsed.y.toFixed(1)} กิโลเมตร`; }
              }
            }
          },
          scales: {
            x: { 
              grid: { display: false, drawBorder: false }, // ซ่อนเส้นตารางแกน X
              ticks: { color: '#a1a7b3' } 
            },
            y: { 
              beginAtZero: true,
              grid: { color: '#2a2f3f', drawBorder: false }, // ทำให้เส้นตารางแกน Y จางๆ
              ticks: { 
                color: '#a1a7b3',
                // ใส่ "km" หลังตัวเลขบนแกน Y
                callback: function(value) { return value + ' km'; }
              }
            }
          }
        }
      });
    }
  } catch (err) { console.error("Dashboard error:", err); }
}

// ================= ฟังก์ชันโหลด AUDIT LOGS =================
async function loadAuditLogs() {
  const params = new URLSearchParams();
  const fields = ["username", "action", "resource", "start", "end"];
  const tbody = document.getElementById("logs-table-body");
  
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>`;
  
  fields.forEach(f => {
    const el = document.getElementById(`filter-${f}`);
    if (el && el.value) {
      params.append(f === "resource" ? "resource_type" : f === "start" ? "start_date" : f === "end" ? "end_date" : f, el.value);
    }
  });

  try {
    const res = await fetch(`${API_URL}/audit-logs?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`Server ตอบกลับด้วยรหัส: ${res.status}`);
    const data = await res.json();
    const logsArray = Array.isArray(data) ? data : (data.logs || []);
    tbody.innerHTML = ""; 

    if (!logsArray.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">ไม่มีประวัติการใช้งานในช่วงเวลานี้</td></tr>`;
      return;
    }

    logsArray.forEach(log => {
      tbody.innerHTML += `
        <tr>
          <td>${new Date(log.created_at).toLocaleString('th-TH')}</td>
          <td><strong>${log.username || log.user_id || '-'}</strong></td>
          <td style="color: #2980b9; font-weight: bold;">${log.action}</td>
          <td>${log.resource_type}</td>
          <td>${log.resource_id || '-'}</td>
          <td><pre class="details-box">${log.details ? JSON.stringify(log.details, null, 2) : "N/A"}</pre></td>
        </tr>
      `;
    });
  } catch (err) { 
    console.error("Audit load error:", err); 
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red;">เกิดข้อผิดพลาด: ${err.message}</td></tr>`;
  }
}

// ================= ฟังก์ชัน LOGOUT =================
function logout() {
  localStorage.removeItem("access_token");
  alert("ออกจากระบบแล้ว");
  window.location.href = "Login.html";
}

// เริ่มต้นทำงานทันที
initDashboard();