import assert from "node:assert/strict";
import test from "node:test";

import { scanSource } from "../../scripts/sast-guardrail-lib.mjs";

test("PT-SEC-001 SAST guardrail rejects dynamic and child-process execution", () => {
  const cases = [
    "eval(input);",
    "(eval)(input);",
    "globalThis.eval(input);",
    "globalThis['eval'](input);",
    "Function(source);",
    "new Function(source);",
    "const Build = Function; new Build(source);",
    "import { exec as run } from 'node:child_process'; run(command);",
    "import * as cp from 'child_process'; cp.spawn(command);",
    "import * as cp from 'node:child_process'; cp['execSync'](command);",
    "import * as cp from 'node:child_process'; const run = cp.exec; run(command);",
    "import * as cp from 'node:child_process'; const alias = cp; alias.exec(command);",
    "import * as cp from 'node:child_process'; const { exec: run } = cp; run(command);",
    "const cp = require('node:child_process'); cp.exec(command);",
    "const load = require; load(`node:child_process`);",
    "const load = require; load(moduleName);",
    "const cp = await import('node:child_process'); cp.exec(command);",
    "const moduleName = 'node:child_process'; const cp = await import(moduleName);",
    "const moduleName = 'child_process'; const cp = await import(`node:${moduleName}`);",
    "const run = globalThis.eval; run(source);",
    "const root = globalThis; root.eval(source);",
    "const root = globalThis; const run = root['eval']; run(source);",
    "new globalThis.Function(source);",
    "new globalThis['Function'](source);",
  ];
  for (const source of cases) assert.notDeepEqual(scanSource(source), [], source);
});

test("PT-SEC-001 SAST guardrail accepts safe calls and fails on malformed source", () => {
  assert.deepEqual(scanSource("const match = /^safe$/u.exec(value);"), []);
  assert.deepEqual(scanSource("const exec = (value) => value; exec('safe');"), []);
  assert.deepEqual(scanSource("const data = require('./data.json');"), []);
  assert.throws(() => scanSource("const broken = ;"), /TypeScript parse failed/u);
});
