#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createBundle, writeBundle } from "./bundle.js";
import { captureCommand } from "./capture.js";
import { loadRedactionRules, redactText } from "./redact.js";
import type { CrashcartBundle } from "./types.js";

function valueAfter(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function usage(): string {
  return `crashcart

Usage:
  crashcart run [--out DIR] [--max-bytes N] [--timeout-ms N] [--patterns FILE] -- <command>
  crashcart inspect <bundle.json>
  crashcart redact <file> [--patterns FILE] [--out FILE]
`;
}

async function runCommand(args: string[]): Promise<number> {
  const separator = args.indexOf("--");
  if (separator < 0) throw new Error("run requires -- before the command to capture");
  const optionArgs = args.slice(0, separator);
  const command = args.slice(separator + 1);
  const outDir = resolve(valueAfter(optionArgs, "--out") ?? ".crashcart/latest");
  const maxBytes = Number(valueAfter(optionArgs, "--max-bytes") ?? "120000");
  const timeoutMs = Number(valueAfter(optionArgs, "--timeout-ms") ?? "600000");
  const patternFile = valueAfter(optionArgs, "--patterns");
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
  const patternFile = valueAfter(args, "--patterns");
  const outFile = valueAfter(args, "--out");
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
  if (argv.length === 0 || hasFlag(argv, "--help") || hasFlag(argv, "-h")) {
    console.log(usage());
    return 0;
  }
  if (hasFlag(argv, "--version") || hasFlag(argv, "-v")) {
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
