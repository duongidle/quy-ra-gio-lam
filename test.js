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

const evg = (patch) => Q.evaluateGross(Object.assign({ gross: '30tr', dependents: 0, insuranceBase: '', region: '1' }, patch));

test('evaluateGross: 30tr -> 26.215.000đ', () => {
  const out = evg({});
  assert.equal(out.result.net, 26215000);
  assert.equal(out.result.socialCapped, false);
  noBadNumbers(out);
});

test('evaluateGross: gross trống / sai -> gợi ý, không kết quả', () => {
  for (const gross of ['', 'abc', '0', '-5tr']) {
    const out = evg({ gross });
    assert.equal(out.result, null, gross);
    assert.ok(out.hint, gross);
    noBadNumbers(out);
  }
});

test('evaluateGross: cờ chạm trần bảo hiểm', () => {
  const r = evg({ gross: '120tr' }).result;
  assert.equal(r.socialCapped, true);
  assert.equal(r.unemploymentCapped, true);
});

[[-1, 'invalid'], ['1,5', 'invalid'], ['hai', 'invalid'], [21, 'invalid'], [3, 'ok']].forEach(([dependents, st]) => {
  test(`người phụ thuộc ${JSON.stringify(dependents)} -> ${st}`, () => {
    const out = evg({ dependents });
    assert.equal(out.fields.dependents.state, st);
    assert.equal(!!out.result, st === 'ok');
    noBadNumbers(out);
  });
});

test('lương đóng BH lớn hơn gross hoặc gõ linh tinh -> báo', () => {
  assert.equal(evg({ insuranceBase: '40tr' }).fields.insuranceBase.state, 'range');
  assert.equal(evg({ insuranceBase: 'abc' }).fields.insuranceBase.state, 'invalid');
  assert.equal(evg({ insuranceBase: '' }).fields.insuranceBase.state, 'ok');
  assert.equal(evg({ insuranceBase: '10tr' }).result.insurance, 1050000);
  noBadNumbers(evg({ insuranceBase: 'abc' }));
});

test('phụ cấp miễn thuế: cộng vào thực nhận, không đóng BH, không tính thuế', () => {
  const g = Q.grossToNet({ gross: 30000000, allowance: 730000 });
  assert.equal(g.insurance, 3150000);
  assert.equal(g.tax, 635000);
  assert.equal(g.net, 26215000 + 730000);
  const out = evg({ allowance: '730k' });
  assert.equal(out.result.net, 26945000);
  assert.equal(out.result.allowance, 730000);
});

test('phụ cấp trống = 0, gõ sai -> báo, không kết quả', () => {
  assert.equal(evg({ allowance: '' }).result.allowance, 0);
  const bad = evg({ allowance: 'abc' });
  assert.equal(bad.fields.allowance.state, 'invalid');
  assert.equal(bad.result, null);
  assert.ok(bad.hint);
  assert.equal(evg({ allowance: '-5k' }).fields.allowance.state, 'invalid');
  noBadNumbers(bad);
});

test('sticker theo đơn vị thời gian', () => {
  assert.equal(Q.stickerFor('minutes'), '☕');
  assert.equal(Q.stickerFor('years'), '🏔️');
  assert.equal(Q.stickerFor('lạ'), '🛍️');
});

test('câu bình luận về thuế: đúng mức, ổn định theo hạt giống, đã thay {tax}', () => {
  const inPool = (text, k, tax) => Q.TAX_QUIPS[k].lines.map((l) => l.replace('{tax}', tax)).includes(text);
  const cases = [[8000000, 0], [15000000, 1], [30000000, 2], [60000000, 3], [100000000, 4], [300000000, 5]];
  for (const [gross, k] of cases) {
    const g = Q.grossToNet({ gross });
    for (const seed of ['a', 'b', 'c', 'xyz']) {
      const text = Q.netQuip(g, seed);
      assert.ok(inPool(text, k, Q.formatVND(g.tax)), gross + ': ' + text);
      assert.ok(!text.includes('{tax}'), text);
      assert.equal(text, Q.netQuip(g, seed));
    }
  }
  assert.match(Q.netQuip(Q.grossToNet({ gross: 30000000 }), 'seed'), /635\.000đ/);
});

