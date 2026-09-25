// Ephemeral research telemetry.
//
// No utterance, hypothesis, excerpt, personal-context value, or participant identifier is logged.
// Phase 1 records only timing and aggregate diagnostic categories (FR-041, FR-042).

let sink = (kind, data) => {
  if (typeof console !== 'undefined' && console.info) console.info('[research]', kind, data);
};

export function now() {
  return (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();
}

export function logLatency(kind, started) {
  const ms = Math.max(0, Math.round(now() - Number(started || 0)));
  sink('latency', Object.freeze({ kind: String(kind || 'unknown'), ms }));
  return ms;
}

export function logSafetySuppressions(suppressed, mode = 'restate') {
  if (!Array.isArray(suppressed) || !suppressed.length) return 0;
  const checks = [...new Set(suppressed.flatMap((item) =>
    (item.violations || []).map((violation) => violation.check).filter(Boolean)))];
  sink('safety-suppression', Object.freeze({
    mode: mode === 'interpret' ? 'interpret' : 'restate',
    count: suppressed.length,
    checks: Object.freeze(checks),
  }));
  return suppressed.length;
}

export function logEvidenceFailures(failures) {
  if (!Array.isArray(failures) || !failures.length) return 0;
  const reasons = [...new Set(failures.map((item) => item.reason).filter(Boolean))];
  sink('evidence-verification', Object.freeze({
    count: failures.length,
    reasons: Object.freeze(reasons),
  }));
  return failures.length;
}

/** Test seam; production uses the console sink above. */
export function __setSinkForTests(fn) {
  sink = typeof fn === 'function' ? fn : () => {};
}
