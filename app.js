// ==================== BIẾN TOÀN CỤC ====================
let employees = [];
let schedules = {};

// ==================== KHỞI TẠO ỨNG DỤNG ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Ứng dụng đã sẵn sàng!");
    
    // Khởi tạo ngày mặc định
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('workDate').value = today;
    document.getElementById('workDate').min = today;
    
    // Tải dữ liệu
    loadEmployees();
    loadSchedules();
});

// ==================== QUẢN LÝ NHÂN VIÊN ====================
function loadEmployees() {
    const employeesRef = database.ref('employees');
    
    employeesRef.on('value', (snapshot) => {
        employees = [];
        const data = snapshot.val();
        
        if (data) {
            Object.keys(data).forEach(key => {
                employees.push({
                    id: key,
                    name: data[key].name,
                    createdAt: data[key].createdAt
                });
            });
        }
        
        renderEmployees();
        updateEmployeeSelect();
        console.log("✅ Đã tải danh sách nhân viên:", employees.length);
    });
}

function addEmployee() {
    const nameInput = document.getElementById('employeeName');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('⚠️ Vui lòng nhập tên nhân viên!');
        nameInput.focus();
        return;
    }
    
    // Kiểm tra trùng tên
    if (employees.some(emp => emp.name.toLowerCase() === name.toLowerCase())) {
        alert('⚠️ Nhân viên "' + name + '" đã tồn tại!');
        nameInput.focus();
        return;
    }
    
    // Thêm lên Firebase
    const newEmployeeRef = database.ref('employees').push();
    newEmployeeRef.set({
        name: name,
        createdAt: Date.now()
    })
    .then(() => {
        console.log(`✅ Đã thêm nhân viên: ${name}`);
        nameInput.value = '';
        nameInput.focus();
    })
    .catch(error => {
        console.error('❌ Lỗi khi thêm nhân viên:', error);
        alert('❌ Lỗi khi thêm nhân viên: ' + error.message);
    });
}

function deleteEmployee(employeeId, employeeName) {
    if (!confirm(`Bạn có chắc muốn xóa nhân viên "${employeeName}"?\nTất cả lịch làm của họ cũng sẽ bị xóa!`)) {
        return;
    }
    
    // Xóa nhân viên khỏi Firebase
    database.ref(`employees/${employeeId}`).remove()
    .then(() => {
        console.log(`🗑️ Đã xóa nhân viên: ${employeeName}`);
        
        // Xóa tất cả lịch của nhân viên này
        const schedulesRef = database.ref('schedules');
        schedulesRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                Object.keys(data).forEach(scheduleId => {
                    if (data[scheduleId].employee === employeeName) {
                        database.ref(`schedules/${scheduleId}`).remove();
                    }
                });
            }
        });
    })
    .catch(error => {
        console.error('❌ Lỗi khi xóa nhân viên:', error);
        alert('❌ Lỗi khi xóa nhân viên!');
    });
}

function renderEmployees() {
    const container = document.getElementById('employeeList');
    container.innerHTML = '';
    
    if (employees.length === 0) {
        container.innerHTML = '<p style="color:#888; padding:15px; text-align:center;">📭 Chưa có nhân viên nào. Hãy thêm nhân viên đầu tiên!</p>';
        return;
    }
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(employee => {
        const div = document.createElement('div');
        div.className = 'employee-item';
        div.innerHTML = `
            <span>👤 ${employee.name}</span>
            <button class="delete-employee-btn" onclick="deleteEmployee('${employee.id}', '${employee.name}')">
                ×
            </button>
        `;
        container.appendChild(div);
    });
}

function updateEmployeeSelect() {
    const select = document.getElementById('selectEmployee');
    select.innerHTML = '<option value="">-- Chọn nhân viên --</option>';
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.name;
        option.textContent = employee.name;
        select.appendChild(option);
    });
}

// ==================== QUẢN LÝ LỊCH LÀM ====================
function loadSchedules() {
    const schedulesRef = database.ref('schedules');
    
    schedulesRef.on('value', (snapshot) => {
        schedules = snapshot.val() || {};
        renderSchedules();
        console.log("📅 Đã tải lịch làm:", Object.keys(schedules).length + ' lịch');
    });
}

