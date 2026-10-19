# CLAUDE.md — Quy ra giờ làm

Tài liệu cho Claude (và người) làm việc trên repo này. Đọc hết trước khi sửa: phần lớn quy tắc ở đây
đến từ những lần sửa sai trước đó, không phải sở thích ngẫu nhiên.

## Ứng dụng là gì

Web tĩnh, giao diện tiếng Việt, cho người dùng biết **lương về tay bao nhiêu** và **một món đồ tốn mấy giờ làm**.
Cảm giác cần đạt: nhìn con số là "à, hoá ra ly cà phê này tốn của mình 40 phút làm việc".
Từ tháng 10/2026 app thành **app xem và quản lý tài chính cá nhân**: có sổ thu nhập và tab Sức khoẻ (bức tranh từ ngày tới năm).
Phần chi tiêu sẽ làm sau ("từ từ phát triển").

Sáu tab:

| Tab (nhãn)  | `data-tab` | Hash     | Làm gì |
|-------------|-----------|----------|--------|
| Sức khoẻ    | `overview`| (không)  | Ghi khoản thu (Lương/Thưởng/Làm thêm/Khác + ngày + ghi chú); tổng năm, TB tháng, mỗi ngày, biểu đồ 12 tháng, danh sách khoản trong tháng, so cùng kỳ năm trước |
| Cầm về      | `gross`   | `#cam-ve` | 3 chế độ: Gross → Net, Net → Gross (dò ngược để deal lương), So 2 offer (lương thực nhận mỗi giờ) |
| Quy ra giờ  | `time`    | `#quy-ra-gio` | Giỏ một hoặc nhiều món → thời gian làm việc; cách mua: trả thẳng / trả góp 0% / để dành % lương; quy ra đồ đời thường; chia sẻ ảnh 3 mẫu |
| Thói quen   | `habit`   | `#thoi-quen` | Món nhỏ lặp lại (x lần / ngày·tuần·tháng) → mỗi năm tốn bao nhiêu ngày công |
| Đồng hồ     | `clock`   | `#dong-ho` | Tiền kiếm được hôm nay nhảy theo giây giữa giờ vào và giờ về; nút "Đang đi vệ sinh 🚽" |
| Dữ liệu     | `data`    | `#du-lieu` | Liệt kê đúng những gì đang lưu trong localStorage, giải thích quyền riêng tư, nút xoá |

Tab đầu (Sức khoẻ) để URL sạch (không `#`); lần đầu vào (chưa lưu gì) mở tab này. Hash tab **không được trùng `id` của ô nhập nào** (xem "Bẫy đã gặp").
Link cũ (`#net`, `#gross`, `#time`, `#habit`, `#clock`, `#data`) vẫn mở đúng tab qua `OLD_HASHES`.

## Ràng buộc cứng (không phá)

- **Tĩnh hoàn toàn**: HTML + CSS + JS thuần, không framework, không bước build, không npm dependency.
  Chỉ 3 file mã chạy trên trang: `index.html`, `style.css`, `app.js`. Muốn thêm file phải hỏi người dùng trước.
- **Lương không đi đâu ngoài Google Sheet của chính người dùng.** Không backend của mình, không analytics, không cookie,
  không font hay script từ CDN. Ngoại lệ duy nhất (người dùng yêu cầu): **khoản thu** trong sổ được gửi tới link
  Apps Script mà người dùng tự dán ở tab Dữ liệu (`checkScriptUrl` chỉ nhận `https://script.google.com/macros/s/…/exec`).
  Chưa nối sheet thì không gửi gì cả. Lương/thiết lập khác (ô lương, gross, thói quen…) vẫn chỉ ở localStorage.
  CSP trong `<meta>` của `index.html` (`default-src 'none'`, `connect-src` chỉ `script.google.com` + `script.googleusercontent.com`
  — Apps Script trả lời qua redirect sang googleusercontent) là hàng rào kỹ thuật; `_headers` lặp lại CSP dưới dạng HTTP header
  (kèm `frame-ancestors`) cho Cloudflare Pages. Đừng nới CSP thêm. Không dùng `style="..."` hay `<script>` inline (CSP chặn); đổi style qua `el.style.x = ...` thì được.
- **Ảnh chia sẻ không bao giờ chứa lương**, và không chứa thứ gì suy ngược ra lương dễ dàng:
  không "≈ X tháng lương", không phần trăm/số tháng để dành. Trả góp thì được in (giá ÷ số tháng không lộ lương).
  Lưu ý cố hữu: giá + thời gian vẫn suy ra được lương mỗi giờ; người dùng đã biết điều này.
- **localStorage luôn bọc try/catch**; trang phải chạy bình thường khi bộ nhớ bị chặn (hiện thông báo ở tab Dữ liệu).
- **Không tự điền giá** cho món người dùng chọn qua chip — giá thật tuỳ nơi, tuỳ lúc. Bảng `EVERYDAY` (giá ước chừng
  để so sánh "≈ 27 ly cà phê") là ngoại lệ có chủ ý, chỉ dùng để quy đổi cho vui.
- **Ngoài phạm vi**: đăng nhập, backend riêng, lấy giá từ mạng. (Sổ thu là "lịch sử" duy nhất; muốn dùng nhiều máy thì nối cùng một sheet.) Giỏ hàng và 2 offer cố ý không lưu.

## Cấu trúc file

```
index.html   Toàn bộ markup 5 tab, CSP, ?v= cache-busting cho CSS/JS
style.css    Token màu (sáng/tối), list-row, hero, tab, bố cục mobile/desktop
app.js       Nửa trên: hàm thuần (không đụng DOM). Nửa dưới: initUI() — mọi thứ DOM
test.js      Test bằng node:assert, không thư viện. Chạy: node test.js
_headers     Header bảo mật (CSP, frame-ancestors…) cho Cloudflare Pages
README.md    Mô tả ngắn, cách chạy và deploy
```

## Kiến trúc `app.js`

Bọc trong IIFE. `module.exports = Core` khi chạy bằng node (cho test); `initUI(Core)` khi có `document`.
**Quy tắc: logic tính toán và parse luôn là hàm thuần trong nửa trên, export qua `Core`, có test.** UI chỉ gọi
`evaluate*` rồi render kết quả.

### Hàm thuần chính

- **Tiền**: `parseMoney(str)` hiểu "45000", "45.000", "45k", "1,2tr", "1.2tr", "15 triệu", "1tr2", "2k5",
  "15 triệu 500", "1 tỷ 200 triệu", "45.000đ"; trả số nguyên VND (có thể âm) hoặc `null`.
  Quy tắc dấu: một dấu phân cách theo sau đúng 3 chữ số là hàng nghìn, còn lại là thập phân.
  "1tr2" = 1,2tr; "1 triệu 50" = 1.050.000 (theo cách nói). `formatNumber(n, maxDecimals)` / `formatVND` tự viết,
  không dùng Intl (để kết quả giống nhau trên node và trình duyệt): dấu chấm hàng nghìn, dấu phẩy thập phân.
- **Thời gian**: `formatDuration(minutes, hoursPerDay, daysPerMonth)` chọn đơn vị: giây → phút → "3 giờ 15 phút"
  → "4 ngày làm việc (≈ 32 giờ)" → thêm "≈ 2,3 tháng lương" → "28 năm làm việc". Trả `{ kind, parts, text, phrase, detail, monthsLine }`.
- **Thuế & bảo hiểm**: `GROSS_RULES`, `progressiveTax`, `grossToNet({ gross, dependents, insuranceBase, region, allowance })`,
  `netToGross(...)` (chia đôi trên `grossToNet`, làm tròn lên nghìn đồng).
- **Trạng thái từng tab** (nhận chuỗi người dùng gõ, trả `{ fields, result, hint }`):
  `evaluate` (Quy ra giờ: giỏ, trả góp, để dành), `evaluateGross` (Cầm về, `mode: 'gross'|'net'`),
  `evaluateOffers`, `evaluateHabits(raw, ctx)`. Đồng hồ: `parseClock`, `clockState`, `affordable`.
- **Sổ thu nhập**: `INCOME_TYPES` (salary/bonus/extra/other ↔ Lương/Thưởng/Làm thêm/Khác), `incomeType(nhãn gõ tay)`,
  `parseDate` ("2026-10-19", "19/10/2026"… → ISO, chặn ngày không có thật), `normalizeIncome(rows)` → `{ entries, skipped }`
  (dòng hỏng trên sheet bị bỏ qua và đếm), `checkIncome`, `summarizeIncome(entries, year, today)` (tổng, theo loại, 12 tháng,
  TB tháng/ngày tính từ tháng đầu có ghi nếu mới ghi giữa năm, so **cùng kỳ** năm trước với năm đang chạy), `incomeQuip`,
  `moneyParts` (số to "312,5 triệu"). `today` luôn truyền vào để hàm thuần.
- **Google Sheet**: `checkScriptUrl`, `readSheetReply(text)`, `sheetRow(entry)`, và `APPS_SCRIPT` — mã người dùng dán vào
  Apps Script (hiện trong `<textarea>` ở tab Dữ liệu, có nút chép; test kiểm tra cú pháp). Sửa `APPS_SCRIPT` thì người dùng
  phải dán lại và triển khai phiên bản mới, nên giữ tương thích ngược (phản hồi có `v: 1`).
- **Kiểm tra đầu vào**: `checkMoney`, `checkCount`, `checkDependents`, `checkAllowance`, `checkInsuranceBase`;
  thông báo nằm trong `MSG`. Mọi trạng thái lỗi phải ra một gợi ý nhẹ nhàng, **không bao giờ hiện NaN/Infinity**
  (test `noBadNumbers` canh điều này).

### Quy tắc thuế đang dùng (ước tính)

- Luật Thuế TNCN 109/2025/QH15, biểu lũy tiến 5 bậc theo tháng: ≤10tr 5%, ≤30tr 10%, ≤60tr 20%, ≤100tr 30%, trên 35%.
- Giảm trừ gia cảnh 15,5tr bản thân + 6,2tr mỗi người phụ thuộc.
- Bảo hiểm phần người lao động: BHXH 8%, BHYT 1,5%, BHTN 1%. Trần BHXH/BHYT = 20 × lương cơ sở 2.530.000đ (từ 1/7/2026);
  trần BHTN = 20 × lương tối thiểu vùng (NĐ 293/2025: I 5,31tr; II 4,73tr; III 4,14tr; IV 3,7tr).
- Phụ cấp miễn thuế: **trả ngoài gross**, không đóng BH, không tính thuế, cộng thẳng vào thực nhận (người dùng chọn cách hiểu này).
- **Chưa chắc**: số liệu lấy từ nguồn tổng hợp, chưa đối chiếu được văn bản gốc; các nguồn lệch nhau về ngày áp dụng
  (1/1/2026 theo kỳ tính thuế hay 1/7/2026). Chưa xử lý: hợp đồng < 3 tháng (khấu trừ 10%), người nước ngoài,
  mức trần phụ cấp ăn trưa, mức sàn đóng BH. Khi sửa số liệu thuế: cập nhật `GROSS_RULES`, chú thích ở đầu khối đó,
  dòng chú thích trong `index.html` (`.fine`) và test.

### Phần giao diện (`initUI`)

- Trạng thái chính: `state` (Quy ra giờ), `gState` (Cầm về), `oState` (offer), `hState` (thói quen).
  `updateAll(showErrors)` tính lại tất cả rồi gọi các `render*`. Lỗi hiện chậm 700ms khi đang gõ để không nhấp nháy ("15 tri…").
- **Đồng bộ lương**: kết quả tab Cầm về tự điền vào "Lương về tay" ở tab Quy ra giờ (`salaryLinked`).
  Người dùng tự gõ lương thì ngắt đồng bộ; sửa bất cứ thứ gì ở tab Cầm về thì nối lại. **Ai sửa sau cùng thì thắng.**
- `calcMode` ('gross'|'net') nhớ chiều tính của ô lương, tách khỏi `grossMode` (có thêm 'offers'). Đổi chiều thì đổi luôn
  con số trong ô để vẫn là cùng một mức lương. Đừng gộp hai biến này lại (đã từng gây lỗi hiểu nhầm 20tr net thành gross).
- Tab Thói quen và Đồng hồ dùng chung lương/ngày/giờ của tab Quy ra giờ qua `workContext()`.
- Giỏ hàng (`cart`) và thói quen (`habits`) render động; nút "+ Thêm món"/"+ Thêm thói quen" là dòng cuối trong card.
- **Sổ thu**: chưa nối sheet thì `localIncome` (lưu localStorage); đã nối thì `sheetIncome` chỉ sống trong bộ nhớ, tải lại
  từ sheet mỗi lần mở trang (`refreshSheet`). `book()` trả sổ đang dùng. Gọi mạng qua `request(url, body)`: GET để đọc,
  POST `{action:'add', entries}` / `{action:'delete', id}` với `Content-Type: text/plain` (tránh preflight CORS mà Apps Script
  không trả lời được), `credentials: 'omit'`, hết 20 giây thì huỷ. Lỗi dịch ra câu dễ hiểu ở `sheetError`.
  Nối sheet khi máy đang có khoản thu thì hiện nút "Đẩy N khoản trên máy lên sheet".
- Ô "Số tiền" ở Ghi khoản thu: chọn Lương thì tự điền lương về tay (theo ô lương tab Quy ra giờ, vốn đồng bộ từ Cầm về)
  — người dùng yêu cầu cho đỡ thao tác. `incAuto` tắt khi người dùng gõ, bật lại khi đổi loại hoặc ghi xong.
  Thưởng/Làm thêm/Khác thì để trống. Ngày nhận mặc định hôm nay.
- Trang tính "Thu nhập" trên sheet: cột `ID | Ngày | Loại | Số tiền | Ghi chú`. Người dùng được sửa/thêm tay; dòng chưa có ID
  được script tự điền khi đọc. Mọi chữ từ sheet render bằng `textContent`.
- Ảnh chia sẻ: canvas `drawClassic` (1080×1350), `drawReceipt` (hoá đơn), `drawStory` (1080×1920), chọn qua `shareTpl`.
  `canvasToBlob` dùng `toDataURL` **đồng bộ** để `navigator.share` vẫn nằm trong cú bấm (Safari đòi vậy); không share được thì tải về.

### Lưu trữ

Khoá `quy-ra-gio-lam:v2` (JSON): `tab, salary, days, hours, gross, allowance, insuranceBase, dependents, region, linked,
calcMode, habits[], clockStart, clockEnd, income[], sheetUrl`. `income` chỉ có khoản thu trên máy (chưa đẩy lên sheet). Lưu chuỗi người dùng gõ, không lưu số đã parse.
Toàn giá trị mặc định thì xoá khoá. Bản v1 (`quy-ra-gio-lam:v1`) được chuyển sang v2 khi tải rồi xoá.
Thêm trường mới: cập nhật `save()`, `load()` (kiểm tra kiểu từng trường), điều kiện `isDefault`, `clearSaved()`
và danh sách trong `renderSaved()` ở tab Dữ liệu.

## Giọng văn (quan trọng với người dùng)

- Xưng **"tớ"**, gọi người dùng là **"cậu"**.
- Câu bình luận theo công thức người dùng thích: **một vế nói thẳng sự thật + một phản ứng cụt lủn, hơi cợt nhả.**
  Mẫu chuẩn: *"Chưa phải đóng đồng thuế nào. Ngon! 😎"*, *"Hít một hơi thật sâu trước khi bấm mua."*,
  *"Mấy tháng lương. Toang."*, *"Sếp nghỉ hưu trước cậu luôn. Hết cứu."*
- Kho câu: `TIME_QUIPS`, `TAX_QUIPS`, `INSTALLMENT_QUIPS`, `NET_TO_GROSS_QUIPS`, `OFFER_QUIPS`, `SAVING_QUIPS`,
  `HABIT_QUIPS`, `TOILET_QUIPS`, `INCOME_QUIPS`. Mỗi mức ≥ 3 câu, **không câu nào trùng** (có test). Chọn câu bằng `pickLine(lines, seed)`
  với seed là dữ liệu đầu vào (món + giá…), nên cùng kết quả luôn ra cùng câu, không nhảy loạn khi gõ.
- Placeholder trong câu: `{tax}`, `{per}`, `{n}`, `{t}`, `{money}`, `{win}`, `{pct}`, `{Name}`/`{name}`, `{net}`, `{gross}` —
  test kiểm tra không còn `{` `}` sót lại.
- Câu bình luận phải đúng với mức của nó (ví dụ 5 giờ 22 phút không được nói "nguyên một ngày").
- Nhãn và tên tab cũng giữ giọng này: "Cầm về", "Quy ra giờ", "Trên hợp đồng ghi", "Bị trừ những gì",
  "Đang nhắm món gì?", "Còn cậu thì", "1 giờ của cậu đáng". Tránh tên khô kiểu phần mềm kế toán ("Lương", "Mua sắm").

## Hệ thống thiết kế

Người dùng đã đổi ý nhiều lần; trạng thái hiện tại là kết quả cuối cùng họ chấp nhận. Đừng tự đổi phong cách lớn.

- **Bố cục danh sách dòng**: con số kết quả to ở trên (`.hero`), bên dưới là các nhóm `.list` gồm `.row`
  "nhãn trái — giá trị phải". Mỗi dòng có thể có `.row-sub` (gợi ý / "= 1.200.000đ" / lỗi màu `--warn`).
- **Ô nhập là "chỗ trống để điền"**: không khung, số to đậm, gạch chân nét đứt màu `--accent-line`, focus thì nét liền.
  Người dùng ghét ô trông như ô Excel.
- **Phẳng hoàn toàn**: không `box-shadow` (trừ viền inset đánh dấu offer thắng). Card/chip/nút nổi dùng `border: var(--edge)`
  (1px `--hairline`). Đừng thêm đổ bóng lẻ tẻ.
- **Tinh nghịch có kiểm soát**: sticker đổi theo mức (`STICKERS`, 💳 trả góp, 🐷 để dành) lắc nhẹ, câu bình luận trong nhãn trắng
  nghiêng −1°, chip nghiêng ±1,5°, đồng hồ ở logo quay. **Không** emoji trước tiêu đề nhóm, **không** emoji trong tên tab.
- Màu: token trong `:root`, có bộ tối trong `@media (prefers-color-scheme: dark)`. Màu nhấn `--accent` chỉ dùng cho con số chính,
  nút chính và trạng thái chọn.
- Font: chồng font hệ thống (có "Be Vietnam Pro" nếu máy có sẵn), không tải font từ ngoài (CSP).
- **Điện thoại (mặc định)**: một cột, kết quả lên đầu. `.panel` là flex cột, `.side` là `display: contents`, thứ tự bằng
  `.o-0`…`.o-5`. DOM giữ thứ tự hợp lý cho bàn phím (nhập trước, kết quả sau).
- **Từ 860px**: hai cột cân nhau, trái = nhập, phải = kết quả (`.side-result` sticky). Cả hai cột mở đầu bằng một
  `.group-title` để đỉnh thẳng hàng (`.desk-only` "Kết quả" bên phải). Công tắc chế độ (`.mode-seg`) nằm giữa, trải trên cả hai cột.
  Khi thêm nội dung, đo lại để đáy hai cột lệch không quá ~20–30px ở 1280×800 và mục tiêu vừa một màn không cần cuộn.
- Tab: 6 tab tự rộng theo chữ. Từ 860px vừa một hàng (thanh tab rộng 480px). Màn điện thoại không đủ chỗ: thanh tab vuốt ngang,
  tab đang mở tự kéo vào tầm nhìn (`revealTab`), mép phải mờ dần (`.tabs.more`) khi còn tab khuất.
- Ô tiền dài tự thu nhỏ chữ (`fitMoneyInput`, class `.long`/`.longer`).

## Bẫy đã gặp (đừng tái phạm)

- **Cache lệch phiên bản**: trình duyệt và CDN giữ bản cũ; HTML mới + CSS cũ làm vỡ giao diện. **Mỗi lần sửa `style.css`
  hoặc `app.js` phải tăng `?v=` tương ứng trong `index.html`.**
