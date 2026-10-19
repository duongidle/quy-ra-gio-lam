# Quy ra giờ làm

Sáu tab trong một trang:

- **Sức khoẻ**: sổ thu nhập (lương, thưởng, làm thêm…) theo ngày, xem tổng năm, trung bình tháng/ngày, biểu đồ 12 tháng,
  so với cùng kỳ năm trước. Sổ nằm trên máy, hoặc trên Google Sheet của chính cậu nếu nối ở tab Dữ liệu.
- **Cầm về**: gross → thực nhận (trừ BHXH 8%, BHYT 1,5%, BHTN 1%, thuế TNCN biểu 5 bậc theo Luật 109/2025/QH15,
  cộng phụ cấp miễn thuế), tính ngược net → gross để đi deal lương, và so sánh 2 offer theo lương thực nhận mỗi giờ.
- **Quy ra giờ**: giỏ một hoặc nhiều món quy ra thời gian làm việc; trả thẳng, trả góp 0% (mỗi tháng tốn bao nhiêu giờ làm)
  hoặc để dành theo % lương (bao lâu mới mua được); quy đổi ra đồ đời thường; chia sẻ ảnh 3 mẫu (thẻ, hoá đơn, story),
  không bao giờ có lương trong ảnh.
- **Thói quen**: mấy món nhỏ lặp lại (trà sữa 3 lần/tuần, Netflix 1 lần/tháng…) mỗi năm ngốn bao nhiêu ngày công.
- **Đồng hồ**: tiền kiếm được hôm nay nhảy theo từng giây, kèm nút "Đang đi vệ sinh 🚽".
- **Dữ liệu**: nối Google Sheet (qua Apps Script, có hướng dẫn và mã để chép), xem chính xác những gì đang lưu trên máy
  và xoá hết bằng một nút.

Web tĩnh hoàn toàn: HTML + CSS + JS thuần, không framework, không bước build, không backend.
Trang chỉ gọi mạng tới đúng link Apps Script cậu tự dán (để đọc/ghi sổ thu); CSP trong `index.html` chặn mọi chỗ khác.

## File

- `index.html`: giao diện
- `style.css`: giao diện sáng/tối theo hệ thống
- `app.js`: nửa trên là hàm thuần (parse tiền, tính giờ làm, gross → net, format), nửa dưới là phần DOM
- `test.js`: test cho các hàm thuần

## Chạy local

```sh
python3 -m http.server 8000   # rồi mở http://localhost:8000
node test.js                  # chạy test, cần Node 18+
```

Mở thẳng `index.html` bằng `file://` cũng chạy được.

## Deploy

Trang chạy trên Cloudflare Pages (https://quyragiolam.pages.dev) bằng Direct Upload: nén `index.html`, `style.css`,
`app.js`, `_headers` thành zip rồi kéo thả vào dự án → Create new deployment. Không cần bước build.

Khi sửa `style.css` hoặc `app.js`, tăng số `?v=` trong `index.html` để trình duyệt không dùng bản cũ trong cache.
