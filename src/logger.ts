import { createConsola } from "consola";

export const logger = createConsola({
  fancy: false,
  stdout: process.stderr,
  stderr: process.stderr,
  formatOptions: { date: false, colors: false },
  throttle: 0,
});
