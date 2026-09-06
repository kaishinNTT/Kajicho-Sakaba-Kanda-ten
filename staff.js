// ==================== STAFF PORTAL (trang riêng cho nhân viên) ====================
// Trang này KHÔNG dùng chung app.js của admin - viết riêng gọn nhẹ. Chỉ còn đúng 2 việc:
// 1) Xem lịch làm của chính mình (theo tuần / theo tháng)
// 2) Tự đổi mật khẩu đăng nhập nếu muốn
// Không còn tính năng gửi yêu cầu/đăng ký gì khác từ trang này.

let currentLang = localStorage.getItem('appLanguage') || 'ja';
let currentEmployee = null;   // { id, name, position, uid, loginEmail }
let currentView = 'week';     // 'week' | 'month'
let currentWeekOffset = 0;
let currentMonthOffset = 0;

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

// Thông tin tháng: năm/tháng đang xem, số ngày trong tháng, và vị trí thứ (Thứ 2 = cột đầu
// tiên, khớp với cách tính tuần Thứ 2 - Chủ nhật đang dùng ở trên + bên admin).
function getMonthInfo(monthOffset = 0) {
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth(); // 0-based
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstWeekday = new Date(year, month, 1).getDay(); // 0=CN...6=Thứ7
    firstWeekday = (firstWeekday === 0) ? 6 : firstWeekday - 1; // đổi sang: 0=Thứ2...6=CN
    return { year, month, daysInMonth, firstWeekday };
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

// Chuẩn hoá 1 ca làm thành: loại ca (sớm/muộn/nghỉ/chưa xếp) + nhãn hiển thị ngắn gọn.
// Cùng logic phân loại 早番(trước 17h)/遅番(từ 17h) như bên app.js quản lý.
function getShiftInfo(schedule) {
    if (!schedule) {
        return { cls: 'shift-none', shortLabel: '', fullLabel: currentLang === 'ja' ? '未設定' : '未设置' };
    }
    if (schedule.isDayOff) {
        const label = currentLang === 'ja' ? '休み' : '休息';
        return { cls: 'shift-rest', shortLabel: label, fullLabel: label };
    }
    const start = (schedule.startTime || '').substring(0, 5);
    const end = (schedule.endTime || '').substring(0, 5);
    const startHour = parseInt((schedule.startTime || '0').substring(0, 2), 10) || 0;
    const isLate = startHour >= 17;
    return {
        cls: isLate ? 'shift-late' : 'shift-early',
        shortLabel: start,
        fullLabel: `${start} - ${end}`
    };
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
        renderCurrentView();
    }
}

// ==================== AUTH ====================
let loginInFlight = false; // chặn bấm/submit trùng lặp khi đang xử lý đăng nhập

function showLoginError(msg) {
    const errorBox = document.getElementById('loginError');
    document.getElementById('loginErrorText').textContent = msg;
    errorBox.style.display = 'flex';
}

function hideLoginError() {
    document.getElementById('loginError').style.display = 'none';
}

function setLoginLoading(loading) {
    const btn = document.getElementById('loginBtn');
    const icon = document.getElementById('loginBtnIcon');
    const text = document.getElementById('loginBtnText');
    btn.disabled = loading;
    if (loading) {
        icon.className = 'fas fa-spinner fa-spin';
        text.textContent = currentLang === 'ja' ? 'ログイン中...' : '登录中...';
    } else {
        icon.className = 'fas fa-right-to-bracket';
        text.innerHTML = '<span data-lang="ja">ログイン</span><span data-lang="zh">登录</span>';
        applyLangVisibility();
    }
}

// Dùng chung cho cả ô mật khẩu ở màn đăng nhập lẫn 3 ô trong modal đổi mật khẩu.
// btnRef có thể là id (string) hoặc chính phần tử <button> (this) tuỳ nơi gọi.
function togglePasswordVisibility(inputId, btnRef) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const btn = (typeof btnRef === 'string') ? document.getElementById(btnRef) : btnRef;
    const icon = btn ? btn.querySelector('i') : null;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    if (icon) icon.className = showing ? 'fas fa-eye' : 'fas fa-eye-slash';
}

