// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let currentWeek = 0; // 0 = this week, 1 = next week, -1 = last week
let currentEditEmployee = null;
let currentEditDate = null;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 智能排班系统启动!");
    
    // 初始化日期
    initDates();
    
    // 初始化星期选择器
    initWeekdaySelector();
    
    // 加载数据
    loadEmployees();
    loadSchedules();
    
    // 更新统计数据
    updateStats();
    
    // 设置事件监听器
    setupEventListeners();
});

function initDates() {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    document.getElementById('quickStartDate').value = today;
    document.getElementById('quickStartDate').min = today;
}

function initWeekdaySelector() {
    const weekdays = [
        { id: 'mon', label: '周一', value: 1 },
        { id: 'tue', label: '周二', value: 2 },
        { id: 'wed', label: '周三', value: 3 },
        { id: 'thu', label: '周四', value: 4 },
        { id: 'fri', label: '周五', value: 5 },
        { id: 'sat', label: '周六', value: 6 },
        { id: 'sun', label: '周日', value: 0 }
    ];
    
    const container = document.getElementById('weekdaySelector');
    container.innerHTML = weekdays.map(day => `
        <button type="button" class="weekday-btn ${[1,2,3,4,5].includes(day.value) ? 'active' : ''}" 
                data-day="${day.value}" onclick="toggleWeekday(this)">
            ${day.label}
        </button>
    `).join('');
}

function setupEventListeners() {
    // 排班类型切换
    document.querySelectorAll('input[name="scheduleType"]').forEach(radio => {
        radio.addEventListener('change', function() {
            const timeInputs = document.getElementById('timeInputsSection');
            if (this.value === 'rest') {
                timeInputs.style.display = 'none';
            } else {
                timeInputs.style.display = 'block';
            }
        });
    });
}

