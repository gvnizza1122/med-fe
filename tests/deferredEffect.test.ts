import { scheduleEffect } from '@/lib/useDeferredEffect';

afterEach(() => jest.useRealTimers());
test('inisialisasi yang dibatalkan sebelum mulai tidak memuat ulang data', () => {
  jest.useFakeTimers();
  const effect = jest.fn();
  const cancel = scheduleEffect(effect);
  cancel(); jest.runAllTimers();
  expect(effect).not.toHaveBeenCalled();
});
test('inisialisasi berjalan sekali dan membersihkan langganan saat dilepas', () => {
  jest.useFakeTimers();
  const cleanup = jest.fn();
  const effect = jest.fn(() => cleanup);
  const cancel = scheduleEffect(effect);
  jest.runAllTimers(); expect(effect).toHaveBeenCalledTimes(1);
  cancel(); expect(cleanup).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
test('siklus StrictMode tidak menjalankan inisialisasi yang sudah dibatalkan', () => {
  jest.useFakeTimers();
  const effect = jest.fn();
  scheduleEffect(effect)();
  const cancel = scheduleEffect(effect);
  jest.runAllTimers(); expect(effect).toHaveBeenCalledTimes(1); cancel();
});