function loginErrorMessage(error) {
    const code = error && error.code;
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        return currentLang === 'ja' ? 'IDまたはパスワードが正しくありません' : '账号或密码不正确';
    }
    if (code === 'auth/too-many-requests') {
        return currentLang === 'ja' ? '試行回数が多すぎます。しばらくしてからもう一度お試しください' : '尝试次数过多，请稍后再试';
    }
    if (code === 'auth/network-request-failed') {
        return currentLang === 'ja' ? 'ネットワークに接続できません。通信状態をご確認ください' : '网络连接失败，请检查网络后重试';
    }
    if (code === 'auth/user-disabled') {
        return currentLang === 'ja' ? 'このアカウントは無効化されています。店長にお問い合わせください' : '该账号已被停用，请联系店长';
    }
    return currentLang === 'ja' ? 'ログインできませんでした。もう一度お試しください' : '登录失败，请重试';
}

function doLogin() {
    if (loginInFlight) return; // đang xử lý lần trước, bỏ qua các lần bấm/Enter thêm

    const rawId = document.getElementById('loginId').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    hideLoginError();

    if (!rawId || !password) {
        showLoginError(currentLang === 'ja' ? 'IDとパスワードを入力してください' : '请输入账号和密码');
        return;
    }

    loginInFlight = true;
    setLoginLoading(true);

    // Nhân viên chỉ cần nhập ID (VD: KAJICHO01). ID này có thể đang trỏ tới 1 email kỹ thuật
    // đã được "phát hành lại" (sau khi admin bấm nút cấp mật khẩu mới, HOẶC sau khi chính
    // nhân viên tự đổi mật khẩu - vẫn cùng 1 tài khoản nên email không đổi) - tra cứu
    // loginIndex trước để lấy đúng email hiện tại; nếu không có trong index (tài khoản tạo
    // lần đầu, chưa từng đổi) thì dùng luôn mẫu email cơ bản. Nếu ID đã có dạng email đầy đủ
    // (tài khoản cũ tạo trước khi có tính năng ID cố định) thì giữ nguyên, không tra cứu.
    const basePattern = rawId.includes('@') ? rawId : `${rawId.toLowerCase()}${STAFF_LOGIN_DOMAIN}`;
    const lookupPromise = rawId.includes('@')
        ? Promise.resolve(null)
        : window.database.ref(`loginIndex/${rawId.toUpperCase()}`).once('value')
            .then(snap => snap.val())
            .catch(() => null); // không đọc được (chưa cấu hình rule, hoặc chưa có entry) -> dùng fallback

    lookupPromise.then(indexedEmail => {
        const email = indexedEmail || basePattern;

        return window.auth.signInWithEmailAndPassword(email, password)
        .catch(error => {
            showLoginError(loginErrorMessage(error));
        });
    })
    .catch(error => {
        // Lỗi ở chính bước tra cứu loginIndex (hiếm, ví dụ mất mạng giữa chừng)
        showLoginError(loginErrorMessage(error));
    })
    .finally(() => {
        loginInFlight = false;
        setLoginLoading(false);
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
        currentMonthOffset = 0;
        currentView = 'week';
        document.querySelectorAll('.staff-view-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === 'week'));
        document.getElementById('weekView').style.display = 'block';
        document.getElementById('monthView').style.display = 'none';
        renderCurrentView();
    })
    .catch(error => {
        showToast((currentLang === 'ja' ? '読み込みエラー: ' : '加载错误: ') + error.message, 'error');
    });
}

function renderTopbar() {
    document.getElementById('topbarName').textContent = currentEmployee.name;
    document.getElementById('topbarPosition').textContent = positionLabel(currentEmployee.position);
}

// ==================== VIEW SWITCH (週 / 月) ====================
function switchScheduleView(view) {
    currentView = view;
    document.querySelectorAll('.staff-view-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });
    document.getElementById('weekView').style.display = (view === 'week') ? 'block' : 'none';
    document.getElementById('monthView').style.display = (view === 'month') ? 'block' : 'none';
    renderCurrentView();
}

function changeStaffPeriod(delta) {
    if (currentView === 'week') {
        currentWeekOffset += delta;
    } else {
        currentMonthOffset += delta;
    }
    renderCurrentView();
}

function renderCurrentView() {
    if (currentView === 'week') {
        renderWeekView();
    } else {
        renderMonthView();
    }
}

// ==================== WEEK VIEW ====================
function renderWeekView() {
    if (!currentEmployee) return;
    const { startDate } = getWeekDates(currentWeekOffset);
    const days = generateWeekDays(startDate);

    document.getElementById('periodLabel').textContent = `${formatDate(days[0].dateString)} - ${formatDate(days[6].dateString)}`;

    const startStr = days[0].dateString;
    const endStr = days[6].dateString;

    window.database.ref('schedules').orderByChild('employeeId').equalTo(currentEmployee.id).once('value')
    .then(snapshot => {
        const data = snapshot.val() || {};
        const weekSchedules = Object.values(data).filter(s => s.date >= startStr && s.date <= endStr);

        const list = document.getElementById('weekView');
        list.innerHTML = days.map(day => {
            const schedule = weekSchedules.find(s => s.date === day.dateString);
            const dow = currentLang === 'ja' ? day.dowJa : day.dowZh;
            const info = getShiftInfo(schedule);
            const subText = (schedule && !schedule.isDayOff) ? positionLabel(schedule.employeePosition || currentEmployee.position) : '';

            return `
                <div class="staff-day-row ${day.isToday ? 'today' : info.cls}">
                    <div class="staff-day-date">
                        <div class="dow">${dow}</div>
                        <div class="num">${day.date}</div>
                    </div>
                    <div class="staff-day-info">
                        <div class="staff-day-status ${info.cls}">${info.fullLabel}</div>
                        ${subText ? `<div class="staff-day-sub">${subText}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    })
    .catch(error => {
        showToast((currentLang === 'ja' ? '読み込みエラー: ' : '加载错误: ') + error.message, 'error');
    });
}

// ==================== MONTH VIEW ====================
function renderMonthView() {
    if (!currentEmployee) return;
    const { year, month, daysInMonth, firstWeekday } = getMonthInfo(currentMonthOffset);

    document.getElementById('periodLabel').textContent = currentLang === 'ja'
        ? `${year}年${month + 1}月`
        : `${year}年${month + 1}月`;

    const dowJa = ['月', '火', '水', '木', '金', '土', '日'];
    const dowZh = ['一', '二', '三', '四', '五', '六', '日'];
    const dowRow = document.getElementById('monthDowRow');
    dowRow.innerHTML = (currentLang === 'ja' ? dowJa : dowZh).map(d => `<div>${d}</div>`).join('');

    const startStr = toDateString(new Date(year, month, 1));
    const endStr = toDateString(new Date(year, month, daysInMonth));
    const todayStr = toDateString(new Date());

    window.database.ref('schedules').orderByChild('employeeId').equalTo(currentEmployee.id).once('value')
    .then(snapshot => {
        const data = snapshot.val() || {};
        const monthSchedules = Object.values(data).filter(s => s.date >= startStr && s.date <= endStr);

        const cells = [];
        for (let i = 0; i < firstWeekday; i++) {
            cells.push('<div class="staff-month-cell empty"></div>');
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const dateString = toDateString(new Date(year, month, day));
            const schedule = monthSchedules.find(s => s.date === dateString);
            const info = getShiftInfo(schedule);
            const isToday = dateString === todayStr;
            cells.push(`
                <div class="staff-month-cell ${info.cls} ${isToday ? 'today' : ''}">
                    <div class="cell-num">${day}</div>
                    ${info.shortLabel ? `<div class="cell-time">${info.shortLabel}</div>` : ''}
                </div>
            `);
        }

        document.getElementById('monthGrid').innerHTML = cells.join('');
    })
    .catch(error => {
        showToast((currentLang === 'ja' ? '読み込みエラー: ' : '加载错误: ') + error.message, 'error');
    });
}

// ==================== ĐỔI MẬT KHẨU (tự phục vụ, nhân viên tự đổi nếu muốn) ====================
function showPwError(msg) {
    const box = document.getElementById('pwError');
    document.getElementById('pwErrorText').textContent = msg;
    box.style.display = 'flex';
}

function hidePwError() {
    document.getElementById('pwError').style.display = 'none';
}

function openChangePasswordModal() {
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmNewPassword').value = '';
    hidePwError();
    openStaffModal('changePasswordModal');
}

function changePasswordErrorMessage(error) {
    const code = error && error.code;
    if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        return currentLang === 'ja' ? '現在のパスワードが正しくありません' : '当前密码不正确';
    }
    if (code === 'auth/too-many-requests') {
        return currentLang === 'ja' ? '試行回数が多すぎます。しばらくしてからもう一度お試しください' : '尝试次数过多，请稍后再试';
    }
    if (code === 'auth/network-request-failed') {
        return currentLang === 'ja' ? 'ネットワークに接続できません' : '网络连接失败';
    }
    if (code === 'auth/weak-password') {
        return currentLang === 'ja' ? 'パスワードは6文字以上にしてください' : '密码至少需要6位';
    }
    return currentLang === 'ja' ? '変更に失敗しました。もう一度お試しください' : '修改失败，请重试';
}

function doChangeMyPassword() {
    hidePwError();
    const current = document.getElementById('currentPassword').value.trim();
    const next = document.getElementById('newPassword').value.trim();
    const confirmNext = document.getElementById('confirmNewPassword').value.trim();

    if (!current || !next || !confirmNext) {
        showPwError(currentLang === 'ja' ? 'すべて入力してください' : '请填写所有栏位');
        return;
    }
    if (next.length < 6) {
        showPwError(currentLang === 'ja' ? '新しいパスワードは6文字以上にしてください' : '新密码至少需要6位');
        return;
    }
    if (next !== confirmNext) {
        showPwError(currentLang === 'ja' ? '新しいパスワードが一致しません' : '两次输入的新密码不一致');
        return;
    }
    if (!currentEmployee || !currentEmployee.loginEmail || !window.auth.currentUser) {
        showPwError(currentLang === 'ja' ? 'エラーが発生しました。再ログインしてください' : '发生错误，请重新登录');
        return;
    }

    const btn = document.getElementById('changePwBtn');
    btn.disabled = true;
    btn.style.opacity = '0.7';

    // Firebase yêu cầu xác thực lại (reauthenticate) trước khi cho phép tự đổi mật khẩu của
    // chính mình, để đảm bảo đúng là chủ tài khoản đang thao tác (không chỉ dựa vào phiên
    // đăng nhập cũ còn hiệu lực).
    const credential = firebase.auth.EmailAuthProvider.credential(currentEmployee.loginEmail, current);
    window.auth.currentUser.reauthenticateWithCredential(credential)
    .then(() => window.auth.currentUser.updatePassword(next))
    .then(() => {
        showToast(currentLang === 'ja' ? 'パスワードを変更しました' : '密码已修改', 'success');
        closeStaffModal('changePasswordModal');
    })
    .catch(error => {
        showPwError(changePasswordErrorMessage(error));
    })
    .finally(() => {
        btn.disabled = false;
        btn.style.opacity = '';
    });
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', () => {
    applyLangVisibility();

    // Cho phép bấm Enter (hoặc nút "Go/Done" trên bàn phím điện thoại) để đăng nhập,
    // thay vì bắt buộc phải chạm vào nút "ログイン" - trước đây do không có <form> nên
    // Enter không có tác dụng gì cả.
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            doLogin();
        });
    }

    // Tự động focus vào ô ID khi vừa vào trang để nhân viên gõ được ngay
    const idInput = document.getElementById('loginId');
    if (idInput) idInput.focus();
});