test('câu bình luận theo thời gian: đủ mọi mức, ổn định theo hạt giống', () => {
  const day = 8 * 60;
  const cases = [[0.5, 0], [3, 1], [10, 2], [20, 3], [45, 4], [180, 5], [400, 6], [day * 1.5, 7], [day * 3, 8],
    [day * 10, 9], [day * 22 * 2, 10], [day * 22 * 6, 11], [day * 22 * 12 * 3, 12], [day * 22 * 12 * 10, 13], [day * 22 * 12 * 50, 14]];
  for (const [minutes, k] of cases) {
    for (const seed of ['Ly cà phê|45000', 'x', '']) {
      const text = Q.quip(minutes, 8, 22, seed);
      assert.ok(Q.TIME_QUIPS[k].lines.includes(text), minutes + ' phút -> ' + text);
      assert.equal(text, Q.quip(minutes, 8, 22, seed));
    }
  }
  // Mỗi mức đều có ít nhất 3 câu và không câu nào trùng
  const all = Q.TIME_QUIPS.flatMap((b) => b.lines).concat(Q.TAX_QUIPS.flatMap((b) => b.lines));
  assert.equal(new Set(all).size, all.length);
  Q.TIME_QUIPS.concat(Q.TAX_QUIPS).forEach((b) => assert.ok(b.lines.length >= 3));
});

/* ---------- Giỏ hàng ---------- */
const evc = (items, patch) => Q.evaluate(Object.assign({ salary: '15tr', days: '22', hours: '8', items }, patch));

test('giỏ nhiều món: cộng tổng, câu nói về giỏ', () => {
  const out = evc([{ name: 'Ly cà phê', price: '45k' }, { name: 'Tô phở', price: '60k' }, { name: 'Vé xem phim', price: '120k' }]);
  assert.equal(out.result.price, 225000);
  assert.equal(out.result.count, 3);
  assert.equal(out.result.name, 'Giỏ 3 món');
  assert.match(out.result.sentence, /^Giỏ 3 món 225\.000đ này đáng .+ của cậu\.$/);
  noBadNumbers(out);
});

test('giỏ: bỏ qua dòng chưa có giá, báo dòng gõ sai', () => {
  const ok = evc([{ name: 'Ly cà phê', price: '45k' }, { name: 'Tô phở', price: '' }]);
  assert.equal(ok.result.price, 45000);
  assert.equal(ok.result.count, 1);
  assert.match(ok.result.sentence, /^Ly cà phê 45\.000đ/);
  const bad = evc([{ name: 'Ly cà phê', price: '45k' }, { name: 'Tô phở', price: 'abc' }]);
  assert.equal(bad.result, null);
  assert.equal(bad.fields.items[1].state, 'invalid');
  assert.match(bad.hint, /chưa đọc được giá/);
  const empty = evc([{ name: '', price: '' }, { name: 'x', price: '' }]);
  assert.equal(empty.result, null);
  assert.match(empty.hint, /nhập giá/);
  noBadNumbers(bad);
});

test('giỏ: tổng quá lớn thì báo, không NaN/Infinity', () => {
  const out = evc([{ name: 'a', price: '900000 tỷ' }, { name: 'b', price: '900000 tỷ' }]);
  assert.equal(out.result, null);
  assert.ok(out.hint);
  noBadNumbers(out);
});

/* ---------- Trả góp ---------- */
test('trả góp 12 tháng: chia đều, số to theo tháng', () => {
  const out = evc([{ name: 'iPhone mới', price: '30tr' }], { installment: 12 });
  const i = out.result.installment;
  assert.equal(i.months, 12);
  assert.equal(i.perMonth, 2500000);
  assert.ok(Math.abs(i.share - 2500000 / 15000000) < 1e-9);
  assert.equal(i.perDuration.text, Q.formatDuration(out.result.minutes / 12, 8, 22).text);
  assert.match(out.result.sentence, /^Trả góp 12 tháng: mỗi tháng 2\.500\.000đ, đáng .+ của cậu\.$/);
  assert.ok(Q.INSTALLMENT_QUIPS[2].lines.some((l) => out.result.quip === l.replace('{per}', i.perDuration.text).replace('{n}', '12')), out.result.quip);
  assert.equal(out.result.price, 30000000); // tổng vẫn giữ để chia sẻ ảnh
  noBadNumbers(out);
});