// ==================== UI CONTROLS ====================
function showSection(sectionId) {
    // 隐藏所有部分
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 移除所有活动导航项
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // 显示选中部分
    document.getElementById(sectionId).classList.add('active');
    
    // 激活对应导航项
    document.querySelector(`.nav-item[onclick="showSection('${sectionId}')"]`).classList.add('active');
    
    // 在移动端关闭侧边栏
    if (window.innerWidth <= 1024) {
        document.querySelector('.sidebar').classList.remove('active');
    }
    
    // 根据部分执行特定操作
    switch(sectionId) {
        case 'weekly':
            renderWeeklyView();
            break;
        case 'edit-schedule':
            updateEmployeeSelects();
            break;
    }
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

function toggleWeekday(button) {
    button.classList.toggle('active');
}

function showAddEmployeeModal() {
    document.getElementById('newEmployeeName').value = '';
    document.querySelector('input[name="position"][value="前台/服务区"]').checked = true;
    openModal('addEmployeeModal');
}

function showEmployeeWeeklyView(employeeId) {
    if (!employeeId) return;
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // 获取本周日期范围
    const { startDate, endDate } = getWeekDates(currentWeek);
    
    // 获取员工本周排班
    const weekSchedules = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    
    const container = document.getElementById('employeeWeeklyPreview');
    container.innerHTML = `
        <div class="employee-week-view">
            <div class="employee-info">
                <h4>${employee.name} (${employee.position})</h4>
                <p>${formatDateRange(startDate, endDate)}</p>
            </div>
            <div class="week-schedule-grid">
                ${generateWeekDays(startDate).map(day => {
                    const schedule = weekSchedules.find(s => s.date === day.dateString);
                    return `
                        <div class="day-schedule-preview ${schedule ? (schedule.isDayOff ? 'rest' : 'work') : 'empty'}">
                            <div class="day-name">${day.name}</div>
                            <div class="day-date">${day.date}</div>
                            <div class="schedule-info">
                                ${schedule ? 
                                    (schedule.isDayOff ? '休息' : `${schedule.startTime}-${schedule.endTime}`) : 
                                    '无排班'
                                }
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="actions">
                <button class="btn btn-sm" onclick="editEmployeeSchedule('${employeeId}')">
                    <i class="fas fa-edit"></i> 编辑排班
                </button>
            </div>
        </div>
    `;
}

function editEmployeeSchedule(employeeId) {
    currentEditEmployee = employeeId;
    showSection('edit-schedule');
    document.getElementById('editFilterEmployee').value = employeeId;
    loadEmployeeSchedule();
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
    });
}

function addNewEmployee() {
    const nameInput = document.getElementById('newEmployeeName');
    const name = nameInput.value.trim();
    const position = document.querySelector('input[name="position"]:checked').value;
    
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
        position: position,
        createdAt: Date.now()
    })
    .then(() => {
        closeModal('addEmployeeModal');
        showMessage(`员工 ${name} 添加成功`, 'success');
    })
    .catch(error => {
        showMessage('添加失败: ' + error.message, 'error');
    });
}

function renderEmployees() {
    const container = document.getElementById('employeeGrid');
    
    if (employees.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>暂无员工</h3>
                <p>点击"添加员工"按钮开始</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = employees.map(employee => {
        const weekSchedule = getEmployeeWeeklySchedule(employee.id);
        const workDays = weekSchedule.filter(s => !s.isDayOff).length;
        const restDays = weekSchedule.filter(s => s.isDayOff).length;
        
        return `
            <div class="employee-card ${employee.position === '厨房区' ? 'kitchen' : 'front-desk'}">
                <div class="employee-header">
                    <div class="employee-avatar">
                        ${employee.name.charAt(0)}
                    </div>
                    <div class="employee-info">
                        <div class="employee-name">${employee.name}</div>
                        <div class="employee-position">
                            <i class="fas ${employee.position === '厨房区' ? 'fa-utensils' : 'fa-door-open'}"></i>
                            ${employee.position}
                        </div>
                    </div>
                </div>
                
                <div class="employee-schedule">
                    <div class="schedule-summary">
                        <span>本周: ${workDays}天班 · ${restDays}天休</span>
                    </div>
                    <div class="week-preview">
                        ${generateWeekPreview(employee.id)}
                    </div>
                </div>
                
                <div class="employee-actions">
                    <button class="action-btn" style="background:#e3f2fd;color:#2196F3;" 
                            onclick="quickScheduleEmployee('${employee.id}')">
                        <i class="fas fa-bolt"></i>
                    </button>
                    <button class="action-btn" style="background:#e8f5e9;color:#4CAF50;" 
                            onclick="viewEmployeeSchedule('${employee.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="action-btn" style="background:#fff3e0;color:#ff9800;" 
                            onclick="editEmployeeSchedule('${employee.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function generateWeekPreview(employeeId) {
    const { startDate } = getWeekDates(0);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const dateString = date.toISOString().split('T')[0];
        
        const schedule = Object.values(schedules).find(s => 
            s.employeeId === employeeId && s.date === dateString
        );
        
        days.push(`
            <div class="day-indicator ${schedule ? (schedule.isDayOff ? 'rest' : 'work') : ''}">
                ${['日','一','二','三','四','五','六'][date.getDay()]}
            </div>
        `);
    }
    
    return days.join('');
}

function updateEmployeeSelects() {
    // 更新所有员工下拉框
    const selects = [
        'quickLookupSelect',
        'quickScheduleEmployee',
        'editFilterEmployee'
    ];
    
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
        
        // 恢复之前的选择
        if (currentValue) {
            select.value = currentValue;
        }
    });
}

// ==================== SCHEDULE MANAGEMENT ====================
function loadSchedules() {
    const schedulesRef = database.ref('schedules');
    
    schedulesRef.on('value', (snapshot) => {
        schedules = snapshot.val() || {};
        renderWeeklyView();
        updateStats();
        updateTodaysSchedule();
    });
}

