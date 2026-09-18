/**
 * Setup file untuk Jest testing framework
 * Dijalankan sebelum semua test suites
 */

// Polyfill untuk environment node
if (typeof window === 'undefined') {
  global.window = undefined as any;
  global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  } as any;
}

// Suppress console warnings during tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