test('trả góp: không bật thì không có, câu theo đúng mức', () => {
  assert.equal(evc([{ name: 'x', price: '1tr' }]).result.installment, null);
  assert.equal(evc([{ name: 'x', price: '1tr' }], { installment: 0 }).result.installment, null);
  const levels = [[0.01, 0], [0.1, 1], [0.2, 2], [0.5, 3], [1.5, 4]];
  for (const [share, k] of levels) {
    const text = Q.installmentQuip(share, '2 ngày làm việc', 12, 'seed');
    assert.ok(Q.INSTALLMENT_QUIPS[k].lines.map((l) => l.replace('{per}', '2 ngày làm việc').replace('{n}', '12')).includes(text), text);
    assert.ok(!/[{}]/.test(text));
  }
});

/* ---------- Quy ra đồ đời thường ---------- */
test('quy đổi: tối đa 2 món, số lượng dễ hình dung, có ghi giá dùng để so', () => {
  const eq = Q.equivalents(1000000, 'Tai nghe');
  assert.ok(eq.length >= 1 && eq.length <= 2);
  for (const e of eq) {
    assert.ok(e.count >= 1.5 && e.count <= 999, e.text);
    assert.match(e.priceNote, /\d/);
  }
  assert.equal(eq.length, 2);
  assert.notEqual(eq[0].text, eq[1].text);
  assert.deepEqual(Q.equivalents(1000000, 'Tai nghe'), eq); // ổn định
});

test('quy đổi: không so món với chính nó, quá rẻ thì bỏ', () => {
  const eq = Q.equivalents(350000, 'Ly cà phê');
  assert.ok(eq.length && eq.every((e) => !/cà phê/.test(e.text)), JSON.stringify(eq));
  assert.deepEqual(Q.equivalents(5000, 'x'), []);
  assert.ok(Q.equivalents(900e9, 'x').length >= 1);
  // 1,3tr: chọn vé phim và phở chứ không phải 261 cốc trà đá
  assert.deepEqual(Q.equivalents(1305000, 'x').map((e) => e.text), ['26 tô phở', '13 vé xem phim']); // 900 tỷ vẫn quy ra được căn chung cư
  const r = evc([{ name: 'Bữa lẩu', price: '800k' }]).result;
  assert.ok(Array.isArray(r.equivalents) && r.equivalents.length > 0);
});

/* ---------- Net → Gross ---------- */
test('net → gross: dò ngược khớp với gross → net', () => {
  assert.equal(Q.netToGross({ net: 26215000 }), 30000000);
  for (const net of [8e6, 15e6, 20e6, 35e6, 80e6, 200e6]) {
    for (const dependents of [0, 2]) {
      const g = Q.netToGross({ net, dependents, region: 1 });
      const got = Q.grossToNet({ gross: g, dependents, region: 1 }).net;
      assert.ok(got >= net, `${net}: ${got}`);
      assert.ok(Q.grossToNet({ gross: g - 1000, dependents, region: 1 }).net < net, 'không xin dư quá 1.000đ');
    }
  }
});

test('net → gross: tính cả phụ cấp, phụ cấp đủ thì báo', () => {
  const g = Q.netToGross({ net: 20730000, allowance: 730000 });
  assert.equal(g, Q.netToGross({ net: 20000000 }));
  const out = Q.evaluateGross({ mode: 'net', gross: '500k', allowance: '730k', dependents: 0, region: '1' });
  assert.equal(out.result, null);
  assert.match(out.hint, /Phụ cấp đã đủ/);
  const ok = Q.evaluateGross({ mode: 'net', gross: '20tr', allowance: '', dependents: 0, region: '1' });
  assert.equal(ok.result.target, 20000000);
  assert.ok(ok.result.net >= 20000000);
  assert.match(Q.netQuipFor(ok.result, 's'), /\d/);
  assert.ok(!/[{}]/.test(Q.netQuipFor(ok.result, 's')));
  assert.match(Q.evaluateGross({ mode: 'net', gross: '', dependents: 0 }).hint, /muốn cầm về/);
});

