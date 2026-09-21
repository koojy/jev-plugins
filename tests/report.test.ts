import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("shared reports keep results on stdout and every log level on stderr", () => {
  const report = new URL("../src/report.ts", import.meta.url).href;
  const logger = new URL("../src/logger.ts", import.meta.url).href;
  const code = `
    import { printReport } from ${JSON.stringify(report)};
    import { logger } from ${JSON.stringify(logger)};
    printReport({
      sections: [
        { title: 'Results', items: ['one', 'two'] },
        { title: 'Empty', items: [] },
      ],
      errors: ['request failed'],
    });
    logger.level = 5;
    logger.info('progress');
    logger.warn('warning');
    logger.debug('detail');
    logger.error('duplicate');
    logger.error('duplicate');
  `;
  const env: NodeJS.ProcessEnv = { ...process.env, CONSOLA_LEVEL: "5" };
  delete env.FORCE_COLOR;
  const result = spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), "--input-type=module", "--eval", code], { env, encoding: "utf8", timeout: 15_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "\nResults\n  one\n  two\n\nEmpty\n  None\n\nErrors: 1\n");
  for (const message of ["request failed", "progress", "warning", "detail"]) {
    assert.ok(result.stderr.includes(message), result.stderr);
  }
  assert.equal((result.stderr.match(/duplicate/g) ?? []).length, 2);
  assert.doesNotMatch(result.stderr, /\u001b\[/);
});
