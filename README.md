# SalaryOnline

## Cập nhật mới (đợt này)
1. Nút "職種変更" trên mỗi thẻ nhân viên & modal chi tiết – đổi vị trí nhanh giữa フロント / 厨房 / ラッカ.
2. Checkbox "早退" trong modal sửa ca làm (bấm vào 1 ô ngày trên lịch tuần) – đánh dấu ca đó là về sớm.
3. Ca làm tự động phân loại 早班 (bắt đầu trước 17h, màu xanh dương) / 晚班 (từ 17h trở đi, màu tím) trên lịch tuần và thẻ nhân viên, kèm icon ☀️/🌙 để phân biệt rõ hơn.
4. Nút "来週へコピー" trên thẻ / modal nhân viên – copy toàn bộ ca của 1 người sang tuần kế tiếp.
5. Nút "来週へ複製" trên thanh Quick Actions – copy lịch của TẤT CẢ nhân viên sang tuần kế tiếp.
6. Thêm vị trí mới "拉客" (ラッカ) – có trong bộ lọc, form thêm nhân viên, thống kê, lịch tuần...
7. Bảng lịch tuần trên desktop: cột giờ/tên hiển thị full, chữ to hơn, không cần cuộn ngang.
8. Màu sắc phân biệt rõ 早班 (xanh dương) / 晚班 (tím) trên cả lịch tuần và pattern tuần trên thẻ nhân viên.
9. "整周排班" (Quick Week Schedule) chỉ còn 2 lựa chọn: 早班 (08:00-17:00) và 晚班 (17:00-00:00).
10. Kéo-thả (drag & drop) tên nhân viên từ nhóm vị trí này sang nhóm khác để đổi vị trí làm việc.
11. Tối ưu giao diện mobile: header/nav gọn hơn, thẻ nhân viên chuyển sang lưới 2 cột vuông vắn/gọn hơn (thay vì 1 cột dài dọc như trước), lịch tuần chữ hợp lý hơn.
12. Số liệu "tổng số người theo vị trí" (ô đầu mỗi ngày trên lịch tuần + phần export text) giờ CHỈ tính nhân viên ca 晚班 (từ 17h trở đi). Nhân viên ca 早班 (trước 17h) vẫn hiển thị bình thường trên lịch nhưng không được cộng vào tổng này nữa.
13. Trang `staff.html` (đăng nhập nhân viên): làm lại giao diện đăng nhập gọn/hiện đại hơn (icon trong ô nhập, nút hiện/ẩn mật khẩu, bấm Enter đăng nhập được, trạng thái đang xử lý rõ ràng, thông báo lỗi đầy đủ hơn khi mất mạng/quá nhiều lần thử). Màn hình chính (lịch tuần, lịch sử yêu cầu) cũng được nén gọn hơn để đỡ phải cuộn. Áp dụng tương tự cho màn đăng nhập admin trong `index.html`.
14. Sửa lỗi tạo tài khoản đăng nhập cho nhân viên hay báo "ID đã được sử dụng" / "PERMISSION_DENIED" – xem mục **Khắc phục lỗi tạo/cấp lại tài khoản** bên dưới.

Toàn bộ tính năng cũ được giữ nguyên.

## Khắc phục lỗi tạo/cấp lại tài khoản đăng nhập (quan trọng)
Trước đây khi bấm "アカウント作成" (tạo tài khoản), hệ thống ghi vào 2 chỗ riêng lẻ trong
Realtime Database: `employees/{id}` rồi mới tới `loginIndex/{ID}`. Nếu Firebase Rules **chưa**
cho phép ghi node `loginIndex` (xem mục rules bên dưới), bước ghi thứ 2 sẽ báo lỗi
`PERMISSION_DENIED`, nhưng bước 1 (`employees/{id}`) và tài khoản Firebase Auth thì **đã được
tạo xong trước đó rồi** → dữ liệu bị "nửa vời". Lần bấm tạo tiếp theo sẽ báo
`このIDは既に使われています` (ID đã được dùng) vì tài khoản Auth với ID đó thực ra đã tồn tại.

Đợt này đã sửa tận gốc:
- Việc ghi `employees/{id}` và `loginIndex/{ID}` giờ được gộp vào **1 lệnh ghi duy nhất**
  (multi-path update) – nếu rules chặn thì CẢ HAI đều không ghi, không còn tình trạng nửa vời
  nữa (áp dụng cho cả tạo mới, cấp lại mật khẩu quên, và xoá tài khoản).
- Nếu vẫn gặp lỗi "ID đã được sử dụng", hệ thống giờ **tự động thử ID kế tiếp** vài lần thay
  vì bắt phải đóng/mở lại modal.
- Thông báo lỗi khi thiếu quyền Firebase Rules giờ rõ ràng hơn (chỉ thẳng ra cần bật quyền cho
  `loginIndex`) thay vì hiện `PERMISSION_DENIED` khó hiểu.