/* ---------- So sánh offer ---------- */
test('so sánh 2 offer: theo lương thực nhận mỗi giờ', () => {
  const out = Q.evaluateOffers({
    a: { gross: '30tr', allowance: '', days: '22', hours: '8' },
    b: { gross: '28tr', allowance: '1tr', days: '20', hours: '8' },
    dependents: 0, region: '1'
  });
  const r = out.result;
  assert.ok(r.a.hourly > 0 && r.b.hourly > 0);
  assert.equal(r.win, r.a.hourly >= r.b.hourly ? 'a' : 'b');
  assert.ok(r.diff >= 0);
  assert.equal(r.b.monthHours, 160);
  const q = Q.offerQuip(r.diff, 'B', 's');
  assert.ok(!/[{}]/.test(q), q);
  noBadNumbers(out);
});

test('so sánh offer: thiếu hoặc sai thì gợi ý', () => {
  assert.match(Q.evaluateOffers({ a: { gross: '30tr', days: '22', hours: '8' }, b: { gross: '', days: '22', hours: '8' } }).hint, /cả hai offer/);
  assert.match(Q.evaluateOffers({ a: { gross: 'abc', days: '22', hours: '8' }, b: { gross: '1tr', days: '22', hours: '8' } }).hint, /chưa ổn/);
  assert.match(Q.evaluateOffers({ a: { gross: '1tr', days: '40', hours: '8' }, b: { gross: '1tr', days: '22', hours: '8' } }).hint, /chưa ổn/);
  for (const [d, k] of [[0.01, 0], [0.08, 1], [0.4, 2]]) {
    const q = Q.offerQuip(d, 'A', 'x');
    assert.ok(Q.OFFER_QUIPS[k].lines.some((l) => q === l.replace('{win}', 'A').replace('{pct}', Q.formatNumber(d * 100, d < 0.1 ? 1 : 0) + '%')), q);
  }
});

/* ---------- Để dành ---------- */
test('để dành: số tháng = tổng / phần lương để dành', () => {
  const out = evc([{ name: 'iPhone mới', price: '30tr' }], { payMode: 'save', savePct: 0.2 });
  const sv = out.result.saving;
  assert.equal(sv.perMonth, 3000000);
  assert.equal(sv.months, 10);
  assert.equal(sv.span.text, '10 tháng');
  assert.equal(out.result.installment, null);
  assert.match(out.result.sentence, /^Để dành 20% lương \(3\.000\.000đ\) mỗi tháng thì sau 10 tháng là mua được\.$/);
  assert.ok(Q.SAVING_QUIPS[2].lines.map((l) => l.replace('{t}', '10 tháng')).includes(out.result.quip));
  assert.equal(Q.formatMonths(0.2).text, '6 ngày');
  assert.equal(Q.formatMonths(2.5).text, '2,5 tháng');
  assert.equal(Q.formatMonths(30).text, '2,5 năm');
  noBadNumbers(out);
});

/* ---------- Thói quen ---------- */
const ctx = { hourlyRate: 15000000 / 176, hours: 8, days: 22 };
test('thói quen: quy ra mỗi năm, sắp theo tốn nhất', () => {
  const out = Q.evaluateHabits({ habits: [
    { name: 'Cà phê', price: '35k', times: '5', per: 'week' },
    { name: 'Trà sữa', price: '45k', times: '5', per: 'week' },
    { name: 'Netflix', price: '260k', times: '1', per: 'month' }
  ] }, ctx);
  const r = out.result;
  assert.equal(r.habits[0].name, 'Trà sữa');
  assert.equal(r.habits[0].yearCost, 45000 * 5 * 52);
  assert.equal(r.total, 45000 * 260 + 35000 * 260 + 260000 * 12);
  assert.ok(Math.abs(r.top.workDays - 45000 * 260 / ctx.hourlyRate / 8) < 1e-9);
  assert.match(r.quip, /^Trà sữa|trà sữa/);
  assert.ok(!/[{}]/.test(r.quip), r.quip);
  noBadNumbers(out);
});

