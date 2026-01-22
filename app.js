// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let currentWeek = 0;
let selectedEmployee = null;
let selectedPosition = '前台/服务区';
let currentPositionFilter = 'all';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 智能排班系统启动");
    
    // 初始化日期
    initApp();
    
    // 加载数据
    loadEmployees();
    loadSchedules();
    
    // 设置事件监听器
    setupEventListeners();
});

function initApp() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 设置表单日期
    document.getElementById('scheduleDate').value = todayStr;
    document.getElementById('scheduleDate').min = todayStr;
    document.getElementById('quickWeekDate').value = todayStr;
    
    // 初始化工作日选择器
    initWeekdaysSelector();
    
    // 更新当前日期显示
    updateCurrentDate();
    
    // 设置自动刷新日期
    setInterval(updateCurrentDate, 60000);
}

function initWeekdaysSelector() {
    const weekdays = [
        { id: 1, label: '周一', default: true },
        { id: 2, label: '周二', default: true },
        { id: 3, label: '周三', default: true },
        { id: 4, label: '周四', default: true },
        { id: 5, label: '周五', default: true },
        { id: 6, label: '周六', default: false },
        { id: 0, label: '周日', default: false }
    ];
    
    const container = document.getElementById('weekdaysSelector');
    container.innerHTML = weekdays.map(day => `
        <button type="button" class="weekday-btn ${day.default ? 'active' : ''}" 
                data-day="${day.id}" onclick="toggleWeekday(this)">
            ${day.label}
        </button>
    `).join('');
}

function toggleWeekday(button) {
    button.classList.toggle('active');
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

function setupEventListeners() {
    // 点击背景关闭模态框
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });
    
    // 快捷键支持
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            switch(event.key.toLowerCase()) {
                case 'e':
                    if (selectedEmployee) {
                        editEmployeeSchedule();
                        event.preventDefault();
                    }
                    break;
                case 'c':
                    if (selectedEmployee) {
                        copyEmployeeSchedule();
                        event.preventDefault();
                    }
                    break;
                case 's':
                    refreshData();
                    event.preventDefault();
                    break;
            }
        }
    });
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
    switch(viewName) {
        case 'weekly':
            renderWeeklySchedule();
            break;
        case 'schedule':
            updateScheduleEmployeeSelect();
            break;
        case 'employees':
            renderEmployeeCards();
            break;
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
        updateAllEmployeeSelects();
    });
}

function renderEmployeeCards() {
    const container = document.getElementById('employeeCards');
    const searchTerm = document.getElementById('employeeSearch')?.value.toLowerCase() || '';
    
    let filteredEmployees = employees;
    
    // 搜索过滤
    if (searchTerm) {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm)
        );
    }
    
    // 职位过滤
    if (currentPositionFilter !== 'all') {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.position === currentPositionFilter
        );
    }
    
    if (filteredEmployees.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>${searchTerm || currentPositionFilter !== 'all' ? '未找到员工' : '暂无员工'}</p>
                <small>点击右上角 + 按钮添加员工</small>
            </div>
        `;
        return;
    }
    
    // 按职位分组排序
    const frontDeskEmployees = filteredEmployees.filter(emp => emp.position === '前台/服务区');
    const kitchenEmployees = filteredEmployees.filter(emp => emp.position === '厨房区');
    
    let html = '';
    
    if (frontDeskEmployees.length > 0) {
        html += `
            <div class="position-group">
                <h3 class="position-title">
                    <i class="fas fa-door-open"></i> 前台/服务区
                    <span class="position-count">${frontDeskEmployees.length}人</span>
                </h3>
                <div class="position-cards">
                    ${frontDeskEmployees.map(emp => generateEmployeeCard(emp)).join('')}
                </div>
            </div>
        `;
    }
    
    if (kitchenEmployees.length > 0) {
        html += `
            <div class="position-group">
                <h3 class="position-title">
                    <i class="fas fa-utensils"></i> 厨房区
                    <span class="position-count">${kitchenEmployees.length}人</span>
                </h3>
                <div class="position-cards">
                    ${kitchenEmployees.map(emp => generateEmployeeCard(emp)).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
    
    // 添加CSS样式
    const style = document.createElement('style');
    style.textContent = `
        .position-group {
            margin-bottom: 24px;
        }
        .position-title {
            font-size: 14px;
            color: var(--gray);
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            padding-bottom: 8px;
            border-bottom: 1px solid var(--light-gray);
        }
        .position-count {
            margin-left: auto;
            background: var(--light);
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 12px;
            color: var(--primary);
        }
        .position-cards {
            display: grid;
            gap: 12px;
        }
        @media (min-width: 768px) {
            .position-cards {
                grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            }
        }
    `;
    document.head.appendChild(style);
}

function generateEmployeeCard(employee) {
    const weeklyHours = calculateWeeklyHours(employee.id);
    const monthlyHours = calculateMonthlyHours(employee.id);
    const weekSchedule = getThisWeekSchedule(employee.id);
    
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
                        <span>本周: </span>
                        <span class="stat-value">${weeklyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt"></i>
                        <span>本月: </span>
                        <span class="stat-value">${monthlyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-check"></i>
                        <span>${weekSchedule.workDays}天班</span>
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

function filterEmployees(position) {
    currentPositionFilter = position;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.filter-btn${position === 'all' ? '' : `[onclick*="${position}"]`}`).classList.add('active');
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
    
    openModal('employeeModal');
}

function showEmployeeWeekSchedule(employeeId) {
    const { startDate } = getWeekDates(0);
    const weekSchedule = getEmployeeSchedulesForWeek(employeeId, startDate, new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000));
    
    const container = document.getElementById('employeeWeekDays');
    const days = generateWeekDays(startDate);
    
    container.innerHTML = days.map(day => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        let status = 'none';
        let timeText = '';
        
        if (schedule) {
            status = schedule.isDayOff ? 'rest' : 'work';
            timeText = schedule.isDayOff ? '' : `
                <div style="font-size: 11px; margin-top: 4px; font-weight: 600;">
                    ${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}
                </div>
            `;
        }
        
        return `
            <div class="week-day ${status}">
                <div style="font-weight: 500;">${day.name}</div>
                <div style="font-size: 11px; opacity: 0.8;">${day.date}</div>
                ${timeText}
            </div>
        `;
    }).join('');
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
        nameInput.focus();
        return;
    }
    
    // 检查是否已存在
    if (employees.some(e => e.name.toLowerCase() === name.toLowerCase())) {
        showMessage(`员工 "${name}" 已存在`, 'warning');
        nameInput.focus();
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

function deleteCurrentEmployee() {
    if (!selectedEmployee) return;
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    if (!confirm(`确定要删除员工 "${employee.name}" 吗？\n此操作将同时删除该员工的所有排班记录！`)) {
        return;
    }
    
    // 删除员工
    database.ref(`employees/${selectedEmployee}`).remove()
    .then(() => {
        // 删除该员工的所有排班
        const schedulesRef = database.ref('schedules');
        schedulesRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                Object.keys(data).forEach(scheduleId => {
                    if (data[scheduleId].employeeId === selectedEmployee) {
                        database.ref(`schedules/${scheduleId}`).remove();
                    }
                });
            }
        });
        
        closeModal('employeeModal');
        showMessage(`员工 ${employee.name} 已删除`, 'success');
        selectedEmployee = null;
    })
    .catch(error => {
        showMessage('删除失败: ' + error.message, 'error');
    });
}

function updateAllEmployeeSelects() {
    updateScheduleEmployeeSelect();
    updateQuickWeekEmployeeSelect();
}

function updateScheduleEmployeeSelect() {
    const select = document.getElementById('scheduleEmployee');
    select.innerHTML = '<option value="">选择员工</option>';
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${emp.position})`;
        select.appendChild(option);
    });
}

function updateQuickWeekEmployeeSelect() {
    const select = document.getElementById('quickWeekEmployee');
    if (!select) return;
    
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
        renderEmployeeCards(); // 更新工时显示
    });
}

function selectScheduleType(type) {
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
    
    // 验证输入
    if (!employeeId) {
        showMessage('请选择员工', 'warning');
        return;
    }
    
    if (!date) {
        showMessage('请选择日期', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) {
        showMessage('员工不存在', 'error');
        return;
    }
    
    if (type === 'work') {
        if (!startTime || !endTime) {
            showMessage('请填写工作时间', 'warning');
            return;
        }
        
        if (startTime >= endTime) {
            showMessage('结束时间必须晚于开始时间', 'warning');
            document.getElementById('scheduleEnd').focus();
            return;
        }
    }
    
    // 检查是否已有排班
    const existingSchedule = findScheduleByEmployeeAndDate(employeeId, date);
    
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
        const scheduleId = existingSchedule.id;
        database.ref(`schedules/${scheduleId}`).update(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage('排班更新成功', 'success');
        })
        .catch(error => {
            showMessage('更新失败: ' + error.message, 'error');
        });
    } else {
        // 添加新排班
        scheduleData.createdAt = Date.now();
        
        database.ref('schedules').push().set(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage('排班添加成功', 'success');
        })
        .catch(error => {
            showMessage('添加失败: ' + error.message, 'error');
        });
    }
}

function resetScheduleForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('scheduleDate').value = today;
    document.getElementById('scheduleStart').value = '08:00';
    document.getElementById('scheduleEnd').value = '17:00';
    selectScheduleType('work');
}

function findScheduleByEmployeeAndDate(employeeId, date) {
    const scheduleEntry = Object.entries(schedules).find(([id, schedule]) => 
        schedule.employeeId === employeeId && schedule.date === date
    );
    
    if (scheduleEntry) {
        return { id: scheduleEntry[0], ...scheduleEntry[1] };
    }
    return null;
}

function showQuickWeekModal() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('quickWeekDate').value = today;
    document.getElementById('quickWeekStart').value = '08:00';
    document.getElementById('quickWeekEnd').value = '17:00';
    
    // 重置工作日选择器
    document.querySelectorAll('.weekday-btn').forEach(btn => {
        const day = parseInt(btn.dataset.day);
        btn.classList.toggle('active', day >= 1 && day <= 5); // 周一到周五默认选中
    });
    
    updateQuickWeekEmployeeSelect();
    openModal('quickWeekModal');
}

