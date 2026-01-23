// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let currentWeek = 0;
let selectedEmployee = null;
let selectedPosition = '前台/服务区';
let currentPositionFilter = 'all';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Kajicho Kanda 排班系统启动");
    
    // 防止iOS bounce
    document.body.addEventListener('touchmove', function(e) {
        if (e.target.classList.contains('weekly-schedule') || 
            e.target.classList.contains('modal-content')) {
            return;
        }
        e.preventDefault();
    }, { passive: false });
    
    // 初始化日期
    initApp();
    
    // 加载数据
    loadEmployees();
    loadSchedules();
    
    // 设置事件监听器
    setupEventListeners();
    
    // 添加toast样式
    addToastStyles();
});

function initApp() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 设置表单日期
    document.getElementById('scheduleDate').value = todayStr;
    document.getElementById('scheduleDate').min = todayStr;
    
    // 初始化工作日选择器
    initWeekdaysSelector();
    
    // 更新当前日期显示
    updateCurrentDate();
    
    // 设置自动刷新日期
    setInterval(updateCurrentDate, 60000);
}

function initWeekdaysSelector() {
    const today = new Date();
    const currentDay = today.getDay();
    
    // 计算本周一
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
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
    
    let html = '';
    weekdays.forEach((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        
        html += `
            <button type="button" class="weekday-btn ${day.default ? 'active' : ''}" 
                    data-day="${day.id}" data-date="${date.toISOString().split('T')[0]}"
                    onclick="toggleWeekday(this)">
                <div style="font-weight: 600; font-size: 14px; color: var(--gray-700);">${day.label}</div>
                <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">${month}/${dayNum}</div>
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function toggleWeekday(button) {
    button.classList.toggle('active');
}

function setAllWeekdays() {
    document.querySelectorAll('#weekdaysSelector .weekday-btn').forEach(btn => {
        btn.classList.add('active');
        btn.classList.remove('rest');
    });
}

function setAllAsRest() {
    document.querySelectorAll('#weekdaysSelector .weekday-btn').forEach(btn => {
        btn.classList.add('active', 'rest');
    });
}

function clearWeekdays() {
    document.querySelectorAll('#weekdaysSelector .weekday-btn').forEach(btn => {
        btn.classList.remove('active', 'rest');
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

function setupEventListeners() {
    // 点击背景关闭模态框
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });
    
    // 防止iOS键盘收起时页面滚动
    document.addEventListener('focusout', function() {
        window.scrollTo(0, 0);
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
                case 'p':
                    if (selectedEmployee) {
                        printEmployeeSchedule();
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
    
    // Fix cho iOS date input
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.type = 'text';
            setTimeout(() => {
                this.type = 'date';
            }, 100);
        });
    });
    
    // Ngăn chặn zoom trên iOS khi focus input
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            document.body.style.zoom = '100%';
        });
    });
    
    // Lưu trạng thái khi rời trang
    window.addEventListener('beforeunload', function(e) {
        const lastView = document.querySelector('.view.active').id.replace('View', '');
        localStorage.setItem('lastView', lastView);
    });
    
    // Khôi phục view đã lưu
    const savedView = localStorage.getItem('lastView');
    if (savedView) {
        setTimeout(() => switchView(savedView), 100);
    }
}

// ==================== MODAL FUNCTIONS ====================
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus vào input đầu tiên nếu có
    setTimeout(() => {
        const modal = document.getElementById(modalId);
        const firstInput = modal.querySelector('input:not([type="hidden"]), select, button:not(.modal-close)');
        if (firstInput && firstInput.type !== 'hidden') {
            firstInput.focus();
        }
    }, 100);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    if (modalId === 'employeeModal') {
        selectedEmployee = null;
    }
}

// ==================== MESSAGE FUNCTIONS ====================
function addToastStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .toast-message {
            position: fixed;
            top: 100px;
            right: 20px;
            background: white;
            border-radius: 12px;
            padding: 16px 20px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            z-index: 2000;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            max-width: 350px;
            border-left: 4px solid var(--primary);
        }
        
        .toast-message.show {
            transform: translateX(0);
        }
        
        .toast-content {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .toast-message i {
            font-size: 20px;
            flex-shrink: 0;
        }
        
        .toast-success {
            border-left-color: var(--success);
        }
        
        .toast-success i {
            color: var(--success);
        }
        
        .toast-error {
            border-left-color: var(--danger);
        }
        
        .toast-error i {
            color: var(--danger);
        }
        
        .toast-warning {
            border-left-color: var(--warning);
        }
        
        .toast-warning i {
            color: var(--warning);
        }
        
        .toast-info {
            border-left-color: var(--primary);
        }
        
        .toast-info i {
            color: var(--primary);
        }
        
        @media (max-width: 768px) {
            .toast-message {
                left: 20px;
                right: 20px;
                top: 80px;
                transform: translateY(-100px);
            }
            
            .toast-message.show {
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

function showMessage(message, type = 'info') {
    // Tạo toast message
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${
                type === 'success' ? 'fa-check-circle' :
                type === 'error' ? 'fa-exclamation-circle' :
                type === 'warning' ? 'fa-exclamation-triangle' :
                'fa-info-circle'
            }"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Hiệu ứng xuất hiện
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Tự động biến mất sau 3 giây
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ==================== 时间验证函数 ====================
function validateTimeRange(startTime, endTime) {
    // 处理跨午夜的特殊情况
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    
    // 检查时间格式
    if (startParts.length !== 2 || endParts.length !== 2) {
        showMessage('时间格式不正确', 'warning');
        return false;
    }
    
    // 检查时间是否在有效范围内
    if (startParts[0] < 0 || startParts[0] > 23 || startParts[1] < 0 || startParts[1] > 59 ||
        endParts[0] < 0 || endParts[0] > 23 || endParts[1] < 0 || endParts[1] > 59) {
        showMessage('时间必须在 00:00 到 23:59 之间', 'warning');
        return false;
    }
    
    // 计算分钟数进行比较
    const startTotalMinutes = startParts[0] * 60 + startParts[1];
    const endTotalMinutes = endParts[0] * 60 + endParts[1];
    
    // 判断是否跨午夜
    const isCrossMidnight = endTotalMinutes < startTotalMinutes;
    
    // 计算实际工时（考虑跨午夜）
    let actualWorkMinutes;
    if (isCrossMidnight) {
        // 跨午夜：从开始时间到午夜 + 从午夜到结束时间
        actualWorkMinutes = (24 * 60 - startTotalMinutes) + endTotalMinutes;
    } else {
        // 不跨午夜
        actualWorkMinutes = endTotalMinutes - startTotalMinutes;
    }
    
    // 检查工时是否合理
    if (actualWorkMinutes > 24 * 60) {
        showMessage('工作时间不能超过24小时', 'warning');
        return false;
    }
    
    if (actualWorkMinutes === 0) {
        showMessage('开始时间和结束时间不能相同', 'warning');
        return false;
    }
    
    // 检查班次是否太短（至少15分钟）
    if (actualWorkMinutes < 15) {
        showMessage('工作时间至少需要15分钟', 'warning');
        return false;
    }
    
    return true;
}

// ==================== 计算工时函数（已修复跨午夜问题） ====================
function calculateShiftHours(startTime, endTime) {
    if (!startTime || !endTime) {
        return 0;
    }
    
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    
    if (startParts.length !== 2 || endParts.length !== 2) {
        return 0;
    }
    
    const startTotalMinutes = startParts[0] * 60 + startParts[1];
    const endTotalMinutes = endParts[0] * 60 + endParts[1];
    
    // 判断是否跨午夜
    let workMinutes;
    if (endTotalMinutes <= startTotalMinutes) {
        // 跨午夜：从开始时间到午夜 + 从午夜到结束时间
        workMinutes = (24 * 60 - startTotalMinutes) + endTotalMinutes;
    } else {
        // 不跨午夜
        workMinutes = endTotalMinutes - startTotalMinutes;
    }
    
    const workHours = workMinutes / 60;
    return Math.round(workHours * 100) / 100; // 保留两位小数
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
    const navBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
    if (navBtn) navBtn.classList.add('active');
    
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
    
    // Lưu view vào localStorage
    localStorage.setItem('lastView', viewName);
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
                <h3 class="position-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--primary);">
                    <i class="fas fa-door-open"></i> 前台/服务区
                    <span class="position-count" style="font-size: 12px; background: var(--primary-light); color: var(--primary); padding: 2px 8px; border-radius: 12px;">${frontDeskEmployees.length}人</span>
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
                <h3 class="position-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--warning);">
                    <i class="fas fa-utensils"></i> 厨房区
                    <span class="position-count" style="font-size: 12px; background: var(--warning-light); color: var(--warning); padding: 2px 8px; border-radius: 12px;">${kitchenEmployees.length}人</span>
                </h3>
                <div class="position-cards">
                    ${kitchenEmployees.map(emp => generateEmployeeCard(emp)).join('')}
                </div>
            </div>
        `;
    }
    
    container.innerHTML = html;
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
                        <i class="fas fa-clock" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">本周:</span>
                        <span class="stat-value">${weeklyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">本月:</span>
                        <span class="stat-value">${monthlyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-check" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">${weekSchedule.workDays}天班</span>
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
                <div style="font-size: 11px; margin-top: 4px; font-weight: 600; color: var(--success);">
                    ${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}
                </div>
            `;
        }
        
        return `
            <div class="week-day ${status}">
                <div style="font-weight: 600; color: var(--gray-700);">${day.name}</div>
                <div style="font-size: 11px; color: var(--gray-500);">${day.date}</div>
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
    updateRestDaysEmployeeSelect();
}

function updateScheduleEmployeeSelect() {
    const select = document.getElementById('scheduleEmployee');
    if (!select) return;
    
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

function updateRestDaysEmployeeSelect() {
    const select = document.getElementById('restDaysEmployee');
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

function setTimePreset(start, end) {
    document.getElementById('scheduleStart').value = start;
    document.getElementById('scheduleEnd').value = end;
    
    // 计算并显示工时
    const hours = calculateShiftHours(start, end);
    showMessage(`已设置时间: ${start} - ${end} (${hours}小时)`, 'info');
}

function setQuickTimePreset(start, end) {
    document.getElementById('quickWeekStart').value = start;
    document.getElementById('quickWeekEnd').value = end;
    
    // 计算并显示工时
    const hours = calculateShiftHours(start, end);
    showMessage(`已设置时间: ${start} - ${end} (${hours}小时)`, 'info');
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
        
        // 使用新的时间验证逻辑
        if (!validateTimeRange(startTime, endTime)) {
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
            // 强制刷新本周视图
            renderWeeklySchedule();
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
            // 强制刷新本周视图
            renderWeeklySchedule();
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

// ==================== QUICK WEEK SCHEDULE ====================
function showQuickWeekModal() {
    document.getElementById('quickWeekStart').value = '08:00';
    document.getElementById('quickWeekEnd').value = '17:00';
    
    // 更新工作日选择器
    updateWeekdaysSelector();
    
    updateQuickWeekEmployeeSelect();
    openModal('quickWeekModal');
}

function updateWeekdaysSelector() {
    const today = new Date();
    const currentDay = today.getDay();
    
    // 计算本周一
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
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
    
    let html = '';
    weekdays.forEach((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        
        // 检查是否有现有的排班
        const dateString = date.toISOString().split('T')[0];
        const hasSchedule = checkExistingSchedule(dateString);
        
        html += `
            <button type="button" class="weekday-btn ${day.default ? 'active' : ''} ${hasSchedule === 'rest' ? 'rest' : ''}" 
                    data-day="${day.id}" data-date="${dateString}"
                    onclick="toggleWeekday(this)">
                <div style="font-weight: 600; font-size: 14px; color: ${hasSchedule === 'rest' ? 'var(--warning)' : 'var(--gray-700)'};">${day.label}</div>
                <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">${month}/${dayNum}</div>
                ${hasSchedule ? `
                    <div style="font-size: 10px; margin-top: 2px; color: ${hasSchedule === 'rest' ? 'var(--warning)' : 'var(--success)'}; font-weight: 500;">
                        ${hasSchedule === 'rest' ? '休息' : '有班'}
                    </div>
                ` : ''}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function checkExistingSchedule(dateString) {
    // 检查是否有任何员工在这天有排班
    const schedulesForDate = Object.values(schedules).filter(s => s.date === dateString);
    if (schedulesForDate.length > 0) {
        const employeeId = document.getElementById('quickWeekEmployee').value;
        if (employeeId) {
            const employeeSchedule = schedulesForDate.find(s => s.employeeId === employeeId);
            if (employeeSchedule) {
                return employeeSchedule.isDayOff ? 'rest' : 'work';
            }
        }
        return 'work'; // 其他员工有班
    }
    return '';
}

function applyQuickWeekSchedule() {
    const employeeId = document.getElementById('quickWeekEmployee').value;
    const startTime = document.getElementById('quickWeekStart').value;
    const endTime = document.getElementById('quickWeekEnd').value;
    
    if (!employeeId) {
        showMessage('请选择员工', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const selectedDays = [];
    const selectedDates = [];
    const restDays = [];
    
    document.querySelectorAll('#weekdaysSelector .weekday-btn.active').forEach(btn => {
        const day = parseInt(btn.dataset.day);
        const dateString = btn.dataset.date;
        const isRestDay = btn.classList.contains('rest');
        
        selectedDays.push(day);
        selectedDates.push(dateString);
        
        if (isRestDay) {
            restDays.push(dateString);
        }
    });
    
    if (selectedDays.length === 0) {
        showMessage('请至少选择一个工作日', 'warning');
        return;
    }
    
    const promises = [];
    
    // 为选择的日期设置排班
    selectedDates.forEach(dateString => {
        const isRestDay = restDays.includes(dateString);
        
        const scheduleData = {
            employeeId: employeeId,
            employeeName: employee.name,
            employeePosition: employee.position,
            date: dateString,
            isDayOff: isRestDay,
            updatedAt: Date.now()
        };
        
        if (!isRestDay) {
            if (!startTime || !endTime) {
                showMessage('请填写工作时间', 'warning');
                return;
            }
            
            // 使用新的时间验证逻辑
            if (!validateTimeRange(startTime, endTime)) {
                return;
            }
            
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
    });
    
    Promise.all(promises)
    .then(() => {
        closeModal('quickWeekModal');
        const workDays = selectedDays.length - restDays.length;
        showMessage(`已设置 ${workDays} 天工作, ${restDays.length} 天休息`, 'success');
        // 强制刷新本周视图
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage('设置失败: ' + error.message, 'error');
    });
}

// ==================== REST DAYS MANAGEMENT ====================
function showSetRestDaysModal() {
    updateRestDaysSelector();
    updateRestDaysEmployeeSelect();
    openModal('setRestDaysModal');
}

function updateRestDaysSelector() {
    const today = new Date();
    const currentDay = today.getDay();
    
    // 计算本周一
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    const weekdays = [
        { id: 1, label: '周一', default: false },
        { id: 2, label: '周二', default: false },
        { id: 3, label: '周三', default: false },
        { id: 4, label: '周四', default: false },
        { id: 5, label: '周五', default: false },
        { id: 6, label: '周六', default: false },
        { id: 0, label: '周日', default: false }
    ];
    
    const container = document.getElementById('restDaysSelector');
    
    let html = '';
    weekdays.forEach((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        
        html += `
            <button type="button" class="weekday-btn" 
                    data-day="${day.id}" data-date="${date.toISOString().split('T')[0]}"
                    onclick="toggleRestDay(this)">
                <div style="font-weight: 600; font-size: 14px; color: var(--gray-700);">${day.label}</div>
                <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">${month}/${dayNum}</div>
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function toggleRestDay(button) {
    button.classList.toggle('active');
    button.classList.toggle('rest');
}

function setAllRestDays() {
    document.querySelectorAll('#restDaysSelector .weekday-btn').forEach(btn => {
        btn.classList.add('active', 'rest');
    });
}

function clearRestDays() {
    document.querySelectorAll('#restDaysSelector .weekday-btn').forEach(btn => {
        btn.classList.remove('active', 'rest');
    });
}

function applyRestDays() {
    const employeeId = document.getElementById('restDaysEmployee').value;
    
    if (!employeeId) {
        showMessage('请选择员工', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const selectedDates = [];
    
    document.querySelectorAll('#restDaysSelector .weekday-btn.active').forEach(btn => {
        selectedDates.push(btn.dataset.date);
    });
    
    if (selectedDates.length === 0) {
        showMessage('请至少选择一个休息日', 'warning');
        return;
    }
    
    const promises = [];
    
    // 为选择的日期设置休息
    selectedDates.forEach(dateString => {
        const scheduleData = {
            employeeId: employeeId,
            employeeName: employee.name,
            employeePosition: employee.position,
            date: dateString,
            isDayOff: true,
            startTime: '00:00',
            endTime: '00:00',
            notes: '休息日',
            updatedAt: Date.now()
        };
        
        const existingSchedule = findScheduleByEmployeeAndDate(employeeId, dateString);
        
        if (existingSchedule) {
            // 更新现有排班为休息
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
    });
    
    Promise.all(promises)
    .then(() => {
        closeModal('setRestDaysModal');
        showMessage(`已设置 ${selectedDates.length} 天休息`, 'success');
        // 强制刷新本周视图
        renderWeeklySchedule();
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
            ${days.map(day => {
                const date = new Date(day.dateString);
                const month = date.getMonth() + 1;
                const dayNum = date.getDate();
                return `
                    <div class="week-header-cell">
                        <div style="font-weight: 700; color: var(--dark);">${day.name}</div>
                        <div style="font-size: 11px; color: var(--gray-500); margin-top: 2px;">${month}/${dayNum}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // 生成员工行
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id] || {};
        const weeklyHours = calculateWeeklyHours(employee.id);
        
        html += `
            <div class="week-row">
                <div class="week-cell">
                    <div style="font-weight: 700; font-size: 14px; color: var(--dark);">${employee.name}</div>
                    <div style="font-size: 12px; color: var(--gray-500); margin-bottom: 6px;">${employee.position}</div>
                    <div style="font-size: 11px; color: var(--primary); font-weight: 600;">
                        <i class="fas fa-clock" style="font-size: 10px; margin-right: 4px;"></i> 本周: ${weeklyHours}h
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
                                <div style="font-weight: 600;">${schedule.startTime.substring(0, 5)}</div>
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
                        <div style="font-weight: 700; color: var(--dark);">${employee.name}</div>
                        <div style="font-size: 14px; color: var(--gray-500);">${employee.position}</div>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>日期</label>
                <div class="date-display">
                    <div style="font-weight: 700; color: var(--dark);">${formatDate(date)}</div>
                    <div style="font-size: 14px; color: var(--gray-500);">${getDayName(new Date(date))}</div>
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

function editEmployeeSchedule() {
    if (!selectedEmployee) return;
    
    // 切换到周视图
    switchView('weekly');
    closeModal('employeeModal');
    
    // 滚动到选中的员工
    setTimeout(() => {
        const employee = employees.find(e => e.id === selectedEmployee);
        if (!employee) return;
        
        const employeeRows = document.querySelectorAll('.week-row');
        employeeRows.forEach(row => {
            const nameCell = row.querySelector('.week-cell:first-child');
            if (nameCell && nameCell.textContent.includes(employee.name)) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // 高亮显示
                row.style.background = 'var(--primary-light)';
                setTimeout(() => {
                    row.style.background = '';
                }, 3000);
            }
        });
    }, 300);
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
        
        // 使用新的时间验证逻辑
        if (!validateTimeRange(startTime, endTime)) {
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
            // 强制刷新本周视图
            renderWeeklySchedule();
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
            // 强制刷新本周视图
            renderWeeklySchedule();
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
        // 强制刷新本周视图
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage('删除失败: ' + error.message, 'error');
    });
}

// ==================== PRINT ALL SCHEDULE ====================
function printAllSchedule() {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    const days = generateWeekDays(startDate);
    
    // Tạo HTML để in
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kajicho Kanda - 本周排班表 - ${formatDate(startDate)} 至 ${formatDate(endDate)}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif; 
                    padding: 20px; 
                    color: #1e293b;
                    background: white;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .print-header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    padding-bottom: 20px; 
                    border-bottom: 2px solid #2563eb; 
                }
                .print-header h1 { 
                    color: #2563eb; 
                    margin: 0 0 10px 0; 
                    font-size: 24px;
                    font-weight: 800;
                }
                .print-header p {
                    color: #64748b;
                    font-size: 14px;
                    font-weight: 500;
                }
                .print-info {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-bottom: 25px;
                    padding: 20px;
                    background: #f8fafc;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                }
                .info-item {
                    text-align: center;
                }
                .info-item h3 {
                    color: #64748b;
                    font-size: 12px;
                    margin: 0 0 8px 0;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .info-item p {
                    color: #2563eb;
                    font-size: 20px;
                    font-weight: 800;
                    margin: 0;
                }
                .schedule-table { 
                    width: 100%; 
                    border-collapse: separate; 
                    border-spacing: 0;
                    margin-bottom: 30px;
                    font-size: 13px;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    overflow: hidden;
                }
                .schedule-table th { 
                    background: #2563eb; 
                    color: white; 
                    padding: 16px 12px; 
                    text-align: center; 
                    font-weight: 700;
                    border-right: 1px solid rgba(255,255,255,0.2);
                    font-size: 13px;
                }
                .schedule-table th:last-child {
                    border-right: none;
                }
                .schedule-table td { 
                    padding: 14px 12px; 
                    border: 1px solid #e2e8f0; 
                    text-align: center;
                    vertical-align: top;
                    background: white;
                }
                .schedule-table .work { 
                    background: #d1fae5; 
                    color: #065f46;
                    border-color: #a7f3d0;
                }
                .schedule-table .rest { 
                    background: #fef3c7; 
                    color: #92400e;
                    border-color: #fde68a;
                }
                .employee-name {
                    font-weight: 800;
                    font-size: 14px;
                    color: #1e293b;
                    margin-bottom: 4px;
                }
                .employee-position {
                    font-size: 12px;
                    color: #64748b;
                    font-weight: 500;
                }
                .schedule-time {
                    font-size: 12px;
                    font-weight: 700;
                    margin: 4px 0;
                    color: #059669;
                }
                .schedule-rest {
                    font-size: 12px;
                    font-weight: 700;
                    color: #d97706;
                }
                .day-header {
                    background: #f1f5f9;
                    padding: 8px;
                    border-bottom: 2px solid #2563eb;
                }
                .day-name {
                    font-weight: 800;
                    font-size: 14px;
                    color: #1e293b;
                }
                .day-date {
                    font-size: 12px;
                    color: #64748b;
                    font-weight: 500;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 15px;
                    margin-top: 30px;
                }
                .summary-card {
                    background: #dbeafe;
                    padding: 20px;
                    border-radius: 12px;
                    text-align: center;
                    border: 1px solid #bfdbfe;
                }
                .summary-card h4 {
                    color: #1e40af;
                    font-size: 22px;
                    margin: 0 0 8px 0;
                    font-weight: 800;
                }
                .summary-card p {
                    color: #3730a3;
                    font-size: 12px;
                    margin: 0;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .footer { 
                    text-align: center; 
                    margin-top: 30px; 
                    color: #64748b; 
                    font-size: 12px; 
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                }
                .footer p {
                    margin: 4px 0;
                }
                @media print {
                    body { padding: 10px; }
                    @page { 
                        margin: 0.5cm;
                        size: landscape;
                    }
                    .print-header h1 {
                        font-size: 20px;
                    }
                    .print-info {
                        padding: 15px;
                    }
                    .info-item p {
                        font-size: 18px;
                    }
                    .schedule-table {
                        font-size: 12px;
                    }
                    .summary-card h4 {
                        font-size: 20px;
                    }
                }
                @media (max-width: 768px) {
                    .print-info, .summary-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .schedule-table {
                        font-size: 10px;
                    }
                    .schedule-table th,
                    .schedule-table td {
                        padding: 10px 8px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <h1>Kajicho Kanda 本周排班表</h1>
                <p>日期：${formatDate(startDate)} 至 ${formatDate(endDate)}</p>
            </div>
            
            <div class="print-info">
                <div class="info-item">
                    <h3>总员工数</h3>
                    <p>${employees.length} 人</p>
                </div>
                <div class="info-item">
                    <h3>本周总排班</h3>
                    <p>${weekSchedule.length} 班次</p>
                </div>
                <div class="info-item">
                    <h3>前台/服务区</h3>
                    <p>${employees.filter(e => e.position === '前台/服务区').length} 人</p>
                </div>
                <div class="info-item">
                    <h3>厨房区</h3>
                    <p>${employees.filter(e => e.position === '厨房区').length} 人</p>
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th style="width: 120px; text-align: left; padding-left: 16px;">员工 / 职位</th>
    `;
    
    // Thêm ngày tháng cho mỗi ngày
    days.forEach(day => {
        const date = new Date(day.dateString);
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        printContent += `
            <th>
                <div class="day-header">
                    <div class="day-name">${day.name}</div>
                    <div class="day-date">${month}/${dayNum}</div>
                </div>
            </th>
        `;
    });
    
    printContent += `
                    </tr>
                </thead>
                <tbody>
    `;
    
    // Nhóm lịch trình theo nhân viên
    const schedulesByEmployee = {};
    weekSchedule.forEach(schedule => {
        if (!schedulesByEmployee[schedule.employeeId]) {
            schedulesByEmployee[schedule.employeeId] = {};
        }
        schedulesByEmployee[schedule.employeeId][schedule.date] = schedule;
    });
    
    // Thêm dữ liệu cho mỗi nhân viên
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id] || {};
        const weeklyHours = calculateWeeklyHours(employee.id);
        
        printContent += `
            <tr>
                <td style="text-align: left; padding-left: 16px;">
                    <div class="employee-name">${employee.name}</div>
                    <div class="employee-position">${employee.position}</div>
                    <div style="font-size: 11px; color: #2563eb; margin-top: 6px; font-weight: 700;">
                        本周工时: ${weeklyHours}h
                    </div>
                </td>
        `;
        
        days.forEach(day => {
            const schedule = employeeSchedules[day.dateString];
            let scheduleClass = '';
            let scheduleContent = '';
            
            if (schedule) {
                if (schedule.isDayOff) {
                    scheduleClass = 'rest';
                    scheduleContent = '<div class="schedule-rest">休息</div>';
                } else {
                    scheduleClass = 'work';
                    const hours = calculateShiftHours(schedule.startTime, schedule.endTime);
                    scheduleContent = `
                        <div class="schedule-time">${schedule.startTime.substring(0, 5)}-${schedule.endTime.substring(0, 5)}</div>
                        <div style="font-size: 11px; color: #047857; font-weight: 600;">${hours}h</div>
                    `;
                }
            } else {
                scheduleContent = '<div style="color: #94a3b8; font-size: 12px; font-style: italic;">-</div>';
            }
            
            printContent += `
                <td class="${scheduleClass}">
                    ${scheduleContent}
                </td>
            `;
        });
        
        printContent += `</tr>`;
    });
    
    // Tính tổng kết
    const totalWorkHours = employees.reduce((sum, emp) => sum + calculateWeeklyHours(emp.id), 0);
    const totalWorkDays = weekSchedule.filter(s => !s.isDayOff).length;
    const totalRestDays = weekSchedule.filter(s => s.isDayOff).length;
    
    printContent += `
                </tbody>
            </table>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <h4>${totalWorkHours}</h4>
                    <p>本周总工时</p>
                </div>
                <div class="summary-card">
                    <h4>${employees.length}</h4>
                    <p>员工总数</p>
                </div>
                <div class="summary-card">
                    <h4>${totalWorkDays}</h4>
                    <p>工作班次</p>
                </div>
                <div class="summary-card">
                    <h4>${totalRestDays}</h4>
                    <p>休息班次</p>
                </div>
            </div>
            
            <div class="footer">
                <p>生成时间：${new Date().toLocaleString('zh-CN', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
                <p>Kajicho Kanda 排班系统 - 按 Ctrl + P 打印</p>
            </div>
        </body>
        </html>
    `;
    
    // Mở cửa sổ in
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
        setTimeout(() => {
            printWindow.close();
        }, 500);
    }, 500);
    
    showMessage('正在打开本周排班表打印预览...', 'info');
}

// ==================== EXPORT FUNCTIONS ====================
function copyEmployeeSchedule() {
    if (!selectedEmployee) return;
    copyScheduleAsText();
}

function printEmployeeSchedule() {
    if (!selectedEmployee) return;
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    // 直接调用打印函数
    printSchedule();
    // 关闭员工详情模态框
    closeModal('employeeModal');
}

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
    
    // 生成表格行内容
    const tableRows = generateWeekDays(startDate).map(day => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        const hours = schedule && !schedule.isDayOff ? 
            calculateShiftHours(schedule.startTime, schedule.endTime) : 0;
        
        let scheduleTime = '-';
        if (schedule && !schedule.isDayOff) {
            scheduleTime = schedule.startTime.substring(0, 5) + ' - ' + schedule.endTime.substring(0, 5);
        }
        
        const statusClass = schedule ? (schedule.isDayOff ? 'rest' : 'work') : '';
        const statusText = schedule ? (schedule.isDayOff ? '休息' : '上班') : '无排班';
        
        return `
            <tr class="${statusClass}">
                <td>${day.name}</td>
                <td>${formatDate(day.dateString)}</td>
                <td>${statusText}</td>
                <td>${scheduleTime}</td>
                <td>${hours ? hours + 'h' : '-'}</td>
            </tr>
        `;
    }).join('');
    
    // 创建打印内容
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kajicho Kanda - ${employee.name} 排班表</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; color: #1e293b; background: white; }
                .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2563eb; }
                .header h1 { color: #2563eb; margin: 0 0 10px 0; font-size: 28px; font-weight: 800; }
                .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
                .info-card { background: #f8fafc; padding: 24px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
                .info-card h3 { color: #64748b; font-size: 14px; margin: 0 0 12px 0; font-weight: 600; text-transform: uppercase; }
                .info-card p { color: #2563eb; font-size: 32px; font-weight: 800; margin: 0; }
                .schedule-table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 30px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
                .schedule-table th { background: #2563eb; color: white; padding: 16px; text-align: center; font-weight: 700; border-right: 1px solid rgba(255,255,255,0.2); }
                .schedule-table th:last-child { border-right: none; }
                .schedule-table td { padding: 16px; border: 1px solid #e2e8f0; text-align: center; }
                .schedule-table .work { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
                .schedule-table .rest { background: #fef3c7; color: #92400e; border-color: #fde68a; }
                .summary { background: #dbeafe; padding: 24px; border-radius: 12px; color: #1e40af; border: 1px solid #bfdbfe; }
                .summary h3 { font-size: 18px; margin: 0 0 16px 0; font-weight: 700; }
                .summary p { margin: 8px 0; font-weight: 500; }
                .footer { text-align: center; margin-top: 30px; color: #64748b; font-size: 14px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
                @media print {
                    body { padding: 10px; }
                    .no-print { display: none; }
                    @page { margin: 0.5cm; }
                    .header h1 { font-size: 24px; }
                    .info-card p { font-size: 28px; }
                }
                @media (max-width: 768px) {
                    .info-grid { grid-template-columns: 1fr; }
                    .schedule-table th, .schedule-table td { padding: 12px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Kajicho Kanda - ${employee.name} 排班表</h1>
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
                    ${tableRows}
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
                <p class="no-print">提示：按 Ctrl + P 进行打印</p>
            </div>
        </body>
        </html>
    `;
    
    // 直接打开打印对话框
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // 延迟确保内容加载完成
    setTimeout(() => {
        printWindow.print();
        // 打印后自动关闭窗口
        setTimeout(() => {
            printWindow.close();
        }, 500);
    }, 500);
    
    showMessage('正在打开打印预览...', 'info');
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
            html += `<h4 style="margin-bottom: 16px; color: #2563eb; font-weight: 700;"><i class="fas fa-door-open"></i> 前台/服务区</h4>`;
            html += frontDeskSchedules.map(schedule => createTodayItem(schedule)).join('');
        }
        
        if (kitchenSchedules.length > 0) {
            html += `<h4 style="margin-top: 24px; margin-bottom: 16px; color: #f59e0b; font-weight: 700;"><i class="fas fa-utensils"></i> 厨房区</h4>`;
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
                <div style="font-weight: 700; color: var(--dark);">${schedule.employeeName}</div>
                <div style="font-size: 13px; color: var(--gray-500); font-weight: 500;">${schedule.employeePosition}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700; color: ${schedule.isDayOff ? 'var(--warning)' : 'var(--success)'};">
                    ${schedule.isDayOff ? '休息日' : `${schedule.startTime.substring(0, 5)} - ${schedule.endTime.substring(0, 5)}`}
                </div>
                ${!schedule.isDayOff ? `
                    <div style="font-size: 12px; color: var(--gray-500); font-weight: 500;">
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

function getWeekSchedules(startDate, endDate) {
    const weekSchedules = [];
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    Object.values(schedules).forEach(schedule => {
        if (schedule.date >= startStr && schedule.date <= endStr) {
            weekSchedules.push(schedule);
        }
    });
    
    return weekSchedules;
}

function getEmployeeSchedulesForWeek(employeeId, startDate, endDate) {
    const employeeSchedules = [];
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    Object.values(schedules).forEach(schedule => {
        if (schedule.employeeId === employeeId && 
            schedule.date >= startStr && 
            schedule.date <= endStr) {
            employeeSchedules.push(schedule);
        }
    });
    
    return employeeSchedules;
}

function calculateWeeklyHours(employeeId) {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedules = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    
    let totalHours = 0;
    weekSchedules.forEach(schedule => {
        if (!schedule.isDayOff && schedule.startTime && schedule.endTime) {
            totalHours += calculateShiftHours(schedule.startTime, schedule.endTime);
        }
    });
    
    return Math.round(totalHours * 10) / 10; // Làm tròn 1 số thập phân
}

function calculateMonthlyHours(employeeId) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const firstStr = firstDay.toISOString().split('T')[0];
    const lastStr = lastDay.toISOString().split('T')[0];
    
    let totalHours = 0;
    Object.values(schedules).forEach(schedule => {
        if (schedule.employeeId === employeeId && 
            schedule.date >= firstStr && 
            schedule.date <= lastStr &&
            !schedule.isDayOff) {
            totalHours += calculateShiftHours(schedule.startTime, schedule.endTime);
        }
    });
    
    return Math.round(totalHours * 10) / 10;
}

function getThisWeekSchedule(employeeId) {
    const { startDate } = getWeekDates(0);
    const weekSchedule = getEmployeeSchedulesForWeek(employeeId, startDate, 
        new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000));
    
    const workDays = weekSchedule.filter(s => !s.isDayOff).length;
    const restDays = weekSchedule.filter(s => s.isDayOff).length;
    
    return {
        workDays: workDays,
        restDays: restDays,
        totalShifts: weekSchedule.length
    };
}

function formatDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日`;
}

function getDayName(date) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return days[date.getDay()];
}

function refreshData() {
    // Cập nhật kết nối Firebase
    database.ref('.info/connected').once('value').then(snap => {
        if (snap.val() === true) {
            showMessage('数据同步完成', 'success');
            loadEmployees();
            loadSchedules();
        } else {
            showMessage('无法连接到服务器', 'error');
        }
    });
}

// ==================== ERROR HANDLING ====================
// Xử lý lỗi toàn cục
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('JavaScript Error:', msg, '\nURL:', url, '\nLine:', lineNo, '\nColumn:', columnNo, '\nError object:', error);
    showMessage('发生错误，请刷新页面重试', 'error');
    return false;
};

// ==================== INITIAL LOAD ====================
// Khởi động ứng dụng
console.log("✅ Kajicho Kanda 排班系统已完全加载");