function applyQuickSchedule() {
    const employeeId = document.getElementById('quickScheduleEmployee').value;
    const startDate = document.getElementById('quickStartDate').value;
    const startTime = document.getElementById('quickStartTime').value;
    const endTime = document.getElementById('quickEndTime').value;
    
    if (!employeeId) {
        showMessage('请选择员工', 'warning');
        return;
    }
    
    if (!startDate) {
        showMessage('请选择开始日期', 'warning');
        return;
    }
    
    // 获取选中的工作日
    const selectedDays = [];
    document.querySelectorAll('.weekday-btn.active').forEach(btn => {
        selectedDays.push(parseInt(btn.dataset.day));
    });
    
    if (selectedDays.length === 0) {
        showMessage('请选择至少一个工作日', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const baseDate = new Date(startDate);
    const promises = [];
    
    // 设置接下来四周的排班
    for (let week = 0; week < 4; week++) {
        selectedDays.forEach(dayIndex => {
            const date = new Date(baseDate);
            date.setDate(baseDate.getDate() + (week * 7) + getDayOffset(dayIndex, baseDate.getDay()));
            
            // 跳过过去的日期
            if (date < new Date()) return;
            
            const dateString = date.toISOString().split('T')[0];
            
            // 检查是否已有排班
            const existingSchedule = Object.values(schedules).find(s => 
                s.employeeId === employeeId && s.date === dateString
            );
            
            if (existingSchedule) {
                // 更新现有排班
                const scheduleId = Object.keys(schedules).find(key => 
                    schedules[key].employeeId === employeeId && schedules[key].date === dateString
                );
                
                promises.push(
                    database.ref(`schedules/${scheduleId}`).update({
                        startTime: startTime,
                        endTime: endTime,
                        isDayOff: false,
                        updatedAt: Date.now()
                    })
                );
            } else {
                // 添加新排班
                promises.push(
                    database.ref('schedules').push().set({
                        employeeId: employeeId,
                        employeeName: employee.name,
                        employeePosition: employee.position,
                        date: dateString,
                        startTime: startTime,
                        endTime: endTime,
                        createdAt: Date.now(),
                        isDayOff: false
                    })
                );
            }
        });
        
        // 未选中的日子设为休息
        for (let i = 0; i < 7; i++) {
            if (!selectedDays.includes(i)) {
                const date = new Date(baseDate);
                date.setDate(baseDate.getDate() + (week * 7) + i);
                
                if (date < new Date()) continue;
                
                const dateString = date.toISOString().split('T')[0];
                
                // 检查是否已有排班
                const hasSchedule = Object.values(schedules).some(s => 
                    s.employeeId === employeeId && s.date === dateString
                );
                
                if (!hasSchedule) {
                    promises.push(
                        database.ref('schedules').push().set({
                            employeeId: employeeId,
                            employeeName: employee.name,
                            employeePosition: employee.position,
                            date: dateString,
                            startTime: '00:00',
                            endTime: '00:00',
                            createdAt: Date.now(),
                            isDayOff: true,
                            notes: '休息日'
                        })
                    );
                }
            }
        }
    }
    
    Promise.all(promises)
    .then(() => {
        showMessage('排班设置成功', 'success');
        addQuickScheduleHistory(employee.name, selectedDays.length);
    })
    .catch(error => {
        showMessage('设置失败: ' + error.message, 'error');
    });
}

function getDayOffset(targetDay, currentDay) {
    // 计算目标星期几的偏移量
    let offset = targetDay - currentDay;
    if (offset < 0) offset += 7;
    return offset;
}

function addQuickScheduleHistory(employeeName, workDays) {
    const container = document.getElementById('quickScheduleHistory');
    const time = new Date().toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const historyItem = document.createElement('div');
    historyItem.className = 'schedule-history-item';
    historyItem.innerHTML = `
        <div class="history-info">
            <strong>${employeeName}</strong>
            <span>设置了 ${workDays} 天工作排班</span>
        </div>
        <div class="history-time">${time}</div>
    `;
    
    container.insertBefore(historyItem, container.firstChild);
    
    // 只保留最近的5条记录
    if (container.children.length > 5) {
        container.removeChild(container.lastChild);
    }
}

function loadEmployeeSchedule() {
    const employeeId = document.getElementById('editFilterEmployee').value;
    const weekFilter = document.getElementById('editFilterWeek').value;
    
    if (!employeeId) {
        document.getElementById('editScheduleContainer').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-edit"></i>
                <h3>选择员工编辑排班</h3>
                <p>在左侧选择员工开始编辑排班</p>
            </div>
        `;
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // 获取日期范围
    let startDate, endDate;
    if (weekFilter === 'all') {
        // 显示所有排班
        const employeeSchedules = Object.values(schedules)
            .filter(s => s.employeeId === employeeId)
            .sort((a, b) => a.date.localeCompare(b.date));
        
        renderAllSchedules(employee, employeeSchedules);
        return;
    } else {
        const weekOffset = weekFilter === 'next' ? 1 : 0;
        const dates = getWeekDates(weekOffset);
        startDate = dates.startDate;
        endDate = dates.endDate;
    }
    
    // 获取本周排班
    const weekSchedules = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    
    // 生成编辑界面
    const container = document.getElementById('editScheduleContainer');
    container.innerHTML = `
        <div class="edit-schedule-header">
            <h4>${employee.name} - ${formatDateRange(startDate, endDate)}</h4>
            <button class="btn btn-sm" onclick="copyToNextWeek('${employeeId}')">
                <i class="fas fa-copy"></i> 复制到下周
            </button>
        </div>
        <div class="edit-schedule-grid">
            ${generateWeekDays(startDate).map(day => {
                const schedule = weekSchedules.find(s => s.date === day.dateString);
                return generateDayEditCard(employee, day, schedule);
            }).join('')}
        </div>
    `;
}

function generateDayEditCard(employee, day, schedule) {
    const isWorkDay = schedule && !schedule.isDayOff;
    const isRestDay = schedule && schedule.isDayOff;
    
    return `
        <div class="day-edit-card">
            <div class="day-header-edit">
                <div class="day-name-edit">${day.name}</div>
                <div class="day-date-edit">${day.date}</div>
            </div>
            
            <div class="schedule-type-selector">
                <label class="type-option">
                    <input type="radio" name="type-${day.dateString}" value="work" 
                           ${isWorkDay ? 'checked' : ''} 
                           onchange="updateDaySchedule('${employee.id}', '${day.dateString}', 'work')">
                    <div class="type-card work">
                        <i class="fas fa-briefcase"></i>
                        <span>上班</span>
                    </div>
                </label>
                <label class="type-option">
                    <input type="radio" name="type-${day.dateString}" value="rest"
                           ${isRestDay ? 'checked' : ''}
                           onchange="updateDaySchedule('${employee.id}', '${day.dateString}', 'rest')">
                    <div class="type-card rest">
                        <i class="fas fa-umbrella-beach"></i>
                        <span>休息</span>
                    </div>
                </label>
                <label class="type-option">
                    <input type="radio" name="type-${day.dateString}" value="none"
                           ${!schedule ? 'checked' : ''}
                           onchange="clearDaySchedule('${employee.id}', '${day.dateString}')">
                    <div class="type-card">
                        <i class="fas fa-times"></i>
                        <span>无排班</span>
                    </div>
                </label>
            </div>
            
            ${isWorkDay ? `
                <div class="time-settings-edit">
                    <div class="time-input-group">
                        <label>上班时间</label>
                        <input type="time" class="time-field" value="${schedule.startTime}"
                               onchange="updateWorkTime('${employee.id}', '${day.dateString}', 'start', this.value)">
                    </div>
                    <div class="time-input-group">
                        <label>下班时间</label>
                        <input type="time" class="time-field" value="${schedule.endTime}"
                               onchange="updateWorkTime('${employee.id}', '${day.dateString}', 'end', this.value)">
                    </div>
                </div>
            ` : ''}
            
            <button class="btn btn-sm" style="margin-top:10px;width:100%;"
                    onclick="editDaySchedule('${employee.id}', '${day.dateString}')">
                <i class="fas fa-edit"></i> 详细编辑
            </button>
        </div>
    `;
}

function updateDaySchedule(employeeId, date, type) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    // 查找现有排班
    const existingSchedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    if (existingSchedule) {
        const scheduleId = Object.keys(schedules).find(key => 
            schedules[key].employeeId === employeeId && schedules[key].date === date
        );
        
        if (type === 'work') {
            // 更新为上班
            database.ref(`schedules/${scheduleId}`).update({
                startTime: existingSchedule.startTime || '08:00',
                endTime: existingSchedule.endTime || '17:00',
                isDayOff: false,
                updatedAt: Date.now()
            });
        } else if (type === 'rest') {
            // 更新为休息
            database.ref(`schedules/${scheduleId}`).update({
                startTime: '00:00',
                endTime: '00:00',
                isDayOff: true,
                notes: '休息日',
                updatedAt: Date.now()
            });
        }
    } else {
        // 创建新排班
        const scheduleData = {
            employeeId: employeeId,
            employeeName: employee.name,
            employeePosition: employee.position,
            date: date,
            createdAt: Date.now()
        };
        
        if (type === 'work') {
            Object.assign(scheduleData, {
                startTime: '08:00',
                endTime: '17:00',
                isDayOff: false
            });
        } else if (type === 'rest') {
            Object.assign(scheduleData, {
                startTime: '00:00',
                endTime: '00:00',
                isDayOff: true,
                notes: '休息日'
            });
        }
        
        database.ref('schedules').push().set(scheduleData);
    }
    
    showMessage('排班更新成功', 'success');
}

function updateWorkTime(employeeId, date, timeType, timeValue) {
    const schedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    if (!schedule) return;
    
    const scheduleId = Object.keys(schedules).find(key => 
        schedules[key].employeeId === employeeId && schedules[key].date === date
    );
    
    const updateData = {};
    updateData[timeType === 'start' ? 'startTime' : 'endTime'] = timeValue;
    updateData.updatedAt = Date.now();
    
    database.ref(`schedules/${scheduleId}`).update(updateData);
}

function clearDaySchedule(employeeId, date) {
    const schedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    if (!schedule) return;
    
    const scheduleId = Object.keys(schedules).find(key => 
        schedules[key].employeeId === employeeId && schedules[key].date === date
    );
    
    if (confirm('确定删除这个排班吗?')) {
        database.ref(`schedules/${scheduleId}`).remove()
        .then(() => {
            showMessage('排班已删除', 'success');
        });
    }
}

function editDaySchedule(employeeId, date) {
    currentEditEmployee = employeeId;
    currentEditDate = date;
    
    const employee = employees.find(e => e.id === employeeId);
    const schedule = Object.values(schedules).find(s => 
        s.employeeId === employeeId && s.date === date
    );
    
    // 更新模态框内容
    document.getElementById('editDayEmployee').innerHTML = `
        <div class="employee-display-info">
            <div class="avatar-small">${employee.name.charAt(0)}</div>
            <div>
                <strong>${employee.name}</strong>
                <small>${employee.position}</small>
            </div>
        </div>
    `;
    
    document.getElementById('editDayDate').innerHTML = `
        <strong>${formatDate(date)}</strong>
        <div>${getDayName(new Date(date))}</div>
    `;
    
    // 设置排班类型
    if (schedule) {
        if (schedule.isDayOff) {
            document.querySelector('input[name="scheduleType"][value="rest"]').checked = true;
            document.getElementById('timeInputsSection').style.display = 'none';
        } else {
            document.querySelector('input[name="scheduleType"][value="work"]').checked = true;
            document.getElementById('timeInputsSection').style.display = 'block';
            document.getElementById('editDayStartTime').value = schedule.startTime;
            document.getElementById('editDayEndTime').value = schedule.endTime;
        }
        
        // 显示删除按钮
        document.getElementById('deleteDayBtn').style.display = 'block';
    } else {
        document.querySelector('input[name="scheduleType"][value="work"]').checked = true;
        document.getElementById('timeInputsSection').style.display = 'block';
        document.getElementById('editDayStartTime').value = '08:00';
        document.getElementById('editDayEndTime').value = '17:00';
        
        // 隐藏删除按钮
        document.getElementById('deleteDayBtn').style.display = 'none';
    }
    
    openModal('dayEditModal');
}

function saveDayEdit() {
    const scheduleType = document.querySelector('input[name="scheduleType"]:checked').value;
    const employee = employees.find(e => e.id === currentEditEmployee);
    
    if (!employee || !currentEditDate) return;
    
    // 查找现有排班
    const existingSchedule = Object.values(schedules).find(s => 
        s.employeeId === currentEditEmployee && s.date === currentEditDate
    );
    
    const scheduleData = {
        employeeId: currentEditEmployee,
        employeeName: employee.name,
        employeePosition: employee.position,
        date: currentEditDate,
        updatedAt: Date.now()
    };
    
    if (scheduleType === 'work') {
        const startTime = document.getElementById('editDayStartTime').value;
        const endTime = document.getElementById('editDayEndTime').value;
        
        if (startTime >= endTime) {
            showMessage('下班时间必须晚于上班时间', 'warning');
            return;
        }
        
        Object.assign(scheduleData, {
            startTime: startTime,
            endTime: endTime,
            isDayOff: false
        });
    } else {
        Object.assign(scheduleData, {
            startTime: '00:00',
            endTime: '00:00',
            isDayOff: true,
            notes: '休息日'
        });
    }
    
    if (existingSchedule) {
        // 更新现有排班
        const scheduleId = Object.keys(schedules).find(key => 
            schedules[key].employeeId === currentEditEmployee && schedules[key].date === currentEditDate
        );
        
        database.ref(`schedules/${scheduleId}`).update(scheduleData)
        .then(() => {
            closeModal('dayEditModal');
            showMessage('排班更新成功', 'success');
        });
    } else {
        // 创建新排班
        scheduleData.createdAt = Date.now();
        
        database.ref('schedules').push().set(scheduleData)
        .then(() => {
            closeModal('dayEditModal');
            showMessage('排班创建成功', 'success');
        });
    }
}

function deleteDaySchedule() {
    if (!currentEditEmployee || !currentEditDate) return;
    
    const schedule = Object.values(schedules).find(s => 
        s.employeeId === currentEditEmployee && s.date === currentEditDate
    );
    
    if (!schedule) return;
    
    if (!confirm('确定删除这个排班吗?')) return;
    
    const scheduleId = Object.keys(schedules).find(key => 
        schedules[key].employeeId === currentEditEmployee && schedules[key].date === currentEditDate
    );
    
    database.ref(`schedules/${scheduleId}`).remove()
    .then(() => {
        closeModal('dayEditModal');
        showMessage('排班已删除', 'success');
    });
}

// ==================== WEEKLY VIEW ====================
function renderWeeklyView() {
    const container = document.getElementById('weeklyGrid');
    const { startDate, endDate } = getWeekDates(currentWeek);
    
    // 获取本周所有排班
    const weekSchedules = getWeekSchedules(startDate, endDate);
    
    // 按员工分组
    const schedulesByEmployee = {};
    weekSchedules.forEach(schedule => {
        if (!schedulesByEmployee[schedule.employeeId]) {
            schedulesByEmployee[schedule.employeeId] = {
                employee: employees.find(e => e.id === schedule.employeeId),
                schedules: {}
            };
        }
        schedulesByEmployee[schedule.employeeId].schedules[schedule.date] = schedule;
    });
    
    // 生成周视图
    const days = generateWeekDays(startDate);
    
    let html = `
        <div class="week-header">
            <div class="week-header-cell">员工</div>
            ${days.map(day => `
                <div class="week-header-cell">
                    <div>${day.name}</div>
                    <small>${day.date}</small>
                </div>
            `).join('')}
        </div>
    `;
    
    // 添加每个员工的行
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id];
        
        html += `
            <div class="week-row">
                <div class="week-cell">
                    <div class="employee-cell">
                        <strong>${employee.name}</strong>
                        <small>${employee.position}</small>
                    </div>
                </div>
                ${days.map(day => {
                    const schedule = employeeSchedules ? employeeSchedules.schedules[day.dateString] : null;
                    let scheduleClass = 'empty';
                    let scheduleText = '';
                    
                    if (schedule) {
                        if (schedule.isDayOff) {
                            scheduleClass = 'rest';
                            scheduleText = '休息';
                        } else {
                            scheduleClass = 'work';
                            scheduleText = `${schedule.startTime}-${schedule.endTime}`;
                        }
                    }
                    
                    return `
                        <div class="week-cell">
                            ${schedule ? `
                                <div class="day-schedule ${scheduleClass}" 
                                     onclick="editDaySchedule('${employee.id}', '${day.dateString}')"
                                     title="点击编辑">
                                    ${scheduleText}
                                </div>
                            ` : `
                                <div class="day-schedule empty"
                                     onclick="editDaySchedule('${employee.id}', '${day.dateString}')"
                                     title="点击添加排班">
                                    点击添加
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // 更新周范围显示
    document.getElementById('currentWeekRange').textContent = 
        `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function changeWeek(direction) {
    currentWeek += direction;
    renderWeeklyView();
}

// ==================== UTILITY FUNCTIONS ====================
function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    
    // 计算本周一的日期 (中国习惯: 周一为第一天)
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    // 应用周偏移
    monday.setDate(monday.getDate() + (weekOffset * 7));
    
    // 计算周日日期
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

function getEmployeeWeeklySchedule(employeeId) {
    const { startDate, endDate } = getWeekDates(0);
    return getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
}

function getWeekSchedules(startDate, endDate) {
    return Object.values(schedules).filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= startDate && scheduleDate <= endDate;
    });
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric'
    });
}

function formatDateRange(startDate, endDate) {
    const format = { month: 'short', day: 'numeric' };
    return `${startDate.toLocaleDateString('zh-CN', format)} - ${endDate.toLocaleDateString('zh-CN', format)}`;
}

function getDayName(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
}

function updateStats() {
    document.getElementById('totalEmployees').textContent = employees.length;
    document.getElementById('totalEmployeesStat').textContent = employees.length;
    
    // 今日班次
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = Object.values(schedules).filter(s => 
        s.date === today && !s.isDayOff
    ).length;
    document.getElementById('todayShifts').textContent = todayShifts;
    
    // 本周班次
    const { startDate, endDate } = getWeekDates(0);
    const weekSchedules = getWeekSchedules(startDate, endDate);
    const weekWorkShifts = weekSchedules.filter(s => !s.isDayOff).length;
    document.getElementById('weeklyShiftsStat').textContent = weekWorkShifts;
    
    // 按职位统计
    const frontDeskCount = employees.filter(e => e.position === '前台/服务区').length;
    const kitchenCount = employees.filter(e => e.position === '厨房区').length;
    document.getElementById('frontDeskCount').textContent = frontDeskCount;
    document.getElementById('kitchenCount').textContent = kitchenCount;
}

function updateTodaysSchedule() {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = Object.values(schedules).filter(s => s.date === today);
    
    const container = document.getElementById('todaysSchedule');
    
    if (todaySchedules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar"></i>
                <p>今日暂无排班</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = todaySchedules.map(schedule => {
        const employee = employees.find(e => e.id === schedule.employeeId);
        if (!employee) return '';
        
        return `
            <div class="schedule-item">
                <div class="schedule-info">
                    <strong>${employee.name}</strong>
                    <span>${employee.position}</span>
                </div>
                <div class="schedule-time">
                    ${schedule.isDayOff ? '休息日' : `${schedule.startTime} - ${schedule.endTime}`}
                </div>
            </div>
        `;
    }).join('');
}

function refreshData() {
    loadEmployees();
    loadSchedules();
    showMessage('数据已刷新', 'success');
}

function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function showMessage(text, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) existingMessage.remove();
    
    const message = document.createElement('div');
    message.className = `message message-${type}`;
    message.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 
                       type === 'error' ? 'fa-exclamation-circle' : 
                       'fa-info-circle'}"></i>
        <span>${text}</span>
    `;
    
    document.body.appendChild(message);
    
    setTimeout(() => {
        message.style.opacity = '1';
        message.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
        message.style.opacity = '0';
        message.style.transform = 'translateY(-20px)';
        setTimeout(() => message.remove(), 300);
    }, 3000);
}

// 添加消息样式
const messageStyle = document.createElement('style');
messageStyle.textContent = `
    .message {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 10000;
        opacity: 0;
        transform: translateY(-20px);
        transition: all 0.3s ease;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        font-weight: 500;
        max-width: 400px;
    }
    .message-success {
        background: linear-gradient(135deg, #2ec4b6, #4cc9f0);
        color: white;
        border-left: 4px solid #4CAF50;
    }
    .message-error {
        background: linear-gradient(135deg, #ff006e, #f72585);
        color: white;
        border-left: 4px solid #f44336;
    }
    .message-warning {
        background: linear-gradient(135deg, #ff9f1c, #fb5607);
        color: white;
        border-left: 4px solid #ff9800;
    }
    .message-info {
        background: linear-gradient(135deg, #3a86ff, #4361ee);
        color: white;
        border-left: 4px solid #2196F3;
    }
`;
document.head.appendChild(messageStyle);
