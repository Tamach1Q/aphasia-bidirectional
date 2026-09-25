// Shared helper for the tests that assert properties of source TEXT — import rules, the
// absence of DOM access, the absence of network calls in the safety layer.
//
// Those tests strip comments first so a mention in prose is not mistaken for a call. That
// stripping has to be right, because when it removes too much the assertions do not fail
// — they pass VACUOUSLY. A test asserting "this file contains no fetch(" succeeds
// beautifully against an empty string.
//
// The bug that produced this file: stripping block comments before line comments meant a
// `/*` occurring INSIDE a line comment (worker/index.js had `worker/prompts/*.txt`) opened
// a block comment that ran to the next `*/` 138 lines later, deleting the entire dispatch.
// Order matters, and a guard is cheaper than trusting it.

import { readFileSync } from 'node:fs';

/**
 * Source with comments removed.
 *
 * Line comments go FIRST: a `/*` inside one must not be read as opening a block.
 *
 * @throws if stripping removed most of the file, which means the regexes are wrong and
 *         every assertion built on the result would pass for the wrong reason.
 */
export function stripComments(src, label = 'source') {
  const withoutLine = src.replace(/^\s*\/\/.*$/gm, '');
  const code = withoutLine.replace(/\/\*[\s\S]*?\*\//g, '');

  const kept = code.replace(/\s/g, '').length;
  const original = src.replace(/\s/g, '').length;
  if (original > 200 && kept < original * 0.3) {
    throw new Error(
      `stripComments removed ${Math.round((1 - kept / original) * 100)}% of ${label}. `
      + 'The regexes are wrong, and assertions on this result would pass vacuously.',
    );
  }
  return code;
}

export function readCode(url, label) {
  return stripComments(readFileSync(url, 'utf8'), label || String(url));
}
