// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let currentWeek = 0;
let selectedEmployee = null;
let selectedPosition = '前台/服务区';
let currentPositionFilter = 'all';
let currentLanguage = 'ja';

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 鍛治町酒場 神田店 勤務表システム起動");
    
    // Load language
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage) {
        currentLanguage = savedLanguage;
    }
    
    // Initialize the app
    initApp();
    
    // Load data
    loadEmployees();
    loadSchedules();
    
    // Set up event listeners
    setupEventListeners();
    
    console.log("✅ アプリ初期化完了");
});

function initApp() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Set form date
    const scheduleDateInput = document.getElementById('scheduleDate');
    if (scheduleDateInput) {
        scheduleDateInput.value = todayStr;
        scheduleDateInput.min = todayStr;
    }
    
    // Initialize weekday selector
    initWeekdaysSelector();
    
    // Update current date display
    updateCurrentDate();
    
    // Update language
    updateLanguage();
    
    // Set auto-refresh for date
    setInterval(updateCurrentDate, 60000);
}

// ==================== LANGUAGE FUNCTIONS ====================
function updateLanguage() {
    // Update all language elements
    document.querySelectorAll('[data-lang]').forEach(element => {
        const jaElement = element.querySelector('[data-lang="ja"]');
        const zhElement = element.querySelector('[data-lang="zh"]');
        
        if (jaElement && zhElement) {
            if (currentLanguage === 'ja') {
                jaElement.style.display = 'inline';
                zhElement.style.display = 'none';
            } else {
                jaElement.style.display = 'none';
                zhElement.style.display = 'inline';
            }
        } else if (element.hasAttribute('data-lang')) {
            const lang = element.getAttribute('data-lang');
            element.style.display = lang === currentLanguage ? 'inline' : 'none';
        }
    });
    
    // Update language button
    const languageBtn = document.getElementById('languageSwitch');
    const currentLangSpan = document.getElementById('currentLanguage');
    if (currentLanguage === 'ja') {
        currentLangSpan.textContent = '日本語';
        languageBtn.title = 'Switch to Chinese';
    } else {
        currentLangSpan.textContent = '中文';
        languageBtn.title = 'Switch to Japanese';
    }
    
    // Update date display
    updateCurrentDate();
    
    // Update search placeholder
    const searchInput = document.getElementById('employeeSearch');
    if (searchInput) {
        searchInput.placeholder = currentLanguage === 'ja' ? 'スタッフを検索...' : '搜索员工...';
    }
    
    // Update print date
    updatePrintDate();
    
    // Update data display
    renderEmployeeCards();
    renderWeeklySchedule();
}

function updateCurrentDate() {
    const now = new Date();
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        weekday: 'long'
    };
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
        if (currentLanguage === 'ja') {
            currentDateElement.textContent = now.toLocaleDateString('ja-JP', options);
        } else {
            currentDateElement.textContent = now.toLocaleDateString('zh-CN', options);
        }
    }
}

function updatePrintDate() {
    const today = new Date();
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        weekday: 'long'
    };
    
    const printDateElement = document.getElementById('printDate');
    if (printDateElement) {
        if (currentLanguage === 'ja') {
            printDateElement.textContent = today.toLocaleDateString('ja-JP', options);
        } else {
            printDateElement.textContent = today.toLocaleDateString('zh-CN', options);
        }
    }
}

// ==================== MODAL FUNCTIONS ====================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal ${modalId} not found`);
        return;
    }
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // Focus on first input if available
    setTimeout(() => {
        const firstInput = modal.querySelector('input:not([type="hidden"]), select, button:not(.modal-close)');
        if (firstInput && firstInput.type !== 'hidden') {
            firstInput.focus();
        }
    }, 100);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    if (modalId === 'employeeModal') {
        selectedEmployee = null;
    }
}

// ==================== MESSAGE FUNCTIONS ====================
function showMessage(message, type = 'info') {
    let translatedMessage = message;
    if (currentLanguage === 'ja') {
        const messageMap = {
            'Schedule added successfully': 'スケジュールを追加しました',
            'Schedule updated successfully': 'スケジュールを更新しました',
            'Employee added successfully': 'スタッフを追加しました',
            'Please enter employee name': '名前を入力してください',
            'Please select an employee': 'スタッフを選択してください',
            'Please select a date': '日付を選択してください',
            'Please enter work time': '勤務時間を入力してください',
            'Database connection error': 'データベース接続エラー',
            'Error loading employees': 'スタッフデータの読み込みエラー',
            'Error loading schedules': 'スケジュールデータの読み込みエラー',
            'Delete failed:': '削除に失敗:',
            'Update failed:': '更新に失敗:',
            'Add failed:': '追加に失敗:',
            'Setting failed:': '設定に失敗:',
            'Refresh error:': '更新エラー:',
            'An error occurred, please refresh the page and try again': 'エラーが発生しました。ページを更新して再試行してください'
        };
        translatedMessage = messageMap[message] || message;
    } else {
        const messageMap = {
            'Schedule added successfully': '排班添加成功',
            'Schedule updated successfully': '排班更新成功',
            'Employee added successfully': '员工添加成功',
            'Please enter employee name': '请输入员工姓名',
            'Please select an employee': '请选择员工',
            'Please select a date': '请选择日期',
            'Please enter work time': '请输入工作时间',
            'Database connection error': '数据库连接错误',
            'Error loading employees': '加载员工数据错误',
            'Error loading schedules': '加载排班数据错误',
            'Delete failed:': '删除失败:',
            'Update failed:': '更新失败:',
            'Add failed:': '添加失败:',
            'Setting failed:': '设置失败:',
            'Refresh error:': '刷新错误:',
            'An error occurred, please refresh the page and try again': '发生错误，请刷新页面重试'
        };
        translatedMessage = messageMap[message] || message;
    }
    
    // Create toast message
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    
    let icon = 'fa-info-circle';
    switch(type) {
        case 'success': icon = 'fa-check-circle'; break;
        case 'error': icon = 'fa-exclamation-circle'; break;
        case 'warning': icon = 'fa-exclamation-triangle'; break;
        default: icon = 'fa-info-circle';
    }
    
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${icon}"></i>
            <span>${translatedMessage}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Show animation
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ==================== TIME VALIDATION FUNCTIONS ====================
function validateTimeRange(startTime, endTime) {
    if (!startTime || !endTime) {
        showMessage(currentLanguage === 'ja' ? '開始時間と終了時間を入力してください' : '请输入开始和结束时间', 'warning');
        return false;
    }
    
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    
    if (startParts.length !== 2 || endParts.length !== 2 ||
        isNaN(startParts[0]) || isNaN(startParts[1]) ||
        isNaN(endParts[0]) || isNaN(endParts[1])) {
        showMessage(currentLanguage === 'ja' ? '無効な時間形式です' : '无效的时间格式', 'warning');
        return false;
    }
    
    if (startParts[0] < 0 || startParts[0] > 23 || startParts[1] < 0 || startParts[1] > 59 ||
        endParts[0] < 0 || endParts[0] > 23 || endParts[1] < 0 || endParts[1] > 59) {
        showMessage(currentLanguage === 'ja' ? '時間は00:00から23:59の間で入力してください' : '时间必须在00:00到23:59之间', 'warning');
        return false;
    }
    
    const startTotalMinutes = startParts[0] * 60 + startParts[1];
    const endTotalMinutes = endParts[0] * 60 + endParts[1];
    
    if (startTotalMinutes === endTotalMinutes) {
        showMessage(currentLanguage === 'ja' ? '開始時間と終了時間を同じにできません' : '开始和结束时间不能相同', 'warning');
        return false;
    }
    
    let workMinutes;
    if (endTotalMinutes <= startTotalMinutes) {
        workMinutes = (24 * 60 - startTotalMinutes) + endTotalMinutes;
    } else {
        workMinutes = endTotalMinutes - startTotalMinutes;
    }
    
    if (workMinutes < 15) {
        showMessage(currentLanguage === 'ja' ? 'シフトは最低15分以上必要です' : '班次必须至少15分钟', 'warning');
        return false;
    }
    
    if (workMinutes > 24 * 60) {
        showMessage(currentLanguage === 'ja' ? 'シフトは24時間を超えることはできません' : '班次不能超过24小时', 'warning');
        return false;
    }
    
    return true;
}

function calculateShiftHours(startTime, endTime) {
    if (!startTime || !endTime) {
        return 0;
    }
    
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    
    if (startParts.length !== 2 || endParts.length !== 2 ||
        isNaN(startParts[0]) || isNaN(startParts[1]) ||
        isNaN(endParts[0]) || isNaN(endParts[1])) {
        return 0;
    }
    
    const startTotalMinutes = startParts[0] * 60 + startParts[1];
    const endTotalMinutes = endParts[0] * 60 + endParts[1];
    
    let workMinutes;
    if (endTotalMinutes <= startTotalMinutes) {
        workMinutes = (24 * 60 - startTotalMinutes) + endTotalMinutes;
    } else {
        workMinutes = endTotalMinutes - startTotalMinutes;
    }
    
    const workHours = workMinutes / 60;
    return Math.round(workHours * 100) / 100;
}

// ==================== VIEW MANAGEMENT ====================
function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });
    
    // Update nav button states
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected view
    const viewElement = document.getElementById(viewName + 'View');
    if (viewElement) {
        viewElement.classList.add('active');
    }
    
    // Activate corresponding nav button
    const navBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
    if (navBtn) navBtn.classList.add('active');
    
    // View-specific initialization
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
    
    // Save view to localStorage
    localStorage.setItem('lastView', viewName);
}

// ==================== EMPLOYEE MANAGEMENT ====================
function loadEmployees() {
    if (!window.database) {
        console.error("Database not initialized");
        return;
    }
    
    const employeesRef = window.database.ref('employees');
    
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
    }, (error) => {
        console.error("Error loading employees:", error);
        showMessage("Error loading employees", "error");
    });
}

function renderEmployeeCards() {
    const container = document.getElementById('employeeCards');
    if (!container) return;
    
    const searchInput = document.getElementById('employeeSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    let filteredEmployees = employees;
    
    if (searchTerm) {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm)
        );
    }
    
    if (currentPositionFilter !== 'all') {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.position === currentPositionFilter
        );
    }
    
    if (filteredEmployees.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>${searchTerm || currentPositionFilter !== 'all' ? 
                    (currentLanguage === 'ja' ? '該当するスタッフがありません' : '没有找到员工') : 
                    (currentLanguage === 'ja' ? 'スタッフがまだ登録されていません' : '还没有员工')}</p>
                <small>${currentLanguage === 'ja' ? '+ボタンをクリックしてスタッフを追加' : '点击+按钮添加员工'}</small>
            </div>
        `;
        return;
    }
    
    const frontDeskEmployees = filteredEmployees.filter(emp => emp.position === '前台/服务区');
    const kitchenEmployees = filteredEmployees.filter(emp => emp.position === '厨房区');
    
    let html = '';
    
    if (frontDeskEmployees.length > 0) {
        const title = currentLanguage === 'ja' ? 'フロント/サービス' : '前台/服务';
        html += `
            <div class="position-group">
                <h3 class="position-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--info);">
                    <i class="fas fa-door-open"></i> ${title}
                    <span class="position-count" style="font-size: 12px; background: var(--info-light); color: var(--info); padding: 2px 8px; border-radius: 12px;">${frontDeskEmployees.length}</span>
                </h3>
                <div class="position-cards">
                    ${frontDeskEmployees.map(emp => generateEmployeeCard(emp)).join('')}
                </div>
            </div>
        `;
    }
    
    if (kitchenEmployees.length > 0) {
        const title = currentLanguage === 'ja' ? '厨房' : '厨房';
        html += `
            <div class="position-group">
                <h3 class="position-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--warning);">
                    <i class="fas fa-utensils"></i> ${title}
                    <span class="position-count" style="font-size: 12px; background: var(--warning-light); color: var(--warning); padding: 2px 8px; border-radius: 12px;">${kitchenEmployees.length}</span>
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
    
    const positionDisplay = currentLanguage === 'ja' 
        ? (employee.position === '厨房区' ? '厨房' : 'フロント')
        : (employee.position === '厨房区' ? '厨房' : '前台');
    
    return `
        <div class="employee-card" onclick="showEmployeeDetail('${employee.id}')">
            <div class="employee-avatar">
                ${employee.name.charAt(0)}
            </div>
            <div class="employee-info">
                <div class="employee-name">${employee.name}</div>
                <div class="employee-position ${employee.position === '厨房区' ? 'kitchen' : 'front-desk'}">
                    <i class="fas ${employee.position === '厨房区' ? 'fa-utensils' : 'fa-door-open'}"></i>
                    ${positionDisplay}
                </div>
                <div class="employee-stats">
                    <div class="stat-item">
                        <i class="fas fa-clock" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">
                            ${currentLanguage === 'ja' ? '今週:' : '本周:'}
                        </span>
                        <span class="stat-value">${weeklyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">
                            ${currentLanguage === 'ja' ? '今月:' : '本月:'}
                        </span>
                        <span class="stat-value">${monthlyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-check" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">
                            ${weekSchedule.workDays} ${currentLanguage === 'ja' ? '勤務' : '班'}
                        </span>
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
    
    const filterBtn = position === 'all' 
        ? document.querySelector('.filter-btn') 
        : document.querySelector(`.filter-btn[onclick*="${position}"]`);
    
    if (filterBtn) {
        filterBtn.classList.add('active');
    }
    
    renderEmployeeCards();
}

function showEmployeeDetail(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    selectedEmployee = employeeId;
    
    const modalEmployeeName = document.getElementById('modalEmployeeName');
    const modalEmployeePosition = document.getElementById('modalEmployeePosition');
    const modalWeekHours = document.getElementById('modalWeekHours');
    const modalMonthHours = document.getElementById('modalMonthHours');
    
    if (modalEmployeeName) modalEmployeeName.textContent = employee.name;
    if (modalEmployeePosition) {
        modalEmployeePosition.textContent = currentLanguage === 'ja' 
            ? (employee.position === '厨房区' ? '厨房' : 'フロント')
            : (employee.position === '厨房区' ? '厨房' : '前台');
    }
    
    const weeklyHours = calculateWeeklyHours(employeeId);
    const monthlyHours = calculateMonthlyHours(employeeId);
    
    if (modalWeekHours) modalWeekHours.textContent = `${weeklyHours} ${currentLanguage === 'ja' ? '時間' : '小时'}`;
    if (modalMonthHours) modalMonthHours.textContent = `${monthlyHours} ${currentLanguage === 'ja' ? '時間' : '小时'}`;
    
    showEmployeeWeekSchedule(employeeId);
    
    openModal('employeeModal');
}

function showEmployeeWeekSchedule(employeeId) {
    const container = document.getElementById('employeeWeekDays');
    if (!container) return;
    
    const { startDate } = getWeekDates(0);
    const weekSchedule = getEmployeeSchedulesForWeek(employeeId, startDate, 
        new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000));
    
    const days = generateWeekDays(startDate);
    
    const dayNames = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
    container.innerHTML = days.map((day, index) => {
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
                <div style="font-weight: 600; color: var(--gray-700);">${dayNames[index]}</div>
                <div style="font-size: 11px; color: var(--gray-500);">${day.date}</div>
                ${timeText}
            </div>
        `;
    }).join('');
}

function showAddEmployee() {
    const nameInput = document.getElementById('newEmployeeName');
    if (nameInput) {
        nameInput.value = '';
    }
    
    selectedPosition = '前台/服务区';
    document.querySelectorAll('.position-option').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const frontDeskBtn = document.querySelector('.position-option[data-position="前台/服务区"]');
    if (frontDeskBtn) {
        frontDeskBtn.classList.add('active');
    }
    
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
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!name) {
        showMessage(currentLanguage === 'ja' ? '名前を入力してください' : '请输入员工姓名', 'warning');
        if (nameInput) nameInput.focus();
        return;
    }
    
    if (employees.some(e => e.name.toLowerCase() === name.toLowerCase())) {
        showMessage(currentLanguage === 'ja' ? `"${name}" は既に存在します` : `"${name}" 已存在`, 'warning');
        if (nameInput) nameInput.focus();
        return;
    }
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    window.database.ref('employees').push({
        name: name,
        position: selectedPosition,
        createdAt: Date.now()
    })
    .then(() => {
        closeModal('addEmployeeModal');
        showMessage(currentLanguage === 'ja' ? `スタッフ ${name} を追加しました` : `员工 ${name} 添加成功`, 'success');
        if (nameInput) nameInput.value = '';
    })
    .catch(error => {
        showMessage(currentLanguage === 'ja' ? '追加失敗: ' : '添加失败: ' + error.message, 'error');
    });
}

function deleteCurrentEmployee() {
    if (!selectedEmployee) return;
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    const confirmMessage = currentLanguage === 'ja' 
        ? `スタッフ "${employee.name}" を削除しますか？\nこのスタッフのすべてのスケジュールも削除されます！`
        : `确定要删除员工 "${employee.name}" 吗？\n该员工的所有排班记录也将被删除！`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    window.database.ref(`employees/${selectedEmployee}`).remove()
    .then(() => {
        const schedulesRef = window.database.ref('schedules');
        schedulesRef.once('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                Object.keys(data).forEach(scheduleId => {
                    if (data[scheduleId].employeeId === selectedEmployee) {
                        window.database.ref(`schedules/${scheduleId}`).remove();
                    }
                });
            }
        });
        
        closeModal('employeeModal');
        showMessage(currentLanguage === 'ja' ? `スタッフ ${employee.name} を削除しました` : `员工 ${employee.name} 删除成功`, 'success');
        selectedEmployee = null;
    })
    .catch(error => {
        showMessage(currentLanguage === 'ja' ? '削除失敗: ' : '删除失败: ' + error.message, 'error');
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
    
    select.innerHTML = `<option value="">${currentLanguage === 'ja' ? 'スタッフを選択' : '选择员工'}</option>`;
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
        const position = currentLanguage === 'ja' 
            ? (emp.position === '厨房区' ? '厨房' : 'フロント')
            : (emp.position === '厨房区' ? '厨房' : '前台');
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${position})`;
        select.appendChild(option);
    });
}

function updateQuickWeekEmployeeSelect() {
    const select = document.getElementById('quickWeekEmployee');
    if (!select) return;
    
    select.innerHTML = `<option value="">${currentLanguage === 'ja' ? 'スタッフを選択' : '选择员工'}</option>`;
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
        const position = currentLanguage === 'ja' 
            ? (emp.position === '厨房区' ? '厨房' : 'フロント')
            : (emp.position === '厨房区' ? '厨房' : '前台');
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${position})`;
        select.appendChild(option);
    });
}

function updateRestDaysEmployeeSelect() {
    const select = document.getElementById('restDaysEmployee');
    if (!select) return;
    
    select.innerHTML = `<option value="">${currentLanguage === 'ja' ? 'スタッフを選択' : '选择员工'}</option>`;
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
        const position = currentLanguage === 'ja' 
            ? (emp.position === '厨房区' ? '厨房' : 'フロント')
            : (emp.position === '厨房区' ? '厨房' : '前台');
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${position})`;
        select.appendChild(option);
    });
}

// ==================== SCHEDULE MANAGEMENT ====================
function loadSchedules() {
    if (!window.database) {
        console.error("Database not initialized");
        return;
    }
    
    const schedulesRef = window.database.ref('schedules');
    
    schedulesRef.on('value', (snapshot) => {
        schedules = snapshot.val() || {};
        renderWeeklySchedule();
        renderEmployeeCards();
    }, (error) => {
        console.error("Error loading schedules:", error);
        showMessage("Error loading schedules", "error");
    });
}

function selectScheduleType(type) {
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const typeBtn = document.querySelector(`.type-btn[data-type="${type}"]`);
    if (typeBtn) {
        typeBtn.classList.add('active');
    }
}

function setTimePreset(start, end) {
    const startInput = document.getElementById('scheduleStart');
    const endInput = document.getElementById('scheduleEnd');
    
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    
    const hours = calculateShiftHours(start, end);
    const message = currentLanguage === 'ja' 
        ? `時間設定: ${start} - ${end} (${hours}時間)`
        : `时间设置: ${start} - ${end} (${hours}小时)`;
    showMessage(message, 'info');
}

function setQuickTimePreset(start, end) {
    const startInput = document.getElementById('quickWeekStart');
    const endInput = document.getElementById('quickWeekEnd');
    
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    
    const hours = calculateShiftHours(start, end);
    const message = currentLanguage === 'ja' 
        ? `時間設定: ${start} - ${end} (${hours}時間)`
        : `时间设置: ${start} - ${end} (${hours}小时)`;
    showMessage(message, 'info');
}

function addSchedule() {
    const employeeId = document.getElementById('scheduleEmployee')?.value;
    const date = document.getElementById('scheduleDate')?.value;
    const startTime = document.getElementById('scheduleStart')?.value;
    const endTime = document.getElementById('scheduleEnd')?.value;
    const typeBtn = document.querySelector('.type-btn.active');
    const type = typeBtn ? typeBtn.dataset.type : 'work';
    
    if (!employeeId) {
        showMessage(currentLanguage === 'ja' ? 'スタッフを選択してください' : '请选择员工', 'warning');
        return;
    }
    
    if (!date) {
        showMessage(currentLanguage === 'ja' ? '日付を選択してください' : '请选择日期', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) {
        showMessage(currentLanguage === 'ja' ? 'スタッフが見つかりません' : '员工未找到', 'error');
        return;
    }
    
    if (type === 'work') {
        if (!startTime || !endTime) {
            showMessage(currentLanguage === 'ja' ? '勤務時間を入力してください' : '请输入工作时间', 'warning');
            return;
        }
        
        if (!validateTimeRange(startTime, endTime)) {
            return;
        }
    }
    
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
        scheduleData.notes = currentLanguage === 'ja' ? '休み' : '休息';
    }
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    if (existingSchedule) {
        const scheduleId = existingSchedule.id;
        window.database.ref(`schedules/${scheduleId}`).update(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage(currentLanguage === 'ja' ? 'スケジュールを更新しました' : '排班更新成功', 'success');
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage(currentLanguage === 'ja' ? '更新失敗: ' : '更新失败: ' + error.message, 'error');
        });
    } else {
        scheduleData.createdAt = Date.now();
        
        window.database.ref('schedules').push().set(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage(currentLanguage === 'ja' ? 'スケジュールを追加しました' : '排班添加成功', 'success');
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage(currentLanguage === 'ja' ? '追加失敗: ' : '添加失败: ' + error.message, 'error');
        });
    }
}

function resetScheduleForm() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('scheduleDate');
    const startInput = document.getElementById('scheduleStart');
    const endInput = document.getElementById('scheduleEnd');
    
    if (dateInput) dateInput.value = today;
    if (startInput) startInput.value = '08:00';
    if (endInput) endInput.value = '17:00';
    
    selectScheduleType('work');
}

function findScheduleByEmployeeAndDate(employeeId, date) {
    if (!schedules || typeof schedules !== 'object') return null;
    
    const scheduleEntry = Object.entries(schedules).find(([id, schedule]) => 
        schedule && schedule.employeeId === employeeId && schedule.date === date
    );
    
    if (scheduleEntry) {
        return { id: scheduleEntry[0], ...scheduleEntry[1] };
    }
    return null;
}

// ==================== WEEKDAY SELECTOR ====================
function initWeekdaysSelector() {
    const today = new Date();
    const currentDay = today.getDay();
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    const weekdays = [
        { id: 1, label: '月', default: true },
        { id: 2, label: '火', default: true },
        { id: 3, label: '水', default: true },
        { id: 4, label: '木', default: true },
        { id: 5, label: '金', default: true },
        { id: 6, label: '土', default: false },
        { id: 0, label: '日', default: false }
    ];
    
    const container = document.getElementById('weekdaysSelector');
    if (!container) return;
    
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
    const buttons = document.querySelectorAll('#weekdaysSelector .weekday-btn');
    if (buttons.length === 0) return;
    
    buttons.forEach(btn => {
        btn.classList.add('active');
        btn.classList.remove('rest');
    });
}

function clearWeekdays() {
    const buttons = document.querySelectorAll('#weekdaysSelector .weekday-btn');
    if (buttons.length === 0) return;
    
    buttons.forEach(btn => {
        btn.classList.remove('active', 'rest');
    });
}

// ==================== QUICK WEEK SCHEDULE ====================
function showQuickWeekModal() {
    const startInput = document.getElementById('quickWeekStart');
    const endInput = document.getElementById('quickWeekEnd');
    
    if (startInput) startInput.value = '08:00';
    if (endInput) endInput.value = '17:00';
    
    updateWeekdaysSelector();
    updateQuickWeekEmployeeSelect();
    openModal('quickWeekModal');
}

function updateWeekdaysSelector() {
    const today = new Date();
    const currentDay = today.getDay();
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    const weekdays = [
        { id: 1, label: '月', default: true },
        { id: 2, label: '火', default: true },
        { id: 3, label: '水', default: true },
        { id: 4, label: '木', default: true },
        { id: 5, label: '金', default: true },
        { id: 6, label: '土', default: false },
        { id: 0, label: '日', default: false }
    ];
    
    const container = document.getElementById('weekdaysSelector');
    if (!container) return;
    
    const dayNames = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
    let html = '';
    weekdays.forEach((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        
        const dateString = date.toISOString().split('T')[0];
        const hasSchedule = checkExistingSchedule(dateString);
        
        html += `
            <button type="button" class="weekday-btn ${day.default ? 'active' : ''} ${hasSchedule === 'rest' ? 'rest' : ''}" 
                    data-day="${day.id}" data-date="${dateString}"
                    onclick="toggleWeekday(this)">
                <div style="font-weight: 600; font-size: 14px; color: ${hasSchedule === 'rest' ? 'var(--warning)' : 'var(--gray-700)'};">${dayNames[index]}</div>
                <div style="font-size: 12px; color: var(--gray-500); margin-top: 4px;">${month}/${dayNum}</div>
                ${hasSchedule ? `
                    <div style="font-size: 10px; margin-top: 2px; color: ${hasSchedule === 'rest' ? 'var(--warning)' : 'var(--success)'}; font-weight: 500;">
                        ${hasSchedule === 'rest' ? (currentLanguage === 'ja' ? '休' : '休') : (currentLanguage === 'ja' ? '予定' : '已排')}
                    </div>
                ` : ''}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function checkExistingSchedule(dateString) {
    if (!schedules || typeof schedules !== 'object') return '';
    
    const schedulesForDate = Object.values(schedules).filter(s => s && s.date === dateString);
    if (schedulesForDate.length > 0) {
        const employeeId = document.getElementById('quickWeekEmployee')?.value;
        if (employeeId) {
            const employeeSchedule = schedulesForDate.find(s => s.employeeId === employeeId);
            if (employeeSchedule) {
                return employeeSchedule.isDayOff ? 'rest' : 'work';
            }
        }
        return 'work';
    }
    return '';
}

function applyQuickWeekSchedule() {
    const employeeId = document.getElementById('quickWeekEmployee')?.value;
    const startTime = document.getElementById('quickWeekStart')?.value;
    const endTime = document.getElementById('quickWeekEnd')?.value;
    
    if (!employeeId) {
        showMessage(currentLanguage === 'ja' ? 'スタッフを選択してください' : '请选择员工', 'warning');
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
        showMessage(currentLanguage === 'ja' ? '少なくとも1つの勤務日を選択してください' : '请至少选择一个工作日', 'warning');
        return;
    }
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    const promises = [];
    
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
                showMessage(currentLanguage === 'ja' ? '勤務時間を入力してください' : '请输入工作时间', 'warning');
                return;
            }
            
            if (!validateTimeRange(startTime, endTime)) {
                return;
            }
            
            scheduleData.startTime = startTime;
            scheduleData.endTime = endTime;
        } else {
            scheduleData.startTime = '00:00';
            scheduleData.endTime = '00:00';
            scheduleData.notes = currentLanguage === 'ja' ? '休み' : '休息';
        }
        
        const existingSchedule = findScheduleByEmployeeAndDate(employeeId, dateString);
        
        if (existingSchedule) {
            promises.push(
                window.database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
            );
        } else {
            scheduleData.createdAt = Date.now();
            promises.push(
                window.database.ref('schedules').push().set(scheduleData)
            );
        }
    });
    
    Promise.all(promises)
    .then(() => {
        closeModal('quickWeekModal');
        const workDays = selectedDays.length - restDays.length;
        const message = currentLanguage === 'ja' 
            ? `${workDays}勤務日、${restDays.length}休日を設定しました`
            : `设置${workDays}个工作日，${restDays.length}个休息日`;
        showMessage(message, 'success');
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage(currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ' + error.message, 'error');
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
    
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    const weekdays = [
        { id: 1, label: 'Mon', default: false },
        { id: 2, label: 'Tue', default: false },
        { id: 3, label: 'Wed', default: false },
        { id: 4, label: 'Thu', default: false },
        { id: 5, label: 'Fri', default: false },
        { id: 6, label: 'Sat', default: false },
        { id: 0, label: 'Sun', default: false }
    ];
    
    const container = document.getElementById('restDaysSelector');
    if (!container) return;
    
    const dayNames = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
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
                <div style="font-weight: 600; font-size: 14px; color: var(--gray-700);">${dayNames[index]}</div>
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

function clearRestDays() {
    document.querySelectorAll('#restDaysSelector .weekday-btn').forEach(btn => {
        btn.classList.remove('active', 'rest');
    });
}

function applyRestDays() {
    const employeeId = document.getElementById('restDaysEmployee')?.value;
    
    if (!employeeId) {
        showMessage(currentLanguage === 'ja' ? 'スタッフを選択してください' : '请选择员工', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const selectedDates = [];
    
    document.querySelectorAll('#restDaysSelector .weekday-btn.active').forEach(btn => {
        selectedDates.push(btn.dataset.date);
    });
    
    if (selectedDates.length === 0) {
        showMessage(currentLanguage === 'ja' ? '少なくとも1つの休日を選択してください' : '请至少选择一个休息日', 'warning');
        return;
    }
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    const promises = [];
    
    selectedDates.forEach(dateString => {
        const scheduleData = {
            employeeId: employeeId,
            employeeName: employee.name,
            employeePosition: employee.position,
            date: dateString,
            isDayOff: true,
            startTime: '00:00',
            endTime: '00:00',
            notes: currentLanguage === 'ja' ? '休み' : '休息',
            updatedAt: Date.now()
        };
        
        const existingSchedule = findScheduleByEmployeeAndDate(employeeId, dateString);
        
        if (existingSchedule) {
            promises.push(
                window.database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
            );
        } else {
            scheduleData.createdAt = Date.now();
            promises.push(
                window.database.ref('schedules').push().set(scheduleData)
            );
        }
    });
    
    Promise.all(promises)
    .then(() => {
        closeModal('setRestDaysModal');
        const message = currentLanguage === 'ja' 
            ? `${selectedDates.length}休日を設定しました`
            : `设置${selectedDates.length}个休息日`;
        showMessage(message, 'success');
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage(currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ' + error.message, 'error');
    });
}

// ==================== WEEKLY VIEW ====================
function renderWeeklySchedule() {
    const container = document.getElementById('weeklySchedule');
    if (!container) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    const days = generateWeekDays(startDate);
    
    const schedulesByEmployee = {};
    weekSchedule.forEach(schedule => {
        if (schedule && schedule.employeeId) {
            if (!schedulesByEmployee[schedule.employeeId]) {
                schedulesByEmployee[schedule.employeeId] = {};
            }
            schedulesByEmployee[schedule.employeeId][schedule.date] = schedule;
        }
    });
    
    const dayNames = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
    let html = `
        <div class="week-header">
            <div class="week-header-cell">${currentLanguage === 'ja' ? 'スタッフ' : '员工'}</div>
            ${days.map((day, index) => {
                const date = new Date(day.dateString);
                const month = date.getMonth() + 1;
                const dayNum = date.getDate();
                return `
                    <div class="week-header-cell">
                        <div style="font-weight: 700; color: var(--dark); font-size: 0.7rem;">${dayNames[index]}</div>
                        <div style="font-size: 0.65rem; color: var(--gray-500); margin-top: 2px;">${month}/${dayNum}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id] || {};
        const weeklyHours = calculateWeeklyHours(employee.id);
        
        const positionDisplay = currentLanguage === 'ja' 
            ? (employee.position === '厨房区' ? '厨房' : 'フロント')
            : (employee.position === '厨房区' ? '厨房' : '前台');
        
        html += `
            <div class="week-row">
                <div class="week-cell">
                    <div style="font-weight: 700; font-size: 0.8rem; color: var(--dark); margin-bottom: 2px;">${employee.name}</div>
                    <div style="font-size: 0.7rem; color: var(--gray-500); margin-bottom: 4px;">${positionDisplay}</div>
                    <div style="font-size: 0.65rem; color: var(--primary); font-weight: 600;">
                        <i class="fas fa-clock" style="font-size: 0.6rem; margin-right: 2px;"></i>
                        ${weeklyHours}h
                    </div>
                </div>
                ${days.map(day => {
                    const schedule = employeeSchedules[day.dateString];
                    let scheduleClass = 'empty';
                    let scheduleText = '';
                    
                    if (schedule) {
                        if (schedule.isDayOff) {
                            scheduleClass = 'rest';
                            scheduleText = currentLanguage === 'ja' ? '休' : '休';
                        } else {
                            scheduleClass = 'work';
                            scheduleText = `
                                <div class="compact-time">
                                    <span>${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}</span>
                                    <span>${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}</span>
                                </div>
                            `;
                        }
                    }
                    
                    const title = schedule ? (schedule.isDayOff ? 
                        (currentLanguage === 'ja' ? '休み' : '休息') : 
                        `${schedule.startTime || ''}-${schedule.endTime || ''}`) : 
                        (currentLanguage === 'ja' ? 'クリックで追加' : '点击添加');
                    
                    return `
                        <div class="week-cell">
                            <div class="day-schedule-item ${scheduleClass}" 
                                 onclick="editDaySchedule('${employee.id}', '${day.dateString}')"
                                 title="${title}">
                                ${scheduleText || (currentLanguage === 'ja' ? '追加' : '加')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    });
    
    container.innerHTML = html || `<div class="empty-state"><p>${currentLanguage === 'ja' ? 'スケジュールデータがありません' : '没有排班数据'}</p></div>`;
    
    const weekRange = document.getElementById('weekRange');
    if (weekRange) {
        const startStr = formatDate(startDate);
        const endStr = formatDate(endDate);
        weekRange.textContent = `${startStr} - ${endStr}`;
    }
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
    if (!container) return;
    
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString(currentLanguage === 'ja' ? 'ja-JP' : 'zh-CN', { weekday: 'long' });
    
    container.innerHTML = `
        <div class="edit-schedule-form">
            <div class="form-group">
                <label>${currentLanguage === 'ja' ? 'スタッフ' : '员工'}</label>
                <div class="employee-display">
                    <div class="employee-avatar-small">${employee.name.charAt(0)}</div>
                    <div>
                        <div style="font-weight: 700; color: var(--dark);">${employee.name}</div>
                        <div style="font-size: 14px; color: var(--gray-500);">
                            ${currentLanguage === 'ja' ? 
                                (employee.position === '厨房区' ? '厨房' : 'フロント') : 
                                (employee.position === '厨房区' ? '厨房' : '前台')}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>${currentLanguage === 'ja' ? '日付' : '日期'}</label>
                <div class="date-display">
                    <div style="font-weight: 700; color: var(--dark);">${formatDate(date)}</div>
                    <div style="font-size: 14px; color: var(--gray-500);">${dayName}</div>
                </div>
            </div>
            
            <div class="form-group">
                <label>${currentLanguage === 'ja' ? '種類' : '类型'}</label>
                <div class="type-selector">
                    <button type="button" class="type-btn ${!schedule || !schedule.isDayOff ? 'active' : ''}" 
                            onclick="setEditScheduleType('work')">
                        <i class="fas fa-briefcase"></i>
                        <span>${currentLanguage === 'ja' ? '勤務' : '工作'}</span>
                    </button>
                    <button type="button" class="type-btn ${schedule && schedule.isDayOff ? 'active' : ''}"
                            onclick="setEditScheduleType('rest')">
                        <i class="fas fa-umbrella-beach"></i>
                        <span>${currentLanguage === 'ja' ? '休み' : '休息'}</span>
                    </button>
                </div>
            </div>
            
            <div class="time-group" id="editTimeGroup" style="display: ${!schedule || !schedule.isDayOff ? 'grid' : 'none'}">
                <div class="form-group">
                    <label>${currentLanguage === 'ja' ? '開始時間' : '开始时间'}</label>
                    <input type="time" id="editStartTime" class="input-field" 
                           value="${schedule && !schedule.isDayOff && schedule.startTime ? schedule.startTime : '08:00'}">
                </div>
                <div class="form-group">
                    <label>${currentLanguage === 'ja' ? '終了時間' : '结束时间'}</label>
                    <input type="time" id="editEndTime" class="input-field" 
                           value="${schedule && !schedule.isDayOff && schedule.endTime ? schedule.endTime : '17:00'}">
                </div>
            </div>
            
            <div class="action-buttons">
                <button type="button" class="btn-primary" onclick="saveDaySchedule('${employeeId}', '${date}')">
                    <i class="fas fa-save"></i> ${currentLanguage === 'ja' ? '保存' : '保存'}
                </button>
                ${schedule ? `
                    <button type="button" class="btn-danger" onclick="deleteDaySchedule('${employeeId}', '${date}')">
                        <i class="fas fa-trash"></i> ${currentLanguage === 'ja' ? '削除' : '删除'}
                    </button>
                ` : ''}
                <button type="button" class="btn-secondary" onclick="closeModal('editModal')">
                    ${currentLanguage === 'ja' ? 'キャンセル' : '取消'}
                </button>
            </div>
        </div>
    `;
    
    openModal('editModal');
}

function editEmployeeSchedule() {
    if (!selectedEmployee) return;
    
    switchView('weekly');
    closeModal('employeeModal');
    
    setTimeout(() => {
        const employee = employees.find(e => e.id === selectedEmployee);
        if (!employee) return;
        
        const employeeRows = document.querySelectorAll('.week-row');
        employeeRows.forEach(row => {
            const nameCell = row.querySelector('.week-cell:first-child');
            if (nameCell && nameCell.textContent.includes(employee.name)) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    
    if (!workBtn || !restBtn) return;
    
    if (type === 'work') {
        workBtn.classList.add('active');
        restBtn.classList.remove('active');
        if (timeGroup) timeGroup.style.display = 'grid';
    } else {
        restBtn.classList.add('active');
        workBtn.classList.remove('active');
        if (timeGroup) timeGroup.style.display = 'none';
    }
}

function saveDaySchedule(employeeId, date) {
    const typeBtn = document.querySelector('.type-btn.active');
    const type = typeBtn ? typeBtn.dataset.type : 'work';
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
        const startTime = document.getElementById('editStartTime')?.value;
        const endTime = document.getElementById('editEndTime')?.value;
        
        if (!startTime || !endTime) {
            showMessage(currentLanguage === 'ja' ? '勤務時間を入力してください' : '请输入工作时间', 'warning');
            return;
        }
        
        if (!validateTimeRange(startTime, endTime)) {
            return;
        }
        
        scheduleData.startTime = startTime;
        scheduleData.endTime = endTime;
    } else {
        scheduleData.startTime = '00:00';
        scheduleData.endTime = '00:00';
        scheduleData.notes = currentLanguage === 'ja' ? '休み' : '休息';
    }
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    const existingSchedule = findScheduleByEmployeeAndDate(employeeId, date);
    
    if (existingSchedule) {
        window.database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage(currentLanguage === 'ja' ? 'スケジュールを更新しました' : '排班更新成功', 'success');
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage(currentLanguage === 'ja' ? '更新失敗: ' : '更新失败: ' + error.message, 'error');
        });
    } else {
        scheduleData.createdAt = Date.now();
        
        window.database.ref('schedules').push().set(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage(currentLanguage === 'ja' ? 'スケジュールを追加しました' : '排班添加成功', 'success');
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage(currentLanguage === 'ja' ? '追加失敗: ' : '添加失败: ' + error.message, 'error');
        });
    }
}

function deleteDaySchedule(employeeId, date) {
    const confirmMessage = currentLanguage === 'ja' 
        ? 'このスケジュールを削除しますか？'
        : '确定要删除这个排班吗？';
    
    if (!confirm(confirmMessage)) return;
    
    const schedule = findScheduleByEmployeeAndDate(employeeId, date);
    if (!schedule) return;
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    window.database.ref(`schedules/${schedule.id}`).remove()
    .then(() => {
        closeModal('editModal');
        showMessage(currentLanguage === 'ja' ? 'スケジュールを削除しました' : '排班删除成功', 'success');
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage(currentLanguage === 'ja' ? '削除失敗: ' : '删除失败: ' + error.message, 'error');
    });
}

// ==================== UTILITY FUNCTIONS ====================
function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    
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
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    
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
    
    if (!schedules || typeof schedules !== 'object') return weekSchedules;
    
    Object.values(schedules).forEach(schedule => {
        if (schedule && schedule.date >= startStr && schedule.date <= endStr) {
            weekSchedules.push(schedule);
        }
    });
    
    return weekSchedules;
}

function getEmployeeSchedulesForWeek(employeeId, startDate, endDate) {
    const employeeSchedules = [];
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];
    
    if (!schedules || typeof schedules !== 'object') return employeeSchedules;
    
    Object.values(schedules).forEach(schedule => {
        if (schedule && schedule.employeeId === employeeId && 
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
    
    return Math.round(totalHours * 10) / 10;
}

function calculateMonthlyHours(employeeId) {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    const firstStr = firstDay.toISOString().split('T')[0];
    const lastStr = lastDay.toISOString().split('T')[0];
    
    let totalHours = 0;
    
    if (!schedules || typeof schedules !== 'object') return totalHours;
    
    Object.values(schedules).forEach(schedule => {
        if (schedule && schedule.employeeId === employeeId && 
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
    return `${month}/${day}`;
}

function refreshData() {
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    window.database.ref('.info/connected').once('value').then(snap => {
        if (snap.val() === true) {
            showMessage(currentLanguage === 'ja' ? 'データ同期完了' : '数据同步完成', 'success');
            loadEmployees();
            loadSchedules();
        } else {
            showMessage(currentLanguage === 'ja' ? 'サーバーに接続できません' : '无法连接服务器', 'error');
        }
    }).catch(error => {
        showMessage(currentLanguage === 'ja' ? '更新エラー: ' : '刷新错误: ' + error.message, 'error');
    });
}

// ==================== COPY TEXT FUNCTION ====================
function copyScheduleAsText() {
    if (!selectedEmployee) {
        showMessage(currentLanguage === 'ja' ? 'スタッフを選択してください' : '请先选择员工', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(selectedEmployee, startDate, endDate);
    const weeklyHours = calculateWeeklyHours(selectedEmployee);
    const monthlyHours = calculateMonthlyHours(selectedEmployee);
    const days = generateWeekDays(startDate);
    
    // Generate formatted text
    let text = `【${employee.name} ${currentLanguage === 'ja' ? 'スケジュール' : '排班表'}】\n`;
    text += `${currentLanguage === 'ja' ? '職種:' : '职位:'} ${currentLanguage === 'ja' ? 
        (employee.position === '厨房区' ? '厨房' : 'フロント') : 
        (employee.position === '厨房区' ? '厨房' : '前台')}\n`;
    text += `${currentLanguage === 'ja' ? '日付:' : '日期:'} ${formatDate(startDate)} ${currentLanguage === 'ja' ? '〜' : '至'} ${formatDate(endDate)}\n`;
    text += `${currentLanguage === 'ja' ? '今週:' : '本周:'} ${weeklyHours}${currentLanguage === 'ja' ? '時間' : '小时'} | ${currentLanguage === 'ja' ? '今月:' : '本月:'} ${monthlyHours}${currentLanguage === 'ja' ? '時間' : '小时'}\n\n`;
    text += `📅 ${currentLanguage === 'ja' ? '今週のスケジュール:' : '本周排班:'}\n`;
    
    // Day names for display
    const dayNames = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
    days.forEach((day, index) => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        const scheduleText = schedule ? 
            (schedule.isDayOff ? '🏖️ ' + (currentLanguage === 'ja' ? '休み' : '休息') : `🕐 ${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}-${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}`) : 
            '📭 ' + (currentLanguage === 'ja' ? 'なし' : '无');
        
        text += `${dayNames[index]} (${day.date}): ${scheduleText}\n`;
    });
    
    text += `\n📍 ${currentLanguage === 'ja' ? '勤務エリア:' : '工作区域:'} ${employee.position === '厨房区' ? 
        (currentLanguage === 'ja' ? '厨房 👨‍🍳' : '厨房 👨‍🍳') : 
        (currentLanguage === 'ja' ? 'フロント/サービス 💁' : '前台/服务 💁')}\n`;
    text += `📊 ${currentLanguage === 'ja' ? '今週:' : '本周:'} ${weekSchedule.filter(s => !s.isDayOff).length}${currentLanguage === 'ja' ? '勤務日' : '工作日'}, ${weekSchedule.filter(s => s.isDayOff).length}${currentLanguage === 'ja' ? '休日' : '休息日'}\n`;
    text += `\n⏰ ${currentLanguage === 'ja' ? '生成日時:' : '生成时间:'} ${new Date().toLocaleString(currentLanguage === 'ja' ? 'ja-JP' : 'zh-CN', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(text)
        .then(() => {
            showMessage(currentLanguage === 'ja' ? 'クリップボードにコピーしました' : '已复制到剪贴板', 'success');
            closeModal('employeeModal');
        })
        .catch(err => {
            console.error('Copy failed:', err);
            
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showMessage(currentLanguage === 'ja' ? 'クリップボードにコピーしました' : '已复制到剪贴板', 'success');
            } catch (err) {
                showMessage(currentLanguage === 'ja' ? 'コピーに失敗しました' : '复制失败', 'error');
            }
            document.body.removeChild(textarea);
            
            closeModal('employeeModal');
        });
}

// ==================== PRINT FUNCTION ====================
function printEmployeeSchedule() {
    if (!selectedEmployee) {
        showMessage(currentLanguage === 'ja' ? 'スタッフを選択してください' : '请先选择员工', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(selectedEmployee, startDate, endDate);
    const weeklyHours = calculateWeeklyHours(selectedEmployee);
    const monthlyHours = calculateMonthlyHours(selectedEmployee);
    const days = generateWeekDays(startDate);
    
    // Create print content with optimized layout for mobile
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${employee.name} ${currentLanguage === 'ja' ? 'スケジュール' : '排班表'}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: 'Microsoft YaHei', 'Meiryo', sans-serif; 
                    margin: 0; 
                    padding: 15px; 
                    background: white;
                    color: #333;
                    font-size: 12px;
                }
                .print-header {
                    text-align: center;
                    margin-bottom: 15px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #2563eb;
                }
                .company-name {
                    font-size: 18px;
                    color: #2563eb;
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .employee-name {
                    font-size: 16px;
                    font-weight: bold;
                    color: #333;
                    margin: 5px 0;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 8px 0;
                    padding: 4px 0;
                    border-bottom: 1px solid #eee;
                }
                .info-label {
                    color: #666;
                    font-weight: 500;
                }
                .info-value {
                    font-weight: bold;
                    color: #2563eb;
                }
                .schedule-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-size: 10px;
                }
                .schedule-table th {
                    background: #e6f0ff;
                    padding: 8px 3px;
                    text-align: center;
                    border: 1px solid #ddd;
                    font-weight: bold;
                }
                .schedule-table td {
                    padding: 6px 2px;
                    text-align: center;
                    border: 1px solid #ddd;
                    vertical-align: middle;
                    height: 50px;
                }
                .work-day {
                    background: #d1fae5;
                    color: #065f46;
                    font-size: 9px;
                    padding: 2px;
                }
                .rest-day {
                    background: #fef3c7;
                    color: #92400e;
                    font-size: 9px;
                    padding: 2px;
                }
                .empty-day {
                    background: #f8fafc;
                    color: #94a3b8;
                    font-size: 9px;
                    padding: 2px;
                }
                .time-display {
                    font-size: 8px;
                    line-height: 1.2;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    color: #666;
                    font-size: 10px;
                    border-top: 1px solid #eee;
                    padding-top: 10px;
                }
                @media print {
                    @page {
                        margin: 0.5cm;
                        size: auto;
                    }
                    body {
                        padding: 10px;
                    }
                    .schedule-table {
                        font-size: 9px;
                    }
                    .schedule-table td {
                        padding: 4px 1px;
                        height: 45px;
                    }
                }
                
                /* Mobile optimization */
                @media (max-width: 600px) {
                    .schedule-table {
                        font-size: 8px;
                    }
                    .schedule-table th,
                    .schedule-table td {
                        padding: 3px 1px;
                    }
                    .work-day, .rest-day, .empty-day {
                        font-size: 7px;
                    }
                }
            </style>
        </head>
        <body class="single-employee-print">
            <div class="print-header">
                <div class="company-name">鍛治町酒場 神田店</div>
                <div class="employee-name">${employee.name}</div>
                <div style="color: #666; font-size: 11px;">
                    ${currentLanguage === 'ja' ? '職種:' : '职位:'} ${currentLanguage === 'ja' ? 
                        (employee.position === '厨房区' ? '厨房' : 'フロント') : 
                        (employee.position === '厨房区' ? '厨房' : '前台')}
                </div>
                <div style="color: #666; font-size: 11px; margin-top: 5px;">
                    ${currentLanguage === 'ja' ? '期間:' : '期间:'} ${formatDate(startDate)} - ${formatDate(endDate)}
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-around; margin-bottom: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 14px; color: #2563eb; font-weight: bold;">${weeklyHours}</div>
                    <div style="font-size: 10px; color: #666;">${currentLanguage === 'ja' ? '今週時間' : '本周工时'}</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 14px; color: #2563eb; font-weight: bold;">${monthlyHours}</div>
                    <div style="font-size: 10px; color: #666;">${currentLanguage === 'ja' ? '今月時間' : '本月工时'}</div>
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th style="width: 12%;">${currentLanguage === 'ja' ? '曜日' : '星期'}</th>
                        <th style="width: 15%;">${currentLanguage === 'ja' ? '日付' : '日期'}</th>
                        <th style="width: 15%;">${currentLanguage === 'ja' ? '状態' : '状态'}</th>
                        <th style="width: 30%;">${currentLanguage === 'ja' ? '時間' : '时间'}</th>
                        <th style="width: 15%;">${currentLanguage === 'ja' ? '時間数' : '小时数'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${days.map(day => {
                        const schedule = weekSchedule.find(s => s.date === day.dateString);
                        let statusClass = 'empty-day';
                        let statusText = currentLanguage === 'ja' ? 'なし' : '无';
                        let timeDisplay = '';
                        let hours = '';
                        
                        if (schedule) {
                            if (schedule.isDayOff) {
                                statusClass = 'rest-day';
                                statusText = currentLanguage === 'ja' ? '休み' : '休息';
                            } else {
                                statusClass = 'work-day';
                                statusText = currentLanguage === 'ja' ? '勤務' : '工作';
                                timeDisplay = `${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}<br>${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}`;
                                hours = calculateShiftHours(schedule.startTime, schedule.endTime) + 'h';
                            }
                        }
                        
                        // Day names for display
                        const dayNames = currentLanguage === 'ja' 
                            ? ['月', '火', '水', '木', '金', '土', '日']
                            : ['一', '二', '三', '四', '五', '六', '日'];
                        
                        const dateParts = day.date.split('/');
                        const month = dateParts[0];
                        const dayNum = dateParts[1];
                        
                        return `
                            <tr>
                                <td>${dayNames[day.dayIndex]}</td>
                                <td>${month}/${dayNum}</td>
                                <td class="${statusClass}">${statusText}</td>
                                <td>${timeDisplay}</td>
                                <td>${hours}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <div class="footer">
                ${currentLanguage === 'ja' ? '印刷日:' : '打印日期:'} ${new Date().toLocaleDateString(currentLanguage === 'ja' ? 'ja-JP' : 'zh-CN')}
            </div>
        </body>
        </html>
    `;
    
    // Open print window
    try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Print after content loads
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => {
                    printWindow.close();
                }, 500);
            }, 500);
            
            showMessage(currentLanguage === 'ja' ? '印刷プレビューを開いています...' : '正在打开打印预览...', 'info');
            closeModal('employeeModal');
        }
    } catch (error) {
        console.error("Print error:", error);
        showMessage(currentLanguage === 'ja' ? "印刷エラー: " : "打印错误: " + error.message, "error");
    }
}

function printAllSchedule() {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    const days = generateWeekDays(startDate);
    
    // Create print content
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>${currentLanguage === 'ja' ? '週間勤務表' : '每周排班表'}</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body { 
                    font-family: 'Microsoft YaHei', 'Meiryo', sans-serif; 
                    margin: 10px; 
                    font-size: 10px; 
                    background: white;
                }
                .print-header { 
                    text-align: center; 
                    margin-bottom: 15px; 
                    padding-bottom: 10px; 
                    border-bottom: 2px solid #2563eb; 
                }
                .company-name { 
                    font-size: 16px; 
                    color: #2563eb; 
                    font-weight: bold; 
                    margin-bottom: 5px; 
                }
                .schedule-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 15px; 
                }
                .schedule-table th { 
                    background: #e6f0ff; 
                    padding: 6px 3px; 
                    text-align: center; 
                    border: 1px solid #ddd; 
                    font-weight: bold; 
                    font-size: 9px;
                }
                .schedule-table td { 
                    padding: 6px 3px; 
                    text-align: center; 
                    border: 1px solid #ddd; 
                    vertical-align: top; 
                    font-size: 8px;
                }
                .work-cell { 
                    background: #d1fae5; 
                    color: #065f46; 
                    font-size: 8px; 
                    padding: 2px;
                }
                .rest-cell { 
                    background: #fef3c7; 
                    color: #92400e; 
                    font-size: 8px; 
                    padding: 2px;
                }
                .empty-cell { 
                    background: #f8fafc; 
                    color: #94a3b8; 
                    font-size: 8px; 
                    padding: 2px;
                }
                .time-display { 
                    font-size: 7px; 
                    line-height: 1.1; 
                }
                .employee-name-cell {
                    text-align: left;
                    padding-left: 5px;
                    font-weight: bold;
                    font-size: 9px;
                }
                @media print { 
                    @page { 
                        margin: 0.3cm; 
                        size: landscape; 
                    } 
                    body {
                        padding: 5px;
                    }
                }
                
                /* Mobile optimization */
                @media (max-width: 600px) {
                    .schedule-table th,
                    .schedule-table td {
                        padding: 4px 2px;
                        font-size: 7px;
                    }
                    .work-cell, .rest-cell, .empty-cell {
                        font-size: 6px;
                    }
                    .time-display {
                        font-size: 6px;
                    }
                }
            </style>
        </head>
        <body>
            <div class="print-header">
                <div class="company-name">鍛治町酒場 神田店</div>
                <div style="color: #666; font-size: 11px;">
                    ${currentLanguage === 'ja' ? '期間:' : '期间:'} ${formatDate(startDate)} - ${formatDate(endDate)}
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th style="width: 100px; min-width: 80px;">${currentLanguage === 'ja' ? 'スタッフ' : '员工'}</th>
    `;
    
    // Day headers
    const dayNames = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
    days.forEach((day, index) => {
        const date = new Date(day.dateString);
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        printContent += `
            <th style="min-width: 50px;">
                <div style="font-weight: bold; font-size: 9px;">${dayNames[index]}</div>
                <div style="font-size: 8px; color: #666;">${month}/${dayNum}</div>
            </th>
        `;
    });
    
    printContent += `</tr></thead><tbody>`;
    
    // Schedule data
    const schedulesByEmployee = {};
    weekSchedule.forEach(schedule => {
        if (schedule && schedule.employeeId) {
            if (!schedulesByEmployee[schedule.employeeId]) {
                schedulesByEmployee[schedule.employeeId] = {};
            }
            schedulesByEmployee[schedule.employeeId][schedule.date] = schedule;
        }
    });
    
    // Employee rows
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id] || {};
        const weeklyHours = calculateWeeklyHours(employee.id);
        
        // Position display
        const positionDisplay = currentLanguage === 'ja' 
            ? (employee.position === '厨房区' ? '厨房' : 'フロント')
            : (employee.position === '厨房区' ? '厨房' : '前台');
        
        printContent += `
            <tr>
                <td class="employee-name-cell">
                    <div>${employee.name}</div>
                    <div style="font-size: 7px; color: #666;">${positionDisplay}</div>
                    <div style="font-size: 7px; color: #2563eb; font-weight: bold;">${weeklyHours}h</div>
                </td>
        `;
        
        // Day cells
        days.forEach(day => {
            const schedule = employeeSchedules[day.dateString];
            let cellClass = 'empty-cell';
            let cellContent = '<div style="font-size: 7px; color: #cbd5e1;">-</div>';
            
            if (schedule) {
                if (schedule.isDayOff) {
                    cellClass = 'rest-cell';
                    cellContent = `<div style="font-size: 8px; font-weight: bold;">${currentLanguage === 'ja' ? '休' : '休'}</div>`;
                } else {
                    cellClass = 'work-cell';
                    const hours = calculateShiftHours(schedule.startTime, schedule.endTime);
                    cellContent = `
                        <div class="time-display">
                            <div>${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}</div>
                            <div>${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}</div>
                            <div style="font-weight: bold;">${hours}h</div>
                        </div>
                    `;
                }
            }
            
            printContent += `<td class="${cellClass}">${cellContent}</td>`;
        });
        
        printContent += `</tr>`;
    });
    
    printContent += `</tbody></table>
            <div style="text-align: center; margin-top: 20px; color: #999; font-size: 9px;">
                ${currentLanguage === 'ja' ? '印刷日:' : '打印日期:'} ${new Date().toLocaleDateString(currentLanguage === 'ja' ? 'ja-JP' : 'zh-CN')}
            </div>
        </body>
        </html>`;
    
    // Create print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Print after content loads
        setTimeout(() => {
            printWindow.print();
            setTimeout(() => {
                printWindow.close();
            }, 500);
        }, 500);
    }
}

// ==================== SETUP EVENT LISTENERS ====================
function setupEventListeners() {
    // Language switch button
    const languageSwitchBtn = document.getElementById('languageSwitch');
    if (languageSwitchBtn) {
        languageSwitchBtn.addEventListener('click', function() {
            currentLanguage = currentLanguage === 'ja' ? 'zh' : 'ja';
            updateLanguage();
            localStorage.setItem('appLanguage', currentLanguage);
        });
    }
    
    // Close modal when clicking background
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            switch(event.key.toLowerCase()) {
                case 'e':
                    if (selectedEmployee) {
                        editEmployeeSchedule();
                        event.preventDefault();
                    }
                    break;
                case 'p':
                    // Ctrl+P for print
                    if (selectedEmployee) {
                        printEmployeeSchedule();
                        event.preventDefault();
                    }
                    break;
                case 'c':
                    // Ctrl+C for copy
                    if (selectedEmployee) {
                        copyScheduleAsText();
                        event.preventDefault();
                    }
                    break;
                case 's':
                    refreshData();
                    event.preventDefault();
                    break;
            }
        }
        
        // Escape key to close modal
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal[style*="display: flex"]');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
    
    // Fix for iOS date input
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.type = 'text';
            setTimeout(() => {
                this.type = 'date';
            }, 100);
        });
    });
    
    // Save state when leaving page
    window.addEventListener('beforeunload', function(e) {
        const activeView = document.querySelector('.view.active');
        if (activeView) {
            const lastView = activeView.id.replace('View', '');
            localStorage.setItem('lastView', lastView);
        }
        localStorage.setItem('appLanguage', currentLanguage);
    });
    
    // Restore saved view
    const savedView = localStorage.getItem('lastView');
    if (savedView) {
        setTimeout(() => switchView(savedView), 100);
    }
}

// ==================== QUICK ACTIONS ====================
function showTodaySchedule() {
    const today = new Date().toISOString().split('T')[0];
    const todaySchedules = Object.values(schedules).filter(s => s && s.date === today);
    
    const container = document.getElementById('todayList');
    if (!container) return;
    
    if (todaySchedules.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-day"></i>
                <p>${currentLanguage === 'ja' ? '今日のシフトはありません' : '今天没有排班'}</p>
                <small>${currentLanguage === 'ja' ? '「シフト登録」ページで追加' : '在"排班"页面添加'}</small>
            </div>
        `;
    } else {
        const frontDeskSchedules = todaySchedules.filter(s => s.employeePosition === '前台/服务区');
        const kitchenSchedules = todaySchedules.filter(s => s.employeePosition === '厨房区');
        
        let html = '';
        
        if (frontDeskSchedules.length > 0) {
            const title = currentLanguage === 'ja' ? 'フロント/サービス' : '前台/服务';
            html += `<h4 style="margin-bottom: 16px; color: #2563eb; font-weight: 700;"><i class="fas fa-door-open"></i> ${title}</h4>`;
            html += frontDeskSchedules.map(schedule => createTodayItem(schedule)).join('');
        }
        
        if (kitchenSchedules.length > 0) {
            const title = currentLanguage === 'ja' ? '厨房' : '厨房';
            html += `<h4 style="margin-top: 24px; margin-bottom: 16px; color: #f59e0b; font-weight: 700;"><i class="fas fa-utensils"></i> ${title}</h4>`;
            html += kitchenSchedules.map(schedule => createTodayItem(schedule)).join('');
        }
        
        container.innerHTML = html;
    }
    
    openModal('todayModal');
}

function createTodayItem(schedule) {
    const position = currentLanguage === 'ja' 
        ? (schedule.employeePosition === '厨房区' ? '厨房' : 'フロント')
        : (schedule.employeePosition === '厨房区' ? '厨房' : '前台');
    
    return `
        <div class="today-item ${schedule.isDayOff ? 'rest' : 'work'}">
            <div>
                <div style="font-weight: 700; color: var(--dark);">${schedule.employeeName}</div>
                <div style="font-size: 13px; color: var(--gray-500); font-weight: 500;">${position}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700; color: ${schedule.isDayOff ? 'var(--warning)' : 'var(--success)'};">
                    ${schedule.isDayOff ? 
                        (currentLanguage === 'ja' ? '休み' : '休息') : 
                        `${schedule.startTime ? schedule.startTime.substring(0, 5) : ''} - ${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}`}
                </div>
                ${!schedule.isDayOff ? `
                    <div style="font-size: 12px; color: var(--gray-500); font-weight: 500;">
                        ${currentLanguage === 'ja' ? '時間:' : '时间:'} ${calculateShiftHours(schedule.startTime, schedule.endTime)}h
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function showStats() {
    const container = document.getElementById('statsGrid');
    if (!container) return;
    
    // Tính toán thời gian làm việc cả tuần
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startStr = startOfWeek.toISOString().split('T')[0];
    const endStr = endOfWeek.toISOString().split('T')[0];
    
    // Tính tổng thời gian làm việc của tất cả nhân viên trong tuần
    let totalWeekHours = 0;
    employees.forEach(employee => {
        totalWeekHours += calculateWeeklyHours(employee.id);
    });
    
    const totalEmployees = employees.length;
    const totalSchedules = Object.keys(schedules).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayShifts = Object.values(schedules).filter(s => s && s.date === todayStr && !s.isDayOff).length;
    const monthHours = employees.reduce((sum, emp) => sum + calculateMonthlyHours(emp.id), 0);
    const frontDeskCount = employees.filter(e => e.position === '前台/服务区').length;
    const kitchenCount = employees.filter(e => e.position === '厨房区').length;
    const avgWeekHours = Math.round((totalWeekHours / (employees.length || 1)) * 10) / 10;
    
    container.innerHTML = `
        <div class="stat-card">
            <h4>${totalEmployees}</h4>
            <p>${currentLanguage === 'ja' ? 'スタッフ数' : '员工总数'}</p>
        </div>
        <div class="stat-card">
            <h4>${totalSchedules}</h4>
            <p>${currentLanguage === 'ja' ? '総スケジュール' : '总排班数'}</p>
        </div>
        <div class="stat-card">
            <h4>${todayShifts}</h4>
            <p>${currentLanguage === 'ja' ? '今日のシフト' : '今日班次'}</p>
        </div>
        <div class="stat-card">
            <h4>${totalWeekHours}h</h4>
            <p>${currentLanguage === 'ja' ? '今週の時間' : '本周工时'}</p>
        </div>
        <div class="stat-card">
            <h4>${monthHours}h</h4>
            <p>${currentLanguage === 'ja' ? '今月の時間' : '本月工时'}</p>
        </div>
        <div class="stat-card">
            <h4>${frontDeskCount}</h4>
            <p>${currentLanguage === 'ja' ? 'フロント' : '前台'}</p>
        </div>
        <div class="stat-card">
            <h4>${kitchenCount}</h4>
            <p>${currentLanguage === 'ja' ? '厨房' : '厨房'}</p>
        </div>
        <div class="stat-card">
            <h4>${avgWeekHours}h</h4>
            <p>${currentLanguage === 'ja' ? '平均週時間' : '平均周工时'}</p>
        </div>
    `;
    
    openModal('statsModal');
}

// ==================== ERROR HANDLING ====================
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('JavaScript Error:', msg, '\nURL:', url, '\nLine:', lineNo, '\nColumn:', columnNo, '\nError object:', error);
    showMessage(currentLanguage === 'ja' ? 'エラーが発生しました、ページを更新して再試行してください' : '发生错误，请刷新页面重试', 'error');
    return false;
};

console.log("✅ 鍛治町酒場 神田店 勤務表システム完全起動");