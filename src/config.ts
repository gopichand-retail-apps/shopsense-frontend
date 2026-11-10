const defaultIsMock = true;
const modeOverride = process.env.NEXT_PUBLIC_IS_MOCK;

if (modeOverride !== undefined && modeOverride !== "true" && modeOverride !== "false") {
  throw new Error('NEXT_PUBLIC_IS_MOCK must be "true" or "false".');
}

export const isMock = modeOverride === undefined ? defaultIsMock : modeOverride === "true";
