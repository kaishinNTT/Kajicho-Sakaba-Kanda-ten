// ==================== STAFF PORTAL (trang riêng cho nhân viên) ====================
// Trang này KHÔNG dùng chung app.js của admin - viết riêng gọn nhẹ, chỉ đọc lịch của
// chính nhân viên đang đăng nhập + gửi yêu cầu đổi lịch (không sửa lịch trực tiếp).

let currentLang = localStorage.getItem('appLanguage') || 'ja';
let currentEmployee = null;   // { id, name, position, uid, loginEmail }
let currentWeekOffset = 0;
let cachedRequests = [];

// ID đăng nhập của nhân viên có dạng cố định (VD: KAJICHO01) do admin tạo bên index.html.
// Vì Firebase Auth (client) bắt buộc định dạng email, domain giả cố định này được ghép thêm
// vào phía sau ID khi đăng nhập - phải khớp với STAFF_LOGIN_DOMAIN bên app.js.
const STAFF_LOGIN_DOMAIN = '@kajicho-staff.local';

const POSITIONS = [
    { key: '前台/服务区', ja: 'フロント', zh: '前台', icon: 'fa-door-open' },
    { key: '厨房区', ja: '厨房', zh: '厨房', icon: 'fa-utensils' },
    { key: '拉客', ja: '拉客', zh: '拉客', icon: 'fa-bullhorn' }
];

function positionLabel(key) {
    const info = POSITIONS.find(p => p.key === key) || POSITIONS[0];
    return currentLang === 'ja' ? info.ja : info.zh;
}

// ==================== DATE HELPERS (giống hệt logic bên app.js để tuần luôn khớp) ====================
function getWeekDates(weekOffset = 0) {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    monday.setDate(monday.getDate() + (weekOffset * 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { startDate: monday, endDate: sunday };
}

function generateWeekDays(startDate) {
    const days = [];
    const dowJa = ['月', '火', '水', '木', '金', '土', '日'];
    const dowZh = ['一', '二', '三', '四', '五', '六', '日'];
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        days.push({
            dowJa: dowJa[i],
            dowZh: dowZh[i],
            date: `${date.getMonth() + 1}/${date.getDate()}`,
            dateString: toDateString(date),
            isToday: toDateString(date) === toDateString(new Date())
        });
    }
    return days;
}

function toDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDate(dateString) {
    const d = new Date(dateString);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ==================== MODAL HELPERS ====================
function openStaffModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeStaffModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'none';
    document.body.style.overflow = '';
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-message toast-${type}`;
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';
    toast.innerHTML = `<i class="fas ${icon}"></i><span>${message}</span>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== LANGUAGE ====================
function applyLangVisibility() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        el.style.display = (el.getAttribute('data-lang') === currentLang) ? '' : 'none';
    });
}

function toggleStaffLang() {
    currentLang = currentLang === 'ja' ? 'zh' : 'ja';
    localStorage.setItem('appLanguage', currentLang);
    applyLangVisibility();
    if (currentEmployee) {
        renderTopbar();
        renderSchedule();
        if (document.getElementById('tabRequests').style.display !== 'none') {
            renderRequestsList();
        }
    }
}

// ==================== AUTH ====================
function doLogin() {
    const rawId = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorBox = document.getElementById('loginError');
    errorBox.style.display = 'none';

    if (!rawId || !password) {
        errorBox.textContent = currentLang === 'ja' ? 'IDとパスワードを入力してください' : '请输入账号和密码';
        errorBox.style.display = 'block';
        return;
    }

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;

    // Nhân viên chỉ cần nhập ID (VD: KAJICHO01). ID này có thể đang trỏ tới 1 email kỹ thuật
    // đã được "phát hành lại" (sau khi admin bấm nút cấp mật khẩu mới) - tra cứu loginIndex
    // trước để lấy đúng email hiện tại; nếu không có trong index (tài khoản tạo lần đầu, chưa
    // từng đổi mật khẩu) thì dùng luôn mẫu email cơ bản. Nếu ID đã có dạng email đầy đủ (tài
    // khoản cũ tạo trước khi có tính năng ID cố định) thì giữ nguyên, không tra cứu.
    const basePattern = rawId.includes('@') ? rawId : `${rawId.toLowerCase()}${STAFF_LOGIN_DOMAIN}`;
    const lookupPromise = rawId.includes('@')
        ? Promise.resolve(null)
        : window.database.ref(`loginIndex/${rawId.toUpperCase()}`).once('value')
            .then(snap => snap.val())
            .catch(() => null); // không đọc được (chưa cấu hình rule, hoặc chưa có entry) -> dùng fallback

    lookupPromise.then(indexedEmail => {
        const email = indexedEmail || basePattern;

        window.auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            let msg = error.message;
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                msg = currentLang === 'ja' ? 'IDまたはパスワードが正しくありません' : '账号或密码不正确';
            }
            errorBox.textContent = msg;
            errorBox.style.display = 'block';
        })
        .finally(() => {
            btn.disabled = false;
        });
    });
}

