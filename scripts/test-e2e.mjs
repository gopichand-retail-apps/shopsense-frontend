import { spawnSync } from "node:child_process";

const apiOrigin = "http://127.0.0.1:5882";
const unavailableApiOrigin = "http://127.0.0.1:1";
const isMock = process.env.NEXT_PUBLIC_IS_MOCK ?? "true";
const environment = {
  ...process.env,
  CI: "1",
  SHOPSENSE_FRONTEND_PORT: "5881",
  SHOPSENSE_API_PORT: "5882",
  SHOPSENSE_API_URL: apiOrigin,
  SHOPSENSE_MOCK_API_URL: process.env.SHOPSENSE_MOCK_API_URL ?? (isMock === "true" ? apiOrigin : unavailableApiOrigin),
  SHOPSENSE_REAL_API_URL: process.env.SHOPSENSE_REAL_API_URL ?? (isMock === "false" ? apiOrigin : unavailableApiOrigin),
  NEXT_PUBLIC_IS_MOCK: isMock,
  SHOPSENSE_NEXT_DIST_DIR: "node_modules/.cache/shopsense-e2e",
};

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: "inherit",
  });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

const buildStatus = run(process.execPath, ["node_modules/next/dist/bin/next", "build"]);
process.exitCode =
  buildStatus === 0 ? run(process.execPath, ["node_modules/@playwright/test/cli.js", "test"]) : buildStatus;