- **Thêm nút "リセット" (khắc phục lỗi)** ở cuối modal tài khoản (cả màn "tạo mới" lẫn màn "đã
  có tài khoản") – dùng khi việc tạo/cấp lại vẫn cứ báo lỗi liên tục. Nút này xoá sạch toàn bộ
  dữ liệu đăng nhập hiện tại của nhân viên đó (kể cả ID) để admin tạo lại từ đầu. Khác với nút
  "アカウントを完全に削除" (giữ nguyên ID, chỉ khoá không cho đăng nhập nữa – dùng khi nhân
  viên nghỉ việc), nút "リセット" giải phóng luôn ID để dùng lại, chỉ nên dùng khi có lỗi kỹ
  thuật thật sự.
- Nếu vẫn thấy lỗi quyền truy cập, hãy vào Firebase Console → Realtime Database → Rules và
  kiểm tra lại đúng như mục bên dưới rồi bấm "Publish".



## Tạo tài khoản đăng nhập cho nhân viên
- Mở chi tiết 1 nhân viên → nút "ログインアカウント" (登录账号).
- ID đăng nhập được TỰ ĐỘNG sinh theo mẫu cố định `KAJICHO01`, `KAJICHO02`... (tăng dần, không trùng - luôn kiểm tra lại với dữ liệu MỚI NHẤT trên Firebase ngay trước khi tạo, để tránh trường hợp 2 nhân viên bị gán trùng ID khi thao tác nhanh liên tiếp), mật khẩu cũng được tự sinh ngẫu nhiên đủ mạnh (hoa/thường/số/ký tự đặc biệt) - admin không cần tự nghĩ/nhập gì cả.
- Có nút 🔄 để sinh lại mật khẩu mới nếu muốn, và nút "ID・パスワードをコピー" để copy cả ID + mật khẩu rồi gửi cho nhân viên. Sau khi bấm "アカウント作成" thì KHÔNG thể xem lại mật khẩu ở màn hình này nữa (đúng theo giới hạn bảo mật của Firebase phía client), nên nhớ copy trước khi tạo.
- **Quên mật khẩu**: khi nhân viên đã có tài khoản, mở lại modal này sẽ thấy nút "パスワードを忘れた場合(新規発行)" - bấm vào sẽ TỰ ĐỘNG sinh 1 mật khẩu mới và cấp lại ngay, **ID đăng nhập giữ nguyên không đổi**, chỉ cần copy mật khẩu mới gửi cho nhân viên là đăng nhập lại được. (Về mặt kỹ thuật: do Firebase phía client không cho đổi mật khẩu của người khác, hệ thống tạo 1 tài khoản Firebase mới đứng sau cùng 1 ID hiển thị, thông qua bảng tra cứu `loginIndex` trong Realtime Database - xem lưu ý rule bên dưới).
- Nút "アカウントを完全に削除" (trước đây là "リンク解除") dùng khi muốn vô hiệu hoá hẳn tài khoản của nhân viên (ví dụ nghỉ việc) - lúc đó ID đó sẽ không đăng nhập được nữa và cũng không được cấp phát lại cho người khác.
- Cần đã bật Email/Password ở Firebase Console → Authentication → Sign-in method (ID của nhân viên được ghép thêm 1 domain giả cố định ở phía sau để thỏa định dạng email mà Firebase yêu cầu - nhân viên không cần biết và không cần nhập domain này).
- **Lưu ý về Firebase Rules**: bản này có thêm 1 node mới `loginIndex` trong Realtime Database (dùng để trang staff.html tra cứu đúng tài khoản hiện tại khi ID không đổi nhưng mật khẩu đã được cấp lại). Cần đảm bảo node này ĐỌC được mà không cần đăng nhập trước (giống các node `employees`/`schedules` hiện tại), ví dụ trong Firebase Rules:
  ```json
  "loginIndex": {
    ".read": true,
    ".write": true
  }
  ```
  Nếu rules hiện tại đã để mở toàn bộ database (`.read`/`.write`: true ở gốc) thì không cần chỉnh gì thêm.
- Lưu ý kỹ thuật: 3 file Firebase SDK (app/database/auth) giờ tải qua CDN chính thức của Google (gstatic.com) thay vì host cục bộ như trước, vì file auth-compat.js quá lớn để nhúng trực tiếp. 2 file cục bộ cũ (firebase-app-compat.js, firebase-database-compat.js) không còn được dùng, có thể xoá khỏi thư mục hosting nếu muốn dọn dẹp.

## Trang riêng cho nhân viên (staff.html)
Nhân viên vào file `staff.html` (ví dụ: `https://<domain-cua-ban>/staff.html`) để:
- Đăng nhập bằng ID + mật khẩu đã được admin tạo (mục "ログインアカウント" trong chi tiết nhân viên) - VD ID `KAJICHO01`.
- Xem lịch làm của CHÍNH MÌNH theo tuần (không thấy lịch người khác)
- Gửi lưu ý/liên lạc tự do (kèm ngày liên quan) về cho quản lý - KHÔNG còn tự đăng ký nghỉ hay tự đổi giờ làm trực tiếp từ trang này nữa, chỉ còn đúng 1 hình thức là gửi nội dung dạng text để quản lý xem và tự xử lý.
- Theo dõi trạng thái các lưu ý đã gửi: 審査中 (đang chờ) / 承認済み (đã xem/duyệt) / 却下 (từ chối)

## Quản lý yêu cầu (phía admin, trong index.html)
- Biểu tượng chuông 🔔 ở góc trên bên phải header, có số đỏ báo số yêu cầu đang chờ duyệt
- Bấm vào để xem danh sách, mỗi yêu cầu có 2 nút "承認" (duyệt) / "却下" (từ chối)
- Vì trang nhân viên giờ chỉ gửi dạng "yêu cầu khác" (lưu ý tự do), duyệt/từ chối chỉ đánh dấu trạng thái - admin tự vào chỉnh lịch tay nếu cần dựa trên nội dung nhân viên gửi

Các file cần upload thêm lên hosting: `staff.html`, `staff.js` (cùng thư mục với `index.html`, `app.js`, `style.css`).

