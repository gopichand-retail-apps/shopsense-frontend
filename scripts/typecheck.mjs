import { spawnSync } from "node:child_process";

// Type generation loads rewrites but sends no requests and creates no deployable build.
// Supply loopback origins only in that child; real builds retain strict origin requirements.
const generationEnvironment = {
  ...process.env,
  SHOPSENSE_MOCK_API_URL: process.env.SHOPSENSE_MOCK_API_URL ?? "http://127.0.0.1:5802",
  SHOPSENSE_REAL_API_URL: process.env.SHOPSENSE_REAL_API_URL ?? "http://127.0.0.1:5802",
};

function run(args, env) {
  const result = spawnSync(process.execPath, args, { env, stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    return 1;
  }
  return result.status ?? 1;
}

const generated = run(["node_modules/next/dist/bin/next", "typegen"], generationEnvironment);
process.exitCode = generated === 0 ? run(["node_modules/typescript/bin/tsc", "--noEmit"], process.env) : generated;
