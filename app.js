// ==================== GLOBAL VARIABLES ====================
let employees = [];
let schedules = {};
let changeRequests = {}; // yêu cầu đổi lịch do nhân viên gửi từ trang staff.html
let currentWeek = 0;
let selectedEmployee = null;
let selectedPosition = '前台/服务区';
let currentPositionFilter = 'all';
let currentLanguage = 'ja';
let quickEditEmployeeId = null; // nhân viên đang được sửa nhanh vị trí (职种)
let dragEmployeeId = null; // nhân viên đang được kéo (drag & drop đổi vị trí)

// ==================== TÀI KHOẢN NHÂN VIÊN: mẫu ID cố định + mật khẩu tự sinh ====================
// ID đăng nhập của nhân viên có dạng cố định "KAJICHO01", "KAJICHO02"... (không cần nhập email thật).
// Vì Firebase Auth (client) bắt buộc định dạng email, hệ thống tự ghép thêm 1 domain giả cố định
// ở phía sau khi tạo/đăng nhập tài khoản - nhân viên không cần biết tới domain giả này.
const STAFF_ACCOUNT_PREFIX = 'KAJICHO';
const STAFF_LOGIN_DOMAIN = '@kajicho-staff.local';
let pendingStaffAccount = null; // { username, password } - bộ ID/mật khẩu vừa sinh, chưa bấm "tạo" thì chưa lưu vào DB

// ==================== POSITIONS CONFIG ====================
// Danh sách vị trí (职种) dùng chung cho toàn bộ app. Thêm vị trí mới chỉ cần
// thêm 1 phần tử vào đây - toàn bộ UI (filter, card nhóm, lịch tuần, thống kê...)
// sẽ tự động cập nhật theo.
const POSITIONS = [
    { key: '前台/服务区', ja: 'フロント', zh: '前台', icon: 'fa-door-open', cls: 'front-desk', color: 'info' },
    { key: '厨房区', ja: '厨房', zh: '厨房', icon: 'fa-utensils', cls: 'kitchen', color: 'warning' },
    { key: '拉客', ja: '拉客', zh: '拉客', icon: 'fa-bullhorn', cls: 'tout', color: 'secondary' }
];

function getPositionInfo(positionKey) {
    return POSITIONS.find(p => p.key === positionKey) || POSITIONS[0];
}

function positionLabel(positionKey) {
    const info = getPositionInfo(positionKey);
    return currentLanguage === 'ja' ? info.ja : info.zh;
}

function positionIcon(positionKey) {
    return getPositionInfo(positionKey).icon;
}

function positionCssClass(positionKey) {
    return getPositionInfo(positionKey).cls;
}

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 鍛治町酒場 神田店 勤務表システム起動");
    
    // Load language
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage) {
        currentLanguage = savedLanguage;
    }
    
    // Trang chính giờ được bảo vệ bằng đăng nhập admin (Firebase Auth). Chỉ khi xác thực
    // xong VÀ đúng quyền admin thì startApp() mới thực sự chạy (xem initAdminAuthGate()).
    initAdminAuthGate();

    // Cho phép bấm Enter để submit form đăng nhập/tạo tài khoản admin, thay vì bắt buộc
    // phải bấm chuột vào nút (trước đây các nút này là type="button" ngoài <form> nên Enter
    // không có tác dụng gì).
    const gateSetupForm = document.getElementById('gateSetupForm');
    if (gateSetupForm) gateSetupForm.addEventListener('submit', e => { e.preventDefault(); adminSetupSubmit(); });
    const gateLoginForm = document.getElementById('gateLoginForm');
    if (gateLoginForm) gateLoginForm.addEventListener('submit', e => { e.preventDefault(); adminLoginSubmit(); });
});

// Hiện/ẩn mật khẩu trong các ô của cổng đăng nhập admin
function toggleGatePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector('i');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    icon.className = showing ? 'fas fa-eye' : 'fas fa-eye-slash';
}

// Bật/tắt trạng thái loading cho nút submit của cổng đăng nhập admin (disable + spinner)
function setGateButtonLoading(btnId, iconId, textId, loading, loadingLabelJa, loadingLabelZh, idleHtml, idleIconClass) {
    const btn = document.getElementById(btnId);
    const icon = document.getElementById(iconId);
    const text = document.getElementById(textId);
    if (!btn || !icon || !text) return;
    btn.disabled = loading;
    if (loading) {
        icon.className = 'fas fa-spinner fa-spin';
        text.textContent = currentLanguage === 'ja' ? loadingLabelJa : loadingLabelZh;
    } else {
        icon.className = idleIconClass;
        text.innerHTML = idleHtml;
        applyLanguageToElement(text);
    }
}

// Diễn giải lỗi Firebase Auth dùng chung cho các form đăng nhập/tạo tài khoản admin,
// để không hiển thị thẳng thông báo lỗi tiếng Anh gốc của Firebase cho người dùng.
function friendlyAuthErrorMessage(error) {
    const code = error && error.code;
    if (code === 'auth/too-many-requests') {
        return currentLanguage === 'ja' ? '試行回数が多すぎます。しばらくしてからもう一度お試しください' : '尝试次数过多，请稍后再试';
    }
    if (code === 'auth/network-request-failed') {
        return currentLanguage === 'ja' ? 'ネットワークに接続できません。通信状態をご確認ください' : '网络连接失败，请检查网络后重试';
    }
    if (code === 'auth/user-disabled') {
        return currentLanguage === 'ja' ? 'このアカウントは無効化されています' : '该账号已被停用';
    }
    return null; // không match case đặc biệt nào -> để hàm gọi tự xử lý message riêng
}

let appStarted = false;
function startApp() {
    if (appStarted) return; // tránh load 2 lần nếu onAuthStateChanged bắn lại
    appStarted = true;
    
    // Initialize the app
    initApp();
    
    // Load data
    loadEmployees();
    loadSchedules();
    loadChangeRequests();
    
    // Set up event listeners
    setupEventListeners();
    
    // Tự động làm mới hiển thị "tổng số người đang làm hôm nay" + trạng thái "đã tan làm"
    // mỗi phút một lần, vì 2 thông tin này phụ thuộc vào giờ thực tế chứ không phải sự kiện
    // từ database (không đổi giờ thì sẽ không có tín hiệu nào báo re-render cả).
    setInterval(() => {
        renderWeeklySchedule();
        const todayModal = document.getElementById('todayModal');
        if (todayModal && todayModal.style.display === 'flex') {
            showTodaySchedule();
        }
    }, 60 * 1000);
    
    console.log("✅ アプリ初期化完了");
}

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

// ==================== ADMIN AUTH GATE (bảo vệ trang chính bằng đăng nhập) ====================
function showGatePanel(panel) {
    ['gateChecking', 'gateSetup', 'gateLogin', 'gateDenied'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === panel) ? 'block' : 'none';
    });
}

function initAdminAuthGate() {
    if (!window.auth || !window.database) {
        // Lỗi cấu hình Firebase thì vẫn cho vào để không khoá cứng người dùng khi có sự cố kỹ thuật
        console.error("Auth/Database chưa sẵn sàng - bỏ qua cổng đăng nhập admin");
        document.getElementById('adminAuthGate').style.display = 'none';
        document.getElementById('mainApp').style.display = 'flex';
        startApp();
        return;
    }
    
    window.auth.onAuthStateChanged(user => {
        if (user) {
            window.database.ref(`admins/${user.uid}`).once('value').then(snap => {
                if (snap.exists()) {
                    document.getElementById('adminAuthGate').style.display = 'none';
                    document.getElementById('mainApp').style.display = 'flex';
                    startApp();
                } else {
                    document.getElementById('mainApp').style.display = 'none';
                    document.getElementById('adminAuthGate').style.display = 'flex';
                    showGatePanel('gateDenied');
                }
            }).catch(error => {
                console.error("Admin check error:", error);
                showGatePanel('gateDenied');
            });
        } else {
            document.getElementById('mainApp').style.display = 'none';
            document.getElementById('adminAuthGate').style.display = 'flex';
            // Chưa đăng nhập -> kiểm tra đã từng có admin nào được tạo chưa để quyết định
            // hiện màn hình "tạo admin đầu tiên" hay màn hình đăng nhập bình thường.
            window.database.ref('admins').once('value').then(snap => {
                const hasAdmins = snap.exists() && Object.keys(snap.val() || {}).length > 0;
                showGatePanel(hasAdmins ? 'gateLogin' : 'gateSetup');
            }).catch(error => {
                console.error("Admins list check error:", error);
                showGatePanel('gateLogin');
            });
        }
    });
}

let gateSetupInFlight = false;
function adminSetupSubmit() {
    if (gateSetupInFlight) return;
    const email = document.getElementById('setupEmail').value.trim();
    const password = document.getElementById('setupPassword').value.trim();
    const confirmPassword = document.getElementById('setupPasswordConfirm').value.trim();
    const errorBox = document.getElementById('setupError');
    errorBox.style.display = 'none';
    
    if (!email || !password) {
        errorBox.textContent = currentLanguage === 'ja' ? 'メールとパスワードを入力してください' : '请输入邮箱和密码';
        errorBox.style.display = 'block';
        return;
    }
    if (password.length < 6) {
        errorBox.textContent = currentLanguage === 'ja' ? 'パスワードは6文字以上にしてください' : '密码至少需要6位';
        errorBox.style.display = 'block';
        return;
    }
    if (password !== confirmPassword) {
        errorBox.textContent = currentLanguage === 'ja' ? 'パスワードが一致しません' : '两次密码不一致';
        errorBox.style.display = 'block';
        return;
    }
    
    gateSetupInFlight = true;
    setGateButtonLoading('setupSubmitBtn', 'setupSubmitIcon', 'setupSubmitText', true,
        '作成中...', '创建中...',
        '<span data-lang="ja">管理者アカウントを作成</span><span data-lang="zh">创建管理员账号</span>',
        'fas fa-user-shield');

    // Ở bước setup lần đầu chưa có ai đăng nhập cả nên dùng thẳng app chính cũng an toàn
    // (không có phiên nào để làm mất).
    window.auth.createUserWithEmailAndPassword(email, password)
    .then(cred => {
        return window.database.ref(`admins/${cred.user.uid}`).set({ email, createdAt: Date.now() });
    })
    .catch(error => {
        let msg = friendlyAuthErrorMessage(error);
        if (!msg) {
            if (error.code === 'auth/email-already-in-use') {
                msg = currentLanguage === 'ja' ? 'このメールは既に使われています' : '该邮箱已被使用';
            } else if (error.code === 'auth/weak-password') {
                msg = currentLanguage === 'ja' ? 'パスワードが弱すぎます' : '密码强度不够';
            } else if (error.code === 'auth/invalid-email') {
                msg = currentLanguage === 'ja' ? 'メールアドレスの形式が正しくありません' : '邮箱格式不正确';
            } else {
                msg = error.message;
            }
        }
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    })
    .finally(() => {
        gateSetupInFlight = false;
        setGateButtonLoading('setupSubmitBtn', 'setupSubmitIcon', 'setupSubmitText', false,
            '', '',
            '<span data-lang="ja">管理者アカウントを作成</span><span data-lang="zh">创建管理员账号</span>',
            'fas fa-user-shield');
    });
}

