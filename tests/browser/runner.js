// Dependency-free browser test runner.
//
// Suites live in sibling files and are listed in SUITES below. Each suite module
// exports `register(test)` and calls `test(name, fn)` for each case; `fn` may be async.
// Kept deliberately small — this exists so the checks in quickstart.md can run in a
// real document, not to be a test framework.

import * as inject from '../../app/capture/inject.js';

const SUITES = [
  // filled in as stages land, e.g. './receptive.test.js'
];

export async function runAll(resultsEl, summaryEl) {
  // T037: every browser suite is driven through the injected transcript path, so none of
  // them needs a microphone. Suites receive it rather than importing it themselves, which
  // keeps the enable() call in one place.
  inject.enable(true);

  const cases = [];
  const test = (name, fn) => cases.push({ name, fn });

  for (const path of SUITES) {
    try {
      const mod = await import(path);
      mod.register(test, inject);
    } catch (err) {
      cases.push({ name: `load ${path}`, fn: () => { throw err; } });
    }
  }

  if (!cases.length) {
    summaryEl.textContent = 'no suites registered yet';
    return;
  }

  let passed = 0;
  for (const c of cases) {
    const el = document.createElement('div');
    el.className = 'case';
    try {
      await c.fn();
      el.classList.add('pass');
      el.textContent = `PASS  ${c.name}`;
      passed += 1;
    } catch (err) {
      el.classList.add('fail');
      el.innerHTML = `FAIL  ${c.name}<div class="detail"></div>`;
      el.querySelector('.detail').textContent = err && err.stack ? err.stack : String(err);
    }
    resultsEl.appendChild(el);
  }

  summaryEl.textContent = `${passed}/${cases.length} passed`;
  summaryEl.style.color = passed === cases.length ? '#2e7d32' : '#c62828';
}

export function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

export function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message || 'not equal'}\n  actual:   ${a}\n  expected: ${e}`);
}
