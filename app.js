// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let currentScheduleId = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Application started!");
    
    // Set default date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('workDate').value = today;
    document.getElementById('workDate').min = today;
    
    // Initialize date for edit modal
    document.getElementById('editDate').value = today;
    
    // Load data
    loadEmployees();
    loadSchedules();
    
    // Set up weekly overview
    updateWeeklyOverview();
    
    // Add event listeners for mobile
    setupMobileListeners();
});

// ==================== MOBILE FUNCTIONALITY ====================
function setupMobileListeners() {
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(event) {
        const mobileMenu = document.getElementById('mobileMenu');
        const menuBtn = document.querySelector('.mobile-menu-btn');
        
        if (mobileMenu && mobileMenu.classList.contains('active') && 
            !mobileMenu.contains(event.target) && 
            !menuBtn.contains(event.target)) {
            toggleMobileMenu();
        }
    });
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.classList.toggle('active');
}

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName + 'Tab').classList.add('active');
    
    // Activate corresponding button
    document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');
    
    // Close mobile menu on mobile
    if (window.innerWidth <= 768) {
        toggleMobileMenu();
    }
}

// ==================== EMPLOYEE MANAGEMENT ====================
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
                    position: data[key].position || '前台/服务区',
                    createdAt: data[key].createdAt
                });
            });
        }
        
        renderEmployees();
        updateEmployeeSelects();
        updateStats();
        console.log("✅ Employees loaded:", employees.length);
    });
}

function addEmployee() {
    const nameInput = document.getElementById('employeeName');
    const positionSelect = document.getElementById('employeePosition');
    
    const name = nameInput.value.trim();
    const position = positionSelect.value;
    
    if (!name) {
        showMessage('⚠️ 请输入员工姓名!', 'warning');
        nameInput.focus();
        return;
    }
    
    if (!position) {
        showMessage('⚠️ 请选择员工职位!', 'warning');
        positionSelect.focus();
        return;
    }
    
    // Check for duplicate
    if (employees.some(emp => emp.name.toLowerCase() === name.toLowerCase())) {
        showMessage(`⚠️ 员工 "${name}" 已存在!`, 'warning');
        nameInput.focus();
        return;
    }
    
    // Add to Firebase
    const newEmployeeRef = database.ref('employees').push();
    newEmployeeRef.set({
        name: name,
        position: position,
        createdAt: Date.now()
    })
    .then(() => {
        console.log(`✅ Added employee: ${name} (${position})`);
        nameInput.value = '';
        positionSelect.value = '';
        nameInput.focus();
        showMessage(`✅ 员工 "${name}" 添加成功!`, 'success');
    })
    .catch(error => {
        console.error('❌ Error adding employee:', error);
        showMessage('❌ 添加员工失败: ' + error.message, 'error');
    });
}

function deleteEmployee(employeeId, employeeName) {
    if (!confirm(`确定要删除员工 "${employeeName}" 吗?\n该员工的所有排班也将被删除!`)) {
        return;
    }
    
    // Delete from Firebase
    database.ref(`employees/${employeeId}`).remove()
    .then(() => {
        console.log(`🗑️ Deleted employee: ${employeeName}`);
        
        // Delete all schedules for this employee
        const schedulesRef = database.ref('schedules');
        schedulesRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                Object.keys(data).forEach(scheduleId => {
                    if (data[scheduleId].employeeId === employeeId) {
                        database.ref(`schedules/${scheduleId}`).remove();
                    }
                });
            }
        });
        
        showMessage(`✅ 员工 "${employeeName}" 删除成功!`, 'success');
    })
    .catch(error => {
        console.error('❌ Error deleting employee:', error);
        showMessage('❌ 删除员工失败!', 'error');
    });
}