let gateLoginInFlight = false;
function adminLoginSubmit() {
    if (gateLoginInFlight) return;
    const email = document.getElementById('gateEmail').value.trim();
    const password = document.getElementById('gatePassword').value.trim();
    const errorBox = document.getElementById('loginGateError');
    errorBox.style.display = 'none';
    
    if (!email || !password) {
        errorBox.textContent = currentLanguage === 'ja' ? 'メールとパスワードを入力してください' : '请输入邮箱和密码';
        errorBox.style.display = 'block';
        return;
    }
    
    gateLoginInFlight = true;
    setGateButtonLoading('gateLoginBtn', 'gateLoginIcon', 'gateLoginText', true,
        'ログイン中...', '登录中...',
        '<span data-lang="ja">ログイン</span><span data-lang="zh">登录</span>',
        'fas fa-right-to-bracket');

    window.auth.signInWithEmailAndPassword(email, password)
    .catch(error => {
        let msg = friendlyAuthErrorMessage(error);
        if (!msg) {
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                msg = currentLanguage === 'ja' ? 'メールまたはパスワードが正しくありません' : '邮箱或密码不正确';
            } else {
                msg = error.message;
            }
        }
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    })
    .finally(() => {
        gateLoginInFlight = false;
        setGateButtonLoading('gateLoginBtn', 'gateLoginIcon', 'gateLoginText', false,
            '', '',
            '<span data-lang="ja">ログイン</span><span data-lang="zh">登录</span>',
            'fas fa-right-to-bracket');
    });
}

function adminForgotPassword() {
    const email = document.getElementById('gateEmail').value.trim();
    const errorBox = document.getElementById('loginGateError');
    
    if (!email) {
        errorBox.style.background = '';
        errorBox.style.color = '';
        errorBox.textContent = currentLanguage === 'ja' ? '先にメールアドレスを入力してください' : '请先输入邮箱';
        errorBox.style.display = 'block';
        return;
    }
    
    window.auth.sendPasswordResetEmail(email)
    .then(() => {
        errorBox.style.background = 'var(--success-light)';
        errorBox.style.color = 'var(--success)';
        errorBox.textContent = currentLanguage === 'ja' 
            ? 'パスワード再設定メールを送信しました。メールをご確認ください。' 
            : '密码重置邮件已发送，请查收邮箱。';
        errorBox.style.display = 'block';
    })
    .catch(error => {
        errorBox.style.background = '';
        errorBox.style.color = '';
        let msg = friendlyAuthErrorMessage(error);
        if (!msg) {
            msg = (error.code === 'auth/user-not-found')
                ? (currentLanguage === 'ja' ? '送信失敗: そのメールの登録がありません' : '发送失败：该邮箱未注册')
                : (currentLanguage === 'ja' ? '送信失敗: メールアドレスの形式を確認してください' : '发送失败：请检查邮箱格式');
        }
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    });
}

// ==================== QUẢN LÝ ADMIN (thêm quản trị viên khác) ====================
function showAdminManageModal() {
    const listEl = document.getElementById('adminList');
    const errorEl = document.getElementById('addAdminError');
    if (errorEl) errorEl.style.display = 'none';
    
    if (listEl) {
        listEl.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
        window.database.ref('admins').once('value').then(snap => {
            const data = snap.val() || {};
            const admins = Object.values(data);
            listEl.innerHTML = admins.length === 0 
                ? `<div style="color: var(--gray-400); font-size:13px;">-</div>`
                : admins.map(a => `
                    <div style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom: 1px solid var(--border);">
                        <i class="fas fa-user-shield" style="color: var(--primary);"></i>
                        <span style="font-size:13px; color: var(--dark);">${a.email}</span>
                    </div>
                `).join('');
        });
    }
    
    openModal('adminManageModal');
}

function addNewAdmin() {
    const email = document.getElementById('newAdminEmail').value.trim();
    const password = document.getElementById('newAdminPassword').value;
    const errorBox = document.getElementById('addAdminError');
    errorBox.style.display = 'none';
    
    if (!email || !password) {
        errorBox.textContent = currentLanguage === 'ja' ? 'メールとパスワードを入力してください' : '请输入邮箱和密码';
        errorBox.style.display = 'block';
        return;
    }
    if (password.length < 6) {
        errorBox.textContent = currentLanguage === 'ja' ? 'パスワードは6文字以上にしてください' : '密码至少需要6位';
        errorBox.style.display = 'block';
        return;
    }
    if (!window.secondaryApp) {
        errorBox.textContent = currentLanguage === 'ja' ? 'システムエラー' : '系统错误';
        errorBox.style.display = 'block';
        return;
    }
    
    // Dùng app phụ để tạo tài khoản admin mới, tránh làm mất phiên đăng nhập admin hiện tại
    window.secondaryApp.auth().createUserWithEmailAndPassword(email, password)
    .then(cred => {
        const uid = cred.user.uid;
        return window.secondaryApp.auth().signOut().then(() => uid);
    })
    .then(uid => window.database.ref(`admins/${uid}`).set({ email, createdAt: Date.now() }))
    .then(() => {
        showMessage(currentLanguage === 'ja' ? '管理者を追加しました' : '管理员添加成功', 'success');
        document.getElementById('newAdminEmail').value = '';
        document.getElementById('newAdminPassword').value = '';
        showAdminManageModal();
    })
    .catch(error => {
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') {
            msg = currentLanguage === 'ja' ? 'このメールは既に使われています' : '该邮箱已被使用';
        }
        errorBox.textContent = msg;
        errorBox.style.display = 'block';
    });
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
    if (modalId === 'accountModal') {
        pendingStaffAccount = null;
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

// ==================== HOURS ROUNDING HELPER ====================
// Dùng chung cho MỌI nơi hiển thị số giờ, để tránh lỗi cộng dồn số thực
// (floating point) gây ra các số lẻ dài kiểu 146.22222222h
function roundHours(value, decimals = 1) {
    if (typeof value !== 'number' || !isFinite(value)) return 0;
    const factor = Math.pow(10, decimals);
    let rounded = Math.round((value + Number.EPSILON) * factor) / factor;
    if (Object.is(rounded, -0)) rounded = 0;
    return rounded;
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
    return roundHours(workHours, 2);
}

// ==================== PHÂN LOẠI CA LÀM: 早班 (trước 17h) / 晚班 (từ 17h) ====================
// Dựa trên giờ bắt đầu ca: bắt đầu trước 17:00 -> 早班 (ca sớm), từ 17:00 trở đi -> 晚班 (ca muộn)
function getShiftPeriod(startTime) {
    if (!startTime) return '';
    const hour = parseInt(startTime.split(':')[0], 10);
    if (isNaN(hour)) return '';
    return hour < 17 ? 'early' : 'late';
}

function shiftPeriodLabel(startTime) {
    const period = getShiftPeriod(startTime);
    if (period === 'early') return currentLanguage === 'ja' ? '早班' : '早班';
    if (period === 'late') return currentLanguage === 'ja' ? '晚班' : '晚班';
    return '';
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
        renderWeeklySchedule();
    }, (error) => {
        console.error("Error loading employees:", error);
        showMessage(`${currentLanguage === 'ja' ? 'スタッフデータの読み込みエラー' : '加载员工数据错误'}: ${error.code || error.message || error}`, "error");
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
    
    let html = '';
    
    POSITIONS.forEach(pos => {
        // Luôn vẽ nhóm (kể cả rỗng) khi không lọc/tìm kiếm, để luôn có chỗ kéo-thả (drag & drop) vào
        const groupEmployees = filteredEmployees.filter(emp => emp.position === pos.key);
        if (groupEmployees.length === 0 && (searchTerm || currentPositionFilter !== 'all')) return;
        
        const title = positionLabel(pos.key);
        html += `
            <div class="position-group">
                <h3 class="position-title" style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--${pos.color});">
                    <i class="fas ${pos.icon}"></i> ${title}
                    <span class="position-count" style="font-size: 12px; background: var(--${pos.color}-light); color: var(--${pos.color}); padding: 2px 8px; border-radius: 12px;">${groupEmployees.length}</span>
                </h3>
                <div class="position-cards drop-zone" data-position="${pos.key}"
                     ondragover="handlePositionDragOver(event)"
                     ondragleave="handlePositionDragLeave(event)"
                     ondrop="handlePositionDrop(event, '${pos.key}')">
                    ${groupEmployees.map(emp => generateEmployeeCard(emp)).join('') || `<div class="drop-zone-hint">${currentLanguage === 'ja' ? 'ここにドラッグして異動' : '拖到这里调岗'}</div>`}
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Trả về mảng 7 phần tử mô tả trạng thái từng ngày trong tuần của 1 nhân viên
// status: 'work' | 'rest' | 'none'
// Đếm số người đang làm việc (không tính nghỉ) ở Front-desk và Bếp trong 1 ngày cụ thể
// ==================== TRẠNG THÁI "ĐANG LÀM / ĐÃ TAN LÀM" (chỉ áp dụng cho hôm nay, theo giờ thực) ====================
function todayDateString() {
    return new Date().toISOString().split('T')[0];
}

function timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

// Ca có đang trong khoảng giờ làm việc TẠI THỜI ĐIỂM HIỆN TẠI hay không (dùng để biết ai
// còn đang làm / ai đã tan làm). "00:00" ở giờ kết thúc được hiểu là nửa đêm (hết ngày,
// tức 24:00), không phải đầu ngày.
function isScheduleCurrentlyActive(schedule) {
    if (!schedule || schedule.isDayOff) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(schedule.startTime);
    let endMinutes = timeToMinutes(schedule.endTime);
    if (startMinutes === null || endMinutes === null) return true; // thiếu giờ thì coi như vẫn tính (an toàn)
    if (endMinutes <= startMinutes) endMinutes += 24 * 60; // ca qua đêm (VD 17:00 - 00:00)
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
}

// Ca của hôm nay đã kết thúc (tan làm) hay chưa - dùng để hiển thị nhãn "退勤済み"
function hasScheduleEnded(schedule) {
    if (!schedule || schedule.isDayOff) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(schedule.startTime);
    let endMinutes = timeToMinutes(schedule.endTime);
    if (startMinutes === null || endMinutes === null) return false;
    if (endMinutes <= startMinutes) endMinutes += 24 * 60;
    return nowMinutes >= endMinutes;
}

function getDayHeadcount(dateString) {
    const result = {};
    POSITIONS.forEach(pos => { result[pos.key] = 0; });
    if (!schedules || typeof schedules !== 'object') return result;
    
    const isToday = dateString === todayDateString();
    
    Object.values(schedules).forEach(s => {
        if (!s || s.date !== dateString || s.isDayOff) return;
        // Chỉ tính vào tổng theo vị trí những ca 晚班 (bắt đầu từ 17h trở đi).
        // Ca 早班 (trước 17h, từ sáng tới 17h) KHÔNG được tính vào tổng số người/vị trí này,
        // dù vẫn hiển thị bình thường trên lịch tuần (chỉ đổi màu để dễ phân biệt).
        if (getShiftPeriod(s.startTime) !== 'late') return;
        // Với NGÀY HÔM NAY: chỉ tính những người ĐANG trong ca làm tại thời điểm hiện tại
        // (ai đã tan làm rồi thì không tính vào tổng nữa). Ngày khác (quá khứ/tương lai)
        // vẫn giữ nguyên logic đếm cả ngày như cũ.
        // if (isToday && !isScheduleCurrentlyActive(s)) return;
        const key = getPositionInfo(s.employeePosition).key;
        result[key] = (result[key] || 0) + 1;
    });
    
    return result;
}

function getWeekPattern(employeeId, weekOffset = 0) {
    const { startDate } = getWeekDates(weekOffset);
    const endDate = new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
    const weekSchedule = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    const days = generateWeekDays(startDate);
    const employee = employees.find(e => e.id === employeeId);
    const dayLetters = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
    return days.map((day, index) => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        let status = 'none';
        let timeLabel = '';
        let period = '';
        let diffPosition = null;
        if (schedule) {
            status = schedule.isDayOff ? 'rest' : 'work';
            if (!schedule.isDayOff && schedule.startTime && schedule.endTime) {
                timeLabel = `${schedule.startTime.substring(0,5)}-${schedule.endTime.substring(0,5)}`;
                period = getShiftPeriod(schedule.startTime);
                const dayPosition = schedule.employeePosition;
                if (employee && dayPosition && dayPosition !== employee.position) {
                    diffPosition = dayPosition;
                }
            }
        }
        return { letter: dayLetters[index], status, timeLabel, period, diffPosition, dateString: day.dateString };
    });
}

function generateWeekPatternHtml(employeeId, weekOffset = 0) {
    const pattern = getWeekPattern(employeeId, weekOffset);
    return `
        <div class="week-pattern-strip">
            ${pattern.map(day => `
                <div class="week-pattern-dot ${day.status} ${day.period}" title="${day.letter}${day.timeLabel ? ' ' + day.timeLabel : ''}${day.diffPosition ? ' · ' + positionLabel(day.diffPosition) : ''}">
                    <span>${day.letter}</span>
                    ${day.diffPosition ? `<i class="fas ${positionIcon(day.diffPosition)} diff-position-dot"></i>` : ''}
                </div>
            `).join('')}
        </div>
    `;
}

function generateEmployeeCard(employee) {
    const weeklyHours = calculateWeeklyHours(employee.id);
    const monthlyHours = calculateMonthlyHours(employee.id);
    const weekSchedule = getThisWeekSchedule(employee.id);
    
    const positionDisplay = positionLabel(employee.position);
    
    return `
        <div class="employee-card" draggable="true" data-employee-id="${employee.id}"
             ondragstart="handleEmployeeDragStart(event, '${employee.id}')"
             ondragend="handleEmployeeDragEnd(event)">
            <div class="employee-card-top" onclick="showEmployeeDetail('${employee.id}')">
                <div class="employee-avatar">
                    ${employee.name.charAt(0)}
                </div>
                <div class="employee-info">
                    <div class="employee-name">${employee.name}</div>
                    <div class="employee-position ${positionCssClass(employee.position)}">
                        <i class="fas ${positionIcon(employee.position)}"></i>
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
            ${generateWeekPatternHtml(employee.id, 0)}
            <div class="employee-card-actions">
                <button type="button" class="card-action-btn" onclick="quickAddScheduleFor('${employee.id}')" title="${currentLanguage === 'ja' ? 'クイック登録' : '快速排班'}">
                    <i class="fas fa-calendar-plus"></i>
                    <span>${currentLanguage === 'ja' ? 'クイック登録' : '快速排班'}</span>
                </button>
                <button type="button" class="card-action-btn" onclick="copyScheduleAsText('${employee.id}')" title="${currentLanguage === 'ja' ? 'コピー' : '复制'}">
                    <i class="fas fa-copy"></i>
                    <span>${currentLanguage === 'ja' ? 'コピー' : '复制'}</span>
                </button>
                <button type="button" class="card-action-btn" onclick="showQuickPositionEdit('${employee.id}')" title="${currentLanguage === 'ja' ? '職種変更' : '更改职位'}">
                    <i class="fas fa-random"></i>
                    <span>${currentLanguage === 'ja' ? '職種変更' : '更改职位'}</span>
                </button>
                <button type="button" class="card-action-btn" onclick="copyEmployeeWeekToNextWeek('${employee.id}')" title="${currentLanguage === 'ja' ? '来週へコピー' : '复制到下周'}">
                    <i class="fas fa-calendar-plus"></i>
                    <span>${currentLanguage === 'ja' ? '来週へコピー' : '复制到下周'}</span>
                </button>
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
    
    const filterBtn = document.querySelector(`.filter-btn[data-position="${position}"]`);
    
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
        modalEmployeePosition.textContent = positionLabel(employee.position);
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
            timeText = schedule.isDayOff ? `
                <div style="font-size: 11px; margin-top: 4px; font-weight: 600; color: var(--warning);">
                    ${currentLanguage === 'ja' ? '休み' : '休息'}
                </div>
            ` : `
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

// Sửa nhanh: nhảy thẳng sang tab "Đăng ký ca" (シフト登録) với nhân viên đã chọn sẵn,
// không cần mở modal chi tiết rồi mới bấm "編集"
function quickAddScheduleFor(employeeId) {
    switchView('schedule');
    setTimeout(() => {
        const select = document.getElementById('scheduleEmployee');
        if (select) select.value = employeeId;
        const dateInput = document.getElementById('scheduleDate');
        if (dateInput) dateInput.focus();
    }, 60);
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
        showMessage((currentLanguage === 'ja' ? '追加失敗: ' : '添加失败: ') + error.message, 'error');
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
        showMessage((currentLanguage === 'ja' ? '削除失敗: ' : '删除失败: ') + error.message, 'error');
    });
}

// ==================== QUICK POSITION CHANGE (職種変更) ====================
function showQuickPositionEdit(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    quickEditEmployeeId = employeeId;
    
    const nameEl = document.getElementById('quickPositionEmployeeName');
    if (nameEl) nameEl.textContent = employee.name;
    
    const container = document.getElementById('quickPositionOptions');
    if (container) {
        container.innerHTML = POSITIONS.map(pos => `
            <button type="button" class="position-option ${employee.position === pos.key ? 'active' : ''}" 
                    onclick="changeEmployeePosition('${employeeId}', '${pos.key}')">
                <i class="fas ${pos.icon}"></i>
                <span>${positionLabel(pos.key)}</span>
            </button>
        `).join('');
    }
    
    openModal('quickPositionModal');
}

function changeEmployeePosition(employeeId, newPosition) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    if (employee.position === newPosition) {
        closeModal('quickPositionModal');
        return;
    }
    
    // Lưu ý: chỉ đổi vị trí MẶC ĐỊNH (職種) của nhân viên cho các ca làm mới sau này.
    // KHÔNG ghi đè lên employeePosition của những ca làm đã có sẵn trong lịch, vì mỗi
    // ngày có thể đã được set vị trí làm việc riêng khác với vị trí mặc định (xem
    // saveDaySchedule / editShiftPosition) - ví dụ nhân viên A làm 厨房 hôm nay nhưng
    // đổi vị trí mặc định sang 拉客 thì lịch cũ vẫn giữ nguyên 厨房 cho đúng thực tế.
    window.database.ref(`employees/${employeeId}`).update({ position: newPosition })
    .then(() => {
        closeModal('quickPositionModal');
        showMessage(currentLanguage === 'ja' ? '職種を変更しました' : '职位已更改', 'success');
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + error.message, 'error');
    });
}

// ==================== DRAG & DROP ĐỔI VỊ TRÍ (職種) ====================
function handleEmployeeDragStart(event, employeeId) {
    dragEmployeeId = employeeId;
    if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        try { event.dataTransfer.setData('text/plain', employeeId); } catch (e) { /* ignore */ }
    }
    const card = event.target.closest ? event.target.closest('.employee-card') : null;
    if (card) card.classList.add('dragging');
}

function handleEmployeeDragEnd() {
    dragEmployeeId = null;
    document.querySelectorAll('.employee-card.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drop-zone.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handlePositionDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
}

function handlePositionDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handlePositionDrop(event, newPosition) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const employeeId = dragEmployeeId || (event.dataTransfer ? event.dataTransfer.getData('text/plain') : null);
    if (!employeeId) return;
    changeEmployeePosition(employeeId, newPosition);
}

// ==================== COPY LỊCH SANG TUẦN SAU ====================
function addDaysToDateString(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + days);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
}

function buildCopiedScheduleData(schedule, targetDate) {
    const data = {
        employeeId: schedule.employeeId,
        employeeName: schedule.employeeName,
        employeePosition: schedule.employeePosition,
        date: targetDate,
        isDayOff: !!schedule.isDayOff,
        startTime: schedule.startTime || '00:00',
        endTime: schedule.endTime || '00:00',
        updatedAt: Date.now()
    };
    if (schedule.notes) data.notes = schedule.notes;
    return data;
}

// Copy toàn bộ ca làm của 1 nhân viên trong tuần đang xem sang tuần kế tiếp
function copyEmployeeWeekToNextWeek(employeeIdParam) {
    const employeeId = employeeIdParam || selectedEmployee;
    if (!employeeId) {
        showMessage(currentLanguage === 'ja' ? 'スタッフを選択してください' : '请先选择员工', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    
    if (weekSchedule.length === 0) {
        showMessage(currentLanguage === 'ja' ? 'コピーするシフトがありません' : '没有可复制的排班', 'warning');
        return;
    }
    
    const confirmMessage = currentLanguage === 'ja' 
        ? `${employee.name} の今週のシフト(${weekSchedule.length}件)を来週にコピーしますか？`
        : `确定要将 ${employee.name} 本周的排班(${weekSchedule.length}条)复制到下周吗？`;
    if (!confirm(confirmMessage)) return;
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    const promises = weekSchedule.map(schedule => {
        const targetDate = addDaysToDateString(schedule.date, 7);
        const scheduleData = buildCopiedScheduleData(schedule, targetDate);
        const existing = findScheduleByEmployeeAndDate(schedule.employeeId, targetDate);
        if (existing) {
            return window.database.ref(`schedules/${existing.id}`).update(scheduleData);
        }
        scheduleData.createdAt = Date.now();
        return window.database.ref('schedules').push().set(scheduleData);
    });
    
    Promise.all(promises)
    .then(() => {
        showMessage(currentLanguage === 'ja' ? '来週にコピーしました' : '已复制到下周', 'success');
        renderWeeklySchedule();
        renderEmployeeCards();
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + error.message, 'error');
    });
}

// Copy toàn bộ lịch của TẤT CẢ nhân viên trong tuần đang xem sang tuần kế tiếp
function copyAllScheduleToNextWeek() {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    
    if (weekSchedule.length === 0) {
        showMessage(currentLanguage === 'ja' ? 'コピーするシフトがありません' : '没有可复制的排班', 'warning');
        return;
    }
    
    const confirmMessage = currentLanguage === 'ja' 
        ? `今週の全スタッフのシフト(${weekSchedule.length}件)を来週にコピーしますか？`
        : `确定要将本周全部员工的排班(${weekSchedule.length}条)复制到下周吗？`;
    if (!confirm(confirmMessage)) return;
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    const promises = weekSchedule.map(schedule => {
        const targetDate = addDaysToDateString(schedule.date, 7);
        const scheduleData = buildCopiedScheduleData(schedule, targetDate);
        const existing = findScheduleByEmployeeAndDate(schedule.employeeId, targetDate);
        if (existing) {
            return window.database.ref(`schedules/${existing.id}`).update(scheduleData);
        }
        scheduleData.createdAt = Date.now();
        return window.database.ref('schedules').push().set(scheduleData);
    });
    
    Promise.all(promises)
    .then(() => {
        showMessage(currentLanguage === 'ja' ? '全スタッフを来週にコピーしました' : '已将全部员工排班复制到下周', 'success');
        renderWeeklySchedule();
        renderEmployeeCards();
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + error.message, 'error');
    });
}

// ==================== TÀI KHOẢN ĐĂNG NHẬP CHO NHÂN VIÊN (Firebase Authentication) ====================
// ID đăng nhập dạng cố định (KAJICHO01, KAJICHO02...) + mật khẩu tự sinh ngẫu nhiên bảo mật,
// admin chỉ cần bấm "コピー" rồi gửi cho nhân viên - không cần tự nghĩ/nhập email hay mật khẩu.
//
// LƯU Ý QUAN TRỌNG: mọi thao tác sinh ID mới / kiểm tra trùng ID đều đọc dữ liệu MỚI NHẤT
// trực tiếp từ Firebase (không dùng biến `employees` trong bộ nhớ), vì biến đó có thể chưa
// kịp đồng bộ nếu admin thao tác nhanh liên tiếp hoặc có nhiều tab/nhiều admin cùng lúc -
// đây chính là nguyên nhân gây trùng ID / tài khoản không đăng nhập được trước đây.
function generateNextStaffUsernameFromList(list) {
    let maxNum = 0;
    const pattern = new RegExp('^' + STAFF_ACCOUNT_PREFIX + '(\\d+)$', 'i');
    (list || []).forEach(e => {
        if (e && e.loginUsername) {
            const m = String(e.loginUsername).match(pattern);
            if (m) {
                const num = parseInt(m[1], 10);
                if (!isNaN(num) && num > maxNum) maxNum = num;
            }
        }
    });
    const next = maxNum + 1;
    const padded = String(next).padStart(2, '0');
    return `${STAFF_ACCOUNT_PREFIX}${padded}`;
}

// (Lưu ý: trước đây có 2 hàm setLoginIndexEntry/clearLoginIndexEntry ghi riêng lẻ vào
// loginIndex - đã gộp vào các lệnh update() đa đường dẫn (atomic) ngay tại nơi sử dụng
// để tránh để lại dữ liệu nửa vời khi Firebase Rules chặn 1 phần của thao tác ghi.)

// Diễn giải lỗi cho toàn bộ luồng tạo/quản lý tài khoản đăng nhập nhân viên, để không hiển
// thị thẳng thông báo kỹ thuật (tiếng Anh, mã lỗi Firebase) cho admin.
function describeAccountError(error) {
    const code = error && error.code;
    const rawMsg = (error && error.message) || '';
    if (code === 'auth/email-already-in-use') {
        return currentLanguage === 'ja'
            ? 'このIDは既に使われています。もう一度お試しください'
            : '该ID已被占用，请重试';
    }
    if (code === 'auth/weak-password') {
        return currentLanguage === 'ja'
            ? 'パスワードが弱すぎます。再生成ボタンでやり直してください'
            : '密码强度不够，请点击重新生成';
    }
    if (code === 'auth/network-request-failed') {
        return currentLanguage === 'ja'
            ? 'ネットワークに接続できません。通信状態をご確認のうえもう一度お試しください'
            : '网络连接失败，请检查网络后重试';
    }
    // Lỗi ghi Realtime Database do Firebase Rules chưa cho phép (thường là node loginIndex
    // chưa được mở quyền đọc/ghi - xem README mục "Lưu ý về Firebase Rules").
    if (code === 'PERMISSION_DENIED' || /permission_denied/i.test(rawMsg)) {
        return currentLanguage === 'ja'
            ? 'データベースの権限エラーです。Firebase Rules で「loginIndex」の読み書きが許可されているかご確認ください(README参照)'
            : '数据库权限错误。请检查 Firebase Rules 是否已开放 "loginIndex" 节点的读写权限(参见 README)';
    }
    return rawMsg || (currentLanguage === 'ja' ? '不明なエラー' : '未知错误');
}

function fetchFreshEmployeesList() {
    if (!window.database) return Promise.reject(new Error(currentLanguage === 'ja' ? 'データベース接続エラー' : '数据库连接错误'));
    return window.database.ref('employees').once('value').then(snapshot => {
        const data = snapshot.val() || {};
        return Object.keys(data).map(id => ({ id, ...data[id] }));
    });
}

function secureRandomIndex(max) {
    const arr = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(arr);
    return arr[0] % max;
}

function generateSecureStaffPassword(length = 10) {
    // Bỏ các ký tự dễ nhầm lẫn khi đọc/gõ lại (I, O, 0, 1, l...)
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnpqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%*?';
    const all = upper + lower + digits + symbols;

    // Đảm bảo có đủ chữ hoa/thường/số/ký tự đặc biệt để mật khẩu đủ mạnh
    let chars = [
        upper[secureRandomIndex(upper.length)],
        lower[secureRandomIndex(lower.length)],
        digits[secureRandomIndex(digits.length)],
        symbols[secureRandomIndex(symbols.length)]
    ];
    for (let i = chars.length; i < length; i++) {
        chars.push(all[secureRandomIndex(all.length)]);
    }
    // Xáo trộn vị trí để 4 ký tự đầu không luôn cố định theo thứ tự hoa/thường/số/ký tự
    for (let i = chars.length - 1; i > 0; i--) {
        const j = secureRandomIndex(i + 1);
        [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
}

function regenerateStaffAccountFields() {
    if (!pendingStaffAccount) return;
    pendingStaffAccount.password = generateSecureStaffPassword();
    const passField = document.getElementById('newAccountPasswordDisplay');
    if (passField) passField.value = pendingStaffAccount.password;
}

function copyStaffAccountCredentials(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee || !pendingStaffAccount) return;
    const text = currentLanguage === 'ja'
        ? `【${employee.name} 様 ログイン情報】\nID: ${pendingStaffAccount.username}\nパスワード: ${pendingStaffAccount.password}`
        : `【${employee.name} 登录信息】\n账号: ${pendingStaffAccount.username}\n密码: ${pendingStaffAccount.password}`;

    const done = () => showMessage(currentLanguage === 'ja' ? 'コピーしました' : '已复制', 'success');
    const fail = () => showMessage(currentLanguage === 'ja' ? 'コピー失敗' : '复制失败', 'error');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fail);
    } else {
        fail();
    }
}

function copyExistingAccountCredentials(employeeId, password) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    const displayId = employee.loginUsername || employee.loginEmail;
    const text = currentLanguage === 'ja'
        ? `【${employee.name} 様 ログイン情報】\nID: ${displayId}\nパスワード: ${password}`
        : `【${employee.name} 登录信息】\n账号: ${displayId}\n密码: ${password}`;

    const done = () => showMessage(currentLanguage === 'ja' ? 'コピーしました' : '已复制', 'success');
    const fail = () => showMessage(currentLanguage === 'ja' ? 'コピー失敗' : '复制失败', 'error');

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(fail);
    } else {
        fail();
    }
}

function showEmployeeAccountModal(employeeId) {
    const cachedEmployee = employees.find(e => e.id === employeeId);
    if (!cachedEmployee) return;

    pendingStaffAccount = null;
    const body = document.getElementById('accountModalBody');
    if (!body) return;

    body.innerHTML = `<div style="text-align:center; padding: 40px 0; color: var(--gray-400);"><i class="fas fa-spinner fa-spin" style="font-size:22px;"></i></div>`;
    openModal('accountModal');

    // Luôn đọc dữ liệu MỚI NHẤT từ Firebase trước khi hiển thị / sinh ID mới (xem lưu ý phía trên)
    fetchFreshEmployeesList()
    .then(freshList => {
        // Nếu admin đã đóng modal hoặc chuyển sang xem nhân viên khác trong lúc chờ tải thì bỏ qua
        const modalEl = document.getElementById('accountModal');
        if (!modalEl || modalEl.style.display === 'none') return;
        const freshEmployee = freshList.find(e => e.id === employeeId) || cachedEmployee;

        if (freshEmployee.uid && freshEmployee.loginEmail) {
            renderAccountExistsView(employeeId, freshEmployee);
        } else {
            pendingStaffAccount = {
                mode: 'new',
                username: generateNextStaffUsernameFromList(freshList),
                password: generateSecureStaffPassword()
            };
            renderNewAccountForm(employeeId, freshEmployee);
        }
    })
    .catch(error => {
        body.innerHTML = `<div style="text-align:center; padding: 20px 0; color: #ef4444;">${(currentLanguage === 'ja' ? '読み込みエラー: ' : '加载错误: ') + error.message}</div>`;
    });
}

function renderAccountExistsView(employeeId, employee, justIssuedPassword) {
    const body = document.getElementById('accountModalBody');
    if (!body) return;
    const displayId = employee.loginUsername || employee.loginEmail;

    const justIssuedHtml = justIssuedPassword ? `
        <div style="background: var(--info-light); border: 1px solid rgba(37,99,235,0.3); border-radius: var(--border-radius); padding: 14px; margin-bottom: 16px;">
            <div style="font-size:12px; color: var(--gray-600); margin-bottom:6px;">
                <span data-lang="ja">新しいパスワード(今すぐコピーしてください)</span><span data-lang="zh" style="display:none">新密码(请立即复制)</span>
            </div>
            <div style="display:flex; gap:8px; align-items:center;">
                <input type="text" class="input-field" value="${justIssuedPassword}" readonly style="font-family:monospace; font-weight:700; letter-spacing:0.5px;">
                <button type="button" class="btn-secondary" style="flex-shrink:0; padding:0 14px;" onclick="copyExistingAccountCredentials('${employeeId}', '${justIssuedPassword}')" title="${currentLanguage === 'ja' ? 'コピー' : '复制'}">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        </div>
    ` : '';

    const reissueSectionHtml = employee.loginUsername ? `
        <button type="button" class="btn-primary" style="width:100%; margin-bottom:10px;" onclick="reissueStaffPassword('${employeeId}')">
            <i class="fas fa-key"></i>
            <span data-lang="ja">パスワードを忘れた場合(新規発行)</span><span data-lang="zh" style="display:none">忘记密码(重新发放)</span>
        </button>
        <p style="font-size:11px; color: var(--gray-400); margin-bottom:12px;">
            <span data-lang="ja">※ ログインIDはそのまま変わらず、新しいパスワードだけ発行されます。発行後は必ずコピーしてスタッフに渡してください。</span>
            <span data-lang="zh" style="display:none">※ 登录账号保持不变，仅生成新密码。发放后请务必复制并交给员工。</span>
        </p>
    ` : `
        <p style="font-size:12px; color: var(--gray-500); margin-bottom:16px;">
            <span data-lang="ja">※ この古いアカウントは以前の方式(メール直接入力)で作られています。パスワードを再発行するには一度「完全に削除」してから作り直してください。</span>
            <span data-lang="zh" style="display:none">※ 该账号是用旧的方式(直接输入邮箱)创建的。如需重设密码，请先「彻底删除」后重新创建。</span>
        </p>
    `;

    body.innerHTML = `
        <div style="text-align:center; margin-bottom: 20px;">
            <div class="employee-avatar-small" style="width:56px;height:56px;font-size:22px;margin:0 auto 10px;">${employee.name.charAt(0)}</div>
            <div style="font-weight:700; color: var(--dark);">${employee.name}</div>
        </div>
        <div style="background: var(--success-light); border: 1px solid rgba(16,185,129,0.3); border-radius: var(--border-radius); padding: 16px; margin-bottom: 16px;">
            <div style="display:flex; align-items:center; gap:8px; color: var(--success); font-weight:700; margin-bottom: 6px;">
                <i class="fas fa-circle-check"></i>
                <span data-lang="ja">アカウント設定済み</span><span data-lang="zh" style="display:none">已设置账号</span>
            </div>
            <div style="font-size: 13px; color: var(--gray-600);">
                <span data-lang="ja">ログインID</span><span data-lang="zh" style="display:none">登录账号</span>: <strong>${displayId}</strong>
            </div>
        </div>
        ${justIssuedHtml}
        ${reissueSectionHtml}
        <button type="button" class="btn-secondary" style="width:100%;" onclick="unlinkEmployeeAccount('${employeeId}')">
            <i class="fas fa-link-slash"></i>
            <span data-lang="ja">アカウントを完全に削除</span><span data-lang="zh" style="display:none">彻底删除账号关联</span>
        </button>
        <div style="text-align:center; margin-top:14px; padding-top:12px; border-top: 1px dashed var(--border);">
            <button type="button" onclick="resetEmployeeAccountData('${employeeId}')" style="background:none; border:none; color: var(--gray-400); font-size:11.5px; font-weight:600; cursor:pointer; text-decoration:underline;">
                <i class="fas fa-wrench"></i>
                <span data-lang="ja">ログインできない・エラーが出続ける場合はこちら(リセット)</span><span data-lang="zh" style="display:none">如果无法登录或持续报错，点此重置</span>
            </button>
        </div>
    `;
    applyLanguageToElement(body);
}

function renderNewAccountForm(employeeId, employee, showResetHint) {
    const body = document.getElementById('accountModalBody');
    if (!body || !pendingStaffAccount) return;

    const resetHintHtml = showResetHint ? `
        <div style="background: var(--warning-light); border: 1px solid rgba(245,158,11,0.35); border-radius: var(--border-radius); padding: 12px 14px; margin-bottom: 14px;">
            <div style="font-size:12.5px; color: var(--warning-dark, #c2410c); line-height:1.6;">
                <span data-lang="ja">⚠ データベースへの保存でエラーが発生しました。下の「リセット」を押してから、もう一度お試しください。</span>
                <span data-lang="zh" style="display:none">⚠ 保存到数据库时出错。请先点击下方"重置"，然后重试。</span>
            </div>
        </div>
    ` : '';

    body.innerHTML = `
        <div style="text-align:center; margin-bottom: 20px;">
            <div class="employee-avatar-small" style="width:56px;height:56px;font-size:22px;margin:0 auto 10px;">${employee.name.charAt(0)}</div>
            <div style="font-weight:700; color: var(--dark);">${employee.name}</div>
            <div style="font-size:12px; color: var(--gray-400); margin-top:4px;">
                <span data-lang="ja">まだログインアカウントがありません</span><span data-lang="zh" style="display:none">还没有登录账号</span>
            </div>
        </div>
        ${resetHintHtml}
        <div class="form-group">
            <label data-lang="ja">ログインID(自動生成)</label>
            <label data-lang="zh" style="display:none">登录账号(自动生成)</label>
            <input type="text" id="newAccountUsernameDisplay" class="input-field" value="${pendingStaffAccount.username}" readonly style="font-weight:700; letter-spacing:0.5px;">
        </div>
        <div class="form-group">
            <label data-lang="ja">パスワード(自動生成)</label>
            <label data-lang="zh" style="display:none">密码(自动生成)</label>
            <div style="display:flex; gap:8px;">
                <input type="text" id="newAccountPasswordDisplay" class="input-field" value="${pendingStaffAccount.password}" readonly style="font-family:monospace; font-weight:700; letter-spacing:0.5px;">
                <button type="button" class="btn-secondary" style="flex-shrink:0; padding:0 14px;" onclick="regenerateStaffAccountFields()" title="${currentLanguage === 'ja' ? 'パスワードを再生成' : '重新生成密码'}">
                    <i class="fas fa-rotate"></i>
                </button>
            </div>
        </div>
        <button type="button" class="btn-secondary" style="width:100%; margin-bottom:10px;" onclick="copyStaffAccountCredentials('${employeeId}')">
            <i class="fas fa-copy"></i>
            <span data-lang="ja">ID・パスワードをコピー</span><span data-lang="zh" style="display:none">复制账号和密码</span>
        </button>
        <button type="button" class="btn-primary" style="width:100%;" onclick="createEmployeeAccount('${employeeId}')">
            <i class="fas fa-user-plus"></i>
            <span data-lang="ja">アカウント作成</span><span data-lang="zh" style="display:none">创建账号</span>
        </button>
        <p style="font-size:11px; color: var(--gray-400); margin-top:12px;">
            <span data-lang="ja">※ 作成後はこの画面でパスワードを再確認できません。必ず作成前にコピーしてスタッフに渡してください。</span>
            <span data-lang="zh" style="display:none">※ 创建后将无法在此重新查看密码，请务必在创建前先复制并交给员工。</span>
        </p>
        <div style="text-align:center; margin-top:14px; padding-top:12px; border-top: 1px dashed var(--border);">
            <button type="button" onclick="resetEmployeeAccountData('${employeeId}')" style="background:none; border:none; color: var(--gray-400); font-size:11.5px; font-weight:600; cursor:pointer; text-decoration:underline;">
                <i class="fas fa-wrench"></i>
                <span data-lang="ja">作成でエラーが出続ける場合はこちら(リセット)</span><span data-lang="zh" style="display:none">如果创建持续报错，点此重置</span>
            </button>
        </div>
    `;
    applyLanguageToElement(body);
}

// Áp dụng lại trạng thái ẩn/hiện data-lang cho nội dung vừa render động (vì nội dung này
// được tạo sau khi trang đã load, không tự động được switchLanguage() xử lý)
function applyLanguageToElement(container) {
    if (!container) return;
    container.querySelectorAll('[data-lang]').forEach(el => {
        const lang = el.getAttribute('data-lang');
        el.style.display = (lang === currentLanguage) ? '' : 'none';
    });
}

function createEmployeeAccount(employeeId, attemptCount) {
    attemptCount = attemptCount || 0;
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    if (!pendingStaffAccount || pendingStaffAccount.mode !== 'new' || !pendingStaffAccount.username || !pendingStaffAccount.password) {
        showMessage(currentLanguage === 'ja' ? 'エラーが発生しました。もう一度開き直してください' : '发生错误，请重新打开此窗口', 'error');
        return;
    }

    if (!window.secondaryApp || !window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }

    // Tránh thử lại vô hạn nếu vì lý do gì đó luôn bị trùng ID
    if (attemptCount >= 5) {
        showMessage(currentLanguage === 'ja'
            ? '作成に繰り返し失敗しました。「リセット」ボタンを試すか、時間をおいてもう一度お試しください'
            : '多次创建失败，请尝试点击"重置"按钮，或稍后再试', 'error');
        return;
    }

    const attemptedUsername = pendingStaffAccount.username;
    const password = pendingStaffAccount.password;

    // Kiểm tra lại 1 lần nữa với dữ liệu MỚI NHẤT ngay trước khi tạo, để tránh trường hợp
    // 2 nhân viên bị gán trùng ID khi admin thao tác nhanh liên tiếp / nhiều tab cùng lúc.
    fetchFreshEmployeesList()
    .then(freshList => {
        const stillTaken = freshList.some(e => e.id !== employeeId && e.loginUsername && e.loginUsername.toUpperCase() === attemptedUsername.toUpperCase());

        if (stillTaken) {
            pendingStaffAccount.username = generateNextStaffUsernameFromList(freshList);
            renderNewAccountForm(employeeId, employee);
            showMessage(currentLanguage === 'ja'
                ? 'このIDは既に使われたため、新しいIDを再生成しました。内容を確認してもう一度作成してください'
                : '该ID刚被占用，已重新生成新ID，请确认后重新点击创建', 'warning');
            return null; // dừng lại, không tạo lúc này - đợi admin xác nhận ID mới rồi bấm lại
        }

        const username = attemptedUsername;
        // ID hiển thị cho nhân viên (VD: KAJICHO01) được ghép thêm domain giả cố định để thỏa
        // định dạng email mà Firebase Auth yêu cầu - nhân viên không cần biết tới domain này.
        const technicalEmail = `${username.toLowerCase()}${STAFF_LOGIN_DOMAIN}`;

        // Dùng app phụ (secondaryApp) để tạo tài khoản, tránh làm mất phiên đăng nhập hiện tại
        return window.secondaryApp.auth().createUserWithEmailAndPassword(technicalEmail, password)
        .then(cred => {
            const uid = cred.user.uid;
            return window.secondaryApp.auth().signOut().then(() => uid);
        })
        .then(uid => {
            // QUAN TRỌNG: ghi employees/{id} VÀ loginIndex/{username} trong CÙNG một lệnh
            // update() đa đường dẫn (multi-path). Nhờ vậy việc ghi có tính nguyên tử: nếu
            // Firebase Rules chặn 1 trong 2 nhánh (thường gặp nhất là thiếu quyền cho
            // loginIndex - xem README) thì CẢ HAI đều không được ghi, tránh để lại dữ liệu
            // nửa vời (employees đã có uid nhưng loginIndex thì chưa) - đây chính là nguyên
            // nhân trước đây gây ra lỗi "ID đã được sử dụng" khi admin thử tạo lại.
            const multiUpdate = {};
            multiUpdate[`employees/${employeeId}/uid`] = uid;
            multiUpdate[`employees/${employeeId}/loginEmail`] = technicalEmail;
            multiUpdate[`employees/${employeeId}/loginUsername`] = username;
            multiUpdate[`loginIndex/${username.toUpperCase()}`] = technicalEmail;

            return window.database.ref().update(multiUpdate)
                .then(() => ({ uid, technicalEmail, username }))
                .catch(dbError => {
                    // Ghi DB thất bại nhưng tài khoản Firebase Auth ĐÃ được tạo ở bước trên
                    // (không thể huỷ từ client) -> đánh dấu rõ để hiển thị nút "リセット"
                    // thay vì để admin bấm lại và dính lỗi "ID đã được sử dụng".
                    dbError.__orphanedAuthEmail = technicalEmail;
                    dbError.__orphanedUsername = username;
                    throw dbError;
                });
        });
    })
    .then(result => {
        if (!result) return; // đã dừng ở bước kiểm tra trùng ID phía trên
        showMessage(currentLanguage === 'ja' ? 'アカウントを作成しました' : '账号创建成功', 'success');
        // Hiển thị màn hình "đã có tài khoản" trực tiếp từ dữ liệu VỪA GHI (không đợi cache
        // `employees` đồng bộ lại) - đây chính là chỗ trước đây gây hiển thị sai/tạo trùng.
        const updatedEmployee = Object.assign({}, employee, {
            uid: result.uid,
            loginEmail: result.technicalEmail,
            loginUsername: result.username
        });
        pendingStaffAccount = null;
        renderAccountExistsView(employeeId, updatedEmployee);
    })
    .catch(error => {
        if (error.code === 'auth/email-already-in-use') {
            // ID này đã tồn tại bên Firebase Auth - thường do 1 lần tạo trước đó bị lỗi giữa
            // chừng (ví dụ mất mạng, hoặc DB rules chặn) để lại tài khoản Auth "mồ côi".
            // Tự động thử ID kế tiếp thay vì bắt admin phải đóng/mở lại nhiều lần.
            const nextNum = (parseInt((attemptedUsername.match(/(\d+)$/) || [])[1], 10) || 0) + 1;
            pendingStaffAccount.username = `${STAFF_ACCOUNT_PREFIX}${String(nextNum).padStart(2, '0')}`;
            createEmployeeAccount(employeeId, attemptCount + 1);
            return;
        }

        showMessage((currentLanguage === 'ja' ? '作成失敗: ' : '创建失败: ') + describeAccountError(error), 'error');

        // Nếu tài khoản Auth đã được tạo nhưng ghi DB thất bại, hiển thị lại form kèm gợi ý
        // dùng nút "リセット" để dọn sạch trước khi thử lại (tránh vòng lặp lỗi liên tục).
        if (error.__orphanedAuthEmail) {
            renderNewAccountForm(employeeId, employee, true);
        }
    });
}

function reissueStaffPassword(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee || !employee.loginUsername) return;

    const confirmMsg = currentLanguage === 'ja'
        ? `${employee.name} の新しいパスワードを発行しますか?(古いパスワードは無効になります。ログインIDは変わりません)`
        : `确定要为 ${employee.name} 发放新密码吗?(旧密码将失效，登录账号不变)`;
    if (!confirm(confirmMsg)) return;

    if (!window.secondaryApp || !window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }

    const username = employee.loginUsername;
    const newPassword = generateSecureStaffPassword();
    // Firebase không cho phép xoá/đổi mật khẩu của user khác từ client, nên tài khoản Auth cũ
    // (mật khẩu quên) sẽ bị "mồ côi" và không dùng được nữa; ta tạo 1 tài khoản Auth MỚI với
    // cùng ID hiển thị nhưng email kỹ thuật tăng version (+1, +2...) để tránh trùng, rồi trỏ
    // lại employees/{id} sang tài khoản mới này - nhân viên vẫn đăng nhập bằng đúng ID cũ.
    const version = (employee.loginEmailVersion || 0) + 1;
    const newTechnicalEmail = `${username.toLowerCase()}+${version}${STAFF_LOGIN_DOMAIN}`;

    window.secondaryApp.auth().createUserWithEmailAndPassword(newTechnicalEmail, newPassword)
    .then(cred => {
        const uid = cred.user.uid;
        return window.secondaryApp.auth().signOut().then(() => uid);
    })
    .then(uid => {
        // Ghi employees + loginIndex trong CÙNG 1 lệnh update() đa đường dẫn (atomic) - cùng
        // lý do như ở createEmployeeAccount: tránh để lại dữ liệu nửa vời nếu rules chặn 1
        // trong 2 nhánh.
        const multiUpdate = {};
        multiUpdate[`employees/${employeeId}/uid`] = uid;
        multiUpdate[`employees/${employeeId}/loginEmail`] = newTechnicalEmail;
        multiUpdate[`employees/${employeeId}/loginEmailVersion`] = version;
        multiUpdate[`loginIndex/${username.toUpperCase()}`] = newTechnicalEmail;
        return window.database.ref().update(multiUpdate);
    })
    .then(() => {
        showMessage(currentLanguage === 'ja' ? '新しいパスワードを発行しました' : '已发放新密码', 'success');
        const updatedEmployee = Object.assign({}, employee, { loginEmail: newTechnicalEmail, loginEmailVersion: version });
        renderAccountExistsView(employeeId, updatedEmployee, newPassword);
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? '発行失敗: ' : '发放失败: ') + describeAccountError(error), 'error');
    });
}

function unlinkEmployeeAccount(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const confirmMsg = currentLanguage === 'ja' 
        ? `${employee.name} のログインアカウントを完全に削除しますか?`
        : `确定要彻底删除 ${employee.name} 的登录账号吗?`;
    if (!confirm(confirmMsg)) return;
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }

    // Ghi atomic: xoá uid/loginEmail của employees VÀ entry loginIndex tương ứng trong CÙNG
    // 1 lệnh update() - ID vẫn được giữ lại (không cấp phát lại cho người khác), đúng như
    // hành vi đã mô tả trong README.
    const multiUpdate = {};
    multiUpdate[`employees/${employeeId}/uid`] = null;
    multiUpdate[`employees/${employeeId}/loginEmail`] = null;
    if (employee.loginUsername) {
        multiUpdate[`loginIndex/${employee.loginUsername.toUpperCase()}`] = null;
    }

    window.database.ref().update(multiUpdate)
    .then(() => {
        showMessage(currentLanguage === 'ja' ? '削除しました' : '已删除', 'success');
        showEmployeeAccountModal(employeeId);
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + describeAccountError(error), 'error');
    });
}

// ==================== KHẮC PHỤC LỖI: reset toàn bộ dữ liệu đăng nhập của 1 nhân viên ====================
// Dùng khi việc tạo/gia hạn tài khoản bị lỗi giữa chừng (mất mạng, thiếu quyền Firebase Rules...)
// để lại dữ liệu "nửa vời" khiến các lần thử sau cứ báo lỗi liên tục (VD: "ID đã được sử dụng",
// "Permission denied"...). Khác với nút "アカウントを完全に削除" (giữ ID không cho dùng lại),
// nút này XOÁ SẠCH luôn cả loginUsername để ID được giải phóng, admin có thể tạo lại từ đầu.
// Lưu ý: không xoá được tài khoản Firebase Auth "mồ côi" từ phía client (giới hạn bảo mật của
// Firebase), nhưng vì không còn gì trỏ tới nó nữa nên hoàn toàn vô hại, có thể bỏ qua.
function resetEmployeeAccountData(employeeId) {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    const confirmMsg = currentLanguage === 'ja'
        ? `${employee.name} のログイン情報を完全にリセットしますか?\n※ 作成・発行がエラーで失敗し続ける場合の復旧専用です。\n※ 現在のID(${employee.loginUsername || '-'})は解放され、次回は新しいIDが発行されます。`
        : `确定要彻底重置 ${employee.name} 的登录数据吗?\n※ 仅用于创建/发放持续报错时的故障恢复。\n※ 当前ID(${employee.loginUsername || '-'})将被释放，下次会生成新ID。`;
    if (!confirm(confirmMsg)) return;

    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }

    const oldUsername = employee.loginUsername;
    const multiUpdate = {};
    multiUpdate[`employees/${employeeId}/uid`] = null;
    multiUpdate[`employees/${employeeId}/loginEmail`] = null;
    multiUpdate[`employees/${employeeId}/loginUsername`] = null;
    multiUpdate[`employees/${employeeId}/loginEmailVersion`] = null;
    if (oldUsername) {
        multiUpdate[`loginIndex/${oldUsername.toUpperCase()}`] = null;
    }

    window.database.ref().update(multiUpdate)
    .then(() => {
        showMessage(currentLanguage === 'ja' ? 'リセットしました。もう一度作成をお試しください' : '已重置，请重新尝试创建', 'success');
        showEmployeeAccountModal(employeeId);
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? 'リセット失敗: ' : '重置失败: ') + describeAccountError(error), 'error');
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
        const position = positionLabel(emp.position);
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
        const position = positionLabel(emp.position);
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
        const position = positionLabel(emp.position);
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
        showMessage(`${currentLanguage === 'ja' ? 'スケジュールデータの読み込みエラー' : '加载排班数据错误'}: ${error.code || error.message || error}`, "error");
    });
}

// ==================== YÊU CẦU ĐỔI LỊCH TỪ NHÂN VIÊN (gửi từ trang staff.html) ====================
function loadChangeRequests() {
    if (!window.database) return;
    
    window.database.ref('changeRequests').on('value', (snapshot) => {
        changeRequests = snapshot.val() || {};
        updateRequestsBadge();
        renderChangeRequests();
    }, (error) => {
        console.error("Error loading change requests:", error);
    });
}

function updateRequestsBadge() {
    const pendingCount = Object.values(changeRequests).filter(r => r && r.status === 'pending').length;
    const badge = document.getElementById('requestsBadge');
    if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'flex' : 'none';
    }
}

const requestTypeLabel = { 
    dayoff: { ja: '休み希望', zh: '请假' }, 
    time_change: { ja: '時間変更', zh: '改时间' }, 
    other: { ja: 'その他', zh: '其他' } 
};

function renderChangeRequests() {
    const container = document.getElementById('requestsListAdmin');
    if (!container) return;
    
    const list = Object.entries(changeRequests)
        .map(([id, r]) => ({ id, ...r }))
        .filter(r => r && r.status)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    
    if (list.length === 0) {
        container.innerHTML = `
            <div class="staff-empty" style="padding: 40px 20px; text-align:center; color: var(--gray-400);">
                <i class="fas fa-inbox" style="font-size:2rem; margin-bottom:10px; display:block;"></i>
                <div>${currentLanguage === 'ja' ? 'リクエストはまだありません' : '还没有申请记录'}</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = list.map(r => {
        const typeText = requestTypeLabel[r.type] ? requestTypeLabel[r.type][currentLanguage] : r.type;
        const statusColor = r.status === 'pending' ? 'warning' : (r.status === 'approved' ? 'success' : 'danger');
        const statusText = r.status === 'pending' 
            ? (currentLanguage === 'ja' ? '審査中' : '待审核') 
            : (r.status === 'approved' ? (currentLanguage === 'ja' ? '承認済み' : '已批准') : (currentLanguage === 'ja' ? '却下' : '已拒绝'));
        
        return `
            <div class="request-item">
                <div class="request-item-top">
                    <div>
                        <strong>${r.employeeName || '?'}</strong>
                        <span style="color: var(--gray-500); font-size:12px;">· ${formatDate(r.date)} · ${typeText}</span>
                    </div>
                    <span class="request-status-badge" style="background: var(--${statusColor}-light); color: var(--${statusColor});">${statusText}</span>
                </div>
                ${r.type === 'time_change' && r.requestedStartTime ? `<div class="request-item-body">${r.requestedStartTime} - ${r.requestedEndTime}</div>` : ''}
                ${r.note ? `<div class="request-item-body">${r.note}</div>` : ''}
                ${r.status === 'pending' ? `
                    <div class="request-item-actions">
                        <button type="button" class="btn-action" style="background: var(--success-light); color: var(--success);" onclick="approveChangeRequest('${r.id}')">
                            <i class="fas fa-check"></i> ${currentLanguage === 'ja' ? '承認' : '批准'}
                        </button>
                        <button type="button" class="btn-action" style="background: var(--danger-light); color: var(--danger);" onclick="rejectChangeRequest('${r.id}')">
                            <i class="fas fa-xmark"></i> ${currentLanguage === 'ja' ? '却下' : '拒绝'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function showRequestsModal() {
    renderChangeRequests();
    openModal('requestsModal');
}

// Duyệt yêu cầu: tự động áp dụng thay đổi vào lịch (nếu là xin nghỉ / đổi giờ), rồi đánh dấu approved
function approveChangeRequest(requestId) {
    const request = changeRequests[requestId];
    if (!request) return;
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    const employee = employees.find(e => e.id === request.employeeId);
    const updates = {};
    
    if (employee && (request.type === 'dayoff' || request.type === 'time_change')) {
        const existing = findScheduleByEmployeeAndDate(request.employeeId, request.date);
        const scheduleData = {
            employeeId: request.employeeId,
            employeeName: request.employeeName,
            employeePosition: existing ? existing.employeePosition : employee.position,
            date: request.date,
            isDayOff: request.type === 'dayoff',
            updatedAt: Date.now()
        };
        if (request.type === 'dayoff') {
            scheduleData.startTime = '00:00';
            scheduleData.endTime = '00:00';
            scheduleData.notes = currentLanguage === 'ja' ? '休み' : '休息';
        } else {
            scheduleData.startTime = request.requestedStartTime || '08:00';
            scheduleData.endTime = request.requestedEndTime || '17:00';
        }
        const scheduleId = existing ? existing.id : window.database.ref('schedules').push().key;
        if (!existing) scheduleData.createdAt = Date.now();
        updates[`schedules/${scheduleId}`] = scheduleData;
    }
    
    updates[`changeRequests/${requestId}/status`] = 'approved';
    updates[`changeRequests/${requestId}/reviewedAt`] = Date.now();
    
    window.database.ref().update(updates)
    .then(() => {
        showMessage(currentLanguage === 'ja' ? '承認してスケジュールに反映しました' : '已批准并应用到排班', 'success');
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + error.message, 'error');
    });
}

function rejectChangeRequest(requestId) {
    if (!changeRequests[requestId]) return;
    
    if (!window.database) {
        showMessage(currentLanguage === 'ja' ? "データベース接続エラー" : "数据库连接错误", "error");
        return;
    }
    
    window.database.ref(`changeRequests/${requestId}`).update({
        status: 'rejected',
        reviewedAt: Date.now()
    })
    .then(() => {
        showMessage(currentLanguage === 'ja' ? 'リクエストを却下しました' : '已拒绝该申请', 'success');
    })
    .catch(error => {
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + error.message, 'error');
    });
}

function selectScheduleType(type) {
    const scope = document.getElementById('scheduleTypeSelector');
    if (!scope) return;
    scope.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const typeBtn = scope.querySelector(`.type-btn[data-type="${type}"]`);
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
    const typeBtn = document.querySelector('#scheduleTypeSelector .type-btn.active');
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
            showMessage((currentLanguage === 'ja' ? '更新失敗: ' : '更新失败: ') + error.message, 'error');
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
            showMessage((currentLanguage === 'ja' ? '追加失敗: ' : '添加失败: ') + error.message, 'error');
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
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + error.message, 'error');
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
        showMessage((currentLanguage === 'ja' ? '設定失敗: ' : '设置失败: ') + error.message, 'error');
    });
}

// ==================== WEEKLY VIEW ====================
function buildWeeklyRowHtml(employee, days, schedulesByEmployee) {
    const employeeSchedules = schedulesByEmployee[employee.id] || {};
    const weeklyHours = calculateWeeklyHours(employee.id);
    
    const positionDisplay = positionLabel(employee.position);
    
    return `
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
                        const shiftPeriod = getShiftPeriod(schedule.startTime);
                        scheduleClass = `work ${shiftPeriod}`;
                        const dayPosition = schedule.employeePosition || employee.position;
                        const isDiffPosition = dayPosition !== employee.position;
                        const shiftIcon = shiftPeriod === 'early' ? 'fa-cloud-sun' : 'fa-moon';
                        scheduleText = `
                            <div class="compact-time">
                                <i class="fas ${shiftIcon} shift-period-icon"></i>
                                <span>${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}</span>
                                <span>${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}</span>
                            </div>
                            ${isDiffPosition ? `<div class="diff-position-badge"><i class="fas ${positionIcon(dayPosition)}"></i> ${positionLabel(dayPosition)}</div>` : ''}
                        `;
                    }
                }
                
                const dayPositionForTitle = schedule && !schedule.isDayOff ? (schedule.employeePosition || employee.position) : null;
                const titleShiftPeriod = schedule && !schedule.isDayOff ? getShiftPeriod(schedule.startTime) : null;
                const headcountNote = titleShiftPeriod === 'early'
                    ? (currentLanguage === 'ja' ? ' (早番・人数集計対象外)' : ' (早班・不计入人数统计)')
                    : (titleShiftPeriod === 'late' ? (currentLanguage === 'ja' ? ' (晩番)' : ' (晚班)') : '');
                const title = schedule ? (schedule.isDayOff ? 
                    (currentLanguage === 'ja' ? '休み' : '休息') : 
                    `${schedule.startTime || ''}-${schedule.endTime || ''}${dayPositionForTitle && dayPositionForTitle !== employee.position ? ' · ' + positionLabel(dayPositionForTitle) : ''}${headcountNote}`) : 
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
}

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
    
    const todayString = new Date().toISOString().split('T')[0];
    
    let html = `
        <div class="week-header">
            <div class="week-header-cell">${currentLanguage === 'ja' ? 'スタッフ' : '员工'}</div>
            ${days.map((day, index) => {
                const date = new Date(day.dateString);
                const month = date.getMonth() + 1;
                const dayNum = date.getDate();
                const headcount = getDayHeadcount(day.dateString);
                const isToday = day.dateString === todayString;
                return `
                    <div class="week-header-cell ${isToday ? 'today' : ''}">
                        <div class="week-header-day">${dayNames[index]}</div>
                        <div class="week-header-date">${month}/${dayNum}</div>
                        <div class="week-header-count" title="${currentLanguage === 'ja' ? '職種別 出勤人数（晩番のみ・早番は含まれません）' : '各职位 出勤人数（仅晚班，早班不计入）'}">
                            ${POSITIONS.map(pos => `<span class="count-pill ${pos.cls}" title="${positionLabel(pos.key)}">${headcount[pos.key] || 0}</span>`).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    // Tách rõ theo từng nhóm vị trí (职种), mỗi nhóm có dải tiêu đề riêng
    POSITIONS.forEach(pos => {
        const groupEmployees = employees.filter(e => e.position === pos.key);
        if (groupEmployees.length === 0) return;
        const title = positionLabel(pos.key);
        html += `
            <div class="week-position-header ${pos.cls}">
                <div class="week-position-header-label">
                    <i class="fas ${pos.icon}"></i> ${title}
                    <span class="week-position-count">${groupEmployees.length}</span>
                </div>
            </div>
        `;
        groupEmployees.forEach(employee => {
            html += buildWeeklyRowHtml(employee, days, schedulesByEmployee);
        });
    });
    
    if (employees.length === 0) {
        html = `<div class="empty-state"><p>${currentLanguage === 'ja' ? 'スケジュールデータがありません' : '没有排班数据'}</p></div>`;
    }
    
    container.innerHTML = html;
    
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
                            ${positionLabel(employee.position)}
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
                <div class="type-selector" id="editTypeSelector">
                    <button type="button" class="type-btn ${!schedule || !schedule.isDayOff ? 'active' : ''}" data-type="work"
                            onclick="setEditScheduleType('work')">
                        <i class="fas fa-briefcase"></i>
                        <span>${currentLanguage === 'ja' ? '勤務' : '工作'}</span>
                    </button>
                    <button type="button" class="type-btn ${schedule && schedule.isDayOff ? 'active' : ''}" data-type="rest"
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
            
            <div class="form-group" id="editPositionGroup" style="display: ${!schedule || !schedule.isDayOff ? 'block' : 'none'}">
                <label>${currentLanguage === 'ja' ? 'この日の職種' : '当天职位'}
                    <span style="font-weight: 400; color: var(--gray-400); font-size: 12px;">
                        (${currentLanguage === 'ja' ? '普段と違う場合のみ変更' : '仅在与平时不同时更改'})
                    </span>
                </label>
                <div class="type-selector" id="editPositionSelector">
                    ${POSITIONS.map(pos => `
                        <button type="button" class="type-btn ${(schedule ? schedule.employeePosition : employee.position) === pos.key ? 'active' : ''}" 
                                data-position="${pos.key}" onclick="setEditSchedulePosition('${pos.key}')">
                            <i class="fas ${pos.icon}"></i>
                            <span>${positionLabel(pos.key)}</span>
                        </button>
                    `).join('')}
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
    const positionGroup = document.getElementById('editPositionGroup');
    const scope = document.getElementById('editTypeSelector');
    if (!scope) return;
    
    const workBtn = scope.querySelector('.type-btn[data-type="work"]');
    const restBtn = scope.querySelector('.type-btn[data-type="rest"]');
    
    if (!workBtn || !restBtn) return;
    
    if (type === 'work') {
        workBtn.classList.add('active');
        restBtn.classList.remove('active');
        if (timeGroup) timeGroup.style.display = 'grid';
        if (positionGroup) positionGroup.style.display = 'block';
    } else {
        restBtn.classList.add('active');
        workBtn.classList.remove('active');
        if (timeGroup) timeGroup.style.display = 'none';
        if (positionGroup) positionGroup.style.display = 'none';
    }
}

// Chọn vị trí làm việc RIÊNG cho ngày đang sửa (có thể khác vị trí mặc định của nhân viên)
function setEditSchedulePosition(positionKey) {
    const scope = document.getElementById('editPositionSelector');
    if (!scope) return;
    scope.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.position === positionKey);
    });
}

function saveDaySchedule(employeeId, date) {
    const typeBtn = document.querySelector('#editTypeSelector .type-btn.active');
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
        
        // Vị trí làm việc riêng cho ngày này (có thể khác vị trí mặc định của nhân viên,
        // ví dụ tuần này hôm làm 厨房, hôm làm 拉客...). Mặc định lấy vị trí hiện tại
        // của nhân viên nếu người dùng chưa chọn khác.
        const positionBtn = document.querySelector('#editPositionSelector .type-btn.active');
        scheduleData.employeePosition = positionBtn ? positionBtn.dataset.position : employee.position;
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
            showMessage((currentLanguage === 'ja' ? '更新失敗: ' : '更新失败: ') + error.message, 'error');
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
            showMessage((currentLanguage === 'ja' ? '追加失敗: ' : '添加失败: ') + error.message, 'error');
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
        showMessage((currentLanguage === 'ja' ? '削除失敗: ' : '删除失败: ') + error.message, 'error');
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
    
    return roundHours(totalHours, 1);
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
    
    return roundHours(totalHours, 1);
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
function copyScheduleAsText(employeeIdParam) {
    const employeeId = employeeIdParam || selectedEmployee;
    
    if (!employeeId) {
        showMessage(currentLanguage === 'ja' ? 'スタッフを選択してください' : '请先选择员工', 'warning');
        return;
    }
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;
    
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getEmployeeSchedulesForWeek(employeeId, startDate, endDate);
    const weeklyHours = calculateWeeklyHours(employeeId);
    const monthlyHours = calculateMonthlyHours(employeeId);
    const days = generateWeekDays(startDate);
    
    // Generate formatted text
    let text = `【${employee.name} ${currentLanguage === 'ja' ? 'スケジュール' : '排班表'}】\n`;
    text += `${currentLanguage === 'ja' ? '基本職種:' : '基本职位:'} ${positionLabel(employee.position)}\n`;
    text += `${currentLanguage === 'ja' ? '日付:' : '日期:'} ${formatDate(startDate)} ${currentLanguage === 'ja' ? '〜' : '至'} ${formatDate(endDate)}\n`;
    text += `${currentLanguage === 'ja' ? '今週:' : '本周:'} ${weeklyHours}${currentLanguage === 'ja' ? '時間' : '小时'} | ${currentLanguage === 'ja' ? '今月:' : '本月:'} ${monthlyHours}${currentLanguage === 'ja' ? '時間' : '小时'}\n\n`;
    text += `📅 ${currentLanguage === 'ja' ? '今週のスケジュール:' : '本周排班:'}\n`;
    
    // Day names for display
    const dayNames = currentLanguage === 'ja' 
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];
    
    days.forEach((day, index) => {
        const schedule = weekSchedule.find(s => s.date === day.dateString);
        let scheduleText;
        if (schedule) {
            if (schedule.isDayOff) {
                scheduleText = '🏖️ ' + (currentLanguage === 'ja' ? '休み' : '休息');
            } else {
                const timeStr = `🕐 ${schedule.startTime ? schedule.startTime.substring(0, 5) : ''}-${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}`;
                const dayPos = positionLabel(schedule.employeePosition || employee.position);
                scheduleText = `${timeStr} · 📍${dayPos}`;
            }
        } else {
            scheduleText = '📭 ' + (currentLanguage === 'ja' ? 'なし' : '无');
        }
        
        text += `${dayNames[index]} (${day.date}): ${scheduleText}\n`;
    });
    
    text += `\n📊 ${currentLanguage === 'ja' ? '今週:' : '本周:'} ${weekSchedule.filter(s => !s.isDayOff).length}${currentLanguage === 'ja' ? '勤務日' : '工作日'}, ${weekSchedule.filter(s => s.isDayOff).length}${currentLanguage === 'ja' ? '休日' : '休息日'}\n`;
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
            const modal = document.getElementById('employeeModal');
            if (modal && modal.style.display === 'flex') closeModal('employeeModal');
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
            
            const modal2 = document.getElementById('employeeModal');
            if (modal2 && modal2.style.display === 'flex') closeModal('employeeModal');
        });
}

// ==================== PRINT SYSTEM (in ngay trong trang) ====================
// Thay vì mở popup window (dễ bị chặn / tự đóng giữa chừng trên điện thoại),
// nội dung in được render thẳng vào #printOutput rồi gọi window.print().
// CSS @media print sẽ ẩn toàn bộ giao diện app và chỉ hiện #printOutput.

function setPrintPageSize(size) {
    let styleTag = document.getElementById('dynamicPrintPageStyle');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamicPrintPageStyle';
        document.head.appendChild(styleTag);
    }
    styleTag.textContent = `@page { size: ${size}; margin: 12mm; }`;
}

function triggerPrint() {
    document.body.classList.add('is-printing');
    // Đợi 1 nhịp để trình duyệt kịp render layout trước khi mở hộp thoại in
    // (giúp ổn định hơn trên trình duyệt di động)
    setTimeout(() => {
        window.print();
    }, 60);
}

function endPrintMode() {
    document.body.classList.remove('is-printing');
}

window.addEventListener('afterprint', endPrintMode);

function buildPrintDayRow(day, schedule, dayNames) {
    let statusClass = 'none';
    let statusText = currentLanguage === 'ja' ? 'なし' : '无';
    let timeDisplay = '—';
    let hoursDisplay = '';

    if (schedule) {
        if (schedule.isDayOff) {
            statusClass = 'rest';
            statusText = currentLanguage === 'ja' ? '休み' : '休息';
        } else {
            statusClass = 'work';
            statusText = currentLanguage === 'ja' ? '勤務' : '工作';
            const start = schedule.startTime ? schedule.startTime.substring(0, 5) : '';
            const end = schedule.endTime ? schedule.endTime.substring(0, 5) : '';
            timeDisplay = `${start} - ${end}`;
            hoursDisplay = `${calculateShiftHours(schedule.startTime, schedule.endTime)}h`;
        }
    }

    return `
        <div class="print-day-row ${statusClass}">
            <div class="print-day-date">
                <div class="print-day-name">${dayNames[day.dayIndex]}</div>
                <div class="print-day-num">${day.date}</div>
            </div>
            <div class="print-day-status">${statusText}</div>
            <div class="print-day-time">${timeDisplay}</div>
            <div class="print-day-hours">${hoursDisplay}</div>
        </div>
    `;
}

// ==================== IN LỊCH CỦA 1 NHÂN VIÊN ====================
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

    const positionDisplay = positionLabel(employee.position);

    const dayNames = currentLanguage === 'ja'
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];

    const workDaysCount = weekSchedule.filter(s => !s.isDayOff).length;
    const restDaysCount = weekSchedule.filter(s => s.isDayOff).length;

    const html = `
        <div class="print-sheet">
            <div class="print-sheet-header">
                <div class="print-company">鍛治町酒場 神田店</div>
                <div class="print-employee-name">${employee.name}</div>
                <div class="print-sub">${positionDisplay} ・ ${formatDate(startDate)} - ${formatDate(endDate)}</div>
            </div>

            <div class="print-summary-row">
                <div class="print-summary-box">
                    <div class="num">${weeklyHours}h</div>
                    <div class="lbl">${currentLanguage === 'ja' ? '今週時間' : '本周工时'}</div>
                </div>
                <div class="print-summary-box">
                    <div class="num">${monthlyHours}h</div>
                    <div class="lbl">${currentLanguage === 'ja' ? '今月時間' : '本月工时'}</div>
                </div>
                <div class="print-summary-box">
                    <div class="num">${workDaysCount}</div>
                    <div class="lbl">${currentLanguage === 'ja' ? '勤務日' : '工作日'}</div>
                </div>
                <div class="print-summary-box">
                    <div class="num">${restDaysCount}</div>
                    <div class="lbl">${currentLanguage === 'ja' ? '休日' : '休息日'}</div>
                </div>
            </div>

            <div class="print-day-list">
                ${days.map(day => buildPrintDayRow(day, weekSchedule.find(s => s.date === day.dateString), dayNames)).join('')}
            </div>

            <div class="print-footer">
                ${currentLanguage === 'ja' ? '印刷日:' : '打印日期:'} ${new Date().toLocaleDateString(currentLanguage === 'ja' ? 'ja-JP' : 'zh-CN')}
            </div>
        </div>
    `;

    const container = document.getElementById('printOutput');
    if (!container) {
        showMessage(currentLanguage === 'ja' ? 'エラーが発生しました、ページを更新して再試行してください' : '发生错误，请刷新页面重试', 'error');
        return;
    }

    container.innerHTML = html;
    setPrintPageSize('portrait');
    triggerPrint();
}

// ==================== IN TOÀN BỘ LỊCH TUẦN (vẫn giữ lại, gọi bằng tay khi cần) ====================
function printAllSchedule() {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const weekSchedule = getWeekSchedules(startDate, endDate);
    const days = generateWeekDays(startDate);

    const dayNames = currentLanguage === 'ja'
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];

    const schedulesByEmployee = {};
    weekSchedule.forEach(schedule => {
        if (schedule && schedule.employeeId) {
            if (!schedulesByEmployee[schedule.employeeId]) {
                schedulesByEmployee[schedule.employeeId] = {};
            }
            schedulesByEmployee[schedule.employeeId][schedule.date] = schedule;
        }
    });

    function renderPrintGroup(groupLabel, groupEmployees) {
        if (groupEmployees.length === 0) return '';
        let groupHtml = `<div class="print-group-title">${groupLabel}</div>`;
        groupEmployees.forEach(employee => {
            const employeeSchedules = schedulesByEmployee[employee.id] || {};
            const weeklyHours = calculateWeeklyHours(employee.id);
            groupHtml += `
                <div class="print-all-row">
                    <div class="print-all-name">
                        <div>${employee.name}</div>
                        <div class="print-all-hours">${weeklyHours}h</div>
                    </div>
                    <div class="print-all-days">
                        ${days.map(day => {
                            const schedule = employeeSchedules[day.dateString];
                            let cls = 'none';
                            let content = '-';
                            if (schedule) {
                                if (schedule.isDayOff) {
                                    cls = 'rest';
                                    content = currentLanguage === 'ja' ? '休' : '休';
                                } else {
                                    cls = 'work';
                                    const start = schedule.startTime ? schedule.startTime.substring(0, 5) : '';
                                    const end = schedule.endTime ? schedule.endTime.substring(0, 5) : '';
                                    content = `${start}<br>${end}`;
                                }
                            }
                            return `<div class="print-all-cell ${cls}">${content}</div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        });
        return groupHtml;
    }

    const html = `
        <div class="print-sheet print-sheet-all">
            <div class="print-sheet-header">
                <div class="print-company">鍛治町酒場 神田店</div>
                <div class="print-sub">${currentLanguage === 'ja' ? '週間勤務表' : '每周排班表'} ・ ${formatDate(startDate)} - ${formatDate(endDate)}</div>
            </div>
            <div class="print-all-header">
                <div class="print-all-name">${currentLanguage === 'ja' ? 'スタッフ' : '员工'}</div>
                <div class="print-all-days">
                    ${days.map((day, i) => `<div class="print-all-cell head">${dayNames[i]}<br>${day.date}</div>`).join('')}
                </div>
            </div>
            ${POSITIONS.map(pos => renderPrintGroup(positionLabel(pos.key), employees.filter(e => e.position === pos.key))).join('')}
            <div class="print-footer">
                ${currentLanguage === 'ja' ? '印刷日:' : '打印日期:'} ${new Date().toLocaleDateString(currentLanguage === 'ja' ? 'ja-JP' : 'zh-CN')}
            </div>
        </div>
    `;

    const container = document.getElementById('printOutput');
    if (!container) return;
    container.innerHTML = html;
    setPrintPageSize('landscape');
    triggerPrint();
}

// ==================== CHIA SẺ LỊCH TUẦN (thay cho nút in cuối cùng) ====================
// Trên điện thoại: mở bảng chia sẻ gốc của hệ điều hành (gửi qua LINE / Zalo / Messenger / SMS...)
// Trên máy tính (không có Web Share API): tự động copy nội dung vào clipboard.
function shareWeeklySchedule() {
    const { startDate, endDate } = getWeekDates(currentWeek);
    const days = generateWeekDays(startDate);

    const dayNames = currentLanguage === 'ja'
        ? ['月', '火', '水', '木', '金', '土', '日']
        : ['一', '二', '三', '四', '五', '六', '日'];

    const positionEmoji = { '前台/服务区': '🚪', '厨房区': '🍳', '拉客': '📣' };

    function groupText(label, groupEmployees) {
        if (groupEmployees.length === 0) return '';
        let t = `${label}\n`;
        groupEmployees.forEach(emp => {
            const hrs = calculateWeeklyHours(emp.id);
            const pattern = getWeekPattern(emp.id, currentWeek);
            const patternText = pattern.map(d => {
                if (d.status === 'work') return `${d.letter}✓`;
                if (d.status === 'rest') return `${d.letter}休`;
                return `${d.letter}-`;
            }).join(' ');
            t += `・${emp.name} (${hrs}h): ${patternText}\n`;
        });
        return t + '\n';
    }

    let text = `📅 鍛治町酒場 神田店\n`;
    text += `${currentLanguage === 'ja' ? '週間シフト' : '每周排班'}: ${formatDate(startDate)} - ${formatDate(endDate)}\n\n`;
    POSITIONS.forEach(pos => {
        const groupEmployees = employees.filter(e => e.position === pos.key);
        const label = `${positionEmoji[pos.key] || '👤'} ${positionLabel(pos.key)}`;
        text += groupText(label, groupEmployees);
    });

    text += `${currentLanguage === 'ja' ? '📊 日別の人数（晩番のみ）' : '📊 每日人数（仅晚班）'}\n`;
    days.forEach((day, index) => {
        const headcount = getDayHeadcount(day.dateString);
        const countStr = POSITIONS.map(pos => `${positionEmoji[pos.key] || '👤'}${headcount[pos.key] || 0}`).join(' ');
        text += `${dayNames[index]} (${day.date}): ${countStr}\n`;
    });

    if (navigator.share) {
        navigator.share({
            title: currentLanguage === 'ja' ? '週間シフト' : '每周排班',
            text: text
        }).catch(() => { /* Người dùng huỷ chia sẻ, không cần báo lỗi */ });
    } else {
        navigator.clipboard.writeText(text)
            .then(() => {
                showMessage(currentLanguage === 'ja' ? 'クリップボードにコピーしました' : '已复制到剪贴板', 'success');
            })
            .catch(() => {
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
            });
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
        let html = '';
        
        POSITIONS.forEach(pos => {
            const groupSchedules = todaySchedules.filter(s => s.employeePosition === pos.key);
            if (groupSchedules.length === 0) return;
            const title = positionLabel(pos.key);
            html += `<h4 style="margin-bottom: 16px; margin-top: 16px; color: var(--${pos.color}); font-weight: 700;"><i class="fas ${pos.icon}"></i> ${title}</h4>`;
            html += groupSchedules.map(schedule => createTodayItem(schedule)).join('');
        });
        
        container.innerHTML = html;
    }
    
    openModal('todayModal');
}

function createTodayItem(schedule) {
    const position = positionLabel(schedule.employeePosition);
    const finished = !schedule.isDayOff && hasScheduleEnded(schedule);
    
    return `
        <div class="today-item ${schedule.isDayOff ? 'rest' : 'work'} ${finished ? 'finished' : ''}">
            <div>
                <div style="font-weight: 700; color: var(--dark);">${schedule.employeeName}</div>
                <div style="font-size: 13px; color: var(--gray-500); font-weight: 500;">${position}</div>
            </div>
            <div style="text-align: right;">
                <div style="font-weight: 700; color: ${schedule.isDayOff ? 'var(--warning)' : (finished ? 'var(--gray-400)' : 'var(--success)')};">
                    ${schedule.isDayOff ? 
                        (currentLanguage === 'ja' ? '休み' : '休息') : 
                        `${schedule.startTime ? schedule.startTime.substring(0, 5) : ''} - ${schedule.endTime ? schedule.endTime.substring(0, 5) : ''}`}
                </div>
                ${!schedule.isDayOff ? `
                    <div style="font-size: 12px; color: var(--gray-500); font-weight: 500;">
                        ${finished 
                            ? `<span style="color: var(--gray-400); font-weight: 700;"><i class="fas fa-door-closed"></i> ${currentLanguage === 'ja' ? '退勤済み' : '已下班'}</span>`
                            : `${currentLanguage === 'ja' ? '時間:' : '时间:'} ${calculateShiftHours(schedule.startTime, schedule.endTime)}h${shiftPeriodLabel(schedule.startTime) ? ' · ' + shiftPeriodLabel(schedule.startTime) : ''}`}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function showStats() {
    const container = document.getElementById('statsGrid');
    if (!container) return;
    
    // Tổng thời gian làm việc trong tuần của tất cả nhân viên (đã làm tròn từng người trước khi cộng)
    let totalWeekHours = 0;
    employees.forEach(employee => {
        totalWeekHours += calculateWeeklyHours(employee.id);
    });
    totalWeekHours = roundHours(totalWeekHours, 1);
    
    const totalEmployees = employees.length;
    const totalSchedules = Object.keys(schedules).length;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayShifts = Object.values(schedules).filter(s => s && s.date === todayStr && !s.isDayOff).length;
    const monthHours = roundHours(employees.reduce((sum, emp) => sum + calculateMonthlyHours(emp.id), 0), 1);
    const avgWeekHours = roundHours(totalWeekHours / (employees.length || 1), 1);
    
    const positionStatCards = POSITIONS.map(pos => `
        <div class="stat-card">
            <h4>${employees.filter(e => e.position === pos.key).length}</h4>
            <p>${positionLabel(pos.key)}</p>
        </div>
    `).join('');
    
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
        ${positionStatCards}
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
