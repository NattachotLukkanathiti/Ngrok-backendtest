
const BASE_URL = "https://mouse-afford-handbrake.ngrok-free.dev"; // เปลี่ยนพอร์ตให้ตรงกับ Backend ของคุณ
const username = document.getElementById("username");
const password = document.getElementById("password");
const role = document.getElementById("role");
const message = document.getElementById("message");
async function Registerbutton(){
    message.innerText = "";

    const selectedRole = document.querySelector('input[name="role"]:checked');

    if (!selectedRole) {
        message.innerText = "Please select role";
        return;
    }

    try {
        await axios.post(`${BASE_URL}/users`,{
        username: username.value,
        password: password.value,   // ✅ เปลี่ยนตรงนี้
        role: selectedRole.value
        });

        clearForm();
        window.location.href = "dashboard.html";

    } catch (error) {
        console.log("การส่งข้อมูลไม่สำเร็จ");
        message.innerText = error.response?.data?.message || "Error";
    }
}

function clearForm(){
    username.value = "";
    password.value = "";
}