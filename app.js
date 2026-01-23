// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let currentWeek = 0;
let selectedEmployee = null;
let selectedPosition = '前台/服务区';
let currentPositionFilter = 'all';
let database;

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Kajicho Kanda Schedule System Starting");
    
    try {
        // Initialize Firebase
        if (typeof firebase !== 'undefined') {
            database = firebase.database();
            
            // Check connection status
            database.ref('.info/connected').on('value', (snap) => {
                const status = document.getElementById('connectionStatus');
                if (snap.val() === true) {
                    status.innerHTML = '<i class="fas fa-wifi"></i><span>Connected</span>';
                    status.className = 'connection-status connected';
                } else {
                    status.innerHTML = '<i class="fas fa-wifi-slash"></i><span>Disconnected</span>';
                    status.className = 'connection-status disconnected';
                }
            });
        } else {
            console.error("Firebase not loaded");
            showMessage("Database connection error", "error");
        }
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
    
    // Initialize the app
    initApp();
    
    // Load data
    loadEmployees();
    loadSchedules();
    
    // Set up event listeners
    setupEventListeners();
    
    // Add toast styles
    addToastStyles();
    
    console.log("✅ App initialized successfully");
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
    
    // Set auto-refresh for date
    setInterval(updateCurrentDate, 60000);
}

function initWeekdaysSelector() {
    const today = new Date();
    const currentDay = today.getDay();
    
    // Calculate Monday of this week
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    const weekdays = [
        { id: 1, label: 'Mon', default: true },
        { id: 2, label: 'Tue', default: true },
        { id: 3, label: 'Wed', default: true },
        { id: 4, label: 'Thu', default: true },
        { id: 5, label: 'Fri', default: true },
        { id: 6, label: 'Sat', default: false },
        { id: 0, label: 'Sun', default: false }
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

function setAllAsRest() {
    const buttons = document.querySelectorAll('#weekdaysSelector .weekday-btn');
    if (buttons.length === 0) return;
    
    buttons.forEach(btn => {
        btn.classList.add('active', 'rest');
    });
}

function clearWeekdays() {
    const buttons = document.querySelectorAll('#weekdaysSelector .weekday-btn');
    if (buttons.length === 0) return;
    
    buttons.forEach(btn => {
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
    const currentDateElement = document.getElementById('currentDate');
    if (currentDateElement) {
        currentDateElement.textContent = 
            now.toLocaleDateString('zh-CN', options);
    }
}

function setupEventListeners() {
    // Close modal when clicking background
    document.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });
    
    // Prevent page scroll on iOS keyboard dismiss
    document.addEventListener('focusout', function() {
        setTimeout(() => {
            window.scrollTo(0, 0);
        }, 100);
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
    
    // Prevent zoom on iOS when focusing input
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            document.body.style.zoom = '100%';
        });
    });
    
    // Save state when leaving page
    window.addEventListener('beforeunload', function(e) {
        const activeView = document.querySelector('.view.active');
        if (activeView) {
            const lastView = activeView.id.replace('View', '');
            localStorage.setItem('lastView', lastView);
        }
    });
    
    // Restore saved view
    const savedView = localStorage.getItem('lastView');
    if (savedView) {
        setTimeout(() => switchView(savedView), 100);
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
function addToastStyles() {
    // Styles are already in CSS
    console.log("Toast styles added");
}

function showMessage(message, type = 'info') {
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
            <span>${message}</span>
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
        showMessage('Please enter both start and end times', 'warning');
        return false;
    }
    
    const startParts = startTime.split(':').map(Number);
    const endParts = endTime.split(':').map(Number);
    
    // Check time format
    if (startParts.length !== 2 || endParts.length !== 2 ||
        isNaN(startParts[0]) || isNaN(startParts[1]) ||
        isNaN(endParts[0]) || isNaN(endParts[1])) {
        showMessage('Invalid time format', 'warning');
        return false;
    }
    
    // Check if times are within valid range
    if (startParts[0] < 0 || startParts[0] > 23 || startParts[1] < 0 || startParts[1] > 59 ||
        endParts[0] < 0 || endParts[0] > 23 || endParts[1] < 0 || endParts[1] > 59) {
        showMessage('Time must be between 00:00 and 23:59', 'warning');
        return false;
    }
    
    // Calculate minutes for comparison
    const startTotalMinutes = startParts[0] * 60 + startParts[1];
    const endTotalMinutes = endParts[0] * 60 + endParts[1];
    
    // Check if times are the same
    if (startTotalMinutes === endTotalMinutes) {
        showMessage('Start and end times cannot be the same', 'warning');
        return false;
    }
    
    // Calculate work minutes (handle overnight shifts)
    let workMinutes;
    if (endTotalMinutes <= startTotalMinutes) {
        // Overnight shift: from start to midnight + midnight to end
        workMinutes = (24 * 60 - startTotalMinutes) + endTotalMinutes;
    } else {
        // Regular shift
        workMinutes = endTotalMinutes - startTotalMinutes;
    }
    
    // Check if shift is too short (minimum 15 minutes)
    if (workMinutes < 15) {
        showMessage('Shift must be at least 15 minutes', 'warning');
        return false;
    }
    
    // Check if shift is too long (maximum 24 hours)
    if (workMinutes > 24 * 60) {
        showMessage('Shift cannot exceed 24 hours', 'warning');
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
    
    // Handle overnight shifts
    let workMinutes;
    if (endTotalMinutes <= startTotalMinutes) {
        // Overnight shift
        workMinutes = (24 * 60 - startTotalMinutes) + endTotalMinutes;
    } else {
        // Regular shift
        workMinutes = endTotalMinutes - startTotalMinutes;
    }
    
    const workHours = workMinutes / 60;
    return Math.round(workHours * 100) / 100; // Round to 2 decimal places
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
    if (!database) {
        console.error("Database not initialized");
        return;
    }
    
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
    
    // Search filter
    if (searchTerm) {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.name.toLowerCase().includes(searchTerm)
        );
    }
    
    // Position filter
    if (currentPositionFilter !== 'all') {
        filteredEmployees = filteredEmployees.filter(emp => 
            emp.position === currentPositionFilter
        );
    }
    
    if (filteredEmployees.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>${searchTerm || currentPositionFilter !== 'all' ? 'No employees found' : 'No employees yet'}</p>
                <small>Click the + button to add an employee</small>
            </div>
        `;
        return;
    }
    
    // Group by position for better organization
    const frontDeskEmployees = filteredEmployees.filter(emp => emp.position === '前台/服务区');
    const kitchenEmployees = filteredEmployees.filter(emp => emp.position === '厨房区');
    
    let html = '';
    
    if (frontDeskEmployees.length > 0) {
        html += `
            <div class="position-group">
                <h3 class="position-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--primary);">
                    <i class="fas fa-door-open"></i> Front Desk/Service
                    <span class="position-count" style="font-size: 12px; background: var(--primary-light); color: var(--primary); padding: 2px 8px; border-radius: 12px;">${frontDeskEmployees.length}</span>
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
                    <i class="fas fa-utensils"></i> Kitchen
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
                        <span style="color: var(--gray-600);">This Week:</span>
                        <span class="stat-value">${weeklyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">This Month:</span>
                        <span class="stat-value">${monthlyHours}h</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-calendar-check" style="color: var(--primary);"></i>
                        <span style="color: var(--gray-600);">${weekSchedule.workDays} shifts</span>
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
    
    // Update modal content
    const modalEmployeeName = document.getElementById('modalEmployeeName');
    const modalEmployeePosition = document.getElementById('modalEmployeePosition');
    const modalWeekHours = document.getElementById('modalWeekHours');
    const modalMonthHours = document.getElementById('modalMonthHours');
    
    if (modalEmployeeName) modalEmployeeName.textContent = employee.name;
    if (modalEmployeePosition) modalEmployeePosition.textContent = employee.position;
    
    // Calculate hours
    const weeklyHours = calculateWeeklyHours(employeeId);
    const monthlyHours = calculateMonthlyHours(employeeId);
    
    if (modalWeekHours) modalWeekHours.textContent = `${weeklyHours} hours`;
    if (modalMonthHours) modalMonthHours.textContent = `${monthlyHours} hours`;
    
    // Show weekly schedule
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
        showMessage('Please enter employee name', 'warning');
        if (nameInput) nameInput.focus();
        return;
    }
    
    // Check if already exists
    if (employees.some(e => e.name.toLowerCase() === name.toLowerCase())) {
        showMessage(`Employee "${name}" already exists`, 'warning');
        if (nameInput) nameInput.focus();
        return;
    }
    
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    database.ref('employees').push({
        name: name,
        position: selectedPosition,
        createdAt: Date.now()
    })
    .then(() => {
        closeModal('addEmployeeModal');
        showMessage(`Employee ${name} added successfully`, 'success');
        if (nameInput) nameInput.value = '';
    })
    .catch(error => {
        showMessage('Failed to add employee: ' + error.message, 'error');
    });
}

function deleteCurrentEmployee() {
    if (!selectedEmployee) return;
    
    const employee = employees.find(e => e.id === selectedEmployee);
    if (!employee) return;
    
    if (!confirm(`Are you sure you want to delete employee "${employee.name}"?\nThis will also delete all schedule records for this employee!`)) {
        return;
    }
    
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    // Delete employee
    database.ref(`employees/${selectedEmployee}`).remove()
    .then(() => {
        // Delete all schedules for this employee
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
        showMessage(`Employee ${employee.name} deleted`, 'success');
        selectedEmployee = null;
    })
    .catch(error => {
        showMessage('Delete failed: ' + error.message, 'error');
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
    
    select.innerHTML = '<option value="">Select Employee</option>';
    
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
    
    select.innerHTML = '<option value="">Select Employee</option>';
    
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
    
    select.innerHTML = '<option value="">Select Employee</option>';
    
    employees.sort((a, b) => a.name.localeCompare(b.name)).forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${emp.position})`;
        select.appendChild(option);
    });
}

// ==================== SCHEDULE MANAGEMENT ====================
function loadSchedules() {
    if (!database) {
        console.error("Database not initialized");
        return;
    }
    
    const schedulesRef = database.ref('schedules');
    
    schedulesRef.on('value', (snapshot) => {
        schedules = snapshot.val() || {};
        renderWeeklySchedule();
        renderEmployeeCards(); // Update hours display
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
    
    // Calculate and show hours
    const hours = calculateShiftHours(start, end);
    showMessage(`Time set: ${start} - ${end} (${hours} hours)`, 'info');
}

function setQuickTimePreset(start, end) {
    const startInput = document.getElementById('quickWeekStart');
    const endInput = document.getElementById('quickWeekEnd');
    
    if (startInput) startInput.value = start;
    if (endInput) endInput.value = end;
    
    // Calculate and show hours
    const hours = calculateShiftHours(start, end);
    showMessage(`Time set: ${start} - ${end} (${hours} hours)`, 'info');
}

function addSchedule() {
    const employeeId = document.getElementById('scheduleEmployee')?.value;
    const date = document.getElementById('scheduleDate')?.value;
    const startTime = document.getElementById('scheduleStart')?.value;
    const endTime = document.getElementById('scheduleEnd')?.value;
    const typeBtn = document.querySelector('.type-btn.active');
    const type = typeBtn ? typeBtn.dataset.type : 'work';
    
    // Validate inputs
    if (!employeeId) {
        showMessage('Please select an employee', 'warning');
        return;
    }
    
    if (!date) {
        showMessage('Please select a date', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) {
        showMessage('Employee not found', 'error');
        return;
    }
    
    if (type === 'work') {
        if (!startTime || !endTime) {
            showMessage('Please enter work time', 'warning');
            return;
        }
        
        // Use new time validation logic
        if (!validateTimeRange(startTime, endTime)) {
            return;
        }
    }
    
    // Check if schedule already exists
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
        scheduleData.notes = 'Rest day';
    }
    
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    if (existingSchedule) {
        // Update existing schedule
        const scheduleId = existingSchedule.id;
        database.ref(`schedules/${scheduleId}`).update(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage('Schedule updated successfully', 'success');
            // Force refresh weekly view
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage('Update failed: ' + error.message, 'error');
        });
    } else {
        // Add new schedule
        scheduleData.createdAt = Date.now();
        
        database.ref('schedules').push().set(scheduleData)
        .then(() => {
            resetScheduleForm();
            showMessage('Schedule added successfully', 'success');
            // Force refresh weekly view
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage('Add failed: ' + error.message, 'error');
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

// ==================== QUICK WEEK SCHEDULE ====================
function showQuickWeekModal() {
    const startInput = document.getElementById('quickWeekStart');
    const endInput = document.getElementById('quickWeekEnd');
    
    if (startInput) startInput.value = '08:00';
    if (endInput) endInput.value = '17:00';
    
    // Update weekday selector
    updateWeekdaysSelector();
    
    updateQuickWeekEmployeeSelect();
    openModal('quickWeekModal');
}

function updateWeekdaysSelector() {
    const today = new Date();
    const currentDay = today.getDay();
    
    // Calculate Monday of this week
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    
    const weekdays = [
        { id: 1, label: 'Mon', default: true },
        { id: 2, label: 'Tue', default: true },
        { id: 3, label: 'Wed', default: true },
        { id: 4, label: 'Thu', default: true },
        { id: 5, label: 'Fri', default: true },
        { id: 6, label: 'Sat', default: false },
        { id: 0, label: 'Sun', default: false }
    ];
    
    const container = document.getElementById('weekdaysSelector');
    if (!container) return;
    
    let html = '';
    weekdays.forEach((day, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        
        const month = date.getMonth() + 1;
        const dayNum = date.getDate();
        
        // Check for existing schedule
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
                        ${hasSchedule === 'rest' ? 'Rest' : 'Scheduled'}
                    </div>
                ` : ''}
            </button>
        `;
    });
    
    container.innerHTML = html;
}

function checkExistingSchedule(dateString) {
    if (!schedules || typeof schedules !== 'object') return '';
    
    // Check if any employee has schedule on this date
    const schedulesForDate = Object.values(schedules).filter(s => s && s.date === dateString);
    if (schedulesForDate.length > 0) {
        const employeeId = document.getElementById('quickWeekEmployee')?.value;
        if (employeeId) {
            const employeeSchedule = schedulesForDate.find(s => s.employeeId === employeeId);
            if (employeeSchedule) {
                return employeeSchedule.isDayOff ? 'rest' : 'work';
            }
        }
        return 'work'; // Other employees have schedule
    }
    return '';
}

function applyQuickWeekSchedule() {
    const employeeId = document.getElementById('quickWeekEmployee')?.value;
    const startTime = document.getElementById('quickWeekStart')?.value;
    const endTime = document.getElementById('quickWeekEnd')?.value;
    
    if (!employeeId) {
        showMessage('Please select an employee', 'warning');
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
        showMessage('Please select at least one workday', 'warning');
        return;
    }
    
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    const promises = [];
    
    // Set schedule for selected dates
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
                showMessage('Please enter work time', 'warning');
                return;
            }
            
            // Use new time validation logic
            if (!validateTimeRange(startTime, endTime)) {
                return;
            }
            
            scheduleData.startTime = startTime;
            scheduleData.endTime = endTime;
        } else {
            scheduleData.startTime = '00:00';
            scheduleData.endTime = '00:00';
            scheduleData.notes = 'Rest day';
        }
        
        const existingSchedule = findScheduleByEmployeeAndDate(employeeId, dateString);
        
        if (existingSchedule) {
            // Update existing schedule
            promises.push(
                database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
            );
        } else {
            // Add new schedule
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
        showMessage(`Set ${workDays} work days, ${restDays.length} rest days`, 'success');
        // Force refresh weekly view
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage('Setting failed: ' + error.message, 'error');
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
    
    // Calculate Monday of this week
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
    const employeeId = document.getElementById('restDaysEmployee')?.value;
    
    if (!employeeId) {
        showMessage('Please select an employee', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const selectedDates = [];
    
    document.querySelectorAll('#restDaysSelector .weekday-btn.active').forEach(btn => {
        selectedDates.push(btn.dataset.date);
    });
    
    if (selectedDates.length === 0) {
        showMessage('Please select at least one rest day', 'warning');
        return;
    }
    
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    const promises = [];
    
    // Set rest days for selected dates
    selectedDates.forEach(dateString => {
        const scheduleData = {
            employeeId: employeeId,
            employeeName: employee.name,
            employeePosition: employee.position,
            date: dateString,
            isDayOff: true,
            startTime: '00:00',
            endTime: '00:00',
            notes: 'Rest day',
            updatedAt: Date.now()
        };
        
        const existingSchedule = findScheduleByEmployeeAndDate(employeeId, dateString);
        
        if (existingSchedule) {
            // Update existing schedule to rest
            promises.push(
                database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
            );
        } else {
            // Add new schedule
            scheduleData.createdAt = Date.now();
            promises.push(
                database.ref('schedules').push().set(scheduleData)
            );
        }
    });
    
    Promise.all(promises)
    .then(() => {
        closeModal('setRestDaysModal');
        showMessage(`Set ${selectedDates.length} rest days`, 'success');
        // Force refresh weekly view
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage('Setting failed: ' + error.message, 'error');
    });
}

// ==================== WEEKLY VIEW ====================
function renderWeeklySchedule() {
    const container = document.getElementById('weeklySchedule');
    if (!container) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    const days = generateWeekDays(startDate);
    
    // Group schedules by employee
    const schedulesByEmployee = {};
    weekSchedule.forEach(schedule => {
        if (schedule && schedule.employeeId) {
            if (!schedulesByEmployee[schedule.employeeId]) {
                schedulesByEmployee[schedule.employeeId] = {};
            }
            schedulesByEmployee[schedule.employeeId][schedule.date] = schedule;
        }
    });
    
    // Generate header
    let html = `
        <div class="week-header">
            <div class="week-header-cell">Employee / Position</div>
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
    
    // Generate employee rows
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id] || {};
        const weeklyHours = calculateWeeklyHours(employee.id);
        
        html += `
            <div class="week-row">
                <div class="week-cell">
                    <div style="font-weight: 700; font-size: 14px; color: var(--dark);">${employee.name}</div>
                    <div style="font-size: 12px; color: var(--gray-500); margin-bottom: 6px;">${employee.position}</div>
                    <div style="font-size: 11px; color: var(--primary); font-weight: 600;">
                        <i class="fas fa-clock" style="font-size: 10px; margin-right: 4px;"></i> This Week: ${weeklyHours}h
                    </div>
                </div>
                ${days.map(day => {
                    const schedule = employeeSchedules[day.dateString];
                    let scheduleClass = 'empty';
                    let scheduleText = '';
                    
                    if (schedule) {
                        if (schedule.isDayOff) {
                            scheduleClass = 'rest';
                            scheduleText = 'Rest';
                        } else {
                            scheduleClass = 'work';
                            scheduleText = `
                                <div style="font-weight: 600;">${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}</div>
                                <div class="day-time">${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}</div>
                            `;
                        }
                    }
                    
                    return `
                        <div class="week-cell">
                            <div class="day-schedule-item ${scheduleClass}" 
                                 onclick="editDaySchedule('${employee.id}', '${day.dateString}')"
                                 title="${schedule ? (schedule.isDayOff ? 'Rest day' : `${schedule.startTime || ''}-${schedule.endTime || ''}`) : 'Click to add schedule'}">
                                ${scheduleText || 'Add'}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    });
    
    container.innerHTML = html || '<div class="empty-state"><p>No schedule data</p></div>';
    
    // Update week range display
    const weekRange = document.getElementById('weekRange');
    if (weekRange) {
        weekRange.textContent = `${formatDate(startDate)} - ${formatDate(endDate)}`;
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
    
    container.innerHTML = `
        <div class="edit-schedule-form">
            <div class="form-group">
                <label>Employee</label>
                <div class="employee-display">
                    <div class="employee-avatar-small">${employee.name.charAt(0)}</div>
                    <div>
                        <div style="font-weight: 700; color: var(--dark);">${employee.name}</div>
                        <div style="font-size: 14px; color: var(--gray-500);">${employee.position}</div>
                    </div>
                </div>
            </div>
            
            <div class="form-group">
                <label>Date</label>
                <div class="date-display">
                    <div style="font-weight: 700; color: var(--dark);">${formatDate(date)}</div>
                    <div style="font-size: 14px; color: var(--gray-500);">${getDayName(new Date(date))}</div>
                </div>
            </div>
            
            <div class="form-group">
                <label>Schedule Type</label>
                <div class="type-selector">
                    <button type="button" class="type-btn ${!schedule || !schedule.isDayOff ? 'active' : ''}" 
                            onclick="setEditScheduleType('work')">
                        <i class="fas fa-briefcase"></i>
                        <span>Work</span>
                    </button>
                    <button type="button" class="type-btn ${schedule && schedule.isDayOff ? 'active' : ''}"
                            onclick="setEditScheduleType('rest')">
                        <i class="fas fa-umbrella-beach"></i>
                        <span>Rest</span>
                    </button>
                </div>
            </div>
            
            <div class="time-group" id="editTimeGroup" style="display: ${!schedule || !schedule.isDayOff ? 'grid' : 'none'}">
                <div class="form-group">
                    <label>Start Time</label>
                    <input type="time" id="editStartTime" class="input-field" 
                           value="${schedule && !schedule.isDayOff && schedule.startTime ? schedule.startTime : '08:00'}">
                </div>
                <div class="form-group">
                    <label>End Time</label>
                    <input type="time" id="editEndTime" class="input-field" 
                           value="${schedule && !schedule.isDayOff && schedule.endTime ? schedule.endTime : '17:00'}">
                </div>
            </div>
            
            <div class="action-buttons">
                <button type="button" class="btn-primary" onclick="saveDaySchedule('${employeeId}', '${date}')">
                    <i class="fas fa-save"></i> Save
                </button>
                ${schedule ? `
                    <button type="button" class="btn-danger" onclick="deleteDaySchedule('${employeeId}', '${date}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                ` : ''}
                <button type="button" class="btn-secondary" onclick="closeModal('editModal')">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    openModal('editModal');
}

function editEmployeeSchedule() {
    if (!selectedEmployee) return;
    
    // Switch to weekly view
    switchView('weekly');
    closeModal('employeeModal');
    
    // Scroll to selected employee
    setTimeout(() => {
        const employee = employees.find(e => e.id === selectedEmployee);
        if (!employee) return;
        
        const employeeRows = document.querySelectorAll('.week-row');
        employeeRows.forEach(row => {
            const nameCell = row.querySelector('.week-cell:first-child');
            if (nameCell && nameCell.textContent.includes(employee.name)) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight
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
            showMessage('Please enter work time', 'warning');
            return;
        }
        
        // Use new time validation logic
        if (!validateTimeRange(startTime, endTime)) {
            return;
        }
        
        scheduleData.startTime = startTime;
        scheduleData.endTime = endTime;
    } else {
        scheduleData.startTime = '00:00';
        scheduleData.endTime = '00:00';
        scheduleData.notes = 'Rest day';
    }
    
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    const existingSchedule = findScheduleByEmployeeAndDate(employeeId, date);
    
    if (existingSchedule) {
        // Update existing schedule
        database.ref(`schedules/${existingSchedule.id}`).update(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage('Schedule updated successfully', 'success');
            // Force refresh weekly view
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage('Update failed: ' + error.message, 'error');
        });
    } else {
        // Add new schedule
        scheduleData.createdAt = Date.now();
        
        database.ref('schedules').push().set(scheduleData)
        .then(() => {
            closeModal('editModal');
            showMessage('Schedule added successfully', 'success');
            // Force refresh weekly view
            renderWeeklySchedule();
        })
        .catch(error => {
            showMessage('Add failed: ' + error.message, 'error');
        });
    }
}

function deleteDaySchedule(employeeId, date) {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    
    const schedule = findScheduleByEmployeeAndDate(employeeId, date);
    if (!schedule) return;
    
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    database.ref(`schedules/${schedule.id}`).remove()
    .then(() => {
        closeModal('editModal');
        showMessage('Schedule deleted', 'success');
        // Force refresh weekly view
        renderWeeklySchedule();
    })
    .catch(error => {
        showMessage('Delete failed: ' + error.message, 'error');
    });
}

// ==================== PRINT ALL SCHEDULE ====================
function printAllSchedule() {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    const days = generateWeekDays(startDate);
    
    // Create HTML for printing
    let printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kajicho Kanda - Weekly Schedule - ${formatDate(startDate)} to ${formatDate(endDate)}</title>
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
                <h1>Kajicho Kanda Weekly Schedule</h1>
                <p>Date: ${formatDate(startDate)} to ${formatDate(endDate)}</p>
            </div>
            
            <div class="print-info">
                <div class="info-item">
                    <h3>Total Employees</h3>
                    <p>${employees.length}</p>
                </div>
                <div class="info-item">
                    <h3>This Week's Schedules</h3>
                    <p>${weekSchedule.length}</p>
                </div>
                <div class="info-item">
                    <h3>Front Desk/Service</h3>
                    <p>${employees.filter(e => e.position === '前台/服务区').length}</p>
                </div>
                <div class="info-item">
                    <h3>Kitchen</h3>
                    <p>${employees.filter(e => e.position === '厨房区').length}</p>
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th style="width: 120px; text-align: left; padding-left: 16px;">Employee / Position</th>
    `;
    
    // Add dates for each day
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
    
    // Group schedules by employee
    const schedulesByEmployee = {};
    weekSchedule.forEach(schedule => {
        if (schedule && schedule.employeeId) {
            if (!schedulesByEmployee[schedule.employeeId]) {
                schedulesByEmployee[schedule.employeeId] = {};
            }
            schedulesByEmployee[schedule.employeeId][schedule.date] = schedule;
        }
    });
    
    // Add data for each employee
    employees.forEach(employee => {
        const employeeSchedules = schedulesByEmployee[employee.id] || {};
        const weeklyHours = calculateWeeklyHours(employee.id);
        
        printContent += `
            <tr>
                <td style="text-align: left; padding-left: 16px;">
                    <div class="employee-name">${employee.name}</div>
                    <div class="employee-position">${employee.position}</div>
                    <div style="font-size: 11px; color: #2563eb; margin-top: 6px; font-weight: 700;">
                        This Week: ${weeklyHours}h
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
                    scheduleContent = '<div class="schedule-rest">Rest</div>';
                } else {
                    scheduleClass = 'work';
                    const hours = calculateShiftHours(schedule.startTime, schedule.endTime);
                    scheduleContent = `
                        <div class="schedule-time">${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}-${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}</div>
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
    
    // Calculate summary
    const totalWorkHours = employees.reduce((sum, emp) => sum + calculateWeeklyHours(emp.id), 0);
    const totalWorkDays = weekSchedule.filter(s => s && !s.isDayOff).length;
    const totalRestDays = weekSchedule.filter(s => s && s.isDayOff).length;
    
    printContent += `
                </tbody>
            </table>
            
            <div class="summary-grid">
                <div class="summary-card">
                    <h4>${totalWorkHours}</h4>
                    <p>Total Hours This Week</p>
                </div>
                <div class="summary-card">
                    <h4>${employees.length}</h4>
                    <p>Total Employees</p>
                </div>
                <div class="summary-card">
                    <h4>${totalWorkDays}</h4>
                    <p>Work Shifts</p>
                </div>
                <div class="summary-card">
                    <h4>${totalRestDays}</h4>
                    <p>Rest Shifts</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Generated: ${new Date().toLocaleString('en-US', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                })}</p>
                <p>Kajicho Kanda Schedule System - Press Ctrl + P to print</p>
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
            
            setTimeout(() => {
                printWindow.print();
                setTimeout(() => {
                    printWindow.close();
                }, 500);
            }, 500);
            
            showMessage('Opening weekly schedule print preview...', 'info');
        }
    } catch (error) {
        console.error("Print error:", error);
        showMessage("Print error: " + error.message, "error");
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
                <p>No schedule for today</p>
                <small>Switch to "Schedule" page to add today's schedule</small>
            </div>
        `;
    } else {
        // Group by position
        const frontDeskSchedules = todaySchedules.filter(s => s.employeePosition === '前台/服务区');
        const kitchenSchedules = todaySchedules.filter(s => s.employeePosition === '厨房区');
        
        let html = '';
        
        if (frontDeskSchedules.length > 0) {
            html += `<h4 style="margin-bottom: 16px; color: #2563eb; font-weight: 700;"><i class="fas fa-door-open"></i> Front Desk/Service</h4>`;
            html += frontDeskSchedules.map(schedule => createTodayItem(schedule)).join('');
        }
        
        if (kitchenSchedules.length > 0) {
            html += `<h4 style="margin-top: 24px; margin-bottom: 16px; color: #f59e0b; font-weight: 700;"><i class="fas fa-utensils"></i> Kitchen</h4>`;
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
                    ${schedule.isDayOff ? 'Rest Day' : `${schedule.startTime ? schedule.startTime.substring(0, 5) : ''} - ${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}`}
                </div>
                ${!schedule.isDayOff ? `
                    <div style="font-size: 12px; color: var(--gray-500); font-weight: 500;">
                        Hours: ${calculateShiftHours(schedule.startTime, schedule.endTime)}h
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function showStats() {
    const container = document.getElementById('statsGrid');
    if (!container) return;
    
    // Calculate statistics
    const totalEmployees = employees.length;
    const totalSchedules = Object.keys(schedules).length;
    const today = new Date().toISOString().split('T')[0];
    const todayShifts = Object.values(schedules).filter(s => s && s.date === today && !s.isDayOff).length;
    const weekHours = employees.reduce((sum, emp) => sum + calculateWeeklyHours(emp.id), 0);
    const monthHours = employees.reduce((sum, emp) => sum + calculateMonthlyHours(emp.id), 0);
    const frontDeskCount = employees.filter(e => e.position === '前台/服务区').length;
    const kitchenCount = employees.filter(e => e.position === '厨房区').length;
    
    container.innerHTML = `
        <div class="stat-card">
            <h4>${totalEmployees}</h4>
            <p>Total Employees</p>
        </div>
        <div class="stat-card">
            <h4>${totalSchedules}</h4>
            <p>Total Schedules</p>
        </div>
        <div class="stat-card">
            <h4>${todayShifts}</h4>
            <p>Today's Shifts</p>
        </div>
        <div class="stat-card">
            <h4>${weekHours}h</h4>
            <p>This Week's Hours</p>
        </div>
        <div class="stat-card">
            <h4>${monthHours}h</h4>
            <p>This Month's Hours</p>
        </div>
        <div class="stat-card">
            <h4>${frontDeskCount}</h4>
            <p>Front Desk/Service</p>
        </div>
        <div class="stat-card">
            <h4>${kitchenCount}</h4>
            <p>Kitchen</p>
        </div>
        <div class="stat-card">
            <h4>${Math.round(weekHours / (employees.length || 1))}h</h4>
            <p>Avg. Weekly Hours</p>
        </div>
    `;
    
    openModal('statsModal');
}

// ==================== UTILITY FUNCTIONS ====================
function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    
    // Monday as first day (Chinese convention)
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
    
    return Math.round(totalHours * 10) / 10; // Round to 1 decimal place
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

function getDayName(date) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[date.getDay()];
}

function refreshData() {
    if (!database) {
        showMessage("Database not connected", "error");
        return;
    }
    
    // Update Firebase connection
    database.ref('.info/connected').once('value').then(snap => {
        if (snap.val() === true) {
            showMessage('Data sync complete', 'success');
            loadEmployees();
            loadSchedules();
        } else {
            showMessage('Unable to connect to server', 'error');
        }
    }).catch(error => {
        showMessage('Refresh error: ' + error.message, 'error');
    });
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
    
    // Directly call print function
    printSchedule();
    // Close employee detail modal
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
    
    // Generate formatted text
    let text = `【${employee.name} Schedule】\n`;
    text += `Position: ${employee.position}\n`;
    text += `Date: ${formatDate(startDate)} to ${formatDate(endDate)}\n`;
    text += `This Week: ${weeklyHours} hours | This Month: ${monthlyHours} hours\n\n`;
    text += `📅 This Week's Schedule:\n`;
    
    days.forEach(day => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        const scheduleText = schedule ? 
            (schedule.isDayOff ? '🏖️ Rest' : `🕐 ${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}-${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}`) : 
            '📭 No Schedule';
        
        text += `${day.name} (${day.date}): ${scheduleText}\n`;
    });
    
    text += `\n📍 Work Area: ${employee.position === '厨房区' ? 'Kitchen 👨‍🍳' : 'Front Desk/Service 💁'}\n`;
    text += `📊 This Week: ${weekSchedule.filter(s => !s.isDayOff).length} work days, ${weekSchedule.filter(s => s.isDayOff).length} rest days\n`;
    text += `\n⏰ Generated: ${new Date().toLocaleString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    })}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(text)
        .then(() => {
            showMessage('Schedule copied to clipboard', 'success');
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
                showMessage('Copied to clipboard', 'success');
            } catch (err) {
                showMessage('Copy failed', 'error');
            }
            document.body.removeChild(textarea);
            
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
    
    // Generate table row content
    const tableRows = generateWeekDays(startDate).map(day => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        const hours = schedule && !schedule.isDayOff ? 
            calculateShiftHours(schedule.startTime, schedule.endTime) : 0;
        
        let scheduleTime = '-';
        if (schedule && !schedule.isDayOff) {
            scheduleTime = (schedule.startTime ? schedule.startTime.substring(0, 5) : '') + ' - ' + (schedule.endTime ? schedule.endTime.substring(0, 5) : '');
        }
        
        const statusClass = schedule ? (schedule.isDayOff ? 'rest' : 'work') : '';
        const statusText = schedule ? (schedule.isDayOff ? 'Rest' : 'Work') : 'No Schedule';
        
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
    
    // Create print content
    const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Kajicho Kanda - ${employee.name} Schedule</title>
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
                <h1>Kajicho Kanda - ${employee.name} Schedule</h1>
                <p>Position: ${employee.position} | Date: ${formatDate(startDate)} to ${formatDate(endDate)}</p>
            </div>
            
            <div class="info-grid">
                <div class="info-card">
                    <h3>This Week's Hours</h3>
                    <p>${weeklyHours} hours</p>
                </div>
                <div class="info-card">
                    <h3>This Month's Hours</h3>
                    <p>${monthlyHours} hours</p>
                </div>
            </div>
            
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Day</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Work Time</th>
                        <th>Hours</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            
            <div class="summary">
                <h3>This Week Summary</h3>
                <p>Work Days: ${weekSchedule.filter(s => !s.isDayOff).length} days</p>
                <p>Rest Days: ${weekSchedule.filter(s => s.isDayOff).length} days</p>
                <p>Total Hours: ${weeklyHours} hours</p>
            </div>
            
            <div class="footer">
                <p>Generated: ${new Date().toLocaleString('en-US')}</p>
                <p class="no-print">Tip: Press Ctrl + P to print</p>
            </div>
        </body>
        </html>
    `;
    
    // Directly open print dialog
    try {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Delay to ensure content loads
            setTimeout(() => {
                printWindow.print();
                // Automatically close window after printing
                setTimeout(() => {
                    printWindow.close();
                }, 500);
            }, 500);
            
            showMessage('Opening print preview...', 'info');
        }
    } catch (error) {
        console.error("Print error:", error);
        showMessage("Print error: " + error.message, "error");
    }
}

// ==================== ERROR HANDLING ====================
// Global error handling
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('JavaScript Error:', msg, '\nURL:', url, '\nLine:', lineNo, '\nColumn:', columnNo, '\nError object:', error);
    showMessage('An error occurred, please refresh the page and try again', 'error');
    return false;
};

// ==================== INITIAL LOAD ====================
// Start application
console.log("✅ Kajicho Kanda Schedule System fully loaded");
