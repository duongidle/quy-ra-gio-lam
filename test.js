// Chạy: node test.js   (không cần thư viện nào)
'use strict';
const assert = require('node:assert/strict');
const Q = require('./app.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error('✗ ' + name + '\n   ' + err.message.split('\n').join('\n   '));
  }
}

/* ---------- parseMoney ---------- */
const money = [
  ['45000', 45000],
  ['45.000', 45000],
  ['45,000', 45000],
  ['45 000', 45000],
  ['45k', 45000],
  ['45K', 45000],
  ['45 k', 45000],
  ['45 nghìn', 45000],
  ['45 ngàn', 45000],
  ['45.000đ', 45000],
  ['45.000 đ', 45000],
  ['45000 vnđ', 45000],
  ['45000VND', 45000],
  ['45k đồng', 45000],
  ['1,2tr', 1200000],
  ['1.2tr', 1200000],
  ['1,2 triệu', 1200000],
  ['15 triệu', 15000000],
  ['15 Triệu', 15000000],
  ['15tr', 15000000],
  ['15 trieu', 15000000],
  ['15 củ', 15000000],
  ['15.000.000', 15000000],
  ['15,000,000', 15000000],
  ['1tr2', 1200000],
  ['1tr5', 1500000],
  ['2k5', 2500],
  ['15 triệu 500', 15500000],
  ['1 triệu 50', 1050000],
  ['1 tỷ 200 triệu', 1200000000],
  ['1 tỷ 2', 1200000000],
  ['3 tỷ', 3000000000],
  ['3,5 tỉ', 3500000000],
  ['2.5 ty', 2500000000],
  ['1.200k', 1200000],
  ['0.5tr', 500000],
  ['0,500tr', 500000],
  ['1.234.567,8', 1234568],
  ['1,234,567.8', 1234568],
  ['45.', 45], // đang gõ dở
  ['  45k  ', 45000],
  ['0', 0],
  ['-45k', -45000],
  ['+45k', 45000]
];
money.forEach(([input, expected]) => {
  test(`parseMoney(${JSON.stringify(input)}) = ${expected}`, () => {
    assert.equal(Q.parseMoney(input), expected);
  });
});

const notMoney = ['', '   ', 'abc', 'k', 'tr', 'một triệu', '45kk', '45 xyz', '1.2.3', '1..2', '45k 3tr', 'đ', '12-3', null, undefined, '1,23,4'];
notMoney.forEach((input) => {
  test(`parseMoney(${JSON.stringify(input)}) = null`, () => {
    assert.equal(Q.parseMoney(input), null);
  });
});

/* ---------- parseCount ---------- */
test('parseCount đọc số nguyên và thập phân', () => {
  assert.equal(Q.parseCount('22'), 22);
  assert.equal(Q.parseCount(' 8 '), 8);
  assert.equal(Q.parseCount('7,5'), 7.5);
  assert.equal(Q.parseCount('7.5'), 7.5);
  assert.equal(Q.parseCount(''), null);
  assert.ok(Number.isNaN(Q.parseCount('tám')));
  assert.ok(Number.isNaN(Q.parseCount('8h')));
});

/* ---------- formatNumber ---------- */
test('formatNumber dùng dấu chấm hàng nghìn, dấu phẩy thập phân', () => {
  assert.equal(Q.formatNumber(0), '0');
  assert.equal(Q.formatNumber(999), '999');
  assert.equal(Q.formatNumber(45000), '45.000');
  assert.equal(Q.formatNumber(1234567), '1.234.567');
  assert.equal(Q.formatNumber(3000000000), '3.000.000.000');
  assert.equal(Q.formatNumber(2.34, 1), '2,3');
  assert.equal(Q.formatNumber(2.0, 1), '2');
  assert.equal(Q.formatNumber(1234.56, 1), '1.234,6');
  assert.equal(Q.formatNumber(-45000), '-45.000');
  assert.equal(Q.formatVND(45000), '45.000đ');
});

/* ---------- formatDuration ---------- */
// 8 giờ/ngày, 22 ngày/tháng
const D = (min) => Q.formatDuration(min, 8, 22);

