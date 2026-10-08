import { claimPercentage, fieldValue, jsonObject } from '@/lib/claimData';
test('data JSON rusak/array tidak dianggap sebagai peta kolom klaim', () => {
  for (const value of ['{rusak', 'null', '[]', null, [1]]) expect(jsonObject(value)).toEqual({});
  expect(jsonObject('{"LOS":3}')).toEqual({ LOS: 3 });
});
test('nilai objek tidak bocor ke tampilan isian klaim', () => {
  expect(fieldValue({ data: 'bukan nilai kolom' })).toBeNull();
  expect(fieldValue('J18.9')).toBe('J18.9'); expect(fieldValue(0)).toBe(0);
});

test('persentase klaim kosong dan hitungan tidak sah tidak menjadi NaN atau Infinity', () => {
  expect(claimPercentage(0, 0)).toBe(0);
  expect(claimPercentage(1, 0)).toBe(0);
  expect(claimPercentage(Number.NaN, 2)).toBe(0);
  expect(claimPercentage(2, 4)).toBe(50);
  expect(claimPercentage(4, 2)).toBe(100);
});
