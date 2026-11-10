import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("frontend data mode configuration", () => {
  it("defaults to mock mode and supports explicit live mode", async () => {
    const previousMode = process.env.NEXT_PUBLIC_IS_MOCK;
    delete process.env.NEXT_PUBLIC_IS_MOCK;
    vi.resetModules();
    try {
      await expect(import("./config")).resolves.toMatchObject({ isMock: true });
    } finally {
      if (previousMode === undefined) delete process.env.NEXT_PUBLIC_IS_MOCK;
      else process.env.NEXT_PUBLIC_IS_MOCK = previousMode;
    }

    vi.stubEnv("NEXT_PUBLIC_IS_MOCK", "false");
    vi.resetModules();
    await expect(import("./config")).resolves.toMatchObject({ isMock: false });
  });

  it("rejects invalid mode values", async () => {
    vi.stubEnv("NEXT_PUBLIC_IS_MOCK", "maybe");
    vi.resetModules();
    await expect(import("./config")).rejects.toThrow('NEXT_PUBLIC_IS_MOCK must be "true" or "false".');
  });
});