function editEmployee(employeeId) {
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;
    
    const newName = prompt(`修改员工姓名:`, employee.name);
    if (!newName || newName.trim() === employee.name) return;
    
    const newPosition = prompt(`选择职位:\n1. 前台/服务区\n2. 厨房区`, employee.position);
    if (!newPosition) return;
    
    database.ref(`employees/${employeeId}`).update({
        name: newName.trim(),
        position: newPosition
    })
    .then(() => {
        showMessage(`✅ 员工信息更新成功!`, 'success');
    })
    .catch(error => {
        console.error('❌ Error updating employee:', error);
        showMessage('❌ 更新员工信息失败!', 'error');
    });
}

function renderEmployees() {
    const container = document.getElementById('employeeList');
    
    if (employees.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users" style="font-size:48px;color:#ccc;margin-bottom:15px;"></i>
                <h3>暂无员工</h3>
                <p>添加第一个员工开始管理排班</p>
            </div>
        `;
        return;
    }
    
    // Sort employees by name
    employees.sort((a, b) => a.name.localeCompare(b.name));
    
    container.innerHTML = employees.map(employee => `
        <div class="employee-item ${employee.position === '厨房区' ? 'kitchen' : 'front-desk'}">
            <div class="employee-info">
                <div class="employee-name">👤 ${employee.name}</div>
                <div class="employee-position">
                    <i class="fas ${employee.position === '厨房区' ? 'fa-utensils' : 'fa-door-open'}"></i>
                    ${employee.position}
                </div>
            </div>
            <div class="employee-actions">
                <button class="action-btn edit-btn" onclick="editEmployee('${employee.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn delete-btn" onclick="deleteEmployee('${employee.id}', '${employee.name}')">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="action-btn" onclick="lookupEmployeeSchedule('${employee.id}')" 
                        style="background:#e8f5e9;color:#4CAF50;">
                    <i class="fas fa-search"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function updateEmployeeSelects() {
    // Update all employee dropdowns
    const selects = ['selectEmployee', 'filterEmployee', 'lookupEmployeeSelect'];
    
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (!select) return;
        
        const currentValue = select.value;
        select.innerHTML = '<option value="">选择员工</option>';
        
        employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(employee => {
            const option = document.createElement('option');
            option.value = employee.id;
            option.textContent = `${employee.name} (${employee.position})`;
            select.appendChild(option);
        });
        
        // Try to restore previous selection
        if (currentValue && employees.some(emp => emp.id === currentValue)) {
            select.value = currentValue;
        }
    });
}

// ==================== SCHEDULE MANAGEMENT ====================
function loadSchedules() {
    const schedulesRef = database.ref('schedules');
    
    schedulesRef.on('value', (snapshot) => {
        schedules = snapshot.val() || {};
        renderSchedules();
        updateWeeklyOverview();
        updateStats();
        console.log("📅 Schedules loaded:", Object.keys(schedules).length);
    });
}

