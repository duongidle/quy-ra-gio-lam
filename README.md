# Quy ra giờ làm

Hai công cụ trong một trang:

- **Quy ra giờ làm**: nhập lương thực nhận và một món đồ, trang quy giá món đồ ra thời gian làm việc.
  "À, hoá ra ly cà phê này tốn của mình 32 phút làm việc."
- **Lương thực nhận**: nhập lương gross, trang trừ bảo hiểm (BHXH 8%, BHYT 1,5%, BHTN 1%) và thuế TNCN
  (biểu 5 bậc, Luật 109/2025/QH15), rồi cộng phụ cấp miễn thuế trả ngoài gross, để ra lương thực nhận ước tính.

Web tĩnh hoàn toàn: HTML + CSS + JS thuần, không framework, không bước build, không gọi mạng.
Lương chỉ nằm trong trình duyệt (CSP trong `index.html` chặn mọi request ra ngoài).

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

- **GitHub Pages**: Settings → Pages → Source: *Deploy from a branch* → chọn branch và thư mục `/ (root)`.
- **Cloudflare Pages**: Create project → kết nối repo → Framework preset: *None*, Build command để trống, Build output directory: `/`.

Khi sửa `style.css` hoặc `app.js`, tăng số `?v=` trong `index.html` để trình duyệt không dùng bản cũ trong cache.
