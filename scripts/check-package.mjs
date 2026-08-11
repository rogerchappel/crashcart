import { spawnSync } from "node:child_process";

const packed = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (packed.status !== 0) {
  process.stderr.write(packed.stderr);
  process.exit(packed.status ?? 1);
}

let files;
try {
  [{ files }] = JSON.parse(packed.stdout);
} catch (error) {
  console.error(`Could not parse npm pack file list: ${error.message}`);
  process.exit(1);
}

const paths = new Set(files.map(({ path }) => path));
const required = ["dist/src/cli.js", "dist/src/index.js"];
const missing = required.filter((path) => !paths.has(path));
const compiledTests = [...paths].filter((path) => path.startsWith("dist/tests/"));

if (missing.length > 0 || compiledTests.length > 0) {
  if (missing.length > 0) {
    console.error(`Package is missing required runtime files: ${missing.join(", ")}`);
  }
  if (compiledTests.length > 0) {
    console.error(`Package contains compiled test files: ${compiledTests.join(", ")}`);
  }
  process.exit(1);
}

console.log(`Package contents verified (${paths.size} files, compiled tests excluded).`);