test('dưới 1 phút -> giây', () => {
  assert.equal(D(0.5).text, '30 giây');
  assert.equal(D(0.001).text, '1 giây');
  assert.equal(D(0.999).text, '1 phút');
});
test('dưới 1 giờ -> phút', () => {
  assert.equal(D(38).text, '38 phút');
  assert.equal(D(38).phrase, '38 phút làm việc');
  assert.equal(D(59.4).text, '59 phút');
});
test('dưới 1 ngày làm -> giờ + phút', () => {
  assert.equal(D(59.6).text, '1 giờ');
  assert.equal(D(195).text, '3 giờ 15 phút');
  assert.equal(D(120).text, '2 giờ');
  assert.equal(D(479).text, '7 giờ 59 phút');
  assert.equal(D(195).detail, null);
  assert.equal(D(195).monthsLine, null);
});
test('từ 1 ngày làm -> ngày làm việc (≈ giờ)', () => {
  assert.equal(D(479.6).text, '1 ngày làm việc');
  assert.equal(D(480).text, '1 ngày làm việc');
  assert.equal(D(480).detail, '≈ 8 giờ');
  assert.equal(D(32 * 60).text, '4 ngày làm việc');
  assert.equal(D(32 * 60).detail, '≈ 32 giờ');
  assert.equal(D(36 * 60).text, '4,5 ngày làm việc');
  assert.equal(D(32 * 60).monthsLine, null);
});
test('từ 1 tháng làm -> thêm dòng tháng lương', () => {
  const oneMonth = D(22 * 8 * 60);
  assert.equal(oneMonth.text, '22 ngày làm việc');
  assert.equal(oneMonth.monthsLine, '≈ 1 tháng lương');
  const r = D(2.3 * 22 * 8 * 60);
  assert.equal(r.kind, 'months');
  assert.equal(r.monthsLine, '≈ 2,3 tháng lương');
  assert.equal(r.detail, '≈ 405 giờ');
});
test('từ 12 tháng -> năm làm việc', () => {
  const r = D(27.8 * 12 * 22 * 8 * 60);
  assert.equal(r.kind, 'years');
  assert.equal(r.text, '28 năm làm việc');
  assert.equal(r.monthsLine, '≈ 334 tháng lương');
  assert.match(r.detail, /^≈ [\d.]+ ngày làm việc$/);
  assert.equal(D(1.5 * 12 * 22 * 8 * 60).text, '1,5 năm làm việc');
});
test('ngày làm ngắn (4 giờ) vẫn chọn đúng đơn vị', () => {
  assert.equal(Q.formatDuration(300, 4, 22).text, '1,3 ngày làm việc');
  assert.equal(Q.formatDuration(40, 0.5, 22).text, '1,3 ngày làm việc');
});

/* ---------- capitalizeFirst / buildSentence ---------- */
test('viết hoa chữ đầu nhưng giữ iPhone', () => {
  assert.equal(Q.capitalizeFirst('ly cà phê'), 'Ly cà phê');
  assert.equal(Q.capitalizeFirst('đôi giày'), 'Đôi giày');
  assert.equal(Q.capitalizeFirst('iPhone mới'), 'iPhone mới');
  assert.equal(Q.capitalizeFirst(''), '');
});
test('câu diễn giải', () => {
  assert.equal(Q.buildSentence('Ly cà phê', 45000, D(38)),
    'Ly cà phê 45.000đ này đáng 38 phút làm việc của cậu.');
  assert.equal(Q.buildSentence('', 45000, D(38)),
    'Món đồ 45.000đ này đáng 38 phút làm việc của cậu.');
  assert.equal(Q.buildSentence('  bữa   lẩu ', 500000, D(32 * 60)),
    'Bữa lẩu 500.000đ này đáng 4 ngày làm việc của cậu.');
});

/* ---------- evaluate: luồng chính + trường hợp biên ---------- */
const base = { salary: '15tr', days: '22', hours: '8', name: 'Ly cà phê', price: '45k' };
const ev = (patch) => Q.evaluate(Object.assign({}, base, patch));
// Không được có NaN/Infinity ở bất kỳ đâu, kể cả trong chuỗi hiển thị.
const noBadNumbers = (value, path = 'out') => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), path + ' = ' + value);
  else if (typeof value === 'string') assert.ok(!/NaN|Infinity|undefined/.test(value), path + ' = ' + value);
  else if (value && typeof value === 'object') {
    Object.keys(value).forEach((k) => noBadNumbers(value[k], path + '.' + k));
  }
};

