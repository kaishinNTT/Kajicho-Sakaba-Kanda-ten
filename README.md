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
11. Tối ưu giao diện mobile: header/nav gọn hơn, card nhân viên compact hơn, lịch tuần chữ hợp lý hơn.
12. Số liệu "tổng số người theo vị trí" (ô đầu mỗi ngày trên lịch tuần + phần export text) giờ CHỈ tính nhân viên ca 晚班 (từ 17h trở đi). Nhân viên ca 早班 (trước 17h) vẫn hiển thị bình thường trên lịch nhưng không được cộng vào tổng này nữa.

Toàn bộ tính năng cũ được giữ nguyên.

## Tạo tài khoản đăng nhập cho nhân viên
- Mở chi tiết 1 nhân viên → nút "ログインアカウント" (登录账号).
- ID đăng nhập được TỰ ĐỘNG sinh theo mẫu cố định `KAJICHO01`, `KAJICHO02`... (tăng dần, không trùng), mật khẩu cũng được tự sinh ngẫu nhiên đủ mạnh (hoa/thường/số/ký tự đặc biệt) - admin không cần tự nghĩ/nhập gì cả.
- Có nút 🔄 để sinh lại mật khẩu mới nếu muốn, và nút "ID・パスワードをコピー" để copy cả ID + mật khẩu rồi gửi cho nhân viên. Sau khi bấm "アカウント作成" thì KHÔNG thể xem lại mật khẩu ở màn hình này nữa (đúng theo giới hạn bảo mật của Firebase phía client), nên nhớ copy trước khi tạo.
- Cần đã bật Email/Password ở Firebase Console → Authentication → Sign-in method (ID của nhân viên được ghép thêm 1 domain giả cố định ở phía sau để thỏa định dạng email mà Firebase yêu cầu - nhân viên không cần biết và không cần nhập domain này).
- Lưu ý kỹ thuật: 3 file Firebase SDK (app/database/auth) giờ tải qua CDN chính thức của Google (gstatic.com) thay vì host cục bộ như trước, vì file auth-compat.js quá lớn để nhúng trực tiếp. 2 file cục bộ cũ (firebase-app-compat.js, firebase-database-compat.js) không còn được dùng, có thể xoá khỏi thư mục hosting nếu muốn dọn dẹp.
- Do giới hạn của Firebase phía client, admin có thể TẠO tài khoản mới nhưng không thể tự đổi mật khẩu người khác trực tiếp — nếu nhân viên quên mật khẩu, cần bấm "リンク解除" (解除关联) rồi tạo lại tài khoản mới (sẽ nhận 1 ID mới, VD KAJICHO05).

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

