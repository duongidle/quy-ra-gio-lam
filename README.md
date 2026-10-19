# Quy ra giờ làm

Nhập lương và một món đồ muốn mua, trang quy giá món đồ ra thời gian làm việc cần bỏ ra.
"À, hoá ra ly cà phê này tốn của mình 32 phút làm việc."

Web tĩnh hoàn toàn: HTML + CSS + JS thuần, không framework, không bước build, không gọi mạng.
Lương chỉ nằm trong trình duyệt (CSP trong `index.html` chặn mọi request ra ngoài).

## File

- `index.html`: giao diện
- `style.css`: giao diện sáng/tối theo hệ thống
- `app.js`: nửa trên là hàm thuần (parse tiền, tính toán, format), nửa dưới là phần DOM
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