function addSchedule() {
    const employeeSelect = document.getElementById('selectEmployee');
    const dateInput = document.getElementById('workDate');
    const startTimeInput = document.getElementById('startTime');
    const endTimeInput = document.getElementById('endTime');
    
    const employeeId = employeeSelect.value;
    const date = dateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    
    // Validation
    if (!employeeId) {
        showMessage('⚠️ 请选择员工!', 'warning');
        employeeSelect.focus();
        return;
    }
    
    if (!date) {
        showMessage('⚠️ 请选择日期!', 'warning');
        dateInput.focus();
        return;
    }
    
    if (!startTime || !endTime) {
        showMessage('⚠️ 请选择开始和结束时间!', 'warning');
        return;
    }
    
    if (startTime >= endTime) {
        showMessage('⚠️ 结束时间必须在开始时间之后!', 'warning');
        startTimeInput.focus();
        return;
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
        showMessage('⚠️ 选择的员工不存在!', 'error');
        return;
    }
    
    // Check for duplicate schedule (same employee, same date)
    const isDuplicate = Object.values(schedules).some(schedule => 
        schedule.employeeId === employeeId && 
        schedule.date === date
    );
    
    if (isDuplicate) {
        if (!confirm(`员工 "${employee.name}" 在 ${formatDate(date)} 已有排班.\n是否替换现有排班?`)) {
            return;
        }
        // Find and delete existing schedule
        Object.keys(schedules).forEach(scheduleId => {
            if (schedules[scheduleId].employeeId === employeeId && 
                schedules[scheduleId].date === date) {
                database.ref(`schedules/${scheduleId}`).remove();
            }
        });
    }
    
    // Add to Firebase
    const newScheduleRef = database.ref('schedules').push();
    newScheduleRef.set({
        employeeId: employeeId,
        employeeName: employee.name,
        employeePosition: employee.position,
        date: date,
        startTime: startTime,
        endTime: endTime,
        createdAt: Date.now(),
        isDayOff: false
    })
    .then(() => {
        console.log(`✅ Added schedule: ${employee.name} - ${date} (${startTime}-${endTime})`);
        
        // Reset form
        startTimeInput.value = '08:00';
        endTimeInput.value = '17:00';
        
        showMessage(`✅ ${employee.name} 的排班添加成功!`, 'success');
    })
    .catch(error => {
        console.error('❌ Error adding schedule:', error);
        showMessage('❌ 添加排班失败: ' + error.message, 'error');
    });
}

function addDayOff() {
    const employeeSelect = document.getElementById('selectEmployee');
    const dateInput = document.getElementById('workDate');
    
    const employeeId = employeeSelect.value;
    const date = dateInput.value;
    
    if (!employeeId) {
        showMessage('⚠️ 请选择员工!', 'warning');
        return;
    }
    
    if (!date) {
        showMessage('⚠️ 请选择日期!', 'warning');
        return;
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;
    
    if (!confirm(`确定设置 ${employee.name} 在 ${formatDate(date)} 为休息日吗?`)) {
        return;
    }
    
    // Check for existing schedule
    let existingScheduleId = null;
    Object.keys(schedules).forEach(scheduleId => {
        if (schedules[scheduleId].employeeId === employeeId && 
            schedules[scheduleId].date === date) {
            existingScheduleId = scheduleId;
        }
    });
    
    // Add/update day off
    const scheduleRef = existingScheduleId 
        ? database.ref(`schedules/${existingScheduleId}`)
        : database.ref('schedules').push();
    
    scheduleRef.set({
        employeeId: employeeId,
        employeeName: employee.name,
        employeePosition: employee.position,
        date: date,
        startTime: '00:00',
        endTime: '00:00',
        createdAt: Date.now(),
        isDayOff: true,
        notes: '休息日'
    })
    .then(() => {
        showMessage(`✅ ${employee.name} 的休息日设置成功!`, 'success');
    })
    .catch(error => {
        console.error('❌ Error setting day off:', error);
        showMessage('❌ 设置休息日失败!', 'error');
    });
}

function editSchedule(scheduleId) {
    const schedule = schedules[scheduleId];
    if (!schedule) return;
    
    currentScheduleId = scheduleId;
    
    // Populate edit modal
    const employeeSelect = document.getElementById('editEmployee');
    employeeSelect.innerHTML = '';
    
    employees.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.id;
        option.textContent = `${employee.name} (${employee.position})`;
        option.selected = employee.id === schedule.employeeId;
        employeeSelect.appendChild(option);
    });
    
    document.getElementById('editDate').value = schedule.date;
    document.getElementById('editStartTime').value = schedule.startTime;
    document.getElementById('editEndTime').value = schedule.endTime;
    
    // Show modal
    openModal('editModal');
}