- **Hash trùng id**: hash `#gross` trùng `<input id="gross">` khiến trình duyệt tự cuộn và focus vào ô. Hash tab phải khác mọi id.
- **Bố cục xê dịch làm trượt cú chạm**: chữ/phần tử co lại đúng lúc người dùng chạm (do blur → đổi chữ) làm cú chạm rơi
  sang nút khác. Đã gặp với preview tiền, chip, nút "+" ở 320px. Cách phòng: preview nằm cùng hàng nhãn, `holdHeight()`
  không cho `.row-sub` co lại, dòng gợi ý đủ ngắn để không gãy dòng ở 320px.
- **Thêm nút tạo động có `data-go`** thì dựa vào listener ủy quyền ở `document`, đừng gắn trực tiếp lúc khởi tạo.
- Đồng hồ tính cả giờ nghỉ trưa (tiền chạy đều từ giờ vào tới giờ về); đi vệ sinh ngoài giờ làm thì không tính tiền.
- "x lần / ngày" ở Thói quen nghĩa là 365 ngày/năm (gồm cuối tuần).

## Kiểm thử

1. `node test.js` — phải in `N passed, 0 failed`. Thêm hàm thuần thì thêm test, kể cả trường hợp biên
   (trống, 0, âm, chữ linh tinh, số rất lớn) và kiểm tra kho câu.
2. Kiểm tra trên trình duyệt thật bằng Playwright (Chromium có sẵn; trong môi trường cloud dùng
   `require('/opt/node-tools/node_modules/playwright')`, **không** chạy `playwright install`). Chạy server tĩnh
   `python3 -m http.server 8765` rồi:
   - Bề rộng **375px** (chính), **320px** (máy nhỏ), **1280×800** (desktop); cả **sáng và tối** (`colorScheme`).
   - `document.documentElement.scrollWidth` phải bằng bề rộng (không cuộn ngang).
   - Không lỗi console/pageerror; **không request nào ra ngoài** localhost.
   - Đồng hồ: dùng `page.clock.install({ time })` + `clock.runFor()` để thử.
   - Chụp ảnh và **tự nhìn** trước khi báo xong; ảnh chụp ngay sau khi bấm có thể dính hiệu ứng chuyển (0,15–0,3s), chờ ~400ms.
3. Đọc lại diff, tăng `?v=`, rồi mới commit.

## Nhánh và deploy

- **Chỉ một nhánh: `main`.** Làm việc, commit và push thẳng lên `main`; không tạo nhánh tính năng, không mở PR,
  không chờ người dùng merge tay (người dùng đã yêu cầu rõ). Trước khi push: `node test.js` qua, kiểm tra trình duyệt xong.
- **Không dùng GitHub Pages** (người dùng đã bỏ). Đừng tạo lại nhánh `gh-pages` hay bật Pages.
- **Cloudflare Pages** (https://quyragiolam.pages.dev) là nơi duy nhất trang chạy. Người dùng **không muốn nối Git** (lo tốn giới hạn build).
  Dùng Direct Upload: đóng gói đúng 4 file `index.html style.css app.js _headers` thành zip (không kèm `test.js`,
  `README.md`, `CLAUDE.md`) và gửi cho người dùng kéo thả vào dự án → Create new deployment. Môi trường không có token Cloudflare.
- Commit message tiếng Anh, mô tả lý do; không ghi tên model.

## Làm việc với người dùng

- Người dùng nói tiếng Việt, thích câu trả lời ngắn, thẳng, có giọng thân thiện.
- Khi người dùng chê giao diện mà không rõ muốn gì, đưa 2–3 phương án có xem trước (preview) thay vì đoán rồi làm lại cả trang.
- Sau mỗi thay đổi: push lên `main`, gửi zip mới cho Cloudflare, nói rõ cái gì đã kiểm tra và cái gì chưa chắc.
- Hướng tiếp theo người dùng đã nói: phần **chi tiêu** cho tab Sức khoẻ (chưa làm). Khi làm: thêm trang tính riêng trên sheet,
  thêm action trong `APPS_SCRIPT` mà không phá action cũ.
