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

  function quip(minutes, hoursPerDay, daysPerMonth) {
    var days = minutes / (hoursPerDay * 60);
    if (minutes < 1) return 'Chưa kịp nhấp ngụm nước đã kiếm đủ.';
    if (minutes < 15) return 'Nhẹ tênh, chớp mắt là xong.';
    if (minutes < 60) return 'Chưa hết một cuộc họp.';
    if (days < 1) return 'Cỡ một buổi ngồi máy đấy.';
    if (days < 5) return 'Vài ngày công. Cân nhắc chút nha.';
    if (days < daysPerMonth) return 'Mấy tuần công sức đó.';
    if (days < daysPerMonth * 12) return 'Hít một hơi thật sâu trước khi bấm mua.';
    return 'Món này cần một kế hoạch dài hơi, không phải một cú quẹt thẻ.';
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
    insuranceInvalid: 'Tớ chưa đọc được số này. Để trống nếu công ty đóng bảo hiểm theo đúng lương gross.',
    insuranceTooHigh: 'Lương đóng bảo hiểm thường không cao hơn lương gross. Xem lại giúp tớ nhé.',
    hintGrossFix: 'Phần quy đổi từ gross đang có ô chưa ổn, xem lại giúp tớ nhé.'
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
   * opts = { gross, dependents = 0, insuranceBase = gross, region = 1 }
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
      net: gross - insurance - tax
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

  function checkInsuranceBase(raw, gross) {
    var text = String(raw === null || raw === undefined ? '' : raw).trim();
    if (!text) return { state: 'ok', value: null };
    var v = parseMoney(text);
    if (v === null || v < 0) return { state: 'invalid', message: MSG.insuranceInvalid };
    if (gross !== null && v > gross) return { state: 'range', message: MSG.insuranceTooHigh };
    return { state: 'ok', value: v };
  }

  /**
   * Toàn bộ trạng thái màn hình từ các chuỗi người dùng gõ.
   * raw = { salary, days, hours, name, price } (đều là chuỗi), cộng thêm khi nhập gross:
   * salaryMode = 'gross', dependents, insuranceBase, region.
   */
  function evaluate(raw) {
    var f = {
      salary: checkMoney(raw.salary, 'salary'),
      days: checkCount(raw.days, 'days'),
      hours: checkCount(raw.hours, 'hours'),
      price: checkMoney(raw.price, 'price')
    };
    var isGross = raw.salaryMode === 'gross';
    var out = { fields: f, mode: isGross ? 'gross' : 'net', gross: null, netSalary: null, hourlyRate: null, result: null, hint: null };

    var grossOk = true;
    if (isGross) {
      f.dependents = checkDependents(raw.dependents);
      f.insuranceBase = checkInsuranceBase(raw.insuranceBase, f.salary.state === 'ok' ? f.salary.value : null);
      grossOk = f.dependents.state === 'ok' && f.insuranceBase.state === 'ok';
      if (f.salary.state === 'ok' && grossOk) {
        out.gross = grossToNet({
          gross: f.salary.value,
          dependents: f.dependents.value,
          insuranceBase: f.insuranceBase.value,
          region: Number(raw.region) || 1
        });
        out.netSalary = out.gross.net;
      }
    } else if (f.salary.state === 'ok') {
      out.netSalary = f.salary.value;
    }

    var incomeOk = out.netSalary !== null && f.days.state === 'ok' && f.hours.state === 'ok';
    if (incomeOk) {
      out.hourlyRate = out.netSalary / (f.days.value * f.hours.value);
    }

    if (f.salary.state !== 'ok') {
      out.hint = f.salary.state === 'empty' ? MSG.hintSalary : MSG.hintSalaryFix;
    } else if (!grossOk) {
      out.hint = MSG.hintGrossFix;
    } else if (!incomeOk) {
      out.hint = MSG.hintSchedule;
    } else if (f.price.state === 'empty') {
      out.hint = MSG.hintPrice;
    } else if (f.price.state !== 'ok') {
      out.hint = f.price.message;
    } else {
      var minutes = f.price.value / out.hourlyRate * 60;
      var duration = formatDuration(minutes, f.hours.value, f.days.value);
      out.result = {
        name: cleanName(raw.name),
        price: f.price.value,
        minutes: minutes,
        duration: duration,
        sentence: buildSentence(raw.name, f.price.value, duration),
        quip: quip(minutes, f.hours.value, f.days.value)
      };
    }
    return out;
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
    GROSS_RULES: GROSS_RULES,
    progressiveTax: progressiveTax,
    grossToNet: grossToNet,
    evaluate: evaluate
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
    var STORAGE_KEY = 'quy-ra-gio-lam:v1';
    var FONT = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif';

    function $(id) { return document.getElementById(id); }
    var inputs = {
      salary: $('salary'), days: $('days'), hours: $('hours'), name: $('name'), price: $('price'),
      dependents: $('dependents'), insuranceBase: $('insurance-base')
    };
    var msgs = {
      salary: $('salary-msg'), days: $('days-msg'), hours: $('hours-msg'), price: $('price-msg'),
      dependents: $('dependents-msg'), insuranceBase: $('insurance-base-msg')
    };
    var previews = { salary: $('salary-preview'), price: $('price-preview'), insuranceBase: $('insurance-base-preview') };
    var SALARY_COPY = {
      net: {
        label: 'Lương thực nhận mỗi tháng',
        note: 'Nhập lương thực nhận sau thuế và bảo hiểm, không phải lương gross.'
      },
      gross: {
        label: 'Lương gross mỗi tháng',
        note: 'Nhập lương gross trên hợp đồng, tớ sẽ trừ bảo hiểm và thuế để ra lương thực nhận.'
      }
    };
    var el = {
      modeRadios: document.querySelectorAll('input[name="mode"]'),
      salaryLabel: $('salary-label'),
      salaryNote: $('salary-note'),
      grossFields: $('gross-fields'),
      region: $('region'),
      breakdown: $('breakdown'),
      breakdownList: $('breakdown-list'),
      form: $('form'),
      hint: $('result-hint'),
      body: $('result-body'),
      big: $('big'),
      detail: $('detail'),
      months: $('months'),
      sentence: $('sentence'),
      quip: $('quip'),
      rate: $('rate'),
      share: $('share'),
      clear: $('clear'),
      storageNote: $('storage-note'),
      toast: $('toast'),
      chips: $('chips')
    };

    var state = null;
    var lastBig = '';
    var msgTimer = 0;
    var toastTimer = 0;

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
        return;
      }
      try {
        var saved = JSON.parse(s.getItem(STORAGE_KEY) || 'null');
        if (!saved || typeof saved !== 'object') return;
        ['salary', 'days', 'hours', 'dependents', 'insuranceBase'].forEach(function (key) {
          if (typeof saved[key] === 'string') inputs[key].value = saved[key];
        });
        if (saved.mode === 'gross' || saved.mode === 'net') setMode(saved.mode);
        if (/^[1-4]$/.test(saved.region)) el.region.value = saved.region;
      } catch (e) { /* dữ liệu hỏng thì bỏ qua */ }
    }

    function save() {
      try {
        var data = {
          mode: getMode(),
          salary: inputs.salary.value,
          days: inputs.days.value,
          hours: inputs.hours.value,
          dependents: inputs.dependents.value,
          insuranceBase: inputs.insuranceBase.value,
          region: el.region.value
        };
        var s = storage();
        if (!s) return;
        var isDefault = data.mode === 'net' && !data.salary.trim() && !data.dependents.trim() &&
          !data.insuranceBase.trim() && data.region === '1' &&
          data.days === String(core.DEFAULTS.days) && data.hours === String(core.DEFAULTS.hours);
        if (isDefault) {
          s.removeItem(STORAGE_KEY);
        } else {
          s.setItem(STORAGE_KEY, JSON.stringify(data));
        }
      } catch (e) { /* không lưu được thì thôi */ }
    }

    function clearSaved() {
      try {
        var s = storage();
        if (s) s.removeItem(STORAGE_KEY);
      } catch (e) { /* bỏ qua */ }
      inputs.salary.value = '';
      inputs.days.value = String(core.DEFAULTS.days);
      inputs.hours.value = String(core.DEFAULTS.hours);
      inputs.dependents.value = '';
      inputs.insuranceBase.value = '';
      el.region.value = '1';
      setMode('net');
      update(true);
      toast('Đã xoá. Máy này không còn nhớ lương của cậu nữa.');
    }

    /* --- Hiển thị --- */
    function toast(text) {
      el.toast.textContent = text;
      el.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2600);
    }

    function setText(node, text) {
      node.textContent = text || '';
      node.hidden = !text;
    }

    function getMode() {
      for (var i = 0; i < el.modeRadios.length; i++) {
        if (el.modeRadios[i].checked) return el.modeRadios[i].value;
      }
      return 'net';
    }

    function setMode(mode) {
      for (var i = 0; i < el.modeRadios.length; i++) {
        el.modeRadios[i].checked = el.modeRadios[i].value === mode;
      }
      applyMode();
    }

    function applyMode() {
      var mode = getMode();
      el.salaryLabel.textContent = SALARY_COPY[mode].label;
      el.salaryNote.textContent = SALARY_COPY[mode].note;
      el.grossFields.hidden = mode !== 'gross';
    }

    function renderMessages() {
      Object.keys(msgs).forEach(function (key) {
        var f = state.fields[key];
        var show = !!f && f.state !== 'ok' && f.message && !(f.state === 'empty' && (key === 'salary' || key === 'price'));
        setText(msgs[key], show ? f.message : '');
        inputs[key].setAttribute('aria-invalid', show ? 'true' : 'false');
      });
    }

    function renderBreakdown() {
      var g = state.gross;
      el.breakdown.hidden = !g;
      if (!g) return;
      var rows = [
        ['Lương gross', core.formatVND(g.gross), ''],
        ['BHXH 8%', '−' + core.formatVND(g.bhxh), ''],
        ['BHYT 1,5%', '−' + core.formatVND(g.bhyt), ''],
        ['BHTN 1%', '−' + core.formatVND(g.bhtn), ''],
        ['Thuế TNCN', g.tax ? '−' + core.formatVND(g.tax) : '0đ', ''],
        ['Thực nhận ước tính', core.formatVND(g.net), 'total']
      ];
      el.breakdownList.textContent = '';
      rows.forEach(function (row) {
        var wrap = document.createElement('div');
        if (row[2]) wrap.className = row[2];
        var dt = document.createElement('dt');
        dt.textContent = row[0];
        var dd = document.createElement('dd');
        dd.textContent = row[1];
        wrap.appendChild(dt);
        wrap.appendChild(dd);
        el.breakdownList.appendChild(wrap);
      });
    }

    function renderPreviews() {
      Object.keys(previews).forEach(function (key) {
        var f = state.fields[key];
        var raw = inputs[key].value.trim();
        var text = '';
        if (f && f.state === 'ok' && f.value !== null) {
          var pretty = core.formatNumber(f.value);
          if (raw.replace(/\s*(đ|vnđ|vnd)$/i, '') !== pretty) text = '= ' + core.formatVND(f.value);
        }
        setText(previews[key], text);
      });
    }

    function renderResult() {
      var r = state.result;
      el.hint.hidden = !!r;
      el.body.hidden = !r;
      el.share.disabled = !r;

      if (state.hourlyRate !== null) {
        var f = state.fields;
        el.rate.textContent = 'Lương mỗi giờ của cậu: ' + core.formatVND(Math.round(state.hourlyRate)) +
          '\n= ' + core.formatVND(state.netSalary) + (state.mode === 'gross' ? ' (thực nhận ước tính)' : '') +
          ' ÷ (' + core.formatNumber(f.days.value, 2) +
          ' ngày × ' + core.formatNumber(f.hours.value, 2) + ' giờ)';
        el.rate.hidden = false;
      } else {
        el.rate.hidden = true;
      }

      if (!r) {
        el.hint.textContent = state.hint;
        lastBig = '';
        return;
      }

      var d = r.duration;
      el.big.textContent = '';
      d.parts.forEach(function (p) {
        var num = document.createElement('span');
        num.className = 'num';
        num.textContent = p[0];
        var unit = document.createElement('span');
        unit.className = 'unit';
        unit.textContent = p[1];
        el.big.appendChild(num);
        el.big.appendChild(unit);
      });
      if (d.text !== lastBig) {
        el.big.classList.remove('pop');
        void el.big.offsetWidth; // chạy lại animation
        el.big.classList.add('pop');
        lastBig = d.text;
      }
      setText(el.detail, d.detail ? '(' + d.detail + ')' : '');
      setText(el.months, d.monthsLine);
      el.sentence.textContent = r.sentence;
      el.quip.textContent = r.quip;
    }

    function update(immediateMessages) {
      state = core.evaluate({
        salary: inputs.salary.value,
        days: inputs.days.value,
        hours: inputs.hours.value,
        name: inputs.name.value,
        price: inputs.price.value,
        salaryMode: getMode(),
        dependents: inputs.dependents.value,
        insuranceBase: inputs.insuranceBase.value,
        region: el.region.value
      });
      renderResult();
      renderBreakdown();
      renderPreviews();
      // Báo lỗi chậm một nhịp để không nhấp nháy khi đang gõ dở ("15 tri…").
      clearTimeout(msgTimer);
      if (immediateMessages) renderMessages();
      else msgTimer = setTimeout(renderMessages, 700);
      // Ô nào đã hết lỗi thì gỡ thông báo ngay.
      Object.keys(msgs).forEach(function (key) {
        var f = state.fields[key];
        if (!f || f.state === 'ok') {
          setText(msgs[key], '');
          inputs[key].setAttribute('aria-invalid', 'false');
        }
      });
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

    function drawCard(r) {
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
      var blob = canvasToBlob(drawCard(state.result));
      var filename = 'quy-ra-gio-lam.png';
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
    function reformatMoney(key) {
      var f = state && state.fields[key];
      if (f && f.state === 'ok' && f.value !== null) inputs[key].value = core.formatNumber(f.value);
      update(true);
    }

    Object.keys(inputs).forEach(function (key) {
      inputs[key].addEventListener('input', function () {
        update(false);
        if (key !== 'name' && key !== 'price') save();
      });
    });
    inputs.salary.addEventListener('change', function () { reformatMoney('salary'); save(); });
    inputs.insuranceBase.addEventListener('change', function () { reformatMoney('insuranceBase'); save(); });
    inputs.dependents.addEventListener('change', function () { update(true); });
    el.region.addEventListener('change', function () { update(true); save(); });
    for (var i = 0; i < el.modeRadios.length; i++) {
      el.modeRadios[i].addEventListener('change', function () {
        applyMode();
        update(true);
        save();
      });
    }
    inputs.price.addEventListener('change', function () { reformatMoney('price'); });
    inputs.days.addEventListener('change', function () { update(true); });
    inputs.hours.addEventListener('change', function () { update(true); });

    el.chips.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-name]');
      if (!chip) return;
      inputs.name.value = chip.getAttribute('data-name');
      inputs.price.value = ''; // không tự điền giá: giá thật tuỳ nơi, tuỳ lúc
      update(true);
      inputs.price.focus();
    });

    el.form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    });
    el.share.addEventListener('click', share);
    el.clear.addEventListener('click', clearSaved);

    load();
    applyMode();
    update(true);
    // Lần đầu mở trang, ô lương trống thì không cần báo lỗi gì cả.
  }
})();