function doLogout() {
    window.auth.signOut();
}

window.auth.onAuthStateChanged(user => {
    if (user) {
        loadCurrentEmployee(user.uid);
    } else {
        currentEmployee = null;
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainScreen').style.display = 'none';
    }
});

function loadCurrentEmployee(uid) {
    window.database.ref('employees').orderByChild('uid').equalTo(uid).once('value')
    .then(snapshot => {
        const data = snapshot.val();
        if (!data) {
            showToast(currentLang === 'ja' ? 'このアカウントに紐づくスタッフが見つかりません。管理者に連絡してください。' : '找不到与此账号关联的员工，请联系管理员。', 'error');
            window.auth.signOut();
            return;
        }
        const empId = Object.keys(data)[0];
        currentEmployee = { id: empId, ...data[empId] };

        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainScreen').style.display = 'flex';
        renderTopbar();
        currentWeekOffset = 0;
        renderSchedule();
    })
    .catch(error => {
        showToast((currentLang === 'ja' ? '読み込みエラー: ' : '加载错误: ') + error.message, 'error');
    });
}

function renderTopbar() {
    document.getElementById('topbarName').textContent = currentEmployee.name;
    document.getElementById('topbarPosition').textContent = positionLabel(currentEmployee.position);
}

// ==================== TABS ====================
function switchStaffTab(tab) {
    document.querySelectorAll('.staff-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('tabSchedule').style.display = (tab === 'schedule') ? 'block' : 'none';
    document.getElementById('tabRequests').style.display = (tab === 'requests') ? 'block' : 'none';
    if (tab === 'requests') renderRequestsList();
}

// ==================== SCHEDULE ====================
function changeStaffWeek(delta) {
    currentWeekOffset += delta;
    renderSchedule();
}

function renderSchedule() {
    if (!currentEmployee) return;
    const { startDate, endDate } = getWeekDates(currentWeekOffset);
    const days = generateWeekDays(startDate);

    document.getElementById('weekLabel').textContent = `${formatDate(days[0].dateString)} - ${formatDate(days[6].dateString)}`;

    const startStr = days[0].dateString;
    const endStr = days[6].dateString;

    window.database.ref('schedules').orderByChild('employeeId').equalTo(currentEmployee.id).once('value')
    .then(snapshot => {
        const data = snapshot.val() || {};
        const weekSchedules = Object.values(data).filter(s => s.date >= startStr && s.date <= endStr);

        const list = document.getElementById('scheduleList');
        list.innerHTML = days.map(day => {
            const schedule = weekSchedules.find(s => s.date === day.dateString);
            const dow = currentLang === 'ja' ? day.dowJa : day.dowZh;
            let statusClass = 'none';
            let statusText = currentLang === 'ja' ? '未設定' : '未设置';
            let subText = '';

            if (schedule) {
                if (schedule.isDayOff) {
                    statusClass = 'rest';
                    statusText = currentLang === 'ja' ? '休み' : '休息';
                } else {
                    statusClass = 'work';
                    const start = (schedule.startTime || '').substring(0, 5);
                    const end = (schedule.endTime || '').substring(0, 5);
                    statusText = `${start} - ${end}`;
                    subText = positionLabel(schedule.employeePosition || currentEmployee.position);
                }
            }

            return `
                <div class="staff-day-row ${day.isToday ? 'today' : ''}">
                    <div class="staff-day-date">
                        <div class="dow">${dow}</div>
                        <div class="num">${day.date}</div>
                    </div>
                    <div class="staff-day-info">
                        <div class="staff-day-status ${statusClass}">${statusText}</div>
                        ${subText ? `<div class="staff-day-sub">${subText}</div>` : ''}
                    </div>
                    <button type="button" class="staff-request-btn" onclick="openRequestForm('${day.dateString}')">
                        <i class="fas fa-pen"></i> ${currentLang === 'ja' ? '申請' : '申请'}
                    </button>
                </div>
            `;
        }).join('');
    })
    .catch(error => {
        showToast((currentLang === 'ja' ? '読み込みエラー: ' : '加载错误: ') + error.message, 'error');
    });
}

// ==================== REQUEST FORM ====================
// Từ bản này chỉ còn lại 1 tính năng duy nhất: gửi lưu ý/tin nhắn tự do cho bên quản lý
// (không còn đăng ký nghỉ / đổi giờ trực tiếp từ trang nhân viên nữa - luôn gửi dạng "other").
function openRequestForm(prefillDate) {
    document.getElementById('reqDate').value = prefillDate || toDateString(new Date());
    document.getElementById('reqNote').value = '';
    openStaffModal('requestModal');
}

function submitStaffRequest() {
    const date = document.getElementById('reqDate').value;
    const note = document.getElementById('reqNote').value.trim();

    if (!date) {
        showToast(currentLang === 'ja' ? '日付を選択してください' : '请选择日期', 'warning');
        return;
    }
    if (!note) {
        showToast(currentLang === 'ja' ? '内容を入力してください' : '请输入内容', 'warning');
        return;
    }

    const requestData = {
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.name,
        date: date,
        type: 'other',
        note: note,
        status: 'pending',
        createdAt: Date.now()
    };

    window.database.ref('changeRequests').push(requestData)
    .then(() => {
        closeStaffModal('requestModal');
        showToast(currentLang === 'ja' ? '送信しました' : '已提交', 'success');
        switchStaffTab('requests');
    })
    .catch(error => {
        showToast((currentLang === 'ja' ? '送信失敗: ' : '提交失败: ') + error.message, 'error');
    });
}

// ==================== REQUESTS LIST ====================
function renderRequestsList() {
    if (!currentEmployee) return;
    window.database.ref('changeRequests').orderByChild('employeeId').equalTo(currentEmployee.id).once('value')
    .then(snapshot => {
        const data = snapshot.val() || {};
        cachedRequests = Object.entries(data).map(([id, r]) => ({ id, ...r })).sort((a, b) => b.createdAt - a.createdAt);

        const list = document.getElementById('requestsList');
        if (cachedRequests.length === 0) {
            list.innerHTML = `
                <div class="staff-empty">
                    <i class="fas fa-inbox"></i>
                    <div>${currentLang === 'ja' ? 'リクエストはまだありません' : '还没有申请记录'}</div>
                </div>
            `;
            return;
        }

        const typeLabel = { dayoff: currentLang === 'ja' ? '休み希望' : '请假', time_change: currentLang === 'ja' ? '時間変更' : '改时间', other: currentLang === 'ja' ? 'その他' : '其他' };
        const statusLabel = { pending: currentLang === 'ja' ? '審査中' : '待审核', approved: currentLang === 'ja' ? '承認済み' : '已批准', rejected: currentLang === 'ja' ? '却下' : '已拒绝' };

        list.innerHTML = cachedRequests.map(r => `
            <div class="staff-req-item">
                <div class="staff-req-top">
                    <div class="staff-req-date">${formatDate(r.date)} · ${typeLabel[r.type] || r.type}</div>
                    <div class="staff-req-status ${r.status}">${statusLabel[r.status] || r.status}</div>
                </div>
                <div class="staff-req-body">
                    ${r.type === 'time_change' && r.requestedStartTime ? `${r.requestedStartTime} - ${r.requestedEndTime}<br>` : ''}
                    ${r.note ? r.note : ''}
                </div>
            </div>
        `).join('');
    })
    .catch(error => {
        showToast((currentLang === 'ja' ? '読み込みエラー: ' : '加载错误: ') + error.message, 'error');
    });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    applyLangVisibility();
});