test('ví dụ chuẩn: 15tr, 22 ngày, 8 giờ, cà phê 45k', () => {
  const out = ev({});
  assert.ok(Math.abs(out.hourlyRate - 15000000 / 176) < 1e-9);
  assert.equal(out.result.duration.text, '32 phút');
  assert.equal(out.result.sentence, 'Ly cà phê 45.000đ này đáng 32 phút làm việc của cậu.');
  noBadNumbers(out);
});

test('lương trống -> gợi ý, không có kết quả', () => {
  const out = ev({ salary: '' });
  assert.equal(out.result, null);
  assert.equal(out.hourlyRate, null);
  assert.match(out.hint, /Nhập lương/);
  noBadNumbers(out);
});

[['0', 'zero'], ['-5tr', 'negative'], ['abc', 'invalid'], ['9999999 tỷ', 'tooLarge']].forEach(([salary, st]) => {
  test(`lương "${salary}" -> ${st}, không NaN/Infinity`, () => {
    const out = ev({ salary });
    assert.equal(out.fields.salary.state, st);
    assert.ok(out.fields.salary.message);
    assert.equal(out.result, null);
    assert.ok(out.hint);
    noBadNumbers(out);
  });
});

[['', 'empty'], ['0', 'zero'], ['-1', 'negative'], ['linh tinh', 'invalid']].forEach(([price, st]) => {
  test(`giá "${price}" -> ${st}`, () => {
    const out = ev({ price });
    assert.equal(out.fields.price.state, st);
    assert.equal(out.result, null);
    assert.ok(out.hint);
    assert.ok(out.hourlyRate > 0); // vẫn hiện lương mỗi giờ
    noBadNumbers(out);
  });
});

[['0', 'range'], ['32', 'range'], ['', 'empty'], ['abc', 'invalid'], ['-3', 'range']].forEach(([days, st]) => {
  test(`số ngày "${days}" -> ${st}`, () => {
    const out = ev({ days });
    assert.equal(out.fields.days.state, st);
    assert.ok(out.fields.days.message);
    assert.equal(out.result, null);
    assert.equal(out.hourlyRate, null);
    noBadNumbers(out);
  });
});

[['0', 'range'], ['25', 'range'], ['24.5', 'range'], ['', 'empty'], ['tám', 'invalid']].forEach(([hours, st]) => {
  test(`số giờ "${hours}" -> ${st}`, () => {
    const out = ev({ hours });
    assert.equal(out.fields.hours.state, st);
    assert.equal(out.result, null);
    noBadNumbers(out);
  });
});

test('biên hợp lệ: 1 và 31 ngày, 24 giờ, 0,5 giờ', () => {
  assert.ok(ev({ days: '1' }).result);
  assert.ok(ev({ days: '31' }).result);
  assert.ok(ev({ hours: '24' }).result);
  assert.ok(ev({ hours: '0,5' }).result);
});

test('giá nhà vài tỷ -> năm làm việc, số đọc được', () => {
  const out = ev({ name: 'Căn nhà', price: '5 tỷ' });
  assert.equal(out.result.duration.kind, 'years');
  assert.equal(out.result.duration.text, '28 năm làm việc');
  assert.equal(out.result.duration.monthsLine, '≈ 333 tháng lương');
  assert.equal(out.result.sentence, 'Căn nhà 5.000.000.000đ này đáng 28 năm làm việc của cậu.');
  noBadNumbers(out);
});

test('số cực lớn vẫn hiển thị hợp lý', () => {
  const out = ev({ salary: '5tr', price: '999000 tỷ' });
  assert.equal(out.result.duration.kind, 'years');
  assert.match(out.result.duration.text, /^[\d.]+ năm làm việc$/);
  noBadNumbers(out);
});

test('lương cực cao, giá cực nhỏ -> giây', () => {
  const out = ev({ salary: '10 tỷ', price: '1000' });
  assert.equal(out.result.duration.kind, 'seconds');
  noBadNumbers(out);
});