function applyQuickWeekSchedule() {
    const employeeId = document.getElementById('quickWeekEmployee').value;
    const startDate = document.getElementById('quickWeekDate').value;
    const startTime = document.getElementById('quickWeekStart').value;
    const endTime = document.getElementById('quickWeekEnd').value;
    
    if (!employeeId) {
        showMessage('请选择员工', 'warning');
        return;
    }
    
    if (!startDate) {
        showMessage('请选择开始日期', 'warning');
        return;
    }
    
    if (!startTime || !endTime) {
        showMessage('请填写工作时间', 'warning');
        return;
    }
    
    if (startTime >= endTime) {
        showMessage('结束时间必须晚于开始时间', 'warning');
        return;
    }
    
    const selectedDays = [];
    document.querySelectorAll('.weekday-btn.active').forEach(btn => {
        selectedDays.push(parseInt(btn.dataset.day));
    });
    
    if (selectedDays.length === 0) {
        showMessage('请至少选择一个工作日', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const baseDate = new Date(startDate);
    const promises = [];
    
    // 为接下来4周设置排班
    for (let week = 0; week < 4; week++) {
        for (let i = 0; i < 7; i++) {
            const date = new Date(baseDate);
            date.setDate(baseDate.getDate() + (week * 7) + i);
            
            // 跳过过去的日期
            if (date < new Date()) continue;
            
            const dateString = date.toISOString().split('T')[0];
            const dayOfWeek = date.getDay();
            const isSelectedDay = selectedDays.includes(dayOfWeek);
            
            const scheduleData = {
                employeeId: employeeId,
                employeeName: employee.name,
                employeePosition: employee.position,
                date: dateString,
                isDayOff: !isSelectedDay,
                updatedAt: Date.now()
            };
            
            if (isSelectedDay) {
                scheduleData.startTime = startTime;
                scheduleData.endTime = endTime;
            } else {
                scheduleData.startTime = '00:00';
                scheduleData.endTime = '00:00';
                scheduleData.notes = '休息日';
            }
            
            const existingSchedule = findScheduleByEmployeeAndDate(employeeId, dateString);
            
            if (existingSchedule) {
                // 更新现有排班
                promises.push(
                    database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
                );
            } else {
                // 添加新排班
                scheduleData.createdAt = Date.now();
                promises.push(
                    database.ref('schedules').push().set(scheduleData)
                );
            }
        }
    }
    
    Promise.all(promises)
    .then(() => {
        closeModal('quickWeekModal');
        showMessage('快速整周排班设置成功', 'success');
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
    
    // 按员工分组排班
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
            <div class="week-header-cell">员工 / 职位</div>
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
        const weeklyHours = calculateWeeklyHours(employee.id);
        
        html += `
            <div class="week-row">
                <div class="week-cell">
                    <div style="font-weight: 500; font-size: 14px;">${employee.name}</div>
                    <div style="font-size: 12px; color: var(--gray); margin-bottom: 4px;">${employee.position}</div>
                    <div style="font-size: 11px; color: var(--primary);">
                        <i class="fas fa-clock" style="font-size: 10px;"></i> 本周: ${weeklyHours}h
                    </div>
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
                            scheduleText = `
                                <div>${schedule.startTime.substring(0, 5)}</div>
                                <div class="day-time">${schedule.endTime.substring(0, 5)}</div>
                            `;
                        }
                    }
                    
                    return `
                        <div class="week-cell">
                            <div class="day-schedule-item ${scheduleClass}" 
                                 onclick="editDaySchedule('${employee.id}', '${day.dateString}')"
                                 title="${schedule ? (schedule.isDayOff ? '休息日' : `${schedule.startTime}-${schedule.endTime}`) : '点击添加排班'}">
                                ${scheduleText || '点击添加'}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    });
    
    container.innerHTML = html || '<div class="empty-state"><p>暂无排班数据</p></div>';
    
    // 更新周范围显示
    const weekRange = document.getElementById('weekRange');
    weekRange.textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function changeWeek(direction) {
    currentWeek += direction;
    renderWeeklySchedule();
}

function editDaySchedule(employeeId, date) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const schedule = findScheduleByEmployeeAndDate(employeeId, date);
    
    const container = document.getElementById('editScheduleContent');
    container.innerHTML = `
        <div class="edit-schedule-form">
            <div class="form-group">
                <label>员工</label>
                <div class="employee-display">
                    <div class="employee-avatar-small">${employee.name.charAt(0)}</div>
                    <div>
                        <div style="font-weight: 500;">${employee.name}</div>
                        <div style="font-size: 14px; color: var(--gray);">${employee.position}</div>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>日期</label>
                <div class="date-display">
                    <div style="font-weight: 500;">${formatDate(date)}</div>
                    <div style="font-size: 14px; color: var(--gray);">${getDayName(new Date(date))}</div>
                </div>
            </div>
            
            <div class="form-group">
                <label>排班类型</label>
                <div class="type-selector">
                    <button class="type-btn ${!schedule || !schedule.isDayOff ? 'active' : ''}" 
                            onclick="setEditScheduleType('work')">
                        <i class="fas fa-briefcase"></i>
                        <span>上班</span>
                    </button>
                    <button class="type-btn ${schedule && schedule.isDayOff ? 'active' : ''}"
                            onclick="setEditScheduleType('rest')">
                        <i class="fas fa-umbrella-beach"></i>
                        <span>休息</span>
                    </button>
                </div>
            </div>
            
            <div class="time-group" id="editTimeGroup" style="display: ${!schedule || !schedule.isDayOff ? 'grid' : 'none'}">
                <div class="form-group">
                    <label>开始时间</label>
                    <input type="time" id="editStartTime" class="input-field" 
                           value="${schedule && !schedule.isDayOff ? schedule.startTime : '08:00'}">
                </div>
                <div class="form-group">
                    <label>结束时间</label>
                    <input type="time" id="editEndTime" class="input-field" 
                           value="${schedule && !schedule.isDayOff ? schedule.endTime : '17:00'}">
                </div>
            </div>
            
            <div class="action-buttons">
                <button class="btn-primary" onclick="saveDaySchedule('${employeeId}', '${date}')">
                    <i class="fas fa-save"></i> 保存
                </button>
                ${schedule ? `
                    <button class="btn-danger" onclick="deleteDaySchedule('${employeeId}', '${date}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                ` : ''}
                <button class="btn-secondary" onclick="closeModal('editModal')">
                    取消
                </button>
            </div>
        </div>
    `;
    
    openModal('editModal');
}

function setEditScheduleType(type) {
    const timeGroup = document.getElementById('editTimeGroup');
    const workBtn = document.querySelector('.type-btn:first-child');
    const restBtn = document.querySelector('.type-btn:last-child');
    
    if (type === 'work') {
        workBtn.classList.add('active');
        restBtn.classList.remove('active');
        timeGroup.style.display = 'grid';
    } else {
        restBtn.classList.add('active');
        workBtn.classList.remove('active');
        timeGroup.style.display = 'none';
    }
}

function saveDaySchedule(employeeId, date) {
    const type = document.querySelector('.type-btn.active').dataset.type;
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
        const startTime = document.getElementById('editStartTime').value;
        const endTime = document.getElementById('editEndTime').value;
        
        if (!startTime || !endTime) {
            showMessage('请填写工作时间', 'warning');
            return;
        }
        
        if (startTime >= endTime) {
            showMessage('结束时间必须晚于开始时间', 'warning');
            return;
        }
        
        scheduleData.startTime = startTime;
        scheduleData.endTime = endTime;
    } else {
        scheduleData.startTime = '00:00';
        scheduleData.endTime = '00:00';
        scheduleData.notes = '休息日';
    }
    
    const existingSchedule = findScheduleByEmployeeAndDate(employeeId, date);
    
    if (existingSchedule) {
        // 更新现有排班
        database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage('排班更新成功', 'success');
        })
        .catch(error => {
            showMessage('更新失败: ' + error.message, 'error');
        });
    } else {
        // 添加新排班
        scheduleData.createdAt = Date.now();
        
        database.ref('schedules').push().set(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage('排班添加成功', 'success');
        })
        .catch(error => {
            showMessage('添加失败: ' + error.message, 'error');
        });
    }
}

function deleteDaySchedule(employeeId, date) {
    if (!confirm('确定要删除这个排班吗？')) return;
    
    const schedule = findScheduleByEmployeeAndDate(employeeId, date);
    if (!schedule) return;
    
    database.ref(`schedules/${schedule.id}`).remove()
    .then(() => {
        closeModal('editModal');
        showMessage('排班已删除', 'success');
    })
    .catch(error => {
        showMessage('删除失败: ' + error.message, 'error');
    });
}

// ==================== QUICK ACTIONS ====================
function showTodaySchedule() {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = Object.values(schedules).filter(s => s.date === today);
    
    const container = document.getElementById('todayList');
    
    if (todaySchedules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-day"></i>
                <p>今日暂无排班</p>
                <small>可以切换到"排班"页面添加今日排班</small>
            </div>
        `;
    } else {
        // 按职位分组
        const frontDeskSchedules = todaySchedules.filter(s => s.employeePosition === '前台/服务区');
        const kitchenSchedules = todaySchedules.filter(s => s.employeePosition === '厨房区');
        
        let html = '';
        
        if (frontDeskSchedules.length > 0) {
            html += `<h4 style="margin-bottom: 12px; color: #7209b7;"><i class="fas fa-door-open"></i> 前台/服务区</h4>`;
            html += frontDeskSchedules.map(schedule => createTodayItem(schedule)).join('');
        }
        
        if (kitchenSchedules.length > 0) {
            html += `<h4 style="margin-top: 20px; margin-bottom: 12px; color: #f8961e;"><i class="fas fa-utensils"></i> 厨房区</h4>`;
            html += kitchenSchedules.map(schedule => createTodayItem(schedule)).join('');
        }
        
        container.innerHTML = html;
    }
    
    openModal('todayModal');
}

function createTodayItem(schedule) {
    return `
        <div class="today-item ${schedule.isDayOff ? 'rest' : 'work'}">
            <div>
                <div style="font-weight: 500;">${schedule.employeeName}</div>
                <div style="font-size: 13px; color: var(--gray);">${schedule.employeePosition}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 500; color: ${schedule.isDayOff ? 'var(--warning)' : 'var(--success)'}">
                    ${schedule.isDayOff ? '休息日' : `${schedule.startTime.substring(0, 5)} - ${schedule.endTime.substring(0, 5)}`}
                </div>
                ${!schedule.isDayOff ? `
                    <div style="font-size: 12px; color: var(--gray);">
                        工时: ${calculateShiftHours(schedule.startTime, schedule.endTime)}h
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function showStats() {
    const container = document.getElementById('statsGrid');
    
    // 计算统计数据
    const totalEmployees = employees.length;
    const totalSchedules = Object.keys(schedules).length;
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = Object.values(schedules).filter(s => s.date === today && !s.isDayOff).length;
    const weekHours = employees.reduce((sum, emp) => sum + calculateWeeklyHours(emp.id), 0);
    const monthHours = employees.reduce((sum, emp) => sum + calculateMonthlyHours(emp.id), 0);
    const frontDeskCount = employees.filter(e => e.position === '前台/服务区').length;
    const kitchenCount = employees.filter(e => e.position === '厨房区').length;
    
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
            <h4>${weekHours}h</h4>
            <p>本周总工时</p>
        </div>
        <div class="stat-card">
            <h4>${monthHours}h</h4>
            <p>本月总工时</p>
        </div>
        <div class="stat-card">
            <h4>${frontDeskCount}</h4>
            <p>前台/服务区</p>
        </div>
        <div class="stat-card">
            <h4>${kitchenCount}</h4>
            <p>厨房区</p>
        </div>
        <div class="stat-card">
            <h4>${Math.round(weekHours / (employees.length || 1))}h</h4>
            <p>人均周工时</p>
        </div>
    `;
    
    openModal('statsModal');
}

function showExportOptions() {
    if (!selectedEmployee) {
        showMessage('请先选择一个员工', 'warning');
        return;
    }
    openModal('exportModal');
}

function copyEmployeeSchedule() {
    if (!selectedEmployee) return;
    copyScheduleAsText();
}

// ==================== EXPORT FUNCTIONS ====================
function copyScheduleAsText() {
    if (!selectedEmployee) return;
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(selectedEmployee, startDate, endDate);
    const weeklyHours = calculateWeeklyHours(selectedEmployee);
    const monthlyHours = calculateMonthlyHours(selectedEmployee);
    const days = generateWeekDays(startDate);
    
    // 生成格式化的文本
    let text = `【${employee.name} 排班表】\n`;
    text += `职位：${employee.position}\n`;
    text += `日期：${formatDate(startDate)} 至 ${formatDate(endDate)}\n`;
    text += `本周工时：${weeklyHours}小时 | 本月工时：${monthlyHours}小时\n\n`;
    text += `📅 本周排班详情：\n`;
    
    days.forEach(day => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        const scheduleText = schedule ? 
            (schedule.isDayOff ? '🏖️ 休息' : `🕐 ${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}`) : 
            '📭 无排班';
        
        text += `${day.name}（${day.date}）：${scheduleText}\n`;
    });
    
    text += `\n📍 工作区域：${employee.position === '厨房区' ? '厨房区 👨‍🍳' : '前台/服务区 💁'}\n`;
    text += `📊 本周工作${weekSchedule.filter(s => !s.isDayOff).length}天，休息${weekSchedule.filter(s => s.isDayOff).length}天\n`;
    text += `\n⏰ 生成时间：${new Date().toLocaleString('zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
    
    // 复制到剪贴板
    navigator.clipboard.writeText(text)
        .then(() => {
            showMessage('排班表已复制到剪贴板', 'success');
            closeModal('exportModal');
            closeModal('employeeModal');
        })
        .catch(err => {
            console.error('复制失败:', err);
            
            // 备用方案
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            
            showMessage('已复制到剪贴板', 'success');
            closeModal('exportModal');
            closeModal('employeeModal');
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
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${employee.name} 排班表</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; color: #333; }
                .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #4361ee; }
                .header h1 { color: #4361ee; margin: 0 0 10px 0; }
                .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                .info-card { background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; }
                .info-card h3 { color: #666; font-size: 14px; margin: 0 0 10px 0; }
                .info-card p { color: #4361ee; font-size: 28px; font-weight: bold; margin: 0; }
                .schedule-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                .schedule-table th { background: #4361ee; color: white; padding: 12px; text-align: center; }
                .schedule-table td { padding: 12px; border: 1px solid #ddd; text-align: center; }
                .schedule-table .work { background: #e8f5e9; }
                .schedule-table .rest { background: #fff3e0; }
                .summary { background: #eef2ff; padding: 20px; border-radius: 10px; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                @media print {
                    body { padding: 10px; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${employee.name} 排班表</h1>
                <p>职位：${employee.position} | 日期：${formatDate(startDate)} 至 ${formatDate(endDate)}</p>
            </div>
            
            <div class="info-grid">
                <div class="info-card">
                    <h3>本周工时</h3>
                    <p>${weeklyHours} 小时</p>
                </div>
                <div class="info-card">
                    <h3>本月工时</h3>
                    <p>${monthlyHours} 小时</p>
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>星期</th>
                        <th>日期</th>
                        <th>工作状态</th>
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
                                <td>${schedule ? (schedule.isDayOff ? '-' : 
                                    `${schedule.startTime.substring(0, 5)} - ${schedule.endTime.substring(0, 5)}`) : '-'}</td>
                                <td>${hours ? hours + 'h' : '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <div class="summary">
                <h3>本周总结</h3>
                <p>工作天数：${weekSchedule.filter(s => !s.isDayOff).length} 天</p>
                <p>休息天数：${weekSchedule.filter(s => s.isDayOff).length} 天</p>
                <p>总工时：${weeklyHours} 小时</p>
            </div>
            
            <div class="footer">
                <p>生成时间：${new Date().toLocaleString('zh-CN')}</p>
                <p class="no-print">打印快捷键：Ctrl + P</p>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(() => window.close(), 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
    
    closeModal('exportModal');
    showMessage('正在生成打印预览...', 'info');
}

// ==================== UTILITY FUNCTIONS ====================
function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    
    // 周一为第一天（中国习惯）
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
        return schedule.employeeId === employeeId && 
               schedule.date >= startDate.toISOString().split('T')[0] && 
               schedule.date <= endDate.toISOString().split('T')[0];
    });
}

function getWeekSchedules(startDate, endDate) {
    return Object.values(schedules).filter(schedule => {
        const scheduleDate = schedule.date;
        return scheduleDate >= startDate.toISOString().split('T')[0] && 
               scheduleDate <= endDate.toISOString().split('T')[0];
    });
}

function getThisWeekSchedule(employeeId) {
    const { startDate, endDate } = getWeekDates(0);
    const weekSchedules = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    
    return {
        workDays: weekSchedules.filter(s => !s.isDayOff).length,
        restDays: weekSchedules.filter(s => s.isDayOff).length,
        schedules: weekSchedules
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
        if (schedule.employeeId !== employeeId || schedule.isDayOff) return false;
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= startOfMonth && scheduleDate <= endOfMonth;
    });
    
    return monthSchedules.reduce((total, schedule) => {
        return total + calculateShiftHours(schedule.startTime, schedule.endTime);
    }, 0);
}

function calculateShiftHours(startTime, endTime) {
    if (!startTime || !endTime || startTime === '00:00' || endTime === '00:00') {
        return 0;
    }
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    // 处理跨午夜的情况
    if (end < start) {
        end.setDate(end.getDate() + 1);
    }
    
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.round(diffHours * 100) / 100; // 保留两位小数
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric'
    });
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

function refreshData() {
    loadEmployees();
    loadSchedules();
    showMessage('数据已刷新', 'success');
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
        top: 100px;
        left: 50%;
        transform: translateX(-50%) translateY(-20px);
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

// 添加编辑表单样式
const editFormStyle = document.createElement('style');
editFormStyle.textContent = `
    .edit-schedule-form {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }
    .employee-display, .date-display {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: var(--light);
        border-radius: var(--radius-sm);
    }
    .employee-avatar-small {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 16px;
    }
    .btn-danger {
        background: linear-gradient(135deg, var(--danger), #b5179e);
        color: white;
        border: none;
    }
    .btn-danger:hover {
        background: linear-gradient(135deg, #e63946, #f72585);
        transform: translateY(-2px);
    }
`;
document.head.appendChild(editFormStyle);