test('thói quen: thiếu lương, chưa có giá, số lần sai', () => {
  const h = [{ name: 'x', price: '45k', times: '5', per: 'day' }];
  assert.match(Q.evaluateHabits({ habits: h }, null).hint, /lương về tay/);
  assert.match(Q.evaluateHabits({ habits: [{ name: 'x', price: '', times: '5', per: 'day' }] }, ctx).hint, /Nhập giá/);
  assert.match(Q.evaluateHabits({ habits: [{ name: 'x', price: '45k', times: '0', per: 'day' }] }, ctx).hint, /Số lần/);
  assert.match(Q.evaluateHabits({ habits: [{ name: 'x', price: 'abc', times: '1', per: 'day' }] }, ctx).hint, /chưa đọc được/);
  assert.equal(Q.evaluateHabits({ habits: [{ name: '', price: '10k', times: '1', per: 'day' }] }, ctx).result.top.name, 'Thói quen 1');
});

/* ---------- Đồng hồ kiếm tiền ---------- */
test('đồng hồ: trước giờ, đang làm, sau giờ', () => {
  const start = Q.parseClock('08:30'), end = Q.parseClock('17:30');
  assert.equal(start, 510);
  assert.equal(Q.parseClock('25:00'), null);
  assert.equal(Q.parseClock('abc'), null);
  const daily = 15000000 / 22;
  assert.equal(Q.clockState(8 * 3600, start, end, daily).phase, 'before');
  const mid = Q.clockState(13 * 3600, start, end, daily);
  assert.equal(mid.phase, 'working');
  assert.ok(Math.abs(mid.earned - daily * 0.5) < 1e-6);
  assert.ok(Math.abs(mid.ratePerSec - daily / (9 * 3600)) < 1e-9);
  const after = Q.clockState(18 * 3600, start, end, daily);
  assert.equal(after.phase, 'after');
  assert.equal(after.earned, daily);
  // ca đêm 22:00 → 06:00
  const night = Q.clockState(1 * 3600, Q.parseClock('22:00'), Q.parseClock('06:00'), 800000);
  assert.equal(night.phase, 'working');
  assert.ok(Math.abs(night.earned - 300000) < 1e-6);
});

test('đồng hồ: đủ mấy món, câu toilet', () => {
  assert.match(Q.affordable(412350), /^đủ \d+ /);
  assert.equal(Q.affordable(1000), '');
  for (const [sec, k] of [[30, 0], [200, 1], [600, 2], [1500, 3]]) {
    const q = Q.toiletQuip(sec, 23400, 'x');
    assert.ok(!/[{}]/.test(q), q);
    const lines = Q.TOILET_QUIPS[k].lines.map((l) => l.replace('{money}', '23.400đ').replace('{t}', Q.formatElapsed(sec)));
    assert.ok(lines.includes(q), q);
  }
  assert.equal(Q.formatElapsed(125), '2 phút 5 giây');
  assert.equal(Q.formatElapsed(42), '42 giây');
});

/* ---------- Sổ thu nhập & Google Sheet ---------- */
test('parseDate: nhiều kiểu gõ, chặn ngày không có thật', () => {
  assert.equal(Q.parseDate('2026-10-19'), '2026-10-19');
  assert.equal(Q.parseDate('19/10/2026'), '2026-10-19');
  assert.equal(Q.parseDate('5-1-2026'), '2026-01-05');
  assert.equal(Q.parseDate('5.1.2026'), '2026-01-05');
  assert.equal(Q.parseDate('2026-1-5T00:00:00.000Z'), '2026-01-05');
  assert.equal(Q.parseDate('29/02/2028'), '2028-02-29');
  for (const bad of ['', null, undefined, '29/02/2026', '31/04/2026', '00/01/2026', '1/13/2026', 'hôm qua', '2026/10/19', '19/10/26', '1/1/1800']) {
    assert.equal(Q.parseDate(bad), null, String(bad));
  }
  assert.equal(Q.formatDate('2026-01-05'), '05/01/2026');
});

test('incomeType đọc nhãn gõ tay trên sheet', () => {
  const cases = [['Lương', 'salary'], ['luong thang 10', 'salary'], ['LƯƠNG', 'salary'], ['Thưởng Tết', 'bonus'],
    ['bonus', 'bonus'], ['Làm thêm', 'extra'], ['tăng ca', 'extra'], ['OT', 'extra'], ['Freelance', 'extra'],
    ['salary', 'salary'], ['Khác', 'other'], ['', 'other'], [null, 'other'], ['bán đồ cũ', 'other']];
  for (const [label, key] of cases) assert.equal(Q.incomeType(label), key, String(label));
  assert.equal(Q.incomeLabel('extra'), 'Làm thêm');
  assert.equal(Q.incomeLabel('???'), 'Khác');
});

test('normalizeIncome: bỏ dòng hỏng, đếm lại, sắp theo ngày', () => {
  const n = Q.normalizeIncome([
    { id: 'b', date: '2026-02-01', type: 'Thưởng', amount: '5tr', note: '  Tết  ' },
    { id: 'a', date: '15/01/2026', type: 'Lương', amount: 15000000.4 },
    { id: 'c', date: 'không rõ', type: 'Lương', amount: 1000 },
    { id: 'd', date: '2026-03-01', type: 'Lương', amount: 'abc' },
    { id: 'e', date: '2026-03-01', type: 'Lương', amount: -5 },
    { id: 'f', date: '2026-03-01', type: 'Lương', amount: 0 },
    { id: 'g', date: '2026-03-01', type: 'Lương', amount: 1e20 },
    null, 'chuỗi', { date: '2026-04-01', amount: 100000 }
  ]);
  assert.equal(n.skipped, 7);
  assert.deepEqual(n.entries.map((e) => e.id), ['a', 'b', 'row-9']);
  assert.equal(n.entries[0].amount, 15000000);
  assert.equal(n.entries[1].note, 'Tết');
  assert.equal(n.entries[2].type, 'other');
  assert.deepEqual(Q.normalizeIncome('rác'), { entries: [], skipped: 0 });
});

test('checkIncome: lỗi nhẹ nhàng, không ra NaN', () => {
  const ok = Q.checkIncome({ amount: '15tr', date: '2026-10-05', type: 'bonus', note: ' Tết ' });
  assert.deepEqual(ok.entry, { date: '2026-10-05', type: 'bonus', amount: 15000000, note: 'Tết' });
  assert.equal(Q.checkIncome({ amount: '', date: '2026-10-05', type: 'salary' }).errors.amount, Q.MSG.incomeEmpty);
  assert.equal(Q.checkIncome({ amount: '0', date: '2026-10-05', type: 'salary' }).errors.amount, Q.MSG.incomeZero);
  assert.equal(Q.checkIncome({ amount: 'abc', date: '2026-10-05', type: 'salary' }).errors.amount, Q.MSG.incomeInvalid);
  assert.equal(Q.checkIncome({ amount: '-5tr', date: '2026-10-05', type: 'salary' }).errors.amount, Q.MSG.incomeNegative);
  assert.equal(Q.checkIncome({ amount: '9e99', date: '2026-10-05', type: 'salary' }).entry, null);
  const badDate = Q.checkIncome({ amount: '1tr', date: '', type: 'salary' });
  assert.equal(badDate.entry, null);
  assert.equal(badDate.errors.date, Q.MSG.dateInvalid);
  assert.equal(Q.checkIncome({ amount: '1tr', date: '2026-01-01', type: 'hack' }).entry.type, 'other');
});

const book = Q.normalizeIncome([
  { id: '1', date: '2025-01-10', type: 'Lương', amount: 10000000 },
  { id: '2', date: '2025-06-10', type: 'Lương', amount: 10000000 },
  { id: '3', date: '2025-12-20', type: 'Thưởng', amount: 20000000 },
  { id: '4', date: '2026-01-10', type: 'Lương', amount: 12000000 },
  { id: '5', date: '2026-02-10', type: 'Lương', amount: 12000000 },
  { id: '6', date: '2026-02-14', type: 'Thưởng', amount: 6000000 },
  { id: '7', date: '2026-03-02', type: 'Làm thêm', amount: 3000000 }
]).entries;

test('summarizeIncome: năm đang chạy so với cùng kỳ năm trước', () => {
  const r = Q.summarizeIncome(book, 2026, '2026-03-31');
  assert.equal(r.total, 33000000);
  assert.equal(r.count, 4);
  assert.deepEqual(r.byType, { salary: 24000000, bonus: 6000000, extra: 3000000, other: 0 });
  assert.equal(r.months[1].total, 18000000);
  assert.equal(r.best.month, 2);
  assert.equal(r.elapsedMonths, 3);
  assert.equal(r.avgPerMonth, 11000000);
  assert.equal(r.perDay, 33000000 / 90);
  assert.equal(r.prevTotal, 10000000); // cùng kỳ 2025 chỉ có tháng 1
  assert.equal(r.change, 2.3);
  assert.equal(r.salaryMonths, 2);
  assert.equal(r.monthsWithIncome, 3);
  assert.deepEqual(r.years, [{ year: 2025, total: 40000000 }, { year: 2026, total: 33000000 }]);
  noBadNumbers(r);
});

test('summarizeIncome: năm đã qua tính trọn, năm chưa tới, sổ trống', () => {
  const past = Q.summarizeIncome(book, 2025, '2026-03-31');
  assert.equal(past.total, 40000000);
  assert.equal(past.elapsedMonths, 12);
  assert.equal(past.perDay, 40000000 / 365);
  assert.equal(past.prevTotal, null);
  assert.equal(past.change, null);
  const future = Q.summarizeIncome(book, 2027, '2026-03-31');
  assert.equal(future.future, true);
  assert.equal(future.avgPerMonth, null);
  assert.equal(future.perDay, null);
  const empty = Q.summarizeIncome([], 2026, '2026-10-19');
  assert.equal(empty.total, 0);
  assert.equal(empty.best, null);
  assert.equal(empty.change, null);
  noBadNumbers(empty);
  noBadNumbers(Q.summarizeIncome(undefined, 2026, '2026-02-29'));
});

test('summarizeIncome: mới ghi từ giữa năm thì trung bình tính từ tháng đầu có ghi', () => {
  const r = Q.summarizeIncome(Q.normalizeIncome([{ id: 'x', date: '2026-09-05', type: 'Lương', amount: 20000000 },
    { id: 'y', date: '2026-10-05', type: 'Lương', amount: 20000000 }]).entries, 2026, '2026-10-31');
  assert.equal(r.firstMonth, 9);
  assert.equal(r.elapsedMonths, 2);
  assert.equal(r.avgPerMonth, 20000000);
  assert.equal(r.perDay, 40000000 / 61);
});

test('incomeQuip đúng mức, không sót placeholder', () => {
  const levels = [[null, 0], [0.5, 1], [0.05, 2], [-0.1, 3], [-0.4, 4]];
  for (const [c, k] of levels) {
    const q = Q.incomeQuip(c, 'seed');
    assert.ok(!/[{}]/.test(q), q);
    const lines = Q.INCOME_QUIPS[k].lines.map((l) => l.replace('{pct}', c === null ? '' : Q.formatPct(c)));
    assert.ok(lines.includes(q), q);
  }
  assert.equal(Q.formatPct(0.054), '5,4%');
  assert.equal(Q.formatPct(-0.25), '25%');
});