/* ---------- Gross -> thực nhận ---------- */
test('thuế lũy tiến 5 bậc', () => {
  assert.equal(Q.progressiveTax(0), 0);
  assert.equal(Q.progressiveTax(10000000), 500000);
  assert.equal(Q.progressiveTax(11350000), 635000);
  assert.equal(Q.progressiveTax(30000000), 2500000);
  assert.equal(Q.progressiveTax(60000000), 8500000);
  assert.equal(Q.progressiveTax(100000000), 20500000);
  assert.equal(Q.progressiveTax(120000000), 27500000);
});

test('gross 30tr, không người phụ thuộc', () => {
  const g = Q.grossToNet({ gross: 30000000 });
  assert.equal(g.bhxh, 2400000);
  assert.equal(g.bhyt, 450000);
  assert.equal(g.bhtn, 300000);
  assert.equal(g.insurance, 3150000);
  assert.equal(g.taxable, 11350000); // 30 - 3,15 - 15,5
  assert.equal(g.tax, 635000);
  assert.equal(g.net, 26215000);
});

test('gross thấp hơn mức giảm trừ -> không thuế', () => {
  const g = Q.grossToNet({ gross: 15000000 });
  assert.equal(g.tax, 0);
  assert.equal(g.net, 15000000 - 1575000);
});

test('người phụ thuộc làm giảm thuế', () => {
  const g = Q.grossToNet({ gross: 30000000, dependents: 1 });
  assert.equal(g.taxable, 5150000);
  assert.equal(g.tax, 257500);
});

test('lương đóng BH thấp hơn gross', () => {
  const g = Q.grossToNet({ gross: 30000000, insuranceBase: 10000000 });
  assert.equal(g.insurance, 1050000);
  assert.equal(g.taxable, 13450000);
});

test('trần bảo hiểm: BHXH/BHYT 50,6tr, BHTN theo vùng', () => {
  const g = Q.grossToNet({ gross: 100000000 });
  assert.equal(g.bhxh, 4048000);
  assert.equal(g.bhyt, 759000);
  assert.equal(g.bhtn, 1000000); // dưới trần vùng I 106,2tr
  const g4 = Q.grossToNet({ gross: 100000000, region: 4 });
  assert.equal(g4.bhtn, 740000); // trần vùng IV 74tr
  assert.equal(g.net, 100000000 - g.insurance - g.tax);
});

const grossBase = Object.assign({}, base, { salaryMode: 'gross', salary: '30tr' });
const evg = (patch) => Q.evaluate(Object.assign({}, grossBase, patch));

test('evaluate ở chế độ gross dùng lương thực nhận ước tính', () => {
  const out = evg({});
  assert.equal(out.mode, 'gross');
  assert.equal(out.netSalary, 26215000);
  assert.ok(Math.abs(out.hourlyRate - 26215000 / 176) < 1e-9);
  assert.ok(out.result);
  noBadNumbers(out);
});

[['-1', 'invalid'], ['1,5', 'invalid'], ['hai', 'invalid'], ['21', 'invalid']].forEach(([dependents, st]) => {
  test(`người phụ thuộc "${dependents}" -> ${st}`, () => {
    const out = evg({ dependents });
    assert.equal(out.fields.dependents.state, st);
    assert.equal(out.result, null);
    assert.ok(out.hint);
    noBadNumbers(out);
  });
});

test('lương đóng BH lớn hơn gross hoặc gõ linh tinh -> báo', () => {
  assert.equal(evg({ insuranceBase: '40tr' }).fields.insuranceBase.state, 'range');
  assert.equal(evg({ insuranceBase: 'abc' }).fields.insuranceBase.state, 'invalid');
  assert.equal(evg({ insuranceBase: '' }).fields.insuranceBase.state, 'ok');
  noBadNumbers(evg({ insuranceBase: 'abc' }));
});

test('chế độ thực nhận bỏ qua các ô gross', () => {
  const out = ev({ dependents: 'linh tinh', insuranceBase: 'abc' });
  assert.equal(out.netSalary, 15000000);
  assert.equal(out.fields.dependents, undefined);
  assert.ok(out.result);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
