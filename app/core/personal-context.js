// Personal context: who the person knows, where they go, what recurs in their life.
//
// See specs/002-context-aware-dyadic-support/data-model.md §4, docs/architecture.md §A2.4.
//
// READ-ONLY and IN-MEMORY ONLY. This module deliberately contains no setter and touches
// no storage API. There is no localStorage, no IndexedDB, no cookie, no server write
// anywhere in its lifecycle (FR-004). Nothing here survives a reload — that is the point.
//
// Two loading paths with DIFFERENT data (FR-005):
//
//   ?config=<id>      synthetic fixtures only, from app/context/<id>.json
//   researcher load   real participant context, chosen on the device at session start
//
// A real participant's context must never be committed, served from app/, or put in a URL.

/** @type {Object|null} */
let context = null;

const EMPTY = Object.freeze({
  people: Object.freeze([]),
  places: Object.freeze([]),
  schedule: Object.freeze([]),
  interests: Object.freeze([]),
  topics: Object.freeze([]),
});

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const arr = (v) => (Array.isArray(v) ? Object.freeze([...v]) : Object.freeze([]));
  return Object.freeze({
    people: arr(raw.people),
    places: arr(raw.places),
    schedule: arr(raw.schedule),
    interests: arr(raw.interests),
    topics: arr(raw.topics),
  });
  // `_note` and any other key is dropped: JSON cannot carry comments, so fixtures use
  // a _note field that must not reach the model.
}

/**
 * Load a SYNTHETIC fixture by id. Development, demos and rehearsal only.
 *
 * The id is constrained to a safe slug so this cannot be pointed at an arbitrary path,
 * and the fetch is always relative to app/context/.
 */
export async function loadFixture(id, fetchImpl = fetch) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(String(id || ''))) {
    throw new Error(`personal-context: invalid fixture id "${id}"`);
  }
  const res = await fetchImpl(`context/${id}.json`);
  if (!res.ok) throw new Error(`personal-context: fixture "${id}" not found`);
  context = normalize(await res.json());
  return context;
}

/**
 * Load real participant context from an on-device source (a File the researcher picked,
 * or an on-device form). Held in memory only; never persisted, never uploaded anywhere
 * except as part of a hypotheses request when ctx=personal.
 */
export function loadFromObject(raw) {
  context = normalize(raw);
  return context;
}

/**
 * Researcher-only real-context path: read a JSON File selected on this device.
 * The File object never becomes a URL and nothing is written to browser/server storage.
 */
export async function loadFromFile(file) {
  if (!file || typeof file.text !== 'function') {
    throw new Error('personal-context: a local JSON File is required');
  }
  const text = await file.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (_) {
    throw new Error('personal-context: invalid JSON');
  }
  return loadFromObject(raw);
}

/** Null when nothing has been loaded — distinct from "loaded but empty". */
export function getPersonalContext() {
  return context;
}

export function hasPersonalContext() {
  return context !== null;
}

/**
 * Resolve an evidence path such as `schedule[0]` or `people[2].name` (data-model.md §7).
 * Returns undefined when the path does not resolve; the caller treats that as
 * unverifiable rather than as an error.
 */
export function resolvePath(path) {
  if (!context || typeof path !== 'string') return undefined;
  const parts = path.match(/[^.[\]]+/g);
  if (!parts) return undefined;
  let cur = context;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[/^\d+$/.test(part) ? Number(part) : part];
  }
  return cur;
}

/** Discarded on session stop or reload. */
export function clearPersonalContext() {
  context = null;
}
