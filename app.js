// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let currentWeek = 0;
let selectedEmployee = null;
let selectedPosition = '前台/服务区';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 智能排班系统启动");
    
    // 初始化日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleDate').value = today;
    document.getElementById('scheduleDate').min = today;
    
    // 设置当前日期显示
    updateCurrentDate();
    
    // 加载数据
    loadEmployees();
    loadSchedules();
    
    // 设置事件监听器
    setupEventListeners();
});

function setupEventListeners() {
    // 每周自动更新日期显示
    setInterval(updateCurrentDate, 60000); // 每分钟更新一次
    
    // 点击背景关闭模态框
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });
}

function updateCurrentDate() {
    const now = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    document.getElementById('currentDate').textContent = 
        now.toLocaleDateString('zh-CN', options);
}

// ==================== VIEW MANAGEMENT ====================
function switchView(viewName) {
    // 隐藏所有视图
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // 更新导航按钮状态
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的视图
    document.getElementById(viewName + 'View').classList.add('active');
    
    // 激活对应的导航按钮
    document.querySelector(`.nav-btn[data-view="${viewName}"]`).classList.add('active');
    
    // 视图特定的初始化
    if (viewName === 'weekly') {
        renderWeeklySchedule();
    } else if (viewName === 'schedule') {
        updateEmployeeSelect();
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
        
        renderEmployeeCards();
        updateEmployeeSelect();
    });
}

function renderEmployeeCards() {
    const container = document.getElementById('employeeCards');
    const searchTerm = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
    
    let filteredEmployees = employees;
    if (searchTerm) {
        filteredEmployees = employees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm)
        );
    }
    
    if (filteredEmployees.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>${searchTerm ? '未找到员工' : '暂无员工'}</p>
            </div>
        `;
        return;
    }
    
    // 按职位分组
    const groupedEmployees = {
        '前台/服务区': [],
        '厨房区': []
    };
    
    filteredEmployees.forEach(emp => {
        groupedEmployees[emp.position].push(emp);
    });
    
    let html = '';
    
    // 前台/服务区员工
    if (groupedEmployees['前台/服务区'].length > 0) {
        html += `<h3 style="margin: 20px 0 10px; color: #7209b7; font-size: 14px;">
                    <i class="fas fa-door-open"></i> 前台/服务区
                 </h3>`;
        groupedEmployees['前台/服务区'].forEach(emp => {
            html += generateEmployeeCard(emp);
        });
    }
    
    // 厨房区员工
    if (groupedEmployees['厨房区'].length > 0) {
        html += `<h3 style="margin: 20px 0 10px; color: #f8961e; font-size: 14px;">
                    <i class="fas fa-utensils"></i> 厨房区
                 </h3>`;
        groupedEmployees['厨房区'].forEach(emp => {
            html += generateEmployeeCard(emp);
        });
    }
    
    container.innerHTML = html;
}

function generateEmployeeCard(employee) {
    const weeklyHours = calculateWeeklyHours(employee.id);
    const monthlyHours = calculateMonthlyHours(employee.id);
    const thisWeekSchedule = getThisWeekSchedule(employee.id);
    
    return `
        <div class="employee-card" onclick="showEmployeeDetail('${employee.id}')">
            <div class="employee-avatar">
                ${employee.name.charAt(0)}
            </div>
            <div class="employee-info">
                <div class="employee-name">${employee.name}</div>
                <div class="employee-position ${employee.position === '厨房区' ? 'kitchen' : 'front-desk'}">
                    <i class="fas ${employee.position === '厨房区' ? 'fa-utensils' : 'fa-door-open'}"></i>
                    ${employee.position}
                </div>
                <div class="employee-stats">
                    <div class="stat-item">
                        <i class="fas fa-clock"></i>
                        <span>本周: ${weeklyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>本月: ${monthlyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-check"></i>
                        <span>${thisWeekSchedule.workDays}天班</span>
                    </div>
                </div>
            </div>
            <div class="employee-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `;
}

function searchEmployees() {
    renderEmployeeCards();
}

function showEmployeeDetail(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    selectedEmployee = employeeId;
    
    // 更新模态框内容
    document.getElementById('modalEmployeeName').textContent = employee.name;
    document.getElementById('modalEmployeePosition').textContent = employee.position;
    
    // 计算工时
    const weeklyHours = calculateWeeklyHours(employeeId);
    const monthlyHours = calculateMonthlyHours(employeeId);
    
    document.getElementById('modalWeekHours').textContent = `${weeklyHours} 小时`;
    document.getElementById('modalMonthHours').textContent = `${monthlyHours} 小时`;
    
    // 显示本周排班
    showEmployeeWeekSchedule(employeeId);
    
    // 显示模态框
    openModal('employeeModal');
}

function showEmployeeWeekSchedule(employeeId) {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    const days = generateWeekDays(startDate);
    
    const container = document.getElementById('employeeWeekSchedule');
    container.innerHTML = `
        <div style="margin-bottom: 16px; font-weight: 500; color: var(--dark);">
            本周排班 (${formatDateRange(startDate, endDate)})
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px;">
            ${days.map(day => {
                const schedule = weekSchedule.find(s => s.date === day.dateString);
                return `
                    <div style="text-align: center; padding: 8px; background: ${schedule ? (schedule.isDayOff ? '#fff7ed' : '#f0f9ff') : '#f8fafc'}; 
                         border: 1px solid ${schedule ? (schedule.isDayOff ? '#fed7aa' : '#bae6fd') : '#e2e8f0'}; 
                         border-radius: 6px;">
                        <div style="font-size: 12px; color: var(--gray);">${day.name}</div>
                        <div style="font-size: 11px; margin: 4px 0; font-weight: 500;">
                            ${schedule ? (schedule.isDayOff ? '休息' : schedule.startTime.substring(0, 5)) : '无'}
                        </div>
                        ${schedule && !schedule.isDayOff ? 
                            `<div style="font-size: 10px; color: var(--gray);">${schedule.endTime.substring(0, 5)}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function showAddEmployee() {
    document.getElementById('newEmployeeName').value = '';
    selectedPosition = '前台/服务区';
    document.querySelectorAll('.position-option').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.position-option[data-position="前台/服务区"]').classList.add('active');
    openModal('addEmployeeModal');
}

function selectPosition(button) {
    selectedPosition = button.dataset.position;
    document.querySelectorAll('.position-option').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
}

function addEmployee() {
    const nameInput = document.getElementById('newEmployeeName');
    const name = nameInput.value.trim();
    
    if (!name) {
        showMessage('请输入员工姓名', 'warning');
        return;
    }
    
    if (employees.some(e => e.name.toLowerCase() === name.toLowerCase())) {
        showMessage('员工已存在', 'warning');
        return;
    }
    
    database.ref('employees').push({
        name: name,
        position: selectedPosition,
        createdAt: Date.now()
    })
    .then(() => {
        closeModal('addEmployeeModal');
        showMessage(`员工 ${name} 添加成功`, 'success');
        nameInput.value = '';
    })
    .catch(error => {
        showMessage('添加失败: ' + error.message, 'error');
    });
}

function updateEmployeeSelect() {
    const select = document.getElementById('scheduleEmployee');
    select.innerHTML = '<option value="">选择员工</option>';
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${emp.position})`;
        select.appendChild(option);
    });
}

// ==================== SCHEDULE MANAGEMENT ====================
function loadSchedules() {
    const schedulesRef = database.ref('schedules');
    
    schedulesRef.on('value', (snapshot) => {
        schedules = snapshot.val() || {};
        renderWeeklySchedule();
        updateTodaysSchedule();
    });
}

function selectType(type) {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.type-btn[data-type="${type}"]`).classList.add('active');
}

function addSchedule() {
    const employeeId = document.getElementById('scheduleEmployee').value;
    const date = document.getElementById('scheduleDate').value;
    const startTime = document.getElementById('scheduleStart').value;
    const endTime = document.getElementById('scheduleEnd').value;
    const type = document.querySelector('.type-btn.active').dataset.type;
    
    // 验证
    if (!employeeId) {
        showMessage('请选择员工', 'warning');
        return;
    }
    
    if (!date) {
        showMessage('请选择日期', 'warning');
        return;
    }
    
    if (type === 'work' && (!startTime || !endTime)) {
        showMessage('请填写工作时间', 'warning');
        return;
    }
    
    if (type === 'work' && startTime >= endTime) {
        showMessage('结束时间必须晚于开始时间', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // 检查是否已有排班
    const existingSchedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    const scheduleData = {
        employeeId: employeeId,
        employeeName: employee.name,
        employeePosition: employee.position,
        date: date,
        isDayOff: type === 'rest',
        updatedAt: Date.now()
    };
    
    if (type === 'work') {
        scheduleData.startTime = startTime;
        scheduleData.endTime = endTime;
    } else {
        scheduleData.startTime = '00:00';
        scheduleData.endTime = '00:00';
        scheduleData.notes = '休息日';
    }
    
    if (existingSchedule) {
        // 更新现有排班
        const scheduleId = Object.keys(schedules).find(key => 
            schedules[key].employeeId === employeeId && schedules[key].date === date
        );
        
        database.ref(`schedules/${scheduleId}`).update(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage('排班更新成功', 'success');
        });
    } else {
        // 添加新排班
        scheduleData.createdAt = Date.now();
        
        database.ref('schedules').push().set(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage('排班添加成功', 'success');
        });
    }
}

function resetScheduleForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleDate').value = today;
    document.getElementById('scheduleStart').value = '08:00';
    document.getElementById('scheduleEnd').value = '17:00';
    selectType('work');
}

function quickWeekSchedule() {
    const employeeId = document.getElementById('scheduleEmployee').value;
    const startTime = document.getElementById('scheduleStart').value;
    const endTime = document.getElementById('scheduleEnd').value;
    
    if (!employeeId) {
        showMessage('请先选择员工', 'warning');
        return;
    }
    
    if (!startTime || !endTime) {
        showMessage('请先设置工作时间', 'warning');
        return;
    }
    
    if (startTime >= endTime) {
        showMessage('结束时间必须晚于开始时间', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    if (!confirm(`为 ${employee.name} 设置整周排班?\n工作日: ${startTime}-${endTime}`)) {
        return;
    }
    
    const { startDate } = getWeekDates(0);
    const promises = [];
    
    // 周一到周五上班，周末休息
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        // 跳过过去的日期
        if (date < new Date()) continue;
        
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        
        const scheduleData = {
            employeeId: employeeId,
            employeeName: employee.name,
            employeePosition: employee.position,
            date: dateString,
            createdAt: Date.now()
        };
        
        if (isWeekend) {
            // 周末休息
            Object.assign(scheduleData, {
                startTime: '00:00',
                endTime: '00:00',
                isDayOff: true,
                notes: '周末休息'
            });
        } else {
            // 工作日上班
            Object.assign(scheduleData, {
                startTime: startTime,
                endTime: endTime,
                isDayOff: false
            });
        }
        
        // 检查是否已有排班
        const existingSchedule = Object.values(schedules).find(s => 
            s.employeeId === employeeId && s.date === dateString
        );
        
        if (existingSchedule) {
            const scheduleId = Object.keys(schedules).find(key => 
                schedules[key].employeeId === employeeId && schedules[key].date === dateString
            );
            
            promises.push(
                database.ref(`schedules/${scheduleId}`).update(scheduleData)
            );
        } else {
            promises.push(
                database.ref('schedules').push().set(scheduleData)
            );
        }
    }
    
    Promise.all(promises)
    .then(() => {
        showMessage('整周排班设置成功', 'success');
    })
    .catch(error => {
        showMessage('设置失败: ' + error.message, 'error');
    });
}

// ==================== WEEKLY VIEW ====================
function renderWeeklySchedule() {
    const container = document.getElementById('weeklySchedule');
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    const days = generateWeekDays(startDate);
    
    // 按员工分组
    const schedulesByEmployee = {};
    weekSchedule.forEach(schedule => {
        if (!schedulesByEmployee[schedule.employeeId]) {
            schedulesByEmployee[schedule.employeeId] = {};
        }
        schedulesByEmployee[schedule.employeeId][schedule.date] = schedule;
    });
    
    // 生成表头
    let html = `
        <div class="week-header">
            <div class="week-header-cell">员工</div>
            ${days.map(day => `
                <div class="week-header-cell">
                    <div>${day.name}</div>
                    <div style="font-size: 11px; opacity: 0.8;">${day.date}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    // 生成员工行
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id] || {};
        
        html += `
            <div class="week-row">
                <div class="week-cell">
                    <div style="font-weight: 500; font-size: 14px;">${employee.name}</div>
                    <div style="font-size: 12px; color: var(--gray);">${employee.position}</div>
                </div>
                ${days.map(day => {
                    const schedule = employeeSchedules[day.dateString];
                    let scheduleClass = 'empty';
                    let scheduleText = '';
                    
                    if (schedule) {
                        if (schedule.isDayOff) {
                            scheduleClass = 'rest';
                            scheduleText = '休息';
                        } else {
                            scheduleClass = 'work';
                            scheduleText = `${schedule.startTime.substring(0, 5)}<br>${schedule.endTime.substring(0, 5)}`;
                        }
                    }
                    
                    return `
                        <div class="week-cell">
                            <div class="day-schedule-item ${scheduleClass}" 
                                 onclick="editDaySchedule('${employee.id}', '${day.dateString}')">
                                ${scheduleText || '点击添加'}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // 更新周范围显示
    document.getElementById('weekRange').textContent = 
        `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function changeWeek(direction) {
    currentWeek += direction;
    renderWeeklySchedule();
}

function editDaySchedule(employeeId, date) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const schedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    const container = document.getElementById('editScheduleContent');
    container.innerHTML = `
        <div style="margin-bottom: 20px;">
            <div style="font-weight: 500; margin-bottom: 8px;">${employee.name}</div>
            <div style="color: var(--gray); font-size: 14px;">${formatDate(date)} ${getDayName(new Date(date))}</div>
        </div>
        
        <div style="margin-bottom: 20px;">
            <div style="font-size: 14px; margin-bottom: 12px; color: var(--dark);">排班类型</div>
            <div style="display: flex; gap: 12px; margin-bottom: 20px;">
                <button onclick="updateDayScheduleType('${employeeId}', '${date}', 'work')" 
                        style="flex: 1; padding: 16px; border: 2px solid ${!schedule || !schedule.isDayOff ? 'var(--primary)' : 'var(--border)'}; 
                               background: ${!schedule || !schedule.isDayOff ? 'var(--primary-light)' : 'white'}; 
                               border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-briefcase" style="color: ${!schedule || !schedule.isDayOff ? 'var(--primary)' : 'var(--gray)'}; 
                                                          font-size: 20px; margin-bottom: 8px;"></i>
                    <div style="font-weight: 500; color: ${!schedule || !schedule.isDayOff ? 'var(--primary)' : 'var(--dark)'};">上班</div>
                </button>
                <button onclick="updateDayScheduleType('${employeeId}', '${date}', 'rest')" 
                        style="flex: 1; padding: 16px; border: 2px solid ${schedule && schedule.isDayOff ? 'var(--warning)' : 'var(--border)'}; 
                               background: ${schedule && schedule.isDayOff ? '#fff7ed' : 'white'}; 
                               border-radius: 8px; cursor: pointer;">
                    <i class="fas fa-umbrella-beach" style="color: ${schedule && schedule.isDayOff ? 'var(--warning)' : 'var(--gray)'}; 
                                                            font-size: 20px; margin-bottom: 8px;"></i>
                    <div style="font-weight: 500; color: ${schedule && schedule.isDayOff ? 'var(--warning)' : 'var(--dark)'};">休息</div>
                </button>
            </div>
        </div>
        
        ${(!schedule || !schedule.isDayOff) ? `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 14px; margin-bottom: 12px; color: var(--dark);">工作时间</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    <div>
                        <div style="font-size: 13px; margin-bottom: 8px; color: var(--gray);">开始时间</div>
                        <input type="time" id="editStartTime" value="${schedule ? schedule.startTime : '08:00'}" 
                               style="width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 8px;"
                               onchange="updateWorkTime('${employeeId}', '${date}', 'start', this.value)">
                    </div>
                    <div>
                        <div style="font-size: 13px; margin-bottom: 8px; color: var(--gray);">结束时间</div>
                        <input type="time" id="editEndTime" value="${schedule ? schedule.endTime : '17:00'}" 
                               style="width: 100%; padding: 12px; border: 2px solid var(--border); border-radius: 8px;"
                               onchange="updateWorkTime('${employeeId}', '${date}', 'end', this.value)">
                    </div>
                </div>
            </div>
        ` : ''}
        
        <div style="display: flex; gap: 12px; margin-top: 24px;">
            <button onclick="deleteDaySchedule('${employeeId}', '${date}')" 
                    style="flex: 1; padding: 14px; background: #fee2e2; border: 1px solid #fecaca; 
                           color: #dc2626; border-radius: 8px; font-weight: 500; cursor: pointer;">
                <i class="fas fa-trash"></i> 删除
            </button>
            <button onclick="closeModal('editModal')" 
                    style="flex: 1; padding: 14px; background: var(--light); border: 1px solid var(--border); 
                           color: var(--dark); border-radius: 8px; font-weight: 500; cursor: pointer;">
                关闭
            </button>
        </div>
    `;
    
    openModal('editModal');
}

function updateDayScheduleType(employeeId, date, type) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const scheduleData = {
        employeeId: employeeId,
        employeeName: employee.name,
        employeePosition: employee.position,
        date: date,
        isDayOff: type === 'rest',
        updatedAt: Date.now()
    };
    
    if (type === 'work') {
        const startTime = document.getElementById('editStartTime')?.value || '08:00';
        const endTime = document.getElementById('editEndTime')?.value || '17:00';
        scheduleData.startTime = startTime;
        scheduleData.endTime = endTime;
    } else {
        scheduleData.startTime = '00:00';
        scheduleData.endTime = '00:00';
        scheduleData.notes = '休息日';
    }
    
    const existingSchedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    if (existingSchedule) {
        const scheduleId = Object.keys(schedules).find(key => 
            schedules[key].employeeId === employeeId && schedules[key].date === date
        );
        
        database.ref(`schedules/${scheduleId}`).update(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage('排班更新成功', 'success');
        });
    } else {
        scheduleData.createdAt = Date.now();
        
        database.ref('schedules').push().set(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage('排班添加成功', 'success');
        });
    }
}

function updateWorkTime(employeeId, date, timeType, timeValue) {
    const schedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    if (!schedule || schedule.isDayOff) return;
    
    const scheduleId = Object.keys(schedules).find(key => 
        schedules[key].employeeId === employeeId && schedules[key].date === date
    );
    
    const updateData = {};
    updateData[timeType === 'start' ? 'startTime' : 'endTime'] = timeValue;
    updateData.updatedAt = Date.now();
    
    database.ref(`schedules/${scheduleId}`).update(updateData)
    .then(() => {
        showMessage('时间更新成功', 'success');
    });
}

function deleteDaySchedule(employeeId, date) {
    if (!confirm('确定删除这个排班吗？')) return;
    
    const schedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    if (!schedule) return;
    
    const scheduleId = Object.keys(schedules).find(key => 
        schedules[key].employeeId === employeeId && schedules[key].date === date
    );
    
    database.ref(`schedules/${scheduleId}`).remove()
    .then(() => {
        closeModal('editModal');
        showMessage('排班已删除', 'success');
    });
}

// ==================== QUICK ACTIONS ====================
function showTodaySchedule() {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = Object.values(schedules).filter(s => s.date === today);
    
    const container = document.getElementById('todaySchedule');
    
    if (todaySchedules.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: var(--gray);">
                <i class="fas fa-calendar" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
                <p>今日暂无排班</p>
            </div>
        `;
    } else {
        container.innerHTML = todaySchedules.map(schedule => {
            const employee = employees.find(e => e.id === schedule.employeeId);
            if (!employee) return '';
            
            return `
                <div class="today-item ${schedule.isDayOff ? 'rest' : 'work'}">
                    <div>
                        <div style="font-weight: 500;">${employee.name}</div>
                        <div style="font-size: 13px; color: var(--gray);">${employee.position}</div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 500; color: ${schedule.isDayOff ? 'var(--warning)' : 'var(--success)'}">
                            ${schedule.isDayOff ? '休息日' : `${schedule.startTime.substring(0, 5)} - ${schedule.endTime.substring(0, 5)}`}
                        </div>
                        <div style="font-size: 12px; color: var(--gray);">今日</div>
                    </div>
                </div>
            `;
        }).join('');
    }
    
    openModal('todayModal');
}

function showEmployeeStats() {
    const container = document.getElementById('statsContent');
    
    // 计算统计数据
    const totalEmployees = employees.length;
    const totalSchedules = Object.keys(schedules).length;
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = Object.values(schedules).filter(s => s.date === today && !s.isDayOff).length;
    const weekHours = employees.reduce((sum, emp) => sum + calculateWeeklyHours(emp.id), 0);
    
    container.innerHTML = `
        <div class="stat-card">
            <h4>${totalEmployees}</h4>
            <p>总员工数</p>
        </div>
        <div class="stat-card">
            <h4>${totalSchedules}</h4>
            <p>总排班数</p>
        </div>
        <div class="stat-card">
            <h4>${todayShifts}</h4>
            <p>今日班次</p>
        </div>
        <div class="stat-card">
            <h4>${weekHours}</h4>
            <p>本周总工时</p>
        </div>
        <div class="stat-card">
            <h4>${employees.filter(e => e.position === '前台/服务区').length}</h4>
            <p>前台/服务区</p>
        </div>
        <div class="stat-card">
            <h4>${employees.filter(e => e.position === '厨房区').length}</h4>
            <p>厨房区</p>
        </div>
    `;
    
    openModal('statsModal');
}

function showExportOptions() {
    if (!selectedEmployee) {
        showMessage('请先选择员工', 'warning');
        return;
    }
    showExportEmployeeOptions();
}

function showExportEmployeeOptions() {
    if (!selectedEmployee) return;
    
    openModal('exportModal');
}

// ==================== EXPORT FUNCTIONS ====================
function copyScheduleText() {
    if (!selectedEmployee) return;
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(selectedEmployee, startDate, endDate);
    const weeklyHours = calculateWeeklyHours(selectedEmployee);
    const monthlyHours = calculateMonthlyHours(selectedEmployee);
    
    // 生成易读的文本格式
    let text = `${employee.name} 排班表\n`;
    text += `职位: ${employee.position}\n`;
    text += `本周: ${formatDate(startDate)} - ${formatDate(endDate)}\n`;
    text += `本周工时: ${weeklyHours}小时 | 本月工时: ${monthlyHours}小时\n\n`;
    
    const days = generateWeekDays(startDate);
    days.forEach(day => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        const scheduleText = schedule ? 
            (schedule.isDayOff ? '休息' : `${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`) : 
            '无排班';
        
        text += `${day.name} (${day.date}): ${scheduleText}\n`;
    });
    
    text += `\n生成时间: ${new Date().toLocaleString('zh-CN')}`;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(text)
        .then(() => {
            showMessage('排班表已复制到剪贴板', 'success');
            closeModal('exportModal');
        })
        .catch(err => {
            console.error('复制失败:', err);
            showMessage('复制失败，请手动复制', 'error');
            
            // 备用方法
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            showMessage('已手动复制到剪贴板', 'success');
            closeModal('exportModal');
        });
}

function printSchedule() {
    if (!selectedEmployee) return;
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(selectedEmployee, startDate, endDate);
    const weeklyHours = calculateWeeklyHours(selectedEmployee);
    const monthlyHours = calculateMonthlyHours(selectedEmployee);
    
    // 创建打印内容
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${employee.name} 排班表</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
                .header h1 { margin: 0; color: #333; }
                .info { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .info-item { background: #f5f5f5; padding: 15px; border-radius: 8px; }
                .schedule-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .schedule-table th, .schedule-table td { border: 1px solid #ddd; padding: 12px; text-align: center; }
                .schedule-table th { background: #f8f9fa; font-weight: bold; }
                .work { background: #e8f5e9; }
                .rest { background: #fff3e0; }
                .summary { background: #e3f2fd; padding: 20px; border-radius: 8px; margin-top: 30px; }
                .footer { text-align: center; margin-top: 40px; color: #666; font-size: 14px; }
                @media print {
                    body { padding: 10px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${employee.name} 排班表</h1>
                <p>职位: ${employee.position} | 日期: ${formatDate(startDate)} - ${formatDate(endDate)}</p>
            </div>
            
            <div class="info">
                <div class="info-item">
                    <h3>本周工时</h3>
                    <p style="font-size: 24px; font-weight: bold; color: #4361ee;">${weeklyHours} 小时</p>
                </div>
                <div class="info-item">
                    <h3>本月工时</h3>
                    <p style="font-size: 24px; font-weight: bold; color: #3a0ca3;">${monthlyHours} 小时</p>
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>星期</th>
                        <th>日期</th>
                        <th>排班状态</th>
                        <th>工作时间</th>
                        <th>工时</th>
                    </tr>
                </thead>
                <tbody>
                    ${generateWeekDays(startDate).map(day => {
                        const schedule = weekSchedule.find(s => s.date === day.dateString);
                        const hours = schedule && !schedule.isDayOff ? 
                            calculateShiftHours(schedule.startTime, schedule.endTime) : 0;
                        
                        return `
                            <tr class="${schedule ? (schedule.isDayOff ? 'rest' : 'work') : ''}">
                                <td>${day.name}</td>
                                <td>${formatDate(day.dateString)}</td>
                                <td>${schedule ? (schedule.isDayOff ? '休息' : '上班') : '无排班'}</td>
                                <td>${schedule ? (schedule.isDayOff ? '休息日' : 
                                    `${schedule.startTime.substring(0, 5)} - ${schedule.endTime.substring(0, 5)}`) : '-'}</td>
                                <td>${hours} 小时</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <div class="summary">
                <h3>本周总结</h3>
                <p>总工作日: ${weekSchedule.filter(s => !s.isDayOff).length} 天</p>
                <p>总休息日: ${weekSchedule.filter(s => s.isDayOff).length} 天</p>
                <p>总工时: ${weeklyHours} 小时</p>
            </div>
            
            <div class="footer">
                <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
                <p class="no-print">打印快捷键: Ctrl + P</p>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => {
                        window.close();
                    }, 500);
                };
            </script>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    closeModal('exportModal');
}

// ==================== UTILITY FUNCTIONS ====================
function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    
    // 周一为第一天
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setDate(monday.getDate() + (weekOffset * 7));
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    return {
        startDate: monday,
        endDate: sunday,
        startString: monday.toISOString().split('T')[0],
        endString: sunday.toISOString().split('T')[0]
    };
}

function generateWeekDays(startDate) {
    const days = [];
    const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        days.push({
            name: dayNames[i],
            date: `${date.getMonth() + 1}/${date.getDate()}`,
            dateString: date.toISOString().split('T')[0],
            dayIndex: i
        });
    }
    
    return days;
}

function getEmployeeSchedulesForWeek(employeeId, startDate, endDate) {
    return Object.values(schedules).filter(schedule => {
        if (schedule.employeeId !== employeeId) return false;
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= startDate && scheduleDate <= endDate;
    });
}

function getWeekSchedules(startDate, endDate) {
    return Object.values(schedules).filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= startDate && scheduleDate <= endDate;
    });
}

function getThisWeekSchedule(employeeId) {
    const { startDate, endDate } = getWeekDates(0);
    const weekSchedules = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    
    return {
        workDays: weekSchedules.filter(s => !s.isDayOff).length,
        restDays: weekSchedules.filter(s => s.isDayOff).length,
        totalDays: weekSchedules.length
    };
}

function calculateWeeklyHours(employeeId) {
    const { startDate, endDate } = getWeekDates(0);
    const weekSchedules = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    
    return weekSchedules.reduce((total, schedule) => {
        if (schedule.isDayOff) return total;
        return total + calculateShiftHours(schedule.startTime, schedule.endTime);
    }, 0);
}

function calculateMonthlyHours(employeeId) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const monthSchedules = Object.values(schedules).filter(schedule => {
        if (schedule.employeeId !== employeeId) return false;
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= startOfMonth && scheduleDate <= endOfMonth && !schedule.isDayOff;
    });
    
    return monthSchedules.reduce((total, schedule) => {
        return total + calculateShiftHours(schedule.startTime, schedule.endTime);
    }, 0);
}

function calculateShiftHours(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    const diff = (end - start) / (1000 * 60 * 60); // 转换为小时
    
    return Math.max(0, diff); // 确保不为负数
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric'
    });
}

function formatDateRange(startDate, endDate) {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function getDayName(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
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

function showMessage(text, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.app-message');
    if (existingMessage) existingMessage.remove();
    
    const message = document.createElement('div');
    message.className = `app-message message-${type}`;
    message.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                       type === 'error' ? 'fa-exclamation-circle' : 
                       type === 'warning' ? 'fa-exclamation-triangle' : 
                       'fa-info-circle'}"></i>
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

// 添加消息样式
const messageStyle = document.createElement('style');
messageStyle.textContent = `
    .app-message {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-100%);
        padding: 14px 24px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10000;
        opacity: 0;
        transition: all 0.3s ease;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        font-weight: 500;
        max-width: 90%;
        backdrop-filter: blur(10px);
    }
    .app-message.show {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
    .message-success {
        background: rgba(46, 196, 182, 0.95);
        color: white;
        border: 1px solid rgba(46, 196, 182, 0.3);
    }
    .message-error {
        background: rgba(247, 37, 133, 0.95);
        color: white;
        border: 1px solid rgba(247, 37, 133, 0.3);
    }
    .message-warning {
        background: rgba(248, 150, 30, 0.95);
        color: white;
        border: 1px solid rgba(248, 150, 30, 0.3);
    }
    .message-info {
        background: rgba(67, 97, 238, 0.95);
        color: white;
        border: 1px solid rgba(67, 97, 238, 0.3);
    }
    .app-message i {
        font-size: 18px;
    }
`;
document.head.appendChild(messageStyle);