function addSchedule() {
    const employeeSelect = document.getElementById('selectEmployee');
    const dateInput = document.getElementById('workDate');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    
    const employee = employeeSelect.value;
    const date = dateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    
    // Kiểm tra dữ liệu
    if (!employee) {
        alert('⚠️ Vui lòng chọn nhân viên!');
        employeeSelect.focus();
        return;
    }
    
    if (!date) {
        alert('⚠️ Vui lòng chọn ngày làm việc!');
        dateInput.focus();
        return;
    }
    
    if (!startTime || !endTime) {
        alert('⚠️ Vui lòng chọn giờ bắt đầu và kết thúc!');
        return;
    }
    
    if (startTime >= endTime) {
        alert('⚠️ Giờ kết thúc phải sau giờ bắt đầu!');
        startTimeInput.focus();
        return;
    }
    
    // Kiểm tra trùng lịch (cùng nhân viên, cùng ngày)
    const isDuplicate = Object.values(schedules).some(schedule => 
        schedule.employee === employee && 
        schedule.date === date
    );
    
    if (isDuplicate) {
        if (!confirm(`Nhân viên "${employee}" đã có lịch vào ngày ${formatDate(date)}.\nBạn vẫn muốn thêm lịch mới?`)) {
            return;
        }
    }
    
    // Thêm lịch lên Firebase
    const newScheduleRef = database.ref('schedules').push();
    newScheduleRef.set({
        employee: employee,
        date: date,
        startTime: startTime,
        endTime: endTime,
        createdAt: Date.now()
    })
    .then(() => {
        console.log(`✅ Đã thêm lịch: ${employee} - ${date} (${startTime}-${endTime})`);
        
        // Reset form
        dateInput.value = new Date().toISOString().split('T')[0];
        startTimeInput.value = '08:00';
        endTimeInput.value = '17:00';
        
        // Hiện thông báo thành công
        showMessage(`✅ Đã thêm lịch cho ${employee} vào ${formatDate(date)}`, 'success');
    })
    .catch(error => {
        console.error('❌ Lỗi khi thêm lịch:', error);
        alert('❌ Lỗi khi thêm lịch: ' + error.message);
    });
}

function deleteSchedule(scheduleId) {
    if (!confirm('Bạn có chắc muốn xóa lịch làm này?')) {
        return;
    }
    
    database.ref(`schedules/${scheduleId}`).remove()
    .then(() => {
        console.log('🗑️ Đã xóa lịch');
        showMessage('✅ Đã xóa lịch thành công!', 'success');
    })
    .catch(error => {
        console.error('❌ Lỗi khi xóa lịch:', error);
        alert('❌ Lỗi khi xóa lịch!');
    });
}

function renderSchedules() {
    const container = document.getElementById('scheduleList');
    container.innerHTML = '';
    
    if (Object.keys(schedules).length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:40px; color:#888;">
                <p style="font-size:20px; margin-bottom:10px;">📅</p>
                <p style="font-size:18px; margin-bottom:5px;">Chưa có lịch làm việc nào</p>
                <p>Hãy thêm lịch đầu tiên!</p>
            </div>
        `;
        return;
    }
    
    // Chuyển object thành array và sắp xếp
    const schedulesArray = Object.keys(schedules).map(id => ({
        id: id,
        ...schedules[id]
    })).sort((a, b) => new Date(a.date + 'T' + a.startTime) - new Date(b.date + 'T' + b.startTime));
    
    // Nhóm lịch theo ngày
    const groupedByDate = {};
    schedulesArray.forEach(schedule => {
        if (!groupedByDate[schedule.date]) {
            groupedByDate[schedule.date] = [];
        }
        groupedByDate[schedule.date].push(schedule);
    });
    
    // Hiển thị theo nhóm ngày
    Object.keys(groupedByDate).sort().forEach(date => {
        const dateHeader = document.createElement('div');
        dateHeader.className = 'date-header';
        dateHeader.innerHTML = `<h3>📅 ${formatDate(date)}</h3>`;
        container.appendChild(dateHeader);
        
        groupedByDate[date].forEach(schedule => {
            const div = document.createElement('div');
            div.className = 'schedule-item';
            div.innerHTML = `
                <div class="schedule-info">
                    <strong>👤 ${schedule.employee}</strong>
                    <div class="schedule-time">
                        <span>🕐 ${schedule.startTime} - ${schedule.endTime}</span>
                    </div>
                </div>
                <button class="delete-btn" onclick="deleteSchedule('${schedule.id}')">
                    🗑️ Xóa
                </button>
            `;
            container.appendChild(div);
        });
    });
}

// ==================== TIỆN ÍCH ====================
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
        font-weight: bold;
    `;
    message.textContent = text;
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => message.remove(), 300);
    }, 3000);
}

// Thêm CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// ==================== KIỂM TRA ĐỒNG BỘ ====================
function testRealtimeSync() {
    console.log("🔄 Đang kiểm tra đồng bộ realtime...");
    
    // Mở 2 tab trình duyệt cùng file này
    // Thêm/xóa ở tab 1 sẽ tự động hiện ở tab 2
    console.log("📱 Mở 2 tab trình duyệt để kiểm tra đồng bộ!");
}