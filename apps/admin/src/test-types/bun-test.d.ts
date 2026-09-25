/**
 * Minimal Bun test runner typings for admin unit tests.
 * The monorepo uses Bun for tests (@see packages/blocks, packages/block-schema).
 * Production admin code is Vite/React — this file is included only by tsconfig.test.json.
 */
declare module "bun:test" {
  type TestFn = () => void | Promise<void>;

  export function describe(name: string, fn: TestFn): void;
  export function it(name: string, fn: TestFn): void;
  export function beforeEach(fn: TestFn): void;
  export function afterEach(fn: TestFn): void;

  export interface Matchers<T = unknown> {
    toEqual(expected: T): void;
    toBe(expected: T): void;
    toBeDefined(): void;
    toContain(item: unknown): void;
    toThrow(expected?: string | RegExp): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toHaveLength(expected: number): void;
    toHaveBeenCalled(): void;
    toHaveBeenCalledTimes(expected: number): void;
    toHaveBeenCalledWith(...args: unknown[]): void;
    not: Pick<
      Matchers<T>,
      "toContain" | "toBe" | "toHaveBeenCalled" | "toHaveBeenCalledTimes"
    >;
  }

  export function expect<T>(value: T): Matchers<T>;

  type MockFn<T extends (...args: never[]) => unknown> = T & {
    mockImplementation(fn: T): void;
    mockClear(): void;
  };

  interface Mock {
    <T extends (...args: never[]) => unknown>(implementation?: T): MockFn<T>;
    module(
      modulePath: string,
      factory: () => Record<string, unknown>,
    ): void | Promise<void>;
  }

  export const mock: Mock;
}