test('moneyParts gọn cho số to', () => {
  assert.deepEqual(Q.moneyParts(312500000), [['312,5', 'triệu']]);
  assert.deepEqual(Q.moneyParts(15250000), [['15,25', 'triệu']]);
  assert.deepEqual(Q.moneyParts(1234000000), [['1,23', 'tỷ']]);
  assert.deepEqual(Q.moneyParts(850000), [['850.000', 'đ']]);
});

test('checkScriptUrl chỉ nhận link Web app /exec', () => {
  const id = 'AKfycbx1234567890abcdefghijkLMNOP_-';
  assert.equal(Q.checkScriptUrl(' https://script.google.com/macros/s/' + id + '/exec ').value,
    'https://script.google.com/macros/s/' + id + '/exec');
  assert.equal(Q.checkScriptUrl('https://script.google.com/macros/s/' + id + '/exec?x=1').value,
    'https://script.google.com/macros/s/' + id + '/exec');
  assert.equal(Q.checkScriptUrl('https://script.google.com/a/macros/congty.vn/s/' + id + '/exec').state, 'ok');
  assert.equal(Q.checkScriptUrl('').state, 'empty');
  assert.equal(Q.checkScriptUrl('https://docs.google.com/spreadsheets/d/abc/edit').state, 'sheet');
  assert.equal(Q.checkScriptUrl('https://script.google.com/macros/s/' + id + '/dev').state, 'dev');
  assert.equal(Q.checkScriptUrl('https://script.google.com/home/projects/abc/edit').state, 'editor');
  for (const bad of ['http://script.google.com/macros/s/' + id + '/exec', 'https://evil.com/macros/s/' + id + '/exec',
    'https://script.google.com.evil.com/macros/s/' + id + '/exec', 'https://script.google.com/macros/s/short/exec',
    'https://script.google.com/macros/s/' + id + '/execx', 'javascript:alert(1)']) {
    assert.equal(Q.checkScriptUrl(bad).state, 'invalid', bad);
  }
});

test('readSheetReply: chịu được phản hồi hỏng', () => {
  const ok = Q.readSheetReply(JSON.stringify({ ok: true, sheet: 'Tài chính', income: [
    { id: 'a', date: '2026-10-01', type: 'Lương', amount: 15000000, note: '' },
    { id: 'b', date: '', type: '', amount: '', note: '' }] }));
  assert.equal(ok.ok, true);
  assert.equal(ok.name, 'Tài chính');
  assert.equal(ok.entries.length, 1);
  assert.equal(ok.skipped, 1);
  assert.deepEqual(Q.readSheetReply('<html>Đăng nhập</html>'), { ok: false, error: 'not-json' });
  assert.equal(Q.readSheetReply('null').ok, false);
  assert.equal(Q.readSheetReply('{"ok":false,"error":"not-found"}').error, 'not-found');
  assert.equal(Q.readSheetReply('{"ok":true}').entries, undefined);
});

test('sheetRow ghi nhãn tiếng Việt; mã Apps Script hợp lệ', () => {
  assert.deepEqual(Q.sheetRow({ id: 'x', date: '2026-10-01', type: 'extra', amount: 5, note: '' }),
    { id: 'x', date: '2026-10-01', type: 'Làm thêm', amount: 5, note: '' });
  assert.doesNotThrow(() => new Function(Q.APPS_SCRIPT));
  assert.match(Q.APPS_SCRIPT, /function doGet/);
  assert.match(Q.APPS_SCRIPT, /function doPost/);
});

test('kho câu mới: không câu nào trùng, mỗi mức đủ 3 câu', () => {
  const pools = [Q.TIME_QUIPS, Q.TAX_QUIPS, Q.INSTALLMENT_QUIPS, Q.OFFER_QUIPS, Q.SAVING_QUIPS, Q.HABIT_QUIPS, Q.TOILET_QUIPS, Q.INCOME_QUIPS];
  const all = pools.flatMap((p) => p.flatMap((b) => b.lines)).concat(Q.NET_TO_GROSS_QUIPS);
  assert.equal(new Set(all).size, all.length);
  pools.forEach((p) => p.forEach((b) => assert.ok(b.lines.length >= 3)));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
