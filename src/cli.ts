#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBundle, MIN_MAX_BYTES, writeBundle } from "./bundle.js";
import { captureCommand } from "./capture.js";
import { loadRedactionRules, redactText } from "./redact.js";
import type { CrashcartBundle } from "./types.js";

function parseOptions(args: string[], allowed: readonly string[]): Map<string, string> {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    if (!option?.startsWith("--")) throw new Error(`Unexpected argument: ${option}`);
    if (!allowed.includes(option)) throw new Error(`Unknown option: ${option}`);
    if (values.has(option)) throw new Error(`Duplicate option: ${option}`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${option} requires a value`);
    values.set(option, value);
  }
  return values;
}

function usage(): string {
  return `crashcart

Usage:
  crashcart run [--out DIR] [--max-bytes N>=${MIN_MAX_BYTES}] [--timeout-ms N>=1] [--patterns FILE] -- <command>
  crashcart inspect <bundle.json>
  crashcart redact <file> [--patterns FILE] [--out FILE]

The run command writes a bundle for nonzero exits, signals, timeouts, and commands
that cannot be spawned (for example, an executable missing from PATH).
`;
}

function integerOption(options: Map<string, string>, flag: string, defaultValue: number, minimum: number): number {
  const raw = options.get(flag);
  if (raw === undefined) return defaultValue;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${flag} must be an integer of at least ${minimum}`);
  }
  return value;
}

async function runCommand(args: string[]): Promise<number> {
  const separator = args.indexOf("--");
  if (separator < 0) throw new Error("run requires -- before the command to capture");
  const optionArgs = args.slice(0, separator);
  const command = args.slice(separator + 1);
  const options = parseOptions(optionArgs, ["--out", "--max-bytes", "--timeout-ms", "--patterns"]);
  if (command.length === 0) throw new Error("run requires a command after --");
  const outDir = resolve(options.get("--out") ?? ".crashcart/latest");
  const maxBytes = integerOption(options, "--max-bytes", 120000, MIN_MAX_BYTES);
  const timeoutMs = integerOption(options, "--timeout-ms", 600000, 1);
  const patternFile = options.get("--patterns");
  const captured = await captureCommand(command, process.cwd(), timeoutMs);
  const bundle = await createBundle(captured, {
    outDir,
    cwd: process.cwd(),
    maxBytes,
    timeoutMs,
    patternFile
  });
  const written = await writeBundle(bundle, outDir);
  console.log(`Crashcart wrote ${written.jsonPath}`);
  console.log(`Likely: ${bundle.classification.class} - ${bundle.classification.summary}`);
  return captured.exitCode ?? (captured.signal ? 1 : 0);
}

async function inspectCommand(args: string[]): Promise<number> {
  const bundlePath = args[0];
  if (!bundlePath) throw new Error("inspect requires a crashcart.json path");
  if (args.length > 1) throw new Error(`Unexpected argument: ${args[1]}`);
  if (bundlePath.startsWith("--")) throw new Error(`Unknown option: ${bundlePath}`);
  const bundle = JSON.parse(await readFile(bundlePath, "utf8")) as CrashcartBundle;
  console.log(`${bundle.classification.class} (${bundle.classification.confidence})`);
  console.log(bundle.classification.summary);
  for (const check of bundle.classification.nextChecks) {
    console.log(`- ${check}`);
  }
  return 0;
}

async function redactCommand(args: string[]): Promise<number> {
  const input = args[0];
  if (!input || input.startsWith("--")) throw new Error("redact requires an input file");
  const options = parseOptions(args.slice(1), ["--patterns", "--out"]);
  const patternFile = options.get("--patterns");
  const outFile = options.get("--out");
  const rules = await loadRedactionRules(patternFile);
  const result = redactText(await readFile(input, "utf8"), rules);
  if (outFile) {
    await writeFile(outFile, result.text);
  } else {
    process.stdout.write(result.text);
  }
  return 0;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    if (argv.length > 1) throw new Error(`Unexpected argument: ${argv[1]}`);
    console.log(usage());
    return 0;
  }
  if (argv[0] === "--version" || argv[0] === "-v") {
    if (argv.length > 1) throw new Error(`Unexpected argument: ${argv[1]}`);
    console.log("0.1.0");
    return 0;
  }

  const [command, ...rest] = argv;
  if (command === "run") return await runCommand(rest);
  if (command === "inspect") return await inspectCommand(rest);
  if (command === "redact") return await redactCommand(rest);
  throw new Error(`Unknown command: ${command}`);
}

main().then((code) => {
  process.exitCode = code;
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
