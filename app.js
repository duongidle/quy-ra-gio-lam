/*
 * Quy ra giờ làm
 * Nửa trên: hàm thuần (không đụng DOM), test được bằng `node test.js`.
 * Nửa dưới: giao diện, chỉ chạy khi có `document`.
 * Không có request mạng nào ở đây: lương không bao giờ rời khỏi trình duyệt.
 */
(function () {
  'use strict';

  /* ===================== LOGIC THUẦN ===================== */

  var MAX_MONEY = 1e15; // 1 triệu tỷ — vượt mức này thì coi là gõ nhầm
  var DEFAULTS = { days: 22, hours: 8 };

  var UNITS = [
    { re: /^(k|ng|ngh|nghìn|nghin|ngàn|ngan)$/u, mult: 1e3 },
    { re: /^(tr|triệu|trieu|củ|cu)$/u, mult: 1e6 },
    { re: /^(tỷ|tỉ|ty|ti|tỏi|toi)$/u, mult: 1e9 }
  ];

  function unitMultiplier(unit) {
    for (var i = 0; i < UNITS.length; i++) {
      if (UNITS[i].re.test(unit)) return UNITS[i].mult;
    }
    return 0;
  }

  function isGrouped(str, sep) {
    return new RegExp('^\\d{1,3}(\\' + sep + '\\d{3})*$').test(str);
  }

  // Đọc một chuỗi số kiểu Việt: "45.000", "1,2", "1.234,5", "1,200,000".
  // Một dấu phân cách theo sau đúng 3 chữ số => hàng nghìn; còn lại => thập phân.
  function toNumber(str) {
    str = str.replace(/[.,]+$/, ''); // "45." khi đang gõ dở
    if (!str) return NaN;
    var lastDot = str.lastIndexOf('.');
    var lastComma = str.lastIndexOf(',');
    if (lastDot === -1 && lastComma === -1) return Number(str);

    if (lastDot !== -1 && lastComma !== -1) {
      var dec = lastDot > lastComma ? '.' : ',';
      var thou = dec === '.' ? ',' : '.';
      var at = str.lastIndexOf(dec);
      var intPart = str.slice(0, at);
      var frac = str.slice(at + 1);
      if (!/^\d+$/.test(frac) || !isGrouped(intPart, thou)) return NaN;
      return Number(intPart.split(thou).join('') + '.' + frac);
    }

    var sep = lastDot !== -1 ? '.' : ',';
    var parts = str.split(sep);
    if (parts.some(function (p) { return p === ''; })) return NaN;
    if (parts.length > 2) return isGrouped(str, sep) ? Number(parts.join('')) : NaN;
    if (parts[1].length === 3 && !/^0/.test(parts[0])) return Number(parts[0] + parts[1]);
    return Number(parts[0] + '.' + parts[1]);
  }

  /**
   * Hiểu cách người Việt gõ tiền: "45000", "45.000", "45k", "1,2tr", "1.2tr",
   * "15 triệu", "1tr2", "2k5", "15 triệu 500", "1 tỷ 200 triệu", "45.000đ".
   * Trả về số nguyên VND (có thể âm), hoặc null nếu trống / không đọc được.
   */
  function parseMoney(input) {
    if (input === null || input === undefined) return null;
    var s = String(input).normalize('NFC').toLowerCase().replace(/ /g, ' ').trim();
    s = s.replace(/\s*(?:vnđ|vnd|đồng|dong|₫|đ|d)\.?$/u, '').trim();
    if (!s) return null;

    var sign = 1;
    if (/^[-−–]/.test(s)) { sign = -1; s = s.slice(1).trim(); }
    else if (s[0] === '+') { s = s.slice(1).trim(); }

    // "45 000" -> "45000"
    s = s.replace(/(\d)\s+(?=\d{3}(?!\d))/g, '$1');

    var tokens = [];
    var tokenRe = /^(\d[\d.,]*)\s*(\p{L}+)?\.?\s*/u;
    var rest = s;
    while (rest.length) {
      var m = tokenRe.exec(rest);
      if (!m) return null;
      tokens.push({ num: m[1], unit: m[2] || null });
      rest = rest.slice(m[0].length);
    }
    if (!tokens.length) return null;

    var total = 0;
    var lastMult = Infinity;
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var n;
      if (t.unit) {
        var mult = unitMultiplier(t.unit);
        if (!mult || mult >= lastMult) return null;
        n = toNumber(t.num);
        if (!isFinite(n)) return null;
        total += n * mult;
        lastMult = mult;
      } else if (tokens.length === 1) {
        n = toNumber(t.num);
        if (!isFinite(n)) return null;
        total = n;
      } else if (i === tokens.length - 1 && /^\d{1,3}$/.test(t.num)) {
        // Phần lẻ sau đơn vị: "1tr2" = 1,2tr; "2k5" = 2.500; "15 triệu 500" = 15,5tr;
        // "1 triệu 50" = 1.050.000 (như cách nói "một triệu năm mươi").
        total += t.num.length === 1
          ? Number(t.num) * lastMult / 10
          : Number(t.num) * lastMult / 1000;
      } else {
        return null;
      }
    }

    var value = Math.round(sign * total);
    return isFinite(value) ? value : null;
  }

  // Số ngày / số giờ: "22", "8", "7,5", "7.5". null nếu trống, NaN nếu không phải số.
  function parseCount(input) {
    var s = String(input === null || input === undefined ? '' : input).trim().replace(',', '.');
    if (!s) return null;
    if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }

  // 1234567.8 -> "1.234.568"; formatNumber(2.34, 1) -> "2,3". Không phụ thuộc Intl.
  function formatNumber(n, maxDecimals) {
    maxDecimals = maxDecimals || 0;
    var fixed = Math.abs(n).toFixed(maxDecimals);
    var parts = fixed.split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var frac = parts[1] ? parts[1].replace(/0+$/, '') : '';
    var negative = n < 0 && Number(fixed) !== 0;
    return (negative ? '-' : '') + intPart + (frac ? ',' + frac : '');
  }

  function formatVND(n) {
    return formatNumber(n) + 'đ';
  }

  function smart(x) {
    return formatNumber(x, x < 10 ? 1 : 0);
  }

  /**
   * Chọn đơn vị phù hợp cho một khoảng thời gian làm việc (tính bằng phút).
   * Trả về { kind, parts: [[số, đơn vị]], text, phrase, detail, monthsLine }.
   */
  function formatDuration(minutes, hoursPerDay, daysPerMonth) {
    var dayMinutes = hoursPerDay * 60;
    var parts, kind, detail = null, monthsLine = null;

    if (minutes < 1) {
      var sec = Math.max(1, Math.round(minutes * 60));
      if (sec < 60) return build('seconds', [[String(sec), 'giây']]);
      minutes = 1;
    }

    var m = Math.round(minutes);
    if (m < dayMinutes) {
      if (m < 60) return build('minutes', [[String(m), 'phút']]);
      var h = Math.floor(m / 60);
      var r = m % 60;
      parts = [[String(h), 'giờ']];
      if (r) parts.push([String(r), 'phút']);
      return build('hours', parts);
    }

    var days = minutes / dayMinutes;
    var months = days / daysPerMonth;
    var years = months / 12;
    if (months >= 1) monthsLine = '≈ ' + smart(months) + ' tháng lương';

    if (years >= 1) {
      kind = 'years';
      parts = [[smart(years), 'năm làm việc']];
      detail = '≈ ' + formatNumber(days) + ' ngày làm việc';
    } else {
      kind = months >= 1 ? 'months' : 'days';
      parts = [[smart(days), 'ngày làm việc']];
      detail = '≈ ' + formatNumber(minutes / 60) + ' giờ';
    }
    return build(kind, parts);

    function build(k, p) {
      var text = p.map(function (x) { return x[0] + ' ' + x[1]; }).join(' ');
      var short = k === 'seconds' || k === 'minutes' || k === 'hours';
      return {
        kind: k,
        parts: p,
        text: text,
        phrase: short ? text + ' làm việc' : text,
        detail: detail,
        monthsLine: monthsLine
      };
    }
  }

  function cleanName(name) {
    return String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  }

  // Viết hoa chữ đầu, nhưng giữ nguyên kiểu "iPhone", "iPad".
  function capitalizeFirst(s) {
    var chars = Array.from(s);
    if (!chars.length) return s;
    if (chars[1] && chars[1] !== chars[1].toLowerCase()) return s;
    return chars[0].toUpperCase() + chars.slice(1).join('');
  }

  function buildSentence(name, price, duration) {
    var n = cleanName(name);
    var subject = n ? capitalizeFirst(n) : 'Món đồ';
    return subject + ' ' + formatVND(price) + ' này đáng ' + duration.phrase + ' của cậu.';
  }

  /*
   * Câu bình luận: mỗi mức có vài câu, chọn theo "hạt giống" (món + giá) để cùng một
   * kết quả luôn ra cùng một câu, không nhảy loạn mỗi lần gõ phím.
   */
  var TIME_QUIPS = [
    { upTo: function (m) { return m < 1; }, lines: [
      'Chớp mắt cái là đủ tiền. Quá dễ!',
      'Vài giây đi làm là có. Ngon ơ!',
      'Chưa tới một phút công. Mua luôn, khỏi nghĩ!'
    ] },
    { upTo: function (m) { return m < 5; }, lines: [
      'Chưa hết một clip TikTok. Duyệt!',
      'Vài phút gõ phím là có. Ngon lành!',
      'Ví còn chưa kịp đau. Mua!'
    ] },
    { upTo: function (m) { return m < 15; }, lines: [
      'Pha ly cà phê ở công ty là đủ. Nhẹ tênh!',
      'Mười mấy phút ngồi máy. Nghĩ chi cho mệt!',
      'Đi vệ sinh lâu chút là kiếm đủ. Hehe.'
    ] },
    { upTo: function (m) { return m < 30; }, lines: [
      'Bằng một cuộc họp lẽ ra chỉ cần gửi email. Được!',
      'Nửa tiếng công. Mua được, đừng nghiện là được.',
      'Lướt mạng trong giờ làm cũng tốn chừng đó. Huề!'
    ] },
    { upTo: function (m) { return m < 60; }, lines: [
      'Chưa hết một cuộc họp. Vẫn ổn!',
      'Gần một tiếng ngồi máy. Mua thì mua, đừng mua mỗi ngày nha.',
      'Một tiếng chạy deadline. Đáng không, tự hỏi lòng mình đi.'
    ] },
    { upTo: function (m, day) { return m < day / 2; }, lines: [
      'Nguyên buổi sáng cày cuốc. Hơi xót rồi đó.',
      'Mấy tiếng bị sếp réo tên. Cân nhắc nha.',
      'Họp, cà phê, rồi lại họp. Xong một món.'
    ] },
    { upTo: function (m, day) { return m < day; }, lines: [
      'Hơn nửa ngày công. Mệt ẻ ra mới có đó.',
      'Hơn nửa ngày ngồi máy đau lưng. Xứng không?',
      'Từ lúc chấm công tới quá giờ ăn trưa. Nghĩ kỹ chưa?'
    ] },
    { upTo: function (m, day) { return m < day * 2; }, lines: [
      'Hơn một ngày công. Ví bắt đầu run.',
      'Hai ngày đi làm, hai lần kẹt xe. Đáng không?',
      'Đủ để than "mệt quá" năm lần. Chắc chưa?'
    ] },
    { upTo: function (m, day) { return m < day * 5; }, lines: [
      'Vài ngày công. Đau ví nhẹ.',
      'Nguyên tuần làm việc cho một món. Ví khóc 🥲',
      'Từ thứ Hai mệt mỏi tới thứ Sáu mong chờ. Hết.'
    ] },
    { upTo: function (m, day, month) { return m < month; }, lines: [
      'Mấy tuần công sức. Mua xong nhớ xài cho đáng.',
      'Ngần ấy ngày chịu deadline. Ngủ một đêm rồi hẵng quyết.',
      'Gần trọn tháng đi làm. Xót xa ghê.'
    ] },
    { upTo: function (m, day, month) { return m < month * 3; }, lines: [
      'Hít một hơi thật sâu trước khi bấm mua.',
      'Cả tháng lương bay màu. Chắc chưa?',
      'Ăn mì gói bao lâu mới bù lại đây 🍜'
    ] },
    { upTo: function (m, day, month) { return m < month * 12; }, lines: [
      'Mấy tháng lương. Toang.',
      'Ví cậu vừa xỉu ngang 😵',
      'Đừng bấm mua lúc nửa đêm nha. Xin đó.'
    ] },
    { upTo: function (m, day, month) { return m < month * 12 * 5; }, lines: [
      'Vài năm không ăn không tiêu. Mơ thì cứ mơ 🌙',
      'Cần kế hoạch dài hơi, không phải một cú quẹt thẻ.',
      'Tới lúc mở file Excel tiết kiệm rồi. Căng.'
    ] },
    { upTo: function (m, day, month) { return m < month * 12 * 20; }, lines: [
      'Đi làm tới lúc tóc bạc. Bình tĩnh, uống miếng nước đã.',
      'Sếp nghỉ hưu trước cậu luôn. Hết cứu.',
      'Một phần ba cuộc đời đi làm. Thở đi.'
    ] },
    { upTo: function () { return true; }, lines: [
      'Làm tới kiếp sau may ra đủ 🫠',
      'Ngắm thôi cũng được mà. Ngắm free.',
      'Con số này để ước, đừng để tính. Bye.'
    ] }
  ];

  var TAX_QUIPS = [
    { upTo: function (g) { return g.tax === 0 && g.net < 10000000; }, lines: [
      'Chưa phải đóng đồng thuế nào. Lương khiêm tốn thì thuế cũng tha 🥲',
      'Thuế: 0đ. Nhà nước còn thương, chưa thu đồng nào 😌',
      'Không đóng thuế. Nhớ chừa tiền ăn sáng nha.'
    ] },
    { upTo: function (g) { return g.tax === 0; }, lines: [
      'Chưa phải đóng đồng thuế nào. Ngon! 😎',
      'Thuế: 0đ. Nhà nước chưa để ý tới cậu đâu. Ngon!',
      'Sạch thuế. Tận hưởng đi trước khi được tăng lương 😌'
    ] },
    { upTo: function (g) { return g.tax < 1000000; }, lines: [
      'Thuế {tax}, cỡ vài ly cà phê. Nhẹ!',
      'Góp {tax} tiền thuế. Coi như mời nhà nước ly trà sữa 🧋',
      'Thuế có {tax}. Muỗi!'
    ] },
    { upTo: function (g) { return g.tax < 5000000; }, lines: [
      'Góp {tax} thuế xây đường. Con đường trước nhà có phần cậu đó 🛣️',
      'Đóng {tax} thuế. Bắt đầu thấy xót rồi đúng không 🥲',
      'Thuế {tax}. Hơi đau nha.'
    ] },
    { upTo: function (g) { return g.tax < 20000000; }, lines: [
      'Đóng {tax} thuế mỗi tháng. Công dân gương mẫu 🫡',
      'Thuế {tax}. Nhìn phiếu lương mà mệt ẻ.',
      'Gánh {tax} ngân sách mỗi tháng. Gồng ghê.'
    ] },
    { upTo: function () { return true; }, lines: [
      'Đóng {tax} thuế mỗi tháng. Ngân sách cảm ơn cậu 🙇',
      'Thuế {tax}. Xứng đáng được tặng bằng khen.',
      'Tiền thuế hơn lương nhiều người. Đại gia rồi 🫡'
    ] }
  ];

  function hashSeed(seed) {
    var str = String(seed === undefined || seed === null ? '' : seed);
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }

  function pickLine(lines, seed) {
    return lines[hashSeed(seed) % lines.length];
  }

  function quip(minutes, hoursPerDay, daysPerMonth, seed) {
    var day = hoursPerDay * 60;
    var month = day * daysPerMonth;
    for (var i = 0; i < TIME_QUIPS.length; i++) {
      if (TIME_QUIPS[i].upTo(minutes, day, month)) return pickLine(TIME_QUIPS[i].lines, seed);
    }
    return '';
  }

  var STICKERS = { seconds: '⚡', minutes: '☕', hours: '🕐', days: '📅', months: '🗓️', years: '🏔️' };

  function stickerFor(kind) {
    return STICKERS[kind] || '🛍️';
  }

  // Một câu bình luận vui về tiền thuế, dựa trên kết quả của grossToNet.
  function netQuip(g, seed) {
    for (var i = 0; i < TAX_QUIPS.length; i++) {
      if (TAX_QUIPS[i].upTo(g)) return pickLine(TAX_QUIPS[i].lines, seed).replace('{tax}', formatVND(g.tax));
    }
    return '';
  }

  var MSG = {
    salaryInvalid: 'Tớ chưa đọc được số này. Thử kiểu 15000000, 15tr hoặc 15 triệu nhé.',
    salaryZero: 'Lương 0 đồng thì món gì cũng tốn vô hạn giờ làm 😅 Nhập lương thật nhé.',
    salaryNegative: 'Lương âm thì buồn quá. Nhập số dương nhé.',
    priceInvalid: 'Tớ chưa đọc được giá này. Thử kiểu 45000, 45k hoặc 1,2tr nhé.',
    priceZero: 'Đồ miễn phí thì không tốn phút nào cả 😄',
    priceNegative: 'Giá không âm được đâu nha.',
    tooLarge: 'Số này lớn quá, tớ đếm không xuể. Thử số nhỏ hơn nhé.',
    daysEmpty: 'Cần số ngày làm mỗi tháng (thường là 22).',
    daysInvalid: 'Số ngày phải là một con số, ví dụ 22.',
    daysRange: 'Số ngày làm mỗi tháng phải từ 1 đến 31.',
    hoursEmpty: 'Cần số giờ làm mỗi ngày (thường là 8).',
    hoursInvalid: 'Số giờ phải là một con số, ví dụ 8.',
    hoursRange: 'Số giờ mỗi ngày phải lớn hơn 0 và không quá 24.',
    hintSalary: 'Nhập lương thực nhận mỗi tháng để bắt đầu nhé.',
    hintSalaryFix: 'Ô lương đang có gì đó chưa ổn, xem lại giúp tớ nhé.',
    hintSchedule: 'Số ngày hoặc số giờ làm chưa hợp lý, sửa lại giúp tớ nhé.',
    hintPrice: 'Giờ nhập giá món đồ cậu đang nhắm tới xem.',
    dependentsInvalid: 'Số người phụ thuộc phải là số nguyên từ 0 đến 20.',
    allowanceInvalid: 'Tớ chưa đọc được số này. Thử kiểu 730k, hoặc để trống nếu không có phụ cấp.',
    insuranceInvalid: 'Tớ chưa đọc được số này. Để trống nếu công ty đóng bảo hiểm theo đúng lương gross.',
    insuranceTooHigh: 'Lương đóng bảo hiểm thường không cao hơn lương gross. Xem lại giúp tớ nhé.',
    hintGross: 'Nhập lương gross trên hợp đồng để xem thực nhận nhé.',
    hintGrossFix: 'Phần quy đổi từ gross đang có ô chưa ổn, xem lại giúp tớ nhé.',
    hintNet: 'Nhập số tiền muốn cầm về mỗi tháng nhé.',
    allowanceCovers: 'Phụ cấp đã đủ số cậu muốn cầm rồi, khỏi cần lương luôn 😄',
    hintOffers: 'Nhập lương gross của cả hai offer để so nhé.',
    hintOffersFix: 'Có ô của offer đang chưa ổn, xem lại giúp tớ nhé.',
    hintHabits: 'Nhập giá một thói quen bên dưới xem nó ăn bao nhiêu ngày công.',
    timesInvalid: 'Số lần phải là số lớn hơn 0, ví dụ 5.',
    hintNeedSalary: 'Cần lương về tay ở tab Mua sắm trước đã nhé.'
  };

  /*
   * Quy đổi gross -> thực nhận cho người lao động Việt Nam (hợp đồng từ 3 tháng, cư trú).
   * - Thuế TNCN: Luật 109/2025/QH15, biểu lũy tiến 5 bậc theo tháng; giảm trừ gia cảnh
   *   15,5tr cho bản thân + 6,2tr mỗi người phụ thuộc (áp dụng từ kỳ tính thuế 2026).
   * - Bảo hiểm phần người lao động: BHXH 8%, BHYT 1,5%, BHTN 1%.
   *   Trần BHXH/BHYT = 20 × lương cơ sở (2.530.000đ từ 1/7/2026).
   *   Trần BHTN = 20 × lương tối thiểu vùng (NĐ 293/2025, từ 1/1/2026).
   * Đây là ước tính: chưa tính phụ cấp miễn thuế, đoàn phí, các khoản giảm trừ khác.
   */
  var GROSS_RULES = {
    personalDeduction: 15500000,
    dependentDeduction: 6200000,
    brackets: [
      { upTo: 10000000, rate: 0.05 },
      { upTo: 30000000, rate: 0.10 },
      { upTo: 60000000, rate: 0.20 },
      { upTo: 100000000, rate: 0.30 },
      { upTo: Infinity, rate: 0.35 }
    ],
    bhxhRate: 0.08,
    bhytRate: 0.015,
    bhtnRate: 0.01,
    baseSalary: 2530000,
    regionalMinimum: { 1: 5310000, 2: 4730000, 3: 4140000, 4: 3700000 }
  };

  function progressiveTax(taxable) {
    var tax = 0;
    var lower = 0;
    var brackets = GROSS_RULES.brackets;
    for (var i = 0; i < brackets.length && taxable > lower; i++) {
      tax += (Math.min(taxable, brackets[i].upTo) - lower) * brackets[i].rate;
      lower = brackets[i].upTo;
    }
    return tax;
  }

  /**
   * opts = { gross, dependents = 0, insuranceBase = gross, region = 1, allowance = 0 }
   * allowance: phụ cấp không tính thuế, trả ngoài lương gross (không đóng BH, không tính thuế).
   * Trả về các khoản trừ và lương thực nhận (đều làm tròn đến đồng).
   */
  function grossToNet(opts) {
    var r = GROSS_RULES;
    var gross = opts.gross;
    var base = opts.insuranceBase === undefined || opts.insuranceBase === null ? gross : opts.insuranceBase;
    var minimum = r.regionalMinimum[opts.region] || r.regionalMinimum[1];
    var socialCap = 20 * r.baseSalary;
    var bhxh = Math.round(Math.min(base, socialCap) * r.bhxhRate);
    var bhyt = Math.round(Math.min(base, socialCap) * r.bhytRate);
    var bhtn = Math.round(Math.min(base, 20 * minimum) * r.bhtnRate);
    var insurance = bhxh + bhyt + bhtn;
    var deduction = r.personalDeduction + r.dependentDeduction * (opts.dependents || 0);
    var taxable = Math.max(0, gross - insurance - deduction);
    var tax = Math.round(progressiveTax(taxable));
    return {
      gross: gross,
      bhxh: bhxh,
      bhyt: bhyt,
      bhtn: bhtn,
      insurance: insurance,
      deduction: deduction,
      taxable: taxable,
      tax: tax,
      allowance: opts.allowance || 0,
      net: gross - insurance - tax + (opts.allowance || 0),
      socialCapped: base > socialCap,
      unemploymentCapped: base > 20 * minimum
    };
  }

  function checkMoney(raw, kind) {
    var text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!text) return { state: 'empty' };
    var v = parseMoney(text);
    var salary = kind === 'salary';
    if (v === null) return { state: 'invalid', message: salary ? MSG.salaryInvalid : MSG.priceInvalid };
    if (v === 0) return { state: 'zero', message: salary ? MSG.salaryZero : MSG.priceZero };
    if (v < 0) return { state: 'negative', message: salary ? MSG.salaryNegative : MSG.priceNegative };
    if (v > MAX_MONEY) return { state: 'tooLarge', message: MSG.tooLarge };
    return { state: 'ok', value: v };
  }

  function checkCount(raw, kind) {
    var v = parseCount(raw);
    var days = kind === 'days';
    if (v === null) return { state: 'empty', message: days ? MSG.daysEmpty : MSG.hoursEmpty };
    if (isNaN(v)) return { state: 'invalid', message: days ? MSG.daysInvalid : MSG.hoursInvalid };
    var ok = days ? v >= 1 && v <= 31 : v > 0 && v <= 24;
    if (!ok) return { state: 'range', message: days ? MSG.daysRange : MSG.hoursRange };
    return { state: 'ok', value: v };
  }

  function checkDependents(raw) {
    var v = parseCount(raw);
    if (v === null) return { state: 'ok', value: 0 };
    if (isNaN(v) || v < 0 || v > 20 || Math.floor(v) !== v) {
      return { state: 'invalid', message: MSG.dependentsInvalid };
    }
    return { state: 'ok', value: v };
  }

  function checkAllowance(raw) {
    var text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!text) return { state: 'ok', value: 0 };
    var v = parseMoney(text);
    if (v === null || v < 0) return { state: 'invalid', message: MSG.allowanceInvalid };
    if (v > MAX_MONEY) return { state: 'tooLarge', message: MSG.tooLarge };
    return { state: 'ok', value: v };
  }

  function checkInsuranceBase(raw, gross) {
    var text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!text) return { state: 'ok', value: null };
    var v = parseMoney(text);
    if (v === null || v < 0) return { state: 'invalid', message: MSG.insuranceInvalid };
    if (gross !== null && v > gross) return { state: 'range', message: MSG.insuranceTooHigh };
    return { state: 'ok', value: v };
  }

  /*
   * Quy ra đồ đời thường. Giá ở đây chỉ để so sánh cho vui, không phải giá món người dùng nhập,
   * nên trang luôn ghi rõ giá đang dùng.
   */
  var EVERYDAY = [
    { name: 'cốc trà đá', short: 'trà đá', price: 5000, emoji: '🧊' },
    { name: 'ly cà phê', short: 'cà phê', price: 35000, emoji: '☕' },
    { name: 'ly trà sữa', short: 'trà sữa', price: 45000, emoji: '🧋' },
    { name: 'tô phở', short: 'phở', price: 50000, emoji: '🍜' },
    { name: 'vé xem phim', short: 'vé phim', price: 100000, emoji: '🎬' },
    { name: 'bữa lẩu', short: 'lẩu', price: 400000, emoji: '🍲' },
    { name: 'đôi giày', short: 'giày', price: 1500000, emoji: '👟' },
    { name: 'chiếc iPhone', short: 'iPhone', price: 30000000, emoji: '📱' },
    { name: 'căn chung cư', short: 'chung cư', price: 3000000000, emoji: '🏢' }
  ];

  function shortPrice(v) {
    if (v >= 1e9) return formatNumber(v / 1e9, 1) + ' tỷ';
    if (v >= 1e6) return formatNumber(v / 1e6, 1) + 'tr';
    return formatNumber(v / 1e3, 1) + 'k';
  }

  /**
   * Tối đa 2 món đời thường có số lượng dễ hình dung (từ 1,5 đến 999), bỏ qua món trùng tên
   * với thứ người dùng đang mua. Trả về [] nếu không có món nào hợp.
   */
  function equivalents(total, names) {
    var text = String(names || '').toLowerCase();
    var fits = EVERYDAY.filter(function (ref) {
      var n = total / ref.price;
      return n >= 1.5 && n <= 999 && text.indexOf(ref.short.toLowerCase()) === -1;
    });
    if (!fits.length) return [];
    // Ưu tiên con số dễ hình dung nhất (gần ~15): "13 vé phim" dễ cảm hơn "261 cốc trà đá"
    var picks = fits.slice().sort(function (a, b) {
      return Math.abs(Math.log(total / a.price / 15)) - Math.abs(Math.log(total / b.price / 15));
    }).slice(0, 2);
    picks.sort(function (a, b) { return a.price - b.price; });
    return picks.map(function (ref) {
      var n = total / ref.price;
      return {
        count: n,
        text: formatNumber(n, n < 10 ? 1 : 0) + ' ' + ref.name,
        emoji: ref.emoji,
        priceNote: ref.short + ' ' + shortPrice(ref.price)
      };
    });
  }

  var INSTALLMENT_MONTHS = [0, 3, 6, 12, 24];

  // Câu bình luận cho trả góp, chia theo phần lương mỗi tháng phải gánh.
  var INSTALLMENT_QUIPS = [
    { upTo: function (share) { return share < 0.05; }, lines: [
      'Mỗi tháng {per}, trong {n} tháng. Nhẹ hều!',
      'Góp {per} mỗi tháng. Không thấm vào đâu. Duyệt!',
      'Mỗi tháng {per}. Trả góp mà như không. Ngon!'
    ] },
    { upTo: function (share) { return share < 0.15; }, lines: [
      'Mỗi tháng {per}, trong {n} tháng. Dài hơi ghê.',
      'Góp {per} mỗi tháng suốt {n} tháng. Nhớ đừng góp thêm món nữa nha.',
      'Mỗi tháng {per}. Chưa đau, nhưng {n} tháng là lâu đó.'
    ] },
    { upTo: function (share) { return share < 0.35; }, lines: [
      'Gánh {per} mỗi tháng suốt {n} tháng. Gồng nha.',
      'Mỗi tháng {per}. Cuối tháng ăn mì là có thật 🍜',
      'Góp {per} mỗi tháng trong {n} tháng. Ví sẽ nhớ cậu lắm.'
    ] },
    { upTo: function (share) { return share < 1; }, lines: [
      'Mỗi tháng {per}. Lương về là đi luôn. Toang.',
      'Góp {per} mỗi tháng. Phần còn lại để thở thôi 🫠',
      '{n} tháng gồng {per} mỗi tháng. Nghĩ lại không?'
    ] },
    { upTo: function () { return true; }, lines: [
      'Tiền góp mỗi tháng còn hơn cả lương. Thôi xong.',
      'Góp {per} mỗi tháng mà lương không đủ trả. Hết cứu.',
      'Trả góp kiểu này là đi làm nuôi cửa hàng. Bye.'
    ] }
  ];

  function installmentQuip(share, perText, months, seed) {
    for (var i = 0; i < INSTALLMENT_QUIPS.length; i++) {
      if (INSTALLMENT_QUIPS[i].upTo(share)) {
        return pickLine(INSTALLMENT_QUIPS[i].lines, seed).replace('{per}', perText).replace('{n}', String(months));
      }
    }
    return '';
  }

  /**
   * Trạng thái tab "Quy ra giờ làm" từ các chuỗi người dùng gõ.
   * raw = { salary, days, hours, items: [{ name, price }], installment } — salary là lương thực nhận,
   * installment là số tháng trả góp (0 = trả thẳng). Vẫn nhận { name, price } cho một món.
   */
  function evaluate(raw) {
    var items = raw.items || [{ name: raw.name, price: raw.price }];
    var itemFields = items.map(function (it) { return checkMoney(it.price, 'price'); });
    var bad = itemFields.filter(function (f) { return f.state !== 'ok' && f.state !== 'empty'; })[0];
    var f = {
      salary: checkMoney(raw.salary, 'salary'),
      days: checkCount(raw.days, 'days'),
      hours: checkCount(raw.hours, 'hours'),
      items: itemFields,
      price: items.length === 1 ? itemFields[0] : (bad || { state: itemFields.some(function (x) { return x.state === 'ok'; }) ? 'ok' : 'empty' })
    };
    var out = { fields: f, hourlyRate: null, result: null, hint: null };

    var incomeOk = f.salary.state === 'ok' && f.days.state === 'ok' && f.hours.state === 'ok';
    if (incomeOk) {
      out.hourlyRate = f.salary.value / (f.days.value * f.hours.value);
    }

    var chosen = [];
    items.forEach(function (it, idx) {
      if (itemFields[idx].state === 'ok') chosen.push({ name: cleanName(it.name), price: itemFields[idx].value });
    });

    if (f.salary.state !== 'ok') {
      out.hint = f.salary.state === 'empty' ? MSG.hintSalary : MSG.hintSalaryFix;
    } else if (!incomeOk) {
      out.hint = MSG.hintSchedule;
    } else if (bad) {
      out.hint = bad.message;
    } else if (!chosen.length) {
      out.hint = MSG.hintPrice;
    } else {
      var total = chosen.reduce(function (sum, it) { return sum + it.price; }, 0);
      if (total > MAX_MONEY) {
        out.hint = MSG.tooLarge;
        return out;
      }
      var hours = f.hours.value;
      var days = f.days.value;
      var names = chosen.map(function (it) { return it.name; }).join(', ');
      var seed = names + '|' + total;
      var minutes = total / out.hourlyRate * 60;
      var duration = formatDuration(minutes, hours, days);
      var single = chosen.length === 1;
      var title = single ? chosen[0].name : 'Giỏ ' + chosen.length + ' món';

      var result = {
        name: title,
        price: total,
        count: chosen.length,
        items: chosen,
        minutes: minutes,
        duration: duration,
        sentence: single
          ? buildSentence(chosen[0].name, total, duration)
          : 'Giỏ ' + chosen.length + ' món ' + formatVND(total) + ' này đáng ' + duration.phrase + ' của cậu.',
        quip: quip(minutes, hours, days, seed),
        equivalents: equivalents(total, names),
        installment: null
      };

      var months = Number(raw.installment) || 0;
      if (months > 0) {
        var per = total / months;
        var perMinutes = minutes / months;
        var perDuration = formatDuration(perMinutes, hours, days);
        var share = per / f.salary.value;
        result.installment = {
          months: months,
          perMonth: Math.round(per),
          perMinutes: perMinutes,
          perDuration: perDuration,
          share: share
        };
        result.sentence = 'Trả góp ' + months + ' tháng: mỗi tháng ' + formatVND(Math.round(per)) +
          ', đáng ' + perDuration.phrase + ' của cậu.';
        result.quip = installmentQuip(share, perDuration.text, months, seed);
      }

      var pct = Number(raw.savePct) || 0;
      if (raw.payMode === 'save' && pct > 0) {
        var perSave = f.salary.value * pct;
        var saveMonths = total / perSave;
        var span = formatMonths(saveMonths);
        result.installment = null;
        result.saving = { pct: pct, perMonth: Math.round(perSave), months: saveMonths, span: span };
        result.sentence = 'Để dành ' + formatNumber(pct * 100) + '% lương (' + formatVND(Math.round(perSave)) +
          ') mỗi tháng thì sau ' + span.text + ' là mua được.';
        result.quip = savingQuip(saveMonths, span.text, seed);
      } else {
        result.saving = null;
      }
      out.result = result;
    }
    return out;
  }

  /*
   * Dò ngược: cần gross bao nhiêu để thực nhận (kể cả phụ cấp) đạt `net`.
   * Thực nhận tăng đơn điệu theo gross (thuế suất biên < 100%), nên chia đôi là đủ.
   * Làm tròn lên tới nghìn đồng cho dễ đọc khi đi deal lương.
   */
  function netToGross(opts) {
    var allowance = opts.allowance || 0;
    var target = opts.net - allowance;
    if (target <= 0) return null;
    function netOf(g) {
      return grossToNet({ gross: g, dependents: opts.dependents, insuranceBase: opts.insuranceBase,
        region: opts.region }).net;
    }
    var lo = 0;
    var hi = Math.max(target * 2, target + 1e6);
    while (netOf(hi) < target) hi *= 2;
    while (hi - lo > 1) {
      var mid = Math.floor((lo + hi) / 2);
      if (netOf(mid) >= target) hi = mid; else lo = mid;
    }
    return Math.ceil(hi / 1000) * 1000;
  }

  var NET_TO_GROSS_QUIPS = [
    'Muốn cầm {net} thì xin gross {gross}. Nói to lên, đừng ngại!',
    'Deal gross {gross} nha. Thấp hơn là về tay hụt đó.',
    'Xin {gross} gross. Bị trả giá thì cười tươi rồi giữ giá 😌'
  ];

  /**
   * Trạng thái tab "Lương".
   * raw = { mode: 'gross' | 'net', gross, allowance, dependents, insuranceBase, region }.
   * Ở chế độ 'net', ô gross chứa số tiền muốn cầm về mỗi tháng.
   */
  function evaluateGross(raw) {
    var isNet = raw.mode === 'net';
    var f = { gross: checkMoney(raw.gross, 'salary') };
    f.allowance = checkAllowance(raw.allowance);
    f.dependents = checkDependents(raw.dependents);
    f.insuranceBase = checkInsuranceBase(raw.insuranceBase, f.gross.state === 'ok' && !isNet ? f.gross.value : null);
    var out = { fields: f, mode: isNet ? 'net' : 'gross', result: null, hint: null };

    if (f.gross.state !== 'ok') {
      out.hint = f.gross.state === 'empty' ? (isNet ? MSG.hintNet : MSG.hintGross) : MSG.hintSalaryFix;
      return out;
    }
    if (f.allowance.state !== 'ok' || f.dependents.state !== 'ok' || f.insuranceBase.state !== 'ok') {
      out.hint = MSG.hintGrossFix;
      return out;
    }
    var common = {
      dependents: f.dependents.value,
      insuranceBase: f.insuranceBase.value,
      region: Number(raw.region) || 1,
      allowance: f.allowance.value
    };
    var gross = f.gross.value;
    if (isNet) {
      gross = netToGross(Object.assign({ net: f.gross.value }, common));
      if (gross === null) {
        out.hint = MSG.allowanceCovers;
        return out;
      }
    }
    out.result = grossToNet(Object.assign({ gross: gross }, common));
    if (isNet) out.result.target = f.gross.value;
    return out;
  }

  function netQuipFor(g, seed) {
    if (g.target === undefined) return netQuip(g, seed);
    return pickLine(NET_TO_GROSS_QUIPS, seed)
      .replace('{net}', formatVND(g.target))
      .replace('{gross}', formatVND(g.gross));
  }

  /* --- So sánh 2 offer: tính lương thực nhận mỗi giờ của từng chỗ --- */
  var OFFER_QUIPS = [
    { upTo: function (d) { return d < 0.03; }, lines: [
      'Ngang ngửa nhau. Chọn chỗ nào sếp dễ thương hơn đi.',
      'Chênh không đáng kể. Tính thêm đường đi làm với đồng nghiệp đi.',
      'Hai bên như nhau. Chỗ nào gần nhà thì chọn. Hết.'
    ] },
    { upTo: function (d) { return d < 0.15; }, lines: [
      'Offer {win} hơn {pct} mỗi giờ. Cũng đáng để nghĩ.',
      '{win} trả mỗi giờ hơn {pct}. Không nhiều, không ít.',
      'Nhỉnh hơn {pct} mỗi giờ cho {win}. Cân thêm vụ OT nha.'
    ] },
    { upTo: function () { return true; }, lines: [
      'Offer {win} hơn hẳn {pct} mỗi giờ. Nghĩ chi nữa!',
      '{win} trả mỗi giờ hơn {pct}. Chênh vậy là rõ rồi.',
      'Hơn {pct} mỗi giờ. {win} thẳng tiến, đừng ngoảnh lại.'
    ] }
  ];

  /**
   * raw = { a: { gross, allowance, days, hours }, b: {...}, dependents, region }
   * Trả về thực nhận, lương mỗi giờ của từng offer, bên thắng và phần trăm chênh.
   */
  function evaluateOffers(raw) {
    var out = { fields: {}, result: null, hint: null };
    var offers = {};
    var anyEmpty = false;
    var anyBad = false;
    ['a', 'b'].forEach(function (k) {
      var o = raw[k] || {};
      var fo = {
        gross: checkMoney(o.gross, 'salary'),
        allowance: checkAllowance(o.allowance),
        days: checkCount(o.days, 'days'),
        hours: checkCount(o.hours, 'hours')
      };
      out.fields[k] = fo;
      if (fo.gross.state === 'empty') anyEmpty = true;
      else if (fo.gross.state !== 'ok') anyBad = true;
      if (fo.allowance.state !== 'ok' || fo.days.state !== 'ok' || fo.hours.state !== 'ok') anyBad = true;
      offers[k] = fo;
    });
    if (anyBad) { out.hint = MSG.hintOffersFix; return out; }
    if (anyEmpty) { out.hint = MSG.hintOffers; return out; }
    var res = {};
    ['a', 'b'].forEach(function (k) {
      var fo = offers[k];
      var g = grossToNet({ gross: fo.gross.value, allowance: fo.allowance.value,
        dependents: Number(raw.dependents) || 0, region: Number(raw.region) || 1 });
      var monthHours = fo.days.value * fo.hours.value;
      res[k] = { net: g.net, gross: g.gross, monthHours: monthHours, hourly: g.net / monthHours };
    });
    var win = res.a.hourly >= res.b.hourly ? 'a' : 'b';
    var lose = win === 'a' ? 'b' : 'a';
    var diff = res[win].hourly / res[lose].hourly - 1;
    out.result = { a: res.a, b: res.b, win: win, diff: diff };
    return out;
  }

  function offerQuip(diff, winLabel, seed) {
    for (var i = 0; i < OFFER_QUIPS.length; i++) {
      if (OFFER_QUIPS[i].upTo(diff)) {
        return pickLine(OFFER_QUIPS[i].lines, seed)
          .replace('{win}', winLabel)
          .replace('{pct}', formatNumber(diff * 100, diff < 0.1 ? 1 : 0) + '%');
      }
    }
    return '';
  }

  /* --- Để dành để mua --- */
  // Số tháng -> chữ dễ đọc: dưới 1 tháng tính ngày, từ 2 năm tính năm.
  function formatMonths(m) {
    var parts;
    if (m < 1) parts = [[String(Math.max(1, Math.ceil(m * 30))), 'ngày']];
    else if (m < 24) parts = [[formatNumber(m, m < 10 ? 1 : 0), 'tháng']];
    else parts = [[formatNumber(m / 12, 1), 'năm']];
    return { parts: parts, text: parts[0][0] + ' ' + parts[0][1] };
  }

  var SAVING_QUIPS = [
    { upTo: function (m) { return m < 1; }, lines: [
      'Chưa tới một tháng. Nhịn chút là có. Ngon!',
      'Vài tuần để dành là xong. Dễ ợt!',
      'Bớt vài ly trà sữa là đủ. Duyệt!'
    ] },
    { upTo: function (m) { return m < 6; }, lines: [
      'Để dành {t}. Hoặc trả góp rồi khóc 12 tháng. Chọn đi.',
      'Kiên nhẫn {t} là món về tay. Được!',
      '{t} nhịn ăn nhịn mặc. Chịu nổi không?'
    ] },
    { upTo: function (m) { return m < 24; }, lines: [
      'Để dành {t}. Lâu đó, nhưng không nợ ai đồng nào.',
      '{t} để dành. Giữa chừng đừng lỡ tay tiêu nha.',
      'Mất {t}. Tới lúc mua chắc ra đời mới rồi 😅'
    ] },
    { upTo: function () { return true; }, lines: [
      'Để dành {t}. Thôi tăng phần trăm lên đi.',
      '{t} mới đủ. Ước mơ thì không có hạn sử dụng 🌙',
      'Cỡ {t}. Cố lên, hoặc đổi món khác 🫠'
    ] }
  ];

  function savingQuip(months, spanText, seed) {
    for (var i = 0; i < SAVING_QUIPS.length; i++) {
      if (SAVING_QUIPS[i].upTo(months)) return pickLine(SAVING_QUIPS[i].lines, seed).replace('{t}', spanText);
    }
    return '';
  }

  /* --- Thói quen hằng ngày --- */
  var PER_YEAR = { day: 365, week: 52, month: 12 };

  var HABIT_QUIPS = [
    { upTo: function (d) { return d < 1; }, lines: [
      '{Name} cả năm chưa tới một ngày công. Thả ga!',
      '{Name} mỗi năm chỉ tốn {t}. Nhẹ nhàng thôi.',
      '{Name} hả? {t} mỗi năm. Kệ đi, sống mà!'
    ] },
    { upTo: function (d) { return d < 5; }, lines: [
      '{Name} mỗi năm ngốn {t} của cậu. Vài ngày công đó nha.',
      '{Name} cả năm bằng {t}. Cũng hơi thấm.',
      'Một năm {name} hết {t}. Coi như tiền mua vui.'
    ] },
    { upTo: function (d) { return d < 15; }, lines: [
      '{Name} mỗi năm ngốn {t} của cậu. Gần nửa tháng đi làm đó.',
      '{Name} cả năm bằng {t}. Thói quen nhỏ, hoá đơn to.',
      '{t} mỗi năm cho {name}. Nghĩ lại chưa?'
    ] },
    { upTo: function (d) { return d < 30; }, lines: [
      '{Name} mỗi năm ngốn {t}. Cả tháng đi làm chỉ để nuôi nó. Toang.',
      '{Name} ăn của cậu {t} mỗi năm. Đau ví thật sự.',
      '{t} cho {name}. Bỏ bớt là có ngay chuyến du lịch.'
    ] },
    { upTo: function () { return true; }, lines: [
      '{Name} ăn hơn một tháng lương mỗi năm. Hết cứu.',
      '{Name} tốn {t} mỗi năm. Thói quen hay khoản vay vậy?',
      'Mỗi năm {t} cho {name}. Ví cậu đang kêu cứu đó 🆘'
    ] }
  ];

  /**
   * raw = { habits: [{ name, price, times, per: 'day'|'week'|'month' }] }
   * ctx = { hourlyRate, hours, days } lấy từ tab Mua sắm (có thể null nếu chưa có lương).
   */
  function evaluateHabits(raw, ctx) {
    var habits = raw.habits || [];
    var fields = habits.map(function (h) {
      var times = parseCount(h.times);
      var tf = times === null ? { state: 'empty', message: MSG.timesInvalid }
        : (isNaN(times) || times <= 0 || times > 100) ? { state: 'invalid', message: MSG.timesInvalid }
        : { state: 'ok', value: times };
      return { price: checkMoney(h.price, 'price'), times: tf };
    });
    var out = { fields: fields, result: null, hint: null };
    var bad = fields.filter(function (f) {
      return (f.price.state !== 'ok' && f.price.state !== 'empty') || (f.price.state === 'ok' && f.times.state !== 'ok');
    })[0];
    var chosen = [];
    habits.forEach(function (h, i) {
      if (fields[i].price.state === 'ok' && fields[i].times.state === 'ok') {
        var perYear = fields[i].times.value * (PER_YEAR[h.per] || PER_YEAR.week);
        chosen.push({ name: cleanName(h.name) || 'Thói quen ' + (i + 1), yearCost: fields[i].price.value * perYear });
      }
    });
    if (!ctx || !ctx.hourlyRate) { out.hint = MSG.hintNeedSalary; return out; }
    if (bad) { out.hint = bad.price.state !== 'ok' ? bad.price.message : bad.times.message; return out; }
    if (!chosen.length) { out.hint = MSG.hintHabits; return out; }

    chosen.forEach(function (c) {
      c.minutes = c.yearCost / ctx.hourlyRate * 60;
      c.workDays = c.minutes / (ctx.hours * 60);
      c.duration = formatDuration(c.minutes, ctx.hours, ctx.days);
    });
    chosen.sort(function (a, b) { return b.yearCost - a.yearCost; });
    var total = chosen.reduce(function (sum, c) { return sum + c.yearCost; }, 0);
    var minutes = total / ctx.hourlyRate * 60;
    var top = chosen[0];
    var seed = top.name + '|' + total;
    out.result = {
      habits: chosen,
      total: total,
      minutes: minutes,
      duration: formatDuration(minutes, ctx.hours, ctx.days),
      top: top,
      quip: habitQuip(top, seed),
      equivalents: equivalents(total, chosen.map(function (c) { return c.name; }).join(', '))
    };
    return out;
  }

  function habitQuip(top, seed) {
    for (var i = 0; i < HABIT_QUIPS.length; i++) {
      if (HABIT_QUIPS[i].upTo(top.workDays)) {
        return pickLine(HABIT_QUIPS[i].lines, seed)
          .replace('{Name}', capitalizeFirst(top.name))
          .replace('{name}', top.name.charAt(0).toLowerCase() === top.name.charAt(0) ? top.name : lowerFirst(top.name))
          .replace('{t}', top.duration.text);
      }
    }
    return '';
  }

  // "Trà sữa" -> "trà sữa", nhưng giữ "iPhone", "Netflix" nếu chữ thứ hai viết hoa hoặc là tên riêng.
  function lowerFirst(s) {
    var chars = Array.from(s);
    if (chars[1] && chars[1] !== chars[1].toLowerCase()) return s;
    return chars[0].toLowerCase() + chars.slice(1).join('');
  }

  /* --- Đồng hồ kiếm tiền --- */
  function parseClock(text) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
    if (!m) return null;
    var h = Number(m[1]);
    var min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }

  /**
   * nowSec: số giây tính từ 0:00 hôm nay. start/end: phút trong ngày. dailyPay: lương một ngày công.
   * Tiền chạy đều từ giờ vào tới giờ về (tính cả giờ nghỉ trưa, cho vui).
   */
  function clockState(nowSec, start, end, dailyPay) {
    var span = ((end - start + 1440) % 1440 || 1440) * 60;
    var since = nowSec - start * 60;
    if (since < 0 && start > end) since += 86400; // ca qua đêm
    var ratePerSec = dailyPay / span;
    if (since < 0) return { phase: 'before', earned: 0, ratePerSec: ratePerSec, progress: 0, untilStart: -since };
    if (since >= span) return { phase: 'after', earned: dailyPay, ratePerSec: ratePerSec, progress: 1 };
    return { phase: 'working', earned: dailyPay * since / span, ratePerSec: ratePerSec, progress: since / span };
  }

  // "đủ 9 ly cà phê": chọn món đời thường mua được số lượng tròn, dễ hình dung nhất.
  function affordable(amount) {
    var best = null;
    EVERYDAY.forEach(function (ref) {
      var n = Math.floor(amount / ref.price);
      if (n < 1 || n > 99) return;
      var score = Math.abs(Math.log(n / 10));
      if (!best || score < best.score) best = { score: score, text: 'đủ ' + n + ' ' + ref.name + ' ' + ref.emoji };
    });
    return best ? best.text : '';
  }

  var TOILET_QUIPS = [
    { upTo: function (sec) { return sec < 60; }, lines: [
      'Đi nhanh vậy? Chưa kịp kiếm được bao nhiêu.',
      'Chưa tới một phút. Tốc độ ánh sáng luôn.',
      'Nhanh gọn lẹ. Công ty chắc tiếc cho cậu.'
    ] },
    { upTo: function (sec) { return sec < 300; }, lines: [
      'Vừa kiếm {money} trong lúc ngồi toilet. Đi làm chính là đây!',
      'Ngồi {t}, công ty trả {money}. Hợp lý!',
      'Kiếm {money} mà không cần gõ phím. Ngon!'
    ] },
    { upTo: function (sec) { return sec < 900; }, lines: [
      'Ngồi {t}, bỏ túi {money}. Lướt điện thoại hơi lâu rồi đó 👀',
      'Kiếm {money} trên ngai vàng. Sếp mà biết… 🤫',
      '{t} trong toilet, {money} vào ví. Quá lời!'
    ] },
    { upTo: function () { return true; }, lines: [
      'Ngồi tận {t}, kiếm {money}. Chân tê chưa?',
      'Toilet {t}, lương {money}. Coi chừng bị gọi đi họp.',
      '{t} lận! {money} này là tiền thuê nhà vệ sinh đó hả 😂'
    ] }
  ];

  function formatElapsed(sec) {
    var m = Math.floor(sec / 60);
    var s2 = Math.floor(sec % 60);
    return m ? m + ' phút' + (s2 ? ' ' + s2 + ' giây' : '') : s2 + ' giây';
  }

  function toiletQuip(seconds, amount, seed) {
    for (var i = 0; i < TOILET_QUIPS.length; i++) {
      if (TOILET_QUIPS[i].upTo(seconds)) {
        return pickLine(TOILET_QUIPS[i].lines, seed)
          .replace('{money}', formatVND(Math.round(amount)))
          .replace('{t}', formatElapsed(seconds));
      }
    }
    return '';
  }

  var Core = {
    DEFAULTS: DEFAULTS,
    MAX_MONEY: MAX_MONEY,
    parseMoney: parseMoney,
    parseCount: parseCount,
    formatNumber: formatNumber,
    formatVND: formatVND,
    formatDuration: formatDuration,
    buildSentence: buildSentence,
    capitalizeFirst: capitalizeFirst,
    quip: quip,
    EVERYDAY: EVERYDAY,
    equivalents: equivalents,
    INSTALLMENT_MONTHS: INSTALLMENT_MONTHS,
    INSTALLMENT_QUIPS: INSTALLMENT_QUIPS,
    installmentQuip: installmentQuip,
    TIME_QUIPS: TIME_QUIPS,
    TAX_QUIPS: TAX_QUIPS,
    stickerFor: stickerFor,
    netQuip: netQuip,
    GROSS_RULES: GROSS_RULES,
    progressiveTax: progressiveTax,
    grossToNet: grossToNet,
    evaluate: evaluate,
    evaluateGross: evaluateGross,
    netToGross: netToGross,
    netQuipFor: netQuipFor,
    NET_TO_GROSS_QUIPS: NET_TO_GROSS_QUIPS,
    evaluateOffers: evaluateOffers,
    OFFER_QUIPS: OFFER_QUIPS,
    offerQuip: offerQuip,
    formatMonths: formatMonths,
    SAVING_QUIPS: SAVING_QUIPS,
    savingQuip: savingQuip,
    PER_YEAR: PER_YEAR,
    HABIT_QUIPS: HABIT_QUIPS,
    evaluateHabits: evaluateHabits,
    parseClock: parseClock,
    clockState: clockState,
    affordable: affordable,
    TOILET_QUIPS: TOILET_QUIPS,
    toiletQuip: toiletQuip,
    formatElapsed: formatElapsed
  };

  if (typeof module === 'object' && module.exports) module.exports = Core;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { initUI(Core); });
    } else {
      initUI(Core);
    }
  }

  /* ===================== GIAO DIỆN ===================== */

  function initUI(core) {
    var STORAGE_KEY = 'quy-ra-gio-lam:v2';
    var OLD_STORAGE_KEY = 'quy-ra-gio-lam:v1';
    var FONT = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif';

    function $(id) { return document.getElementById(id); }
    function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

    // Ô nhập tab "Quy ra giờ làm" và tab "Lương thực nhận"; mỗi ô có một dòng phụ <id>-sub
    var inputs = { salary: $('salary'), days: $('days'), hours: $('hours') };
    // Giỏ hàng chỉ sống trong phiên này, không lưu lại (lưu lịch sử nằm ngoài phạm vi)
    var cart = [{ name: '', price: '' }];
    var payMode = 'now';
    var installment = 12;
    var savePct = 0.2;
    var shareTpl = 'card';
    // Tab Lương: 'gross' (gross → net), 'net' (net → gross), 'offers' (so 2 offer).
    // calcMode nhớ chiều tính đang dùng cho ô lương, kể cả khi đang mở phần so offer.
    var grossMode = 'gross';
    var calcMode = 'gross';
    var offers = {
      a: { gross: '', allowance: '', days: '22', hours: '8' },
      b: { gross: '', allowance: '', days: '22', hours: '8' }
    };
    // Thói quen được lưu lại (là thiết lập, không phải lịch sử)
    var habits = [{ name: '', price: '', times: '5', per: 'week' }];
    var CLOCK_DEFAULT = { start: '08:30', end: '17:30' };
    var toilet = null; // { startedAt (ms) } khi đang ngồi
    var gInputs = { gross: $('gross'), allowance: $('allowance'), insuranceBase: $('insurance-base') };
    var MONEY_KEYS = ['salary', 'price', 'gross', 'allowance', 'insuranceBase'];
    var gross = { dependents: 0, region: '1' };
    // Lương về tay ở tab giờ làm tự đi theo kết quả tab lương, cho tới khi người dùng tự gõ số khác.
    // Ai sửa sau cùng thì thắng: chỉnh lại bên tab lương thì nó lại đồng bộ.
    var salaryLinked = true;

    var el = {
      tabs: $all('[role="tab"]'),
      panels: { gross: $('panel-gross'), time: $('panel-time'), habit: $('panel-habit'), clock: $('panel-clock'), data: $('panel-data') },
      savedList: $('saved-list'),
      modes: $all('[data-mode]'),
      grossForm: $('gross-form'),
      offersForm: $('offers-form'),
      offerInputs: $all('[data-offer]'),
      grossLabel: $('gross-label'),
      gHero: $('g-hero'),
      gLabel: $('g-label'),
      oHero: $('o-hero'),
      oBig: $('o-big'),
      oLines: $('o-lines'),
      oSub: $('o-sub'),
      pays: $all('[data-pay]'),
      pcts: $all('[data-pct]'),
      instRow: $('inst-row'),
      saveRow: $('save-row'),
      shareBox: $('share-box'),
      tpls: $all('[data-tpl]'),
      habits: $('habits'),
      habitChips: $('habit-chips'),
      habitCtx: $('habit-ctx'),
      hBig: $('h-big'),
      hDetail: $('h-detail'),
      hEquiv: $('h-equiv'),
      hSub: $('h-sub'),
      hDetailList: $('h-detail-list'),
      hLines: $('h-lines'),
      clockStart: $('clock-start'),
      clockEnd: $('clock-end'),
      clockDaily: $('clock-daily'),
      clockCtx: $('clock-ctx'),
      cSticker: $('c-sticker'),
      cLabel: $('c-label'),
      cBig: $('c-big'),
      cBar: $('c-bar'),
      cProgress: $('c-progress'),
      cSub: $('c-sub'),
      toiletBtn: $('toilet'),
      toiletLive: $('toilet-live'),
      toiletQuip: $('toilet-quip'),
      big: $('big'),
      detail: $('detail'),
      sentence: $('sentence'),
      rate: $('rate'),
      share: $('share'),
      gNet: $('g-net'),
      gQuip: $('g-quip'),
      gSticker: $('g-sticker'),
      tSticker: $('t-sticker'),
      tLabel: $('t-label'),
      equiv: $('equiv'),
      items: $('items'),
      months: $all('[data-months]'),
      chips: $('chips'),
      gSub: $('g-sub'),
      gBar: $('g-bar'),
      bar: { net: $('bar-net'), ins: $('bar-ins'), tax: $('bar-tax') },
      gDetail: $('g-detail'),
      gLines: $('g-lines'),
      useNet: $('use-net'),
      footGo: $('foot-go'),
      footRelink: $('foot-relink'),
      relink: $('relink'),
      depValue: $('dep-value'),
      depMinus: $('dep-minus'),
      depPlus: $('dep-plus'),
      regions: $all('[data-region]'),
      clear: $('clear'),
      storageNote: $('storage-note'),
      toast: $('toast')
    };

    var state = null;
    var gState = null;
    var oState = null;
    var hState = null;
    var lastBig = '';
    var lastNet = '';
    var msgTimer = 0;
    var toastTimer = 0;

    function subOf(input) { return $(input.id + '-sub'); }

    /* --- Lưu trữ cục bộ (luôn bọc try/catch) --- */
    function storage() {
      try {
        var s = window.localStorage;
        var probe = '__qrgl__';
        s.setItem(probe, '1');
        s.removeItem(probe);
        return s;
      } catch (e) {
        return null;
      }
    }

    function load() {
      var s = storage();
      if (!s) {
        el.storageNote.textContent = 'Trình duyệt đang chặn lưu trữ, nên tớ sẽ không nhớ gì sau khi cậu đóng trang.';
        return null;
      }
      try {
        var saved = JSON.parse(s.getItem(STORAGE_KEY) || 'null');
        if (!saved) {
          // Bản đầu tiên chỉ có một ô lương, kèm chế độ net/gross
          var old = JSON.parse(s.getItem(OLD_STORAGE_KEY) || 'null');
          if (old && typeof old === 'object') {
            saved = { days: old.days, hours: old.hours, region: old.region, insuranceBase: old.insuranceBase };
            if (old.mode === 'gross') { saved.gross = old.salary; saved.dependents = old.dependents; }
            else saved.salary = old.salary;
          }
          s.removeItem(OLD_STORAGE_KEY);
        }
        if (!saved || typeof saved !== 'object') return null;
        ['salary', 'days', 'hours'].forEach(function (key) {
          if (typeof saved[key] === 'string') inputs[key].value = saved[key];
        });
        ['gross', 'allowance', 'insuranceBase'].forEach(function (key) {
          if (typeof saved[key] === 'string') gInputs[key].value = saved[key];
        });
        if (Array.isArray(saved.habits) && saved.habits.length) {
          habits = saved.habits.slice(0, 30).map(function (h) {
            return {
              name: typeof h.name === 'string' ? h.name : '',
              price: typeof h.price === 'string' ? h.price : '',
              times: typeof h.times === 'string' ? h.times : '1',
              per: core.PER_YEAR[h.per] ? h.per : 'week'
            };
          });
        }
        if (core.parseClock(saved.clockStart) !== null) el.clockStart.value = saved.clockStart;
        if (core.parseClock(saved.clockEnd) !== null) el.clockEnd.value = saved.clockEnd;
        var dep = core.parseCount(saved.dependents);
        if (dep !== null && dep >= 0 && dep <= 20 && Math.floor(dep) === dep) gross.dependents = dep;
        if (/^[1-4]$/.test(saved.region)) gross.region = saved.region;
        if (saved.calcMode === 'net') { calcMode = 'net'; grossMode = 'net'; }
        // Bản lưu cũ không có cờ này: đã có lương tự gõ thì giữ nguyên, đừng ghi đè
        salaryLinked = typeof saved.linked === 'boolean' ? saved.linked : !(saved.salary && saved.salary.trim());
        return el.panels[saved.tab] ? saved.tab : null;
      } catch (e) {
        return null; // dữ liệu hỏng thì bỏ qua
      }
    }

    function currentTab() {
      var names = Object.keys(el.panels);
      for (var i = 0; i < names.length; i++) {
        if (!el.panels[names[i]].hidden) return names[i];
      }
      return 'gross';
    }

    function habitsBlank() {
      return habits.every(function (h) { return !h.name.trim() && !h.price.trim(); });
    }

    function save() {
      try {
        var s = storage();
        if (!s) return;
        var data = {
          tab: currentTab(),
          salary: inputs.salary.value,
          days: inputs.days.value,
          hours: inputs.hours.value,
          gross: gInputs.gross.value,
          allowance: gInputs.allowance.value,
          insuranceBase: gInputs.insuranceBase.value,
          dependents: String(gross.dependents),
          region: gross.region,
          linked: salaryLinked,
          calcMode: calcMode,
          habits: habitsBlank() ? [] : habits,
          clockStart: el.clockStart.value,
          clockEnd: el.clockEnd.value
        };
        var isDefault = !data.salary.trim() && !data.gross.trim() && !data.allowance.trim() &&
          !data.insuranceBase.trim() && data.dependents === '0' && data.region === '1' &&
          data.days === String(core.DEFAULTS.days) && data.hours === String(core.DEFAULTS.hours) &&
          !data.habits.length && data.clockStart === CLOCK_DEFAULT.start && data.clockEnd === CLOCK_DEFAULT.end;
        if (isDefault) s.removeItem(STORAGE_KEY);
        else s.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (e) { /* không lưu được thì thôi */ }
      renderSaved();
    }

    /* --- Tab "Dữ liệu": đọc thẳng từ bộ nhớ, để thấy đúng những gì máy đang giữ --- */
    function readSaved() {
      try {
        var s = storage();
        return s ? JSON.parse(s.getItem(STORAGE_KEY) || 'null') : null;
      } catch (e) {
        return null;
      }
    }

    function moneyText(raw) {
      var v = core.parseMoney(raw);
      return v ? core.formatVND(v) : '';
    }

    function renderSaved() {
      var d = readSaved();
      el.savedList.textContent = '';
      var rows = [];
      if (d && typeof d === 'object') {
        var habitsCount = Array.isArray(d.habits) ? d.habits.length : 0;
        rows = [
          ['Lương về tay', moneyText(d.salary)],
          [d.calcMode === 'net' ? 'Muốn cầm về' : 'Lương gross', moneyText(d.gross)],
          ['Phụ cấp miễn thuế', moneyText(d.allowance)],
          ['Lương đóng BH', moneyText(d.insuranceBase)],
          ['Người phụ thuộc · vùng', (d.dependents || '0') + ' người · Vùng ' + ['I', 'II', 'III', 'IV'][(Number(d.region) || 1) - 1]],
          ['Ngày · giờ làm', (d.days || core.DEFAULTS.days) + ' ngày × ' + (d.hours || core.DEFAULTS.hours) + ' giờ'],
          ['Thói quen', habitsCount ? habitsCount + ' thói quen' : ''],
          ['Giờ vào · giờ về', (d.clockStart || CLOCK_DEFAULT.start) + ' → ' + (d.clockEnd || CLOCK_DEFAULT.end)]
        ];
      }
      if (!rows.length) {
        var empty = document.createElement('div');
        empty.className = 'row';
        var dt = document.createElement('dt');
        dt.textContent = 'Chưa lưu gì cả';
        empty.appendChild(dt);
        el.savedList.appendChild(empty);
        el.clear.disabled = true;
        return;
      }
      el.clear.disabled = false;
      rows.forEach(function (r) {
        var row = document.createElement('div');
        row.className = 'row';
        var dt = document.createElement('dt');
        dt.textContent = r[0];
        var dd = document.createElement('dd');
        dd.textContent = r[1] || '—';
        if (!r[1]) dd.className = 'none';
        row.appendChild(dt);
        row.appendChild(dd);
        el.savedList.appendChild(row);
      });
    }

    function clearSaved() {
      try {
        var s = storage();
        if (s) { s.removeItem(STORAGE_KEY); s.removeItem(OLD_STORAGE_KEY); }
      } catch (e) { /* bỏ qua */ }
      inputs.salary.value = '';
      salaryLinked = true;
      inputs.days.value = String(core.DEFAULTS.days);
      inputs.hours.value = String(core.DEFAULTS.hours);
      gInputs.gross.value = '';
      gInputs.allowance.value = '';
      gInputs.insuranceBase.value = '';
      gross.dependents = 0;
      gross.region = '1';
      habits = [{ name: '', price: '', times: '5', per: 'week' }];
      el.clockStart.value = CLOCK_DEFAULT.start;
      el.clockEnd.value = CLOCK_DEFAULT.end;
      renderHabits();
      updateAll(true);
      renderSaved();
      toast('Đã xoá. Máy này không còn nhớ lương của cậu nữa.');
    }

    /* --- Tab --- */
    function showTab(name, focus) {
      el.tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-tab') === name;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus();
      });
      Object.keys(el.panels).forEach(function (key) { el.panels[key].hidden = key !== name; });
      // Hash khác id của mọi ô nhập, kẻo trình duyệt tự nhảy tới và focus vào ô đó
      try { history.replaceState(null, '', '#' + HASHES[name]); } catch (e) { /* file:// */ }
      tick();
    }
    var HASHES = { gross: 'net', time: 'time', habit: 'habit', clock: 'clock', data: 'data' };

    /* --- Hiển thị chung --- */
    function toast(text) {
      el.toast.textContent = text;
      el.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2600);
    }

    function pop(node) {
      node.classList.remove('pop');
      void node.offsetWidth; // chạy lại animation
      node.classList.add('pop');
    }

    // Dòng phụ dưới nhãn: lỗi (nếu có) > số đã hiểu ("= 1.200.000đ") > gợi ý mặc định.
    function renderSub(input, field, showErrors) {
      var sub = subOf(input);
      if (!sub) return;
      var error = field && field.state !== 'ok' && field.state !== 'empty' && field.message;
      if (field && field.state === 'empty' && field.message && input.id !== 'salary' && input.id !== 'price' && input.id !== 'gross') {
        error = field.message; // ngày/giờ để trống mới cần báo
      }
      var text = sub.getAttribute('data-default') || '';
      var cls = '';
      if (error && showErrors) {
        text = error;
        cls = 'warn';
      } else if (field && field.state === 'ok' && field.value && MONEY_KEYS.indexOf(keyOf(input)) !== -1) {
        var raw = input.value.trim().replace(/\s*(đ|vnđ|vnd)$/i, '');
        if (raw !== core.formatNumber(field.value)) {
          text = '= ' + core.formatVND(field.value);
          cls = 'preview';
        }
      }
      if (!(error && !showErrors && sub.classList.contains('warn'))) {
        holdHeight(sub, function () {
          sub.textContent = text;
          sub.className = 'row-sub' + (cls ? ' ' + cls : '');
        });
      }
      input.setAttribute('aria-invalid', error && showErrors ? 'true' : 'false');
    }

    // Đổi chữ trong dòng phụ mà không làm nó co lại: nếu co, mọi thứ bên dưới bị kéo lên đúng lúc
    // người dùng đang chạm, và cú chạm trượt sang chỗ khác (gặp ở màn 320px)
    function holdHeight(node, change) {
      var before = node.offsetHeight;
      change();
      if (node.offsetHeight < before) node.style.minHeight = before + 'px';
    }

    function keyOf(input) {
      return input.id === 'insurance-base' ? 'insuranceBase' : input.id;
    }

    // Đánh dấu nút đang chọn trong một nhóm radio dạng nút bấm
    function checkGroup(buttons, attr, value) {
      buttons.forEach(function (btn) {
        var on = btn.getAttribute(attr) === value;
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });
    }

    // Nhóm radio dạng nút: bấm để chọn, mũi tên trái/phải để đổi
    function radioGroup(buttons, onPick) {
      buttons.forEach(function (btn, i) {
        btn.addEventListener('click', function () { onPick(btn); });
        btn.addEventListener('keydown', function (e) {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
          e.preventDefault();
          var next = buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length];
          onPick(next);
          next.focus();
        });
      });
    }

    function setBig(node, parts) {
      node.textContent = '';
      parts.forEach(function (p) {
        node.appendChild(document.createTextNode(p[0]));
        var unit = document.createElement('span');
        unit.className = 'unit';
        unit.textContent = p[1];
        node.appendChild(unit);
      });
    }

    /* --- Tab "Quy ra giờ làm" --- */
    function renderTime(showErrors) {
      Object.keys(inputs).forEach(function (key) {
        renderSub(inputs[key], state.fields[key], showErrors);
      });

      el.rate.textContent = state.hourlyRate !== null
        ? core.formatVND(Math.round(state.hourlyRate))
        : '—';

      renderItemSubs(showErrors);
      checkGroup(el.pays, 'data-pay', payMode);
      checkGroup(el.months, 'data-months', String(installment));
      checkGroup(el.pcts, 'data-pct', String(savePct));
      checkGroup(el.tpls, 'data-tpl', shareTpl);
      el.instRow.hidden = payMode !== 'installment';
      el.saveRow.hidden = payMode !== 'save';

      var r = state.result;
      el.shareBox.hidden = !r;
      el.tLabel.textContent = r && r.installment ? 'Mỗi tháng tốn của cậu'
        : r && r.saving ? 'Để dành ' + core.formatNumber(r.saving.pct * 100) + '% lương thì cần'
        : (r && r.count > 1 ? 'Giỏ này tốn của cậu' : 'Món này tốn của cậu');
      if (!r) {
        el.big.textContent = '—';
        el.big.classList.add('empty');
        el.detail.hidden = true;
        el.equiv.hidden = true;
        el.sentence.textContent = state.hint;
        el.sentence.classList.remove('result-text');
        el.tSticker.textContent = '🛍️';
        lastBig = '';
        return;
      }
      var inst = r.installment;
      var sv = r.saving;
      var d = inst ? inst.perDuration : r.duration;
      var parts = sv ? sv.span.parts : d.parts;
      el.big.classList.remove('empty');
      setBig(el.big, parts);
      el.tSticker.textContent = sv ? '🐷' : inst ? '💳' : core.stickerFor(d.kind);
      var bigKey = JSON.stringify(parts) + payMode;
      if (bigKey !== lastBig) { pop(el.big); pop(el.tSticker); lastBig = bigKey; }
      var extra = sv
        ? 'mỗi tháng để dành ' + core.formatVND(sv.perMonth) + ' · trả thẳng thì tốn ' + r.duration.text
        : inst
        ? 'trong ' + inst.months + ' tháng · tổng ' + r.duration.text
        : [d.detail, d.monthsLine].filter(Boolean).join(' · ');
      el.detail.textContent = extra;
      el.detail.hidden = !extra;
      el.sentence.textContent = r.sentence + ' ' + r.quip;
      el.sentence.classList.add('result-text');

      el.equiv.textContent = '';
      el.equiv.hidden = !r.equivalents.length;
      if (r.equivalents.length) {
        el.equiv.textContent = 'Bằng ≈ ' + r.equivalents.map(function (e) {
          return e.text + ' ' + e.emoji;
        }).join(' hoặc ');
      }
    }

    /* --- Giỏ hàng --- */
    function renderCart(focusIndex, focusField) {
      el.items.textContent = '';
      cart.forEach(function (item, idx) {
        var n = idx + 1;
        var row = document.createElement('div');
        row.className = 'row item-row';

        var main = document.createElement('span');
        main.className = 'row-main';
        var name = document.createElement('input');
        name.type = 'text';
        name.className = 'item-name';
        name.setAttribute('list', 'item-ideas');
        name.maxLength = 60;
        name.placeholder = cart.length > 1 ? 'Món ' + n : 'Tên món (tuỳ chọn)';
        name.setAttribute('aria-label', 'Tên món ' + n);
        name.enterKeyHint = 'next';
        name.value = item.name;
        var sub = document.createElement('span');
        sub.className = 'row-sub';
        main.appendChild(name);
        main.appendChild(sub);

        var wrap = document.createElement('span');
        wrap.className = 'row-input money';
        var price = document.createElement('input');
        price.type = 'text';
        price.className = 'item-price';
        price.inputMode = 'text';
        price.placeholder = '45k';
        price.spellcheck = false;
        price.setAttribute('autocapitalize', 'off');
        price.setAttribute('aria-label', 'Giá món ' + n);
        price.enterKeyHint = 'done';
        price.value = item.price;
        wrap.appendChild(price);

        row.appendChild(main);
        row.appendChild(wrap);
        if (cart.length > 1) {
          var remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'item-remove';
          remove.textContent = '✕';
          remove.setAttribute('aria-label', 'Bỏ món ' + n + ' khỏi giỏ');
          remove.addEventListener('click', function () {
            cart.splice(idx, 1);
            renderCart();
            updateAll(true);
          });
          row.appendChild(remove);
        }

        name.addEventListener('input', function () { item.name = name.value; updateAll(false); });
        price.addEventListener('input', function () { item.price = price.value; updateAll(false); });
        price.addEventListener('change', function () {
          var f = state.fields.items[idx];
          if (f && f.state === 'ok') { price.value = core.formatNumber(f.value); item.price = price.value; }
          fitMoneyInput(price);
          updateAll(true);
        });
        el.items.appendChild(row);
      });
      // Nút thêm món nằm luôn trong thẻ, như một dòng cuối
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'row add-row';
      add.textContent = '+ Thêm món';
      el.items.appendChild(add);
      if (focusIndex !== undefined) {
        var rows = el.items.querySelectorAll('.item-row');
        var target = rows[focusIndex] && rows[focusIndex].querySelector(focusField === 'name' ? '.item-name' : '.item-price');
        if (target) target.focus();
      }
    }

    function renderItemSubs(showErrors) {
      var rows = el.items.querySelectorAll('.item-row');
      cart.forEach(function (item, idx) {
        var row = rows[idx];
        if (!row) return;
        var f = state.fields.items[idx];
        var sub = row.querySelector('.row-sub');
        var price = row.querySelector('.item-price');
        var error = f && f.state !== 'ok' && f.state !== 'empty' && f.message;
        var text = '';
        var cls = '';
        if (error && showErrors) {
          text = f.message;
          cls = 'warn';
        } else if (f && f.state === 'ok') {
          var raw = item.price.trim().replace(/\s*(đ|vnđ|vnd)$/i, '');
          if (raw !== core.formatNumber(f.value)) { text = '= ' + core.formatVND(f.value); cls = 'preview'; }
        }
        if (!(error && !showErrors && sub.classList.contains('warn'))) {
          sub.textContent = text;
          sub.className = 'row-sub' + (cls ? ' ' + cls : '');
        }
        price.setAttribute('aria-invalid', error && showErrors ? 'true' : 'false');
      });
    }

    /* --- Tab "Lương thực nhận" --- */
    function line(label, value, cls, note) {
      var row = document.createElement('div');
      row.className = 'row' + (cls ? ' ' + cls : '');
      var dt = document.createElement('dt');
      dt.textContent = label;
      if (note) {
        var small = document.createElement('small');
        small.textContent = note;
        dt.appendChild(small);
      }
      var dd = document.createElement('dd');
      dd.textContent = value;
      row.appendChild(dt);
      row.appendChild(dd);
      el.gLines.appendChild(row);
    }

    function pct(part, whole) {
      return core.formatNumber(part / whole * 100, 1) + '%';
    }

    var GROSS_COPY = {
      gross: { label: 'Lương gross', sub: 'Trước thuế và bảo hiểm', placeholder: '30tr', hero: 'Mỗi tháng cầm về' },
      net: { label: 'Muốn cầm về', sub: 'Mỗi tháng, đã gồm phụ cấp', placeholder: '20tr', hero: 'Cần deal gross' }
    };

    function renderGross(showErrors) {
      var offersMode = grossMode === 'offers';
      el.modes.forEach(function (btn) {
        var on = btn.getAttribute('data-mode') === grossMode;
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });
      el.grossForm.hidden = offersMode;
      el.offersForm.hidden = !offersMode;
      el.gHero.hidden = offersMode;
      el.oHero.hidden = !offersMode;
      var copy = GROSS_COPY[calcMode];
      el.grossLabel.textContent = copy.label;
      $('gross-sub').setAttribute('data-default', copy.sub);
      gInputs.gross.placeholder = copy.placeholder;
      el.gLabel.textContent = copy.hero;
      renderOffers(showErrors);

      Object.keys(gInputs).forEach(function (key) {
        renderSub(gInputs[key], gState.fields[key], showErrors);
      });
      el.depValue.textContent = String(gross.dependents);
      el.depMinus.disabled = gross.dependents <= 0;
      el.depPlus.disabled = gross.dependents >= 20;
      el.regions.forEach(function (btn) {
        var on = btn.getAttribute('data-region') === gross.region;
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });

      var g = gState.result;
      el.gBar.hidden = !g;
      el.gDetail.hidden = !g || offersMode;
      el.useNet.hidden = !g || offersMode;
      if (!g) {
        el.gNet.textContent = '—';
        el.gNet.parentNode.classList.add('empty');
        el.gSub.textContent = gState.hint;
        el.gQuip.hidden = true;
        lastNet = '';
        return;
      }

      el.gNet.parentNode.classList.remove('empty');
      var netText = core.formatNumber(calcMode === 'net' ? g.gross : g.net);
      el.gNet.textContent = '';
      setBig(el.gNet, [[netText, 'đ']]);
      if (netText + calcMode !== lastNet) { pop(el.gNet); pop(el.gSticker); lastNet = netText + calcMode; }
      el.gQuip.textContent = core.netQuipFor(g, g.gross + '|' + g.allowance + '|' + gross.dependents);
      el.gQuip.hidden = false;

      var total = g.gross + g.allowance;
      el.bar.net.style.width = (g.net / total * 100) + '%';
      el.bar.ins.style.width = (g.insurance / total * 100) + '%';
      el.bar.tax.style.width = (g.tax / total * 100) + '%';
      el.gSub.textContent = '';
      [['net', 'Cầm về ' + pct(g.net, total)], ['ins', 'BH ' + pct(g.insurance, total)], ['tax', 'Thuế ' + pct(g.tax, total)]]
        .forEach(function (item, i) {
          if (i) el.gSub.appendChild(document.createTextNode('   '));
          var dot = document.createElement('span');
          dot.className = 'dot dot-' + item[0];
          el.gSub.appendChild(dot);
          el.gSub.appendChild(document.createTextNode(item[1]));
        });

      el.gLines.textContent = '';
      if (calcMode === 'net') line('Gross cần xin', core.formatVND(g.gross));
      line('BHXH 8%', '−' + core.formatVND(g.bhxh), '', g.socialCapped ? 'Đã chạm mức trần' : '');
      line('BHYT 1,5%', '−' + core.formatVND(g.bhyt), '', g.socialCapped ? 'Đã chạm mức trần' : '');
      line('BHTN 1%', '−' + core.formatVND(g.bhtn), '', g.unemploymentCapped ? 'Đã chạm mức trần' : '');
      line('Thuế TNCN', g.tax ? '−' + core.formatVND(g.tax) : '0đ', '',
        'Tính trên ' + core.formatVND(g.taxable) + ' sau giảm trừ ' + core.formatVND(g.deduction));
      if (g.allowance) line('Phụ cấp miễn thuế', '+' + core.formatVND(g.allowance), 'plus');
      line('Thực nhận', core.formatVND(g.net), 'total');
    }

    /* --- So sánh 2 offer --- */
    function renderOffers(showErrors) {
      el.offerInputs.forEach(function (input) {
        var f = oState.fields[input.getAttribute('data-offer')][input.getAttribute('data-key')];
        var bad = f && f.state !== 'ok' && !(f.state === 'empty' && input.getAttribute('data-key') === 'gross');
        if (showErrors || !bad) input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      });
      var r = oState.result;
      el.oLines.hidden = !r;
      if (!r) {
        el.oBig.textContent = '—';
        el.oBig.classList.add('empty');
        el.oSub.textContent = oState.hint;
        return;
      }
      var winLabel = r.win.toUpperCase();
      el.oBig.classList.remove('empty');
      if (r.diff < 0.005) setBig(el.oBig, [['Hoà', 'gần như bằng nhau']]);
      else setBig(el.oBig, [['+' + core.formatNumber(r.diff * 100, r.diff < 0.1 ? 1 : 0) + '%', 'mỗi giờ cho ' + winLabel]]);
      el.oLines.textContent = '';
      ['a', 'b'].forEach(function (k) {
        var row = document.createElement('div');
        if (k === r.win && r.diff >= 0.005) row.className = 'win';
        var dt = document.createElement('dt');
        dt.textContent = 'Offer ' + k.toUpperCase();
        var dd = document.createElement('dd');
        dd.textContent = core.formatVND(Math.round(r[k].hourly)) + '/giờ';
        var small = document.createElement('small');
        small.textContent = 'Về tay ' + core.formatVND(r[k].net) + ' · ' + core.formatNumber(r[k].monthHours) + ' giờ/tháng';
        dt.appendChild(small);
        row.appendChild(dt);
        row.appendChild(dd);
        el.oLines.appendChild(row);
      });
      el.oSub.textContent = core.offerQuip(r.diff, 'Offer ' + winLabel,
        offers.a.gross + '|' + offers.b.gross + '|' + offers.a.days + '|' + offers.b.days);
    }

    function updateAll(showErrors) {
      gState = core.evaluateGross({
        mode: calcMode,
        gross: gInputs.gross.value,
        allowance: gInputs.allowance.value,
        dependents: gross.dependents,
        insuranceBase: gInputs.insuranceBase.value,
        region: gross.region
      });
      if (salaryLinked && gState.result) {
        inputs.salary.value = core.formatNumber(gState.result.net);
      }
      $('salary-sub').setAttribute('data-default', salaryLinked && gState.result
        ? '✨ Tự lấy từ tab lương'
        : 'Sau thuế và bảo hiểm');
      el.footGo.hidden = !!gState.result;
      el.footRelink.hidden = !gState.result || salaryLinked;
      if (gState.result) el.relink.textContent = 'Dùng lại ' + core.formatVND(gState.result.net) + ' từ tab lương';

      oState = core.evaluateOffers({ a: offers.a, b: offers.b, dependents: gross.dependents, region: gross.region });

      state = core.evaluate({
        salary: inputs.salary.value,
        days: inputs.days.value,
        hours: inputs.hours.value,
        items: cart,
        payMode: payMode,
        installment: payMode === 'installment' ? installment : 0,
        savePct: savePct
      });
      hState = core.evaluateHabits({ habits: habits }, workContext());
      renderTime(showErrors);
      renderGross(showErrors);
      renderHabitResult(showErrors);
      renderClockStatic();
      // Báo lỗi chậm một nhịp để không nhấp nháy khi đang gõ dở ("15 tri…").
      clearTimeout(msgTimer);
      if (!showErrors) {
        msgTimer = setTimeout(function () { renderTime(true); renderGross(true); renderHabitResult(true); }, 700);
      }
    }

    // Lương mỗi giờ, giờ/ngày, ngày/tháng lấy từ tab Mua sắm, dùng chung cho Thói quen và Đồng hồ
    function workContext() {
      if (!state || state.hourlyRate === null) return null;
      return {
        hourlyRate: state.hourlyRate,
        hours: state.fields.hours.value,
        days: state.fields.days.value,
        salary: state.fields.salary.value
      };
    }

    function renderSalaryContext(node) {
      var c = workContext();
      node.textContent = '';
      var go = document.createElement('button');
      go.type = 'button';
      go.className = 'link-btn';
      go.setAttribute('data-go', 'time');
      if (c) {
        node.appendChild(document.createTextNode('Dựa trên lương về tay ' + core.formatVND(c.salary) + ', ' +
          core.formatNumber(c.days, 2) + ' ngày × ' + core.formatNumber(c.hours, 2) + ' giờ. '));
        go.textContent = 'Sửa';
      } else {
        node.appendChild(document.createTextNode('Chưa có lương về tay. '));
        go.textContent = 'Nhập ở tab Mua sắm';
      }
      node.appendChild(go);
    }

    /* --- Thói quen --- */
    var PER_LABEL = { day: 'ngày', week: 'tuần', month: 'tháng' };

    function renderHabits(focusIndex, focusField) {
      el.habits.textContent = '';
      habits.forEach(function (h, idx) {
        var n = idx + 1;
        var row = document.createElement('div');
        row.className = 'row item-row habit-row';

        var main = document.createElement('span');
        main.className = 'row-main';
        var name = document.createElement('input');
        name.type = 'text';
        name.className = 'item-name';
        name.maxLength = 60;
        name.placeholder = 'Thói quen ' + n;
        name.setAttribute('aria-label', 'Tên thói quen ' + n);
        name.value = h.name;

        var freq = document.createElement('span');
        freq.className = 'freq';
        var times = document.createElement('input');
        times.type = 'text';
        times.inputMode = 'decimal';
        times.className = 'freq-times';
        times.value = h.times;
        times.setAttribute('aria-label', 'Số lần, thói quen ' + n);
        var per = document.createElement('select');
        per.className = 'freq-per';
        per.setAttribute('aria-label', 'Mỗi ngày, tuần hay tháng, thói quen ' + n);
        Object.keys(PER_LABEL).forEach(function (key) {
          var opt = document.createElement('option');
          opt.value = key;
          opt.textContent = 'lần / ' + PER_LABEL[key];
          if (key === h.per) opt.selected = true;
          per.appendChild(opt);
        });
        freq.appendChild(times);
        freq.appendChild(per);

        var sub = document.createElement('span');
        sub.className = 'row-sub';
        main.appendChild(name);
        main.appendChild(freq);
        main.appendChild(sub);

        var wrap = document.createElement('span');
        wrap.className = 'row-input money';
        var price = document.createElement('input');
        price.type = 'text';
        price.className = 'item-price';
        price.inputMode = 'text';
        price.placeholder = '45k';
        price.spellcheck = false;
        price.setAttribute('autocapitalize', 'off');
        price.setAttribute('aria-label', 'Giá mỗi lần, thói quen ' + n);
        price.value = h.price;
        wrap.appendChild(price);

        row.appendChild(main);
        row.appendChild(wrap);
        if (habits.length > 1) {
          var remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'item-remove';
          remove.textContent = '✕';
          remove.setAttribute('aria-label', 'Bỏ thói quen ' + n);
          remove.addEventListener('click', function () {
            habits.splice(idx, 1);
            renderHabits();
            updateAll(true);
            save();
          });
          row.appendChild(remove);
        }

        function edited() { updateAll(false); save(); }
        name.addEventListener('input', function () { h.name = name.value; edited(); });
        times.addEventListener('input', function () { h.times = times.value; edited(); });
        per.addEventListener('change', function () { h.per = per.value; updateAll(true); save(); });
        price.addEventListener('input', function () { h.price = price.value; edited(); });
        price.addEventListener('change', function () {
          var f = hState.fields[idx] && hState.fields[idx].price;
          if (f && f.state === 'ok') { price.value = core.formatNumber(f.value); h.price = price.value; }
          fitMoneyInput(price);
          updateAll(true);
          save();
        });
        el.habits.appendChild(row);
      });
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'row add-row';
      add.textContent = '+ Thêm thói quen';
      el.habits.appendChild(add);
      if (focusIndex !== undefined) {
        var rows = el.habits.querySelectorAll('.habit-row');
        var target = rows[focusIndex] && rows[focusIndex].querySelector(focusField === 'name' ? '.item-name' : '.item-price');
        if (target) target.focus();
      }
    }

    function renderHabitResult(showErrors) {
      renderSalaryContext(el.habitCtx);
      var rows = el.habits.querySelectorAll('.habit-row');
      habits.forEach(function (h, idx) {
        var row = rows[idx];
        var f = hState.fields[idx];
        if (!row || !f) return;
        var sub = row.querySelector('.row-sub');
        var priceBad = f.price.state !== 'ok' && f.price.state !== 'empty';
        var timesBad = f.price.state === 'ok' && f.times.state !== 'ok';
        var text = '';
        var cls = '';
        if (showErrors && (priceBad || timesBad)) {
          text = priceBad ? f.price.message : f.times.message;
          cls = 'warn';
        } else if (f.price.state === 'ok') {
          var raw = h.price.trim().replace(/\s*(đ|vnđ|vnd)$/i, '');
          if (raw !== core.formatNumber(f.price.value)) { text = '= ' + core.formatVND(f.price.value); cls = 'preview'; }
        }
        if (showErrors || !sub.classList.contains('warn') || !(priceBad || timesBad)) {
          sub.textContent = text;
          sub.className = 'row-sub' + (cls ? ' ' + cls : '');
        }
        row.querySelector('.item-price').setAttribute('aria-invalid', showErrors && priceBad ? 'true' : 'false');
        row.querySelector('.freq-times').setAttribute('aria-invalid', showErrors && timesBad ? 'true' : 'false');
      });

      var r = hState.result;
      el.hDetailList.hidden = !r;
      el.hDetail.hidden = !r;
      el.hEquiv.hidden = !r || !r.equivalents.length;
      if (!r) {
        el.hBig.textContent = '—';
        el.hBig.classList.add('empty');
        el.hSub.textContent = hState.hint;
        el.hSub.classList.remove('result-text');
        return;
      }
      el.hBig.classList.remove('empty');
      setBig(el.hBig, r.duration.parts);
      el.hDetail.textContent = '≈ ' + core.formatVND(Math.round(r.total)) + ' mỗi năm';
      el.hEquiv.textContent = r.equivalents.length
        ? 'Đủ mua ≈ ' + r.equivalents.map(function (e) { return e.text + ' ' + e.emoji; }).join(' hoặc ')
        : '';
      el.hSub.textContent = r.quip;
      el.hSub.classList.add('result-text');
      el.hLines.textContent = '';
      r.habits.forEach(function (c, i) {
        var row = document.createElement('div');
        row.className = 'row' + (i === 0 && r.habits.length > 1 ? ' top' : '');
        var dt = document.createElement('dt');
        dt.textContent = core.capitalizeFirst(c.name);
        var small = document.createElement('small');
        small.textContent = core.formatVND(Math.round(c.yearCost)) + ' mỗi năm';
        dt.appendChild(small);
        var dd = document.createElement('dd');
        dd.textContent = c.duration.text;
        row.appendChild(dt);
        row.appendChild(dd);
        el.hLines.appendChild(row);
      });
    }

    /* --- Đồng hồ kiếm tiền --- */
    function hm(sec) {
      var m = Math.round(sec / 60);
      var h = Math.floor(m / 60);
      m = m % 60;
      return h ? h + ' giờ' + (m ? ' ' + m + ' phút' : '') : m + ' phút';
    }

    function clockInputs() {
      var start = core.parseClock(el.clockStart.value);
      var end = core.parseClock(el.clockEnd.value);
      if (start === null) start = core.parseClock(CLOCK_DEFAULT.start);
      if (end === null) end = core.parseClock(CLOCK_DEFAULT.end);
      return { start: start, end: end };
    }

    function dailyPay() {
      var c = workContext();
      return c ? c.salary / c.days : null;
    }

    function renderClockStatic() {
      renderSalaryContext(el.clockCtx);
      var daily = dailyPay();
      el.clockDaily.textContent = daily ? core.formatVND(Math.round(daily)) : '—';
      el.toiletBtn.hidden = !daily;
      tick();
    }

    function nowSeconds() {
      var d = new Date();
      return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
    }

    function tick() {
      if (!el || el.panels.clock.hidden) return;
      var daily = dailyPay();
      if (!daily) {
        el.cBig.textContent = '—';
        el.cBig.classList.add('empty');
        el.cBar.hidden = true;
        el.cSub.textContent = core.evaluateHabits({ habits: [] }, null).hint;
        el.cLabel.textContent = 'Hôm nay cậu đã kiếm';
        return;
      }
      var t = clockInputs();
      var c = core.clockState(nowSeconds(), t.start, t.end, daily);
      el.cBig.classList.remove('empty');
      setBig(el.cBig, [[core.formatNumber(Math.floor(c.earned)), 'đ']]);
      el.cBar.hidden = false;
      el.cProgress.style.width = (c.progress * 100) + '%';
      var startText = el.clockStart.value || CLOCK_DEFAULT.start;
      if (c.phase === 'before') {
        el.cLabel.textContent = 'Chưa tới giờ làm';
        el.cSticker.textContent = '😴';
        el.cSub.textContent = 'Còn ' + hm(c.untilStart) + ' nữa mới vào làm. Ngủ thêm đi.';
      } else if (c.phase === 'after') {
        el.cLabel.textContent = 'Hôm nay cậu đã kiếm trọn';
        el.cSticker.textContent = '🏁';
        el.cSub.textContent = 'Hết giờ rồi, về thôi! ' + capitalize(core.affordable(c.earned)) + '.';
      } else {
        el.cLabel.textContent = 'Từ ' + startText + ' tới giờ cậu đã kiếm';
        el.cSticker.textContent = '⏱️';
        var can = core.affordable(c.earned);
        el.cSub.textContent = (can ? capitalize(can) + '. ' : '') + 'Mỗi phút thêm ' + core.formatVND(Math.round(c.ratePerSec * 60)) + '.';
      }
      if (toilet) {
        var sec = (Date.now() - toilet.startedAt) / 1000;
        var mm = Math.floor(sec / 60);
        var ss = Math.floor(sec % 60);
        el.toiletLive.textContent = '⏱ ' + (mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss +
          ' · +' + core.formatVND(Math.round(c.ratePerSec * sec));
      }
    }

    function capitalize(text) {
      return text ? core.capitalizeFirst(text) : '';
    }

    function toggleToilet() {
      var daily = dailyPay();
      if (!daily) return;
      if (!toilet) {
        toilet = { startedAt: Date.now() };
        el.toiletBtn.textContent = '✅ Xong rồi';
        el.toiletBtn.classList.add('active');
        el.toiletLive.hidden = false;
        el.toiletQuip.hidden = true;
        tick();
        return;
      }
      var sec = (Date.now() - toilet.startedAt) / 1000;
      toilet = null;
      var t = clockInputs();
      var c = core.clockState(nowSeconds(), t.start, t.end, daily);
      el.toiletBtn.textContent = '🚽 Đang đi vệ sinh';
      el.toiletBtn.classList.remove('active');
      el.toiletLive.hidden = true;
      el.toiletQuip.textContent = c.phase === 'working'
        ? core.toiletQuip(sec, c.ratePerSec * sec, String(Math.round(sec)))
        : 'Ngoài giờ làm thì đi vệ sinh không ai trả lương đâu 😅';
      el.toiletQuip.hidden = false;
      pop(el.toiletQuip);
    }

    /* --- Ảnh chia sẻ (không bao giờ có lương) --- */
    function wrapLines(ctx, text, maxWidth, maxLines) {
      var words = text.split(' ');
      var lines = [];
      var line = '';
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + ' ' + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = words[i];
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        var last = lines[maxLines - 1];
        while (last.length && ctx.measureText(last + '…').width > maxWidth) last = last.slice(0, -1);
        lines[maxLines - 1] = last + '…';
      }
      return lines;
    }

    function drawClassic(r) {
      var W = 1080, H = 1350, PAD = 96;
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      var bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, '#FFF6EA');
      bg.addColorStop(1, '#FBE1CF');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Vài vòng tròn trang trí
      ctx.fillStyle = 'rgba(217, 83, 30, 0.10)';
      ctx.beginPath(); ctx.arc(W - 90, 170, 260, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(217, 83, 30, 0.06)';
      ctx.beginPath(); ctx.arc(80, H - 120, 200, 0, Math.PI * 2); ctx.fill();

      // Mặt đồng hồ nhỏ
      ctx.strokeStyle = '#D9531E';
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(PAD + 30, PAD + 30, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PAD + 30, PAD + 30); ctx.lineTo(PAD + 30, PAD + 12);
      ctx.moveTo(PAD + 30, PAD + 30); ctx.lineTo(PAD + 44, PAD + 36);
      ctx.stroke();

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#D9531E';
      ctx.font = '700 34px ' + FONT;
      ctx.fillText('QUY RA GIỜ LÀM', PAD + 84, PAD + 42);

      var y = 340;
      ctx.fillStyle = '#2A1F17';
      ctx.font = '800 76px ' + FONT;
      var nameLines = wrapLines(ctx, r.name ? core.capitalizeFirst(r.name) : 'Món đồ này', W - PAD * 2, 2);
      nameLines.forEach(function (l) { ctx.fillText(l, PAD, y); y += 92; });

      ctx.fillStyle = '#7C6A59';
      ctx.font = '600 52px ' + FONT;
      ctx.fillText(core.formatVND(r.price), PAD, y + 4);
      y += 150;

      ctx.font = '500 44px ' + FONT;
      ctx.fillText('đáng', PAD, y);
      y += 40;

      // Con số chính: thu nhỏ cho vừa, hết cỡ thì xuống dòng
      var text = r.duration.text;
      var size = 220;
      ctx.font = '800 ' + size + 'px ' + FONT;
      while (size > 110 && ctx.measureText(text).width > W - PAD * 2) {
        size -= 6;
        ctx.font = '800 ' + size + 'px ' + FONT;
      }
      var bigLines = wrapLines(ctx, text, W - PAD * 2, 3);
      ctx.fillStyle = '#D9531E';
      bigLines.forEach(function (l) { y += size * 0.95; ctx.fillText(l, PAD - 6, y); });

      // "ngày làm việc" / "năm làm việc" đã có sẵn chữ "làm việc"
      var k = r.duration.kind;
      if (k === 'seconds' || k === 'minutes' || k === 'hours') {
        y += 90;
        ctx.fillStyle = '#2A1F17';
        ctx.font = '600 48px ' + FONT;
        ctx.fillText('làm việc', PAD, y);
      }
      if (r.duration.detail) {
        y += 80;
        ctx.fillStyle = '#7C6A59';
        ctx.font = '500 44px ' + FONT;
        ctx.fillText(r.duration.detail, PAD, y);
      }

      ctx.fillStyle = '#7C6A59';
      ctx.font = 'italic 500 40px ' + FONT;
      wrapLines(ctx, r.quip, W - PAD * 2, 2).forEach(function (l, i) {
        ctx.fillText(l, PAD, H - PAD - 60 - (1 - i) * 52);
      });

      ctx.fillStyle = 'rgba(42, 31, 23, 0.45)';
      ctx.font = '500 30px ' + FONT;
      ctx.fillText('Món này tốn của cậu bao nhiêu thời gian làm việc?', PAD, H - PAD + 10);
      return canvas;
    }

    // Chọn cỡ chữ lớn nhất (không quá startSize) để text vừa maxWidth
    function fitFont(ctx, text, weight, startSize, maxWidth) {
      var size = startSize;
      ctx.font = weight + ' ' + size + 'px ' + FONT;
      while (size > 20 && ctx.measureText(text).width > maxWidth) {
        size -= 2;
        ctx.font = weight + ' ' + size + 'px ' + FONT;
      }
    }

    function newCanvas(W, H) {
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      return canvas;
    }

    // Câu tóm tắt cách mua, chỉ những gì không lộ lương (để dành theo % lương thì không ghi)
    function payLine(r) {
      if (r.installment) {
        return 'Trả góp ' + r.installment.months + ' tháng: ' + core.formatVND(r.installment.perMonth) +
          '/tháng ≈ ' + r.installment.perDuration.text;
      }
      return '';
    }

    function drawReceipt(r) {
      var W = 1080, PAD = 110;
      var items = r.items.slice(0, 8);
      var more = r.items.length - items.length;
      var H = 1180 + items.length * 70 + (more ? 70 : 0) + (payLine(r) ? 70 : 0);
      var canvas = newCanvas(W, H);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#F3E6D6';
      ctx.fillRect(0, 0, W, H);

      // Tờ hoá đơn với mép răng cưa
      var x0 = 70, x1 = W - 70, y0 = 70, y1 = H - 70, tooth = 22;
      ctx.fillStyle = '#FFFDF8';
      ctx.beginPath();
      ctx.moveTo(x0, y0 + tooth);
      for (var x = x0; x < x1; x += tooth * 2) { ctx.lineTo(x + tooth, y0); ctx.lineTo(Math.min(x + tooth * 2, x1), y0 + tooth); }
      ctx.lineTo(x1, y1 - tooth);
      for (var x2 = x1; x2 > x0; x2 -= tooth * 2) { ctx.lineTo(x2 - tooth, y1); ctx.lineTo(Math.max(x2 - tooth * 2, x0), y1 - tooth); }
      ctx.closePath();
      ctx.fill();

      var mono = '"SF Mono", "Roboto Mono", Menlo, Consolas, monospace';
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#2A1F17';
      ctx.font = '800 56px ' + FONT;
      ctx.fillText('HOÁ ĐƠN GIỜ LÀM', W / 2, 210);
      ctx.fillStyle = '#86766A';
      ctx.font = '500 32px ' + mono;
      var d = new Date();
      ctx.fillText('Ngày ' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(), W / 2, 265);

      function dashed(y) {
        ctx.save();
        ctx.strokeStyle = '#CDB8A2';
        ctx.lineWidth = 3;
        ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
        ctx.restore();
      }
      function pair(left, right, y, font, color) {
        ctx.font = font;
        ctx.fillStyle = color || '#2A1F17';
        ctx.textAlign = 'left';
        var maxLeft = W - PAD * 2 - ctx.measureText(right).width - 30;
        var l = left;
        while (l.length > 1 && ctx.measureText(l).width > maxLeft) l = l.slice(0, -1);
        if (l !== left) l = l.slice(0, -1) + '…';
        ctx.fillText(l, PAD, y);
        ctx.textAlign = 'right';
        ctx.fillText(right, W - PAD, y);
      }

      var y = 330;
      dashed(y);
      y += 80;
      items.forEach(function (it, i) {
        pair(core.capitalizeFirst(it.name || 'Món ' + (i + 1)), core.formatVND(it.price), y, '500 40px ' + mono);
        y += 70;
      });
      if (more) { pair('… và ' + more + ' món khác', '', y, '500 36px ' + mono, '#86766A'); y += 70; }
      dashed(y - 30);
      y += 40;
      pair('TỔNG', core.formatVND(r.price), y, '800 46px ' + mono);
      y += 60;
      dashed(y);
      y += 110;

      ctx.textAlign = 'center';
      ctx.fillStyle = '#86766A';
      ctx.font = '600 36px ' + FONT;
      ctx.fillText('QUY RA THỜI GIAN LÀM VIỆC', W / 2, y);
      y += 130;
      var text = r.duration.text;
      var size = 120;
      ctx.font = '800 ' + size + 'px ' + FONT;
      while (size > 60 && ctx.measureText(text).width > W - PAD * 2) { size -= 4; ctx.font = '800 ' + size + 'px ' + FONT; }
      ctx.fillStyle = '#E0571F';
      ctx.fillText(text, W / 2, y);
      if (payLine(r)) {
        y += 80;
        ctx.fillStyle = '#2A1F17';
        fitFont(ctx, payLine(r), 500, 34, W - PAD * 2);
        ctx.fillText(payLine(r), W / 2, y);
      }
      y += 100;
      ctx.fillStyle = '#86766A';
      ctx.font = 'italic 500 36px ' + FONT;
      wrapLines(ctx, r.quip, W - PAD * 2, 2).forEach(function (l) { ctx.fillText(l, W / 2, y); y += 50; });

      ctx.fillStyle = '#B9A58F';
      ctx.font = '500 30px ' + mono;
      ctx.fillText('* Cảm ơn quý khách đã đi làm *', W / 2, H - 150);
      ctx.font = '500 26px ' + FONT;
      ctx.fillText('Quy ra giờ làm · ảnh không chứa lương', W / 2, H - 105);
      ctx.textAlign = 'left';
      return canvas;
    }

    function drawStory(r) {
      var W = 1080, H = 1920, PAD = 100;
      var canvas = newCanvas(W, H);
      var ctx = canvas.getContext('2d');
      var bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#FF8A57');
      bg.addColorStop(1, '#E0571F');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
      ctx.beginPath(); ctx.arc(W - 60, 260, 340, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(80, H - 200, 260, 0, Math.PI * 2); ctx.fill();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '700 40px ' + FONT;
      ctx.fillText('QUY RA GIỜ LÀM', W / 2, 200);

      ctx.font = '220px ' + FONT;
      ctx.fillText(r.installment ? '💳' : core.stickerFor(r.duration.kind), W / 2, 560);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 80px ' + FONT;
      var y = 760;
      wrapLines(ctx, core.capitalizeFirst(r.name || 'Món đồ này'), W - PAD * 2, 2).forEach(function (l) {
        ctx.fillText(l, W / 2, y); y += 96;
      });
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.font = '600 56px ' + FONT;
      ctx.fillText(core.formatVND(r.price), W / 2, y + 10);
      y += 150;
      ctx.font = '500 48px ' + FONT;
      ctx.fillText('đáng', W / 2, y);
      y += 30;

      var text = r.duration.text;
      var size = 200;
      ctx.font = '800 ' + size + 'px ' + FONT;
      while (size > 90 && ctx.measureText(text).width > W - PAD * 2) { size -= 6; ctx.font = '800 ' + size + 'px ' + FONT; }
      ctx.fillStyle = '#FFFFFF';
      wrapLines(ctx, text, W - PAD * 2, 2).forEach(function (l) { y += size; ctx.fillText(l, W / 2, y); });
      var k = r.duration.kind;
      if (k === 'seconds' || k === 'minutes' || k === 'hours') {
        y += 80;
        ctx.font = '600 52px ' + FONT;
        ctx.fillText('làm việc', W / 2, y);
      }
      if (payLine(r)) {
        y += 90;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        fitFont(ctx, payLine(r), 500, 38, W - PAD * 2);
        ctx.fillText(payLine(r), W / 2, y);
      }

      // Câu cợt nhả trong một nhãn trắng nghiêng nhẹ
      ctx.save();
      ctx.translate(W / 2, H - 420);
      ctx.rotate(-0.03);
      ctx.font = '600 44px ' + FONT;
      var lines = wrapLines(ctx, r.quip, W - PAD * 2 - 80, 3);
      var boxH = lines.length * 60 + 60;
      ctx.fillStyle = '#FFFDF8';
      roundRect(ctx, -(W - PAD * 2) / 2, -boxH / 2, W - PAD * 2, boxH, 36);
      ctx.fill();
      ctx.fillStyle = '#2A1F17';
      lines.forEach(function (l, i) { ctx.fillText(l, 0, -boxH / 2 + 75 + i * 60); });
      ctx.restore();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.font = '500 32px ' + FONT;
      ctx.fillText('Món này tốn của cậu bao nhiêu giờ làm?', W / 2, H - 140);
      ctx.textAlign = 'left';
      return canvas;
    }

    function roundRect(ctx, x, y, w, h, rad) {
      ctx.beginPath();
      ctx.moveTo(x + rad, y);
      ctx.arcTo(x + w, y, x + w, y + h, rad);
      ctx.arcTo(x + w, y + h, x, y + h, rad);
      ctx.arcTo(x, y + h, x, y, rad);
      ctx.arcTo(x, y, x + w, y, rad);
      ctx.closePath();
    }

    function drawShare(r) {
      if (shareTpl === 'receipt') return drawReceipt(r);
      if (shareTpl === 'story') return drawStory(r);
      return drawClassic(r);
    }

    function canvasToBlob(canvas) {
      // toDataURL chạy đồng bộ, để navigator.share vẫn nằm trong cú bấm (Safari rất khó tính chuyện này).
      var data = canvas.toDataURL('image/png').split(',')[1];
      var bin = atob(data);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: 'image/png' });
    }

    function download(blob, filename) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast('Đã tải ảnh về máy.');
    }

    function share() {
      if (!state || !state.result) return;
      var blob = canvasToBlob(drawShare(state.result));
      var filename = 'quy-ra-gio-lam-' + shareTpl + '.png';
      var file = null;
      try { file = new File([blob], filename, { type: 'image/png' }); } catch (e) { file = null; }

      if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Quy ra giờ làm' }).catch(function (err) {
          if (err && err.name === 'AbortError') return; // người dùng tự đóng
          download(blob, filename);
        });
      } else {
        download(blob, filename);
      }
    }
    /* --- Sự kiện --- */
    function fieldFor(key) {
      return (state.fields[key] || gState.fields[key]);
    }

    function bind(map) {
      Object.keys(map).forEach(function (key) {
        var input = map[key];
        input.addEventListener('input', function () {
          if (key === 'salary') salaryLinked = false;
          if (map === gInputs) salaryLinked = true;
          updateAll(false);
          if (key !== 'name' && key !== 'price') save();
        });
        input.addEventListener('change', function () {
          var f = fieldFor(key);
          if (MONEY_KEYS.indexOf(key) !== -1 && f && f.state === 'ok' && f.value) {
            input.value = core.formatNumber(f.value);
            fitMoneyInput(input);
          }
          updateAll(true);
          if (key !== 'name' && key !== 'price') save();
        });
      });
    }
    bind(inputs);
    bind(gInputs);

    el.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-name]');
      if (!chip) return;
      // Điền vào dòng còn trống giá; hết dòng trống thì thêm món mới vào giỏ.
      // Không tự điền giá: giá thật tuỳ nơi, tuỳ lúc.
      var idx = -1;
      for (var i = cart.length - 1; i >= 0; i--) {
        if (!cart[i].price.trim()) { idx = i; break; }
      }
      if (idx === -1) {
        cart.push({ name: '', price: '' });
        idx = cart.length - 1;
      }
      cart[idx].name = chip.getAttribute('data-name');
      cart[idx].price = '';
      renderCart(idx, 'price');
      updateAll(true);
    });

    el.items.addEventListener('click', function (e) {
      if (!e.target.closest('.add-row')) return;
      cart.push({ name: '', price: '' });
      renderCart(cart.length - 1, 'name');
      updateAll(true);
    });

    radioGroup(el.pays, function (btn) { payMode = btn.getAttribute('data-pay'); updateAll(true); });
    radioGroup(el.months, function (btn) { installment = Number(btn.getAttribute('data-months')); updateAll(true); });
    radioGroup(el.pcts, function (btn) { savePct = Number(btn.getAttribute('data-pct')); updateAll(true); });
    radioGroup(el.tpls, function (btn) { shareTpl = btn.getAttribute('data-tpl'); updateAll(true); });
    radioGroup(el.modes, function (btn) {
      var next = btn.getAttribute('data-mode');
      // Đổi chiều tính thì đổi luôn con số trong ô, để vẫn là cùng một mức lương
      if (next !== 'offers' && next !== calcMode) {
        if (gState.result) gInputs.gross.value = core.formatNumber(next === 'net' ? gState.result.net : gState.result.gross);
        calcMode = next;
      }
      grossMode = next;
      salaryLinked = true;
      updateAll(true);
      save();
    });

    el.offerInputs.forEach(function (input) {
      var o = offers[input.getAttribute('data-offer')];
      var key = input.getAttribute('data-key');
      input.addEventListener('input', function () { o[key] = input.value; updateAll(false); });
      input.addEventListener('change', function () {
        var f = oState.fields[input.getAttribute('data-offer')][key];
        if ((key === 'gross' || key === 'allowance') && f && f.state === 'ok' && f.value) {
          input.value = core.formatNumber(f.value);
          o[key] = input.value;
        }
        updateAll(true);
      });
    });

    el.habitChips.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-habit]');
      if (!chip) return;
      // Như giỏ hàng: điền vào dòng trống giá, không tự điền giá
      var idx = -1;
      for (var i = habits.length - 1; i >= 0; i--) {
        if (!habits[i].price.trim()) { idx = i; break; }
      }
      if (idx === -1) { habits.push({ name: '', price: '', times: '1', per: 'week' }); idx = habits.length - 1; }
      habits[idx].name = chip.getAttribute('data-habit');
      habits[idx].times = chip.getAttribute('data-times');
      habits[idx].per = chip.getAttribute('data-per');
      habits[idx].price = '';
      renderHabits(idx, 'price');
      updateAll(true);
      save();
    });

    el.habits.addEventListener('click', function (e) {
      if (!e.target.closest('.add-row')) return;
      habits.push({ name: '', price: '', times: '1', per: 'week' });
      renderHabits(habits.length - 1, 'name');
      updateAll(true);
    });

    [el.clockStart, el.clockEnd].forEach(function (input) {
      input.addEventListener('input', function () { tick(); save(); });
      input.addEventListener('change', function () { tick(); save(); });
    });
    el.toiletBtn.addEventListener('click', toggleToilet);
    setInterval(tick, 250);

    el.tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { showTab(tab.getAttribute('data-tab')); save(); });
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var next = el.tabs[(i + (e.key === 'ArrowRight' ? 1 : el.tabs.length - 1)) % el.tabs.length];
        showTab(next.getAttribute('data-tab'), true);
        save();
      });
    });

    // Số tiền dài (vd 5.000.000.000) thì thu nhỏ chữ trong ô cho khỏi bị cắt
    function fitMoneyInput(input) {
      if (!input || !input.closest || !input.closest('.row-input.money')) return;
      input.classList.toggle('long', input.value.length > 11);
      input.classList.toggle('longer', input.value.length > 14);
    }
    ['input', 'change'].forEach(function (type) {
      document.addEventListener(type, function (e) { fitMoneyInput(e.target); }, true);
    });

    // Có cả nút data-go tạo động (dòng "Dựa trên lương…"), nên bắt sự kiện ở cấp tài liệu
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-go]');
      if (!btn) return;
      showTab(btn.getAttribute('data-go'));
      save();
      window.scrollTo(0, 0);
    });

    function setDependents(n) {
      gross.dependents = Math.max(0, Math.min(20, n));
      salaryLinked = true;
      updateAll(true);
      save();
    }
    el.depMinus.addEventListener('click', function () { setDependents(gross.dependents - 1); });
    el.depPlus.addEventListener('click', function () { setDependents(gross.dependents + 1); });

    el.regions.forEach(function (btn, i) {
      function pick(target) {
        gross.region = target.getAttribute('data-region');
        salaryLinked = true;
        updateAll(true);
        save();
      }
      btn.addEventListener('click', function () { pick(btn); });
      btn.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var next = el.regions[(i + (e.key === 'ArrowRight' ? 1 : el.regions.length - 1)) % el.regions.length];
        pick(next);
        next.focus();
      });
    });

    el.useNet.addEventListener('click', function () {
      if (!gState.result) return;
      salaryLinked = true;
      showTab('time');
      updateAll(true);
      save();
      window.scrollTo(0, 0);
    });

    el.relink.addEventListener('click', function () {
      salaryLinked = true;
      updateAll(true);
      save();
    });

    $all('form').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      });
    });
    el.share.addEventListener('click', share);
    el.clear.addEventListener('click', clearSaved);

    function tabFromHash() {
      var h = location.hash.slice(1);
      if (h === 'gross') return 'gross';
      for (var key in HASHES) if (HASHES[key] === h) return key;
      return null;
    }
    window.addEventListener('hashchange', function () {
      var tab = tabFromHash();
      if (tab) showTab(tab);
    });

    renderCart();
    var savedTab = load();
    renderHabits();
    var hashTab = tabFromHash();
    // Lần đầu: bắt đầu từ tính lương thực nhận. Đã có lương thực nhận thì vào thẳng quy giờ làm.
    showTab(hashTab || savedTab || (inputs.salary.value.trim() ? 'time' : 'gross'));
    updateAll(true);
    $all('.row-input.money input').forEach(fitMoneyInput);
    renderSaved();
  }
})();