function updateSchedule() {
    if (!currentScheduleId) return;
    
    const employeeSelect = document.getElementById('editEmployee');
    const dateInput = document.getElementById('editDate');
    const startTimeInput = document.getElementById('editStartTime');
    const endTimeInput = document.getElementById('editEndTime');
    
    const employeeId = employeeSelect.value;
    const date = dateInput.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    
    if (!employeeId || !date || !startTime || !endTime) {
        showMessage('⚠️ 请填写所有字段!', 'warning');
        return;
    }
    
    if (startTime >= endTime) {
        showMessage('⚠️ 结束时间必须在开始时间之后!', 'warning');
        return;
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;
    
    database.ref(`schedules/${currentScheduleId}`).update({
        employeeId: employeeId,
        employeeName: employee.name,
        employeePosition: employee.position,
        date: date,
        startTime: startTime,
        endTime: endTime,
        isDayOff: false,
        updatedAt: Date.now()
    })
    .then(() => {
        closeModal('editModal');
        showMessage('✅ 排班更新成功!', 'success');
        currentScheduleId = null;
    })
    .catch(error => {
        console.error('❌ Error updating schedule:', error);
        showMessage('❌ 更新排班失败!', 'error');
    });
}

function deleteCurrentSchedule() {
    if (!currentScheduleId) return;
    
    if (!confirm('确定要删除这个排班吗?')) {
        return;
    }
    
    database.ref(`schedules/${currentScheduleId}`).remove()
    .then(() => {
        closeModal('editModal');
        showMessage('✅ 排班删除成功!', 'success');
        currentScheduleId = null;
    })
    .catch(error => {
        console.error('❌ Error deleting schedule:', error);
        showMessage('❌ 删除排班失败!', 'error');
    });
}

function deleteSchedule(scheduleId) {
    if (!confirm('确定要删除这个排班吗?')) {
        return;
    }
    
    database.ref(`schedules/${scheduleId}`).remove()
    .then(() => {
        showMessage('✅ 排班删除成功!', 'success');
    })
    .catch(error => {
        console.error('❌ Error deleting schedule:', error);
        showMessage('❌ 删除排班失败!', 'error');
    });
}

function filterSchedules() {
    const filterEmployee = document.getElementById('filterEmployee').value;
    const filterPosition = document.getElementById('filterPosition').value;
    const filterWeek = document.getElementById('filterWeek').value;
    
    let filteredSchedules = Object.values(schedules);
    
    // Filter by employee
    if (filterEmployee) {
        filteredSchedules = filteredSchedules.filter(s => s.employeeId === filterEmployee);
    }
    
    // Filter by position
    if (filterPosition) {
        filteredSchedules = filteredSchedules.filter(s => s.employeePosition === filterPosition);
    }
    
    // Filter by week
    if (filterWeek !== 'all') {
        const today = new Date();
        const startOfWeek = new Date(today);
        
        if (filterWeek === 'next') {
            startOfWeek.setDate(today.getDate() + 7 - today.getDay() + 1);
        } else {
            // current week
            startOfWeek.setDate(today.getDate() - today.getDay() + 1);
        }
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        
        filteredSchedules = filteredSchedules.filter(schedule => {
            const scheduleDate = new Date(schedule.date);
            return scheduleDate >= startOfWeek && scheduleDate <= endOfWeek;
        });
    }
    
    // Sort by date and time
    filteredSchedules.sort((a, b) => {
        if (a.date === b.date) {
            return a.startTime.localeCompare(b.startTime);
        }
        return a.date.localeCompare(b.date);
    });
    
    renderFilteredSchedules(filteredSchedules);
}

function resetFilters() {
    document.getElementById('filterEmployee').value = '';
    document.getElementById('filterPosition').value = '';
    document.getElementById('filterWeek').value = 'current';
    renderSchedules();
}

function renderSchedules() {
    const schedulesArray = Object.keys(schedules).map(id => ({
        id: id,
        ...schedules[id]
    }));
    
    renderFilteredSchedules(schedulesArray);
}

function renderFilteredSchedules(schedulesArray) {
    const container = document.getElementById('scheduleList');
    
    if (schedulesArray.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar" style="font-size:48px;color:#ccc;margin-bottom:15px;"></i>
                <h3>暂无排班</h3>
                <p>添加第一个排班开始管理</p>
            </div>
        `;
        return;
    }
    
    // Group by date
    const groupedByDate = {};
    schedulesArray.forEach(schedule => {
        if (!groupedByDate[schedule.date]) {
            groupedByDate[schedule.date] = [];
        }
        groupedByDate[schedule.date].push(schedule);
    });
    
    // Render by date
    container.innerHTML = Object.keys(groupedByDate).sort().map(date => `
        <div class="schedule-date-group">
            <div class="date-header">
                <h3><i class="fas fa-calendar-day"></i> ${formatDate(date)}</h3>
                <span class="date-shift-count">${groupedByDate[date].length} 个班次</span>
            </div>
            <div class="schedule-items">
                ${groupedByDate[date].map(schedule => `
                    <div class="schedule-item ${schedule.isDayOff ? 'rest-day' : ''}">
                        <div class="schedule-info">
                            <div class="schedule-employee">
                                <span>👤 ${schedule.employeeName}</span>
                                <span class="employee-position-badge">
                                    <i class="fas ${schedule.employeePosition === '厨房区' ? 'fa-utensils' : 'fa-door-open'}"></i>
                                    ${schedule.employeePosition}
                                </span>
                            </div>
                            <div class="schedule-time">
                                <div class="time-badge">
                                    <i class="fas fa-clock"></i>
                                    ${schedule.isDayOff ? '休息日' : `${schedule.startTime} - ${schedule.endTime}`}
                                </div>
                                ${schedule.notes ? `<div class="notes">${schedule.notes}</div>` : ''}
                            </div>
                        </div>
                        <div class="schedule-actions">
                            <button class="action-btn edit-btn" onclick="editSchedule('${schedule.id}')">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="deleteSchedule('${schedule.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// ==================== QUICK ACTIONS ====================
function openQuickAdd() {
    openModal('quickAddModal');
}

function quickAddShift(shiftName, startTime, endTime) {
    document.getElementById('startTime').value = startTime;
    document.getElementById('endTime').value = endTime;
    
    showMessage(`✅ ${shiftName} 时间已设置: ${startTime} - ${endTime}`, 'success');
    closeModal('quickAddModal');
}

function quickAddWeek() {
    const employeeSelect = document.getElementById('selectEmployee');
    const employeeId = employeeSelect.value;
    
    if (!employeeId) {
        showMessage('⚠️ 请先选择员工!', 'warning');
        return;
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;
    
    if (!confirm(`为 ${employee.name} 添加整周排班吗?\n周一到周五: 08:00-17:00`)) {
        return;
    }
    
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    
    const promises = [];
    
    // Add Monday to Friday
    for (let i = 0; i < 5; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        // Check if schedule already exists
        const existingSchedule = Object.values(schedules).find(s => 
            s.employeeId === employeeId && s.date === dateString
        );
        
        if (!existingSchedule) {
            const scheduleRef = database.ref('schedules').push();
            promises.push(
                scheduleRef.set({
                    employeeId: employeeId,
                    employeeName: employee.name,
                    employeePosition: employee.position,
                    date: dateString,
                    startTime: '08:00',
                    endTime: '17:00',
                    createdAt: Date.now(),
                    isDayOff: false
                })
            );
        }
    }
    
    Promise.all(promises)
    .then(() => {
        showMessage(`✅ ${employee.name} 的整周排班添加成功!`, 'success');
    })
    .catch(error => {
        console.error('❌ Error adding weekly schedule:', error);
        showMessage('❌ 添加整周排班失败!', 'error');
    });
}

// ==================== LOOKUP & EXPORT ====================
function lookupEmployeeSchedule(employeeId = null) {
    if (!employeeId) {
        employeeId = document.getElementById('lookupEmployeeSelect').value;
        if (!employeeId) return;
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) return;
    
    // Get employee's schedules
    const employeeSchedules = Object.values(schedules).filter(s => s.employeeId === employeeId);
    
    // Group by week
    const weeklySchedules = {};
    employeeSchedules.forEach(schedule => {
        const weekNumber = getWeekNumber(new Date(schedule.date));
        if (!weeklySchedules[weekNumber]) {
            weeklySchedules[weekNumber] = [];
        }
        weeklySchedules[weekNumber].push(schedule);
    });
    
    const resultDiv = document.getElementById('lookupResult');
    resultDiv.innerHTML = `
        <div class="lookup-header">
            <h4>👤 ${employee.name} (${employee.position})</h4>
            <p>共 ${employeeSchedules.length} 个排班记录</p>
        </div>
        ${Object.keys(weeklySchedules).map(week => `
            <div class="week-schedule">
                <h5>第 ${week} 周</h5>
                ${weeklySchedules[week].map(schedule => `
                    <div class="schedule-item">
                        <span class="date">${formatDate(schedule.date)}</span>
                        <span class="time">${schedule.isDayOff ? '休息日' : schedule.startTime + ' - ' + schedule.endTime}</span>
                    </div>
                `).join('')}
            </div>
        `).join('')}
        <div class="lookup-actions">
            <button class="btn-primary" onclick="exportEmployeeSchedule('${employeeId}')">
                <i class="fas fa-download"></i> 导出此员工排班
            </button>
        </div>
    `;
    
    // Auto-select employee in dropdown
    document.getElementById('lookupEmployeeSelect').value = employeeId;
    
    openModal('lookupModal');
}

function exportEmployeeSchedule(employeeId = null) {
    if (!employeeId) {
        employeeId = prompt('请输入要导出的员工ID:');
        if (!employeeId) return;
    }
    
    const employee = employees.find(emp => emp.id === employeeId);
    if (!employee) {
        showMessage('❌ 员工不存在!', 'error');
        return;
    }
    
    const employeeSchedules = Object.values(schedules).filter(s => s.employeeId === employeeId);
    
    if (employeeSchedules.length === 0) {
        showMessage('❌ 此员工暂无排班记录!', 'warning');
        return;
    }
    
    // Create printable content
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${employee.name} 排班表</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .header h1 { color: #333; }
                .info { margin-bottom: 20px; }
                .schedule-table { width: 100%; border-collapse: collapse; }
                .schedule-table th, .schedule-table td { 
                    border: 1px solid #ddd; 
                    padding: 12px; 
                    text-align: left; 
                }
                .schedule-table th { background: #f5f5f5; }
                .day-off { background: #fff5f5; }
                .footer { margin-top: 30px; text-align: center; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${employee.name} 排班表</h1>
                <p>职位: ${employee.position} | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            </div>
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>星期</th>
                        <th>工作时间</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
                    ${employeeSchedules.sort((a,b) => a.date.localeCompare(b.date)).map(schedule => `
                        <tr class="${schedule.isDayOff ? 'day-off' : ''}">
                            <td>${formatDate(schedule.date)}</td>
                            <td>${getDayName(new Date(schedule.date))}</td>
                            <td>${schedule.isDayOff ? '休息日' : schedule.startTime + ' - ' + schedule.endTime}</td>
                            <td>${schedule.notes || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="footer">
                <p>共 ${employeeSchedules.length} 个排班记录 | ${employee.position}</p>
            </div>
        </body>
        </html>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
    
    showMessage('✅ 导出成功! 正在打开打印预览...', 'success');
}

function printAllSchedule() {
    if (Object.keys(schedules).length === 0) {
        showMessage('❌ 暂无排班记录!', 'warning');
        return;
    }
    
    // Group by employee
    const schedulesByEmployee = {};
    Object.values(schedules).forEach(schedule => {
        if (!schedulesByEmployee[schedule.employeeId]) {
            schedulesByEmployee[schedule.employeeId] = {
                employee: employees.find(emp => emp.id === schedule.employeeId),
                schedules: []
            };
        }
        schedulesByEmployee[schedule.employeeId].schedules.push(schedule);
    });
    
    // Create printable content
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>所有员工排班表</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .employee-section { margin-bottom: 40px; page-break-inside: avoid; }
                .employee-header { background: #f5f5f5; padding: 15px; border-radius: 5px; }
                .schedule-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .schedule-table th, .schedule-table td { 
                    border: 1px solid #ddd; 
                    padding: 10px; 
                    text-align: left; 
                }
                .day-off { background: #fff5f5; }
                .footer { margin-top: 30px; text-align: center; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>所有员工排班表</h1>
                <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            </div>
            
            ${Object.values(schedulesByEmployee).map(data => `
                <div class="employee-section">
                    <div class="employee-header">
                        <h3>${data.employee.name} (${data.employee.position})</h3>
                    </div>
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th>日期</th>
                                <th>工作时间</th>
                                <th>备注</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.schedules.sort((a,b) => a.date.localeCompare(b.date)).map(schedule => `
                                <tr class="${schedule.isDayOff ? 'day-off' : ''}">
                                    <td>${formatDate(schedule.date)}</td>
                                    <td>${schedule.isDayOff ? '休息日' : schedule.startTime + ' - ' + schedule.endTime}</td>
                                    <td>${schedule.notes || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `).join('')}
            
            <div class="footer">
                <p>总员工数: ${employees.length} | 总排班数: ${Object.keys(schedules).length}</p>
            </div>
        </body>
        </html>
    `;
    
    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
    
    showMessage('✅ 正在生成全部排班表...', 'success');
}

function exportWeeklyOverview() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    
    const weekSchedules = {};
    
    // Initialize week days
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        weekSchedules[dateString] = [];
    }
    
    // Populate schedules
    Object.values(schedules).forEach(schedule => {
        const scheduleDate = new Date(schedule.date);
        if (scheduleDate >= startOfWeek && scheduleDate < new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000)) {
            weekSchedules[schedule.date].push(schedule);
        }
    });
    
    // Create image for export
    const element = document.getElementById('weeklyOverview');
    
    html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `周排班表_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showMessage('✅ 周排班表导出成功!', 'success');
    });
}

function exportByPosition() {
    const position = prompt('选择要导出的职位:\n1. 前台/服务区\n2. 厨房区');
    if (!position) return;
    
    const positionSchedules = Object.values(schedules).filter(s => s.employeePosition === position);
    const positionEmployees = employees.filter(emp => emp.position === position);
    
    if (positionSchedules.length === 0) {
        showMessage(`❌ ${position} 暂无排班记录!`, 'warning');
        return;
    }
    
    // Create printable content
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${position} 排班表</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .stats { display: flex; justify-content: space-around; margin: 20px 0; }
                .stat { text-align: center; }
                .schedule-table { width: 100%; border-collapse: collapse; }
                .schedule-table th, .schedule-table td { 
                    border: 1px solid #ddd; 
                    padding: 10px; 
                    text-align: left; 
                }
                .schedule-table th { background: #f5f5f5; }
                .footer { margin-top: 30px; text-align: center; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${position} 排班表</h1>
                <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
            </div>
            
            <div class="stats">
                <div class="stat">
                    <h3>${positionEmployees.length}</h3>
                    <p>员工数</p>
                </div>
                <div class="stat">
                    <h3>${positionSchedules.length}</h3>
                    <p>排班数</p>
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>员工</th>
                        <th>日期</th>
                        <th>工作时间</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
                    ${positionSchedules.sort((a,b) => a.date.localeCompare(b.date)).map(schedule => `
                        <tr>
                            <td>${schedule.employeeName}</td>
                            <td>${formatDate(schedule.date)}</td>
                            <td>${schedule.isDayOff ? '休息日' : schedule.startTime + ' - ' + schedule.endTime}</td>
                            <td>${schedule.notes || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="footer">
                <p>${position} | 共 ${positionEmployees.length} 名员工</p>
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// ==================== WEEKLY OVERVIEW ====================
function updateWeeklyOverview() {
    const container = document.getElementById('weekSchedule');
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1);
    
    let html = '';
    
    // Generate week days (Mon-Sun)
    for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        const dayName = getDayName(date);
        
        // Get schedules for this day
        const daySchedules = Object.values(schedules).filter(s => s.date === dateString);
        
        html += `
            <div class="day-card ${isToday(date) ? 'today' : ''}">
                <div class="day-header">
                    <div class="day-name">${dayName}</div>
                    <div class="day-date">${formatDateShort(date)}</div>
                </div>
                <div class="day-shifts">
                    ${daySchedules.length > 0 ? 
                        daySchedules.map(schedule => `
                            <div class="day-shift ${schedule.isDayOff ? 'rest' : ''}">
                                <div class="shift-employee">
                                    <span class="employee-name">${schedule.employeeName}</span>
                                    <span class="employee-position">${schedule.employeePosition === '厨房区' ? '🍳' : '💁'}</span>
                                </div>
                                <div class="shift-time">
                                    ${schedule.isDayOff ? '休息' : schedule.startTime + '-' + schedule.endTime}
                                </div>
                            </div>
                        `).join('') : 
                        '<div class="no-shifts">暂无排班</div>'
                    }
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

// ==================== STATISTICS ====================
function updateStats() {
    document.getElementById('totalEmployees').textContent = employees.length;
    document.getElementById('totalShifts').textContent = Object.keys(schedules).length;
    
    // Today's shifts
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = Object.values(schedules).filter(s => s.date === today && !s.isDayOff).length;
    document.getElementById('activeShifts').textContent = todayShifts;
    
    // Count by position
    const frontDeskCount = employees.filter(emp => emp.position === '前台/服务区').length;
    const kitchenCount = employees.filter(emp => emp.position === '厨房区').length;
    document.getElementById('frontDesk').textContent = frontDeskCount;
    document.getElementById('kitchen').textContent = kitchenCount;
}

// ==================== MODAL FUNCTIONS ====================
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
    document.body.style.overflow = 'auto';
}

function openExportModal() {
    openModal('exportModal');
}

// Close modals when clicking outside
window.onclick = function(event) {
    document.querySelectorAll('.modal').forEach(modal => {
        if (event.target === modal) {
            closeModal(modal.id);
        }
    });
};

// ==================== UTILITY FUNCTIONS ====================
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    return date.toLocaleDateString('zh-CN', options);
}

function formatDateShort(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('zh-CN', options);
}

function getDayName(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
}

function getWeekNumber(date) {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}

function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

function showMessage(text, type = 'info') {
    const message = document.createElement('div');
    message.className = `message message-${type}`;
    message.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${text}</span>
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        message.classList.remove('show');
        setTimeout(() => message.remove(), 300);
    }, 3000);
}

// Add message styles dynamically
const messageStyles = document.createElement('style');
messageStyles.textContent = `
    .message {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 3000;
        transform: translateX(150%);
        transition: transform 0.3s ease;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        font-weight: 500;
        max-width: 400px;
    }
    .message.show {
        transform: translateX(0);
    }
    .message-success {
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        border-left: 5px solid #2E7D32;
    }
    .message-error {
        background: linear-gradient(135deg, #f44336, #e53935);
        color: white;
        border-left: 5px solid #c62828;
    }
    .message-warning {
        background: linear-gradient(135deg, #ff9800, #f57c00);
        color: white;
        border-left: 5px solid #ef6c00;
    }
    .message-info {
        background: linear-gradient(135deg, #2196F3, #1976D2);
        color: white;
        border-left: 5px solid #1565C0;
    }
`;
document.head.appendChild(messageStyles);
