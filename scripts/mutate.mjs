// Manual mutation testing (VERIFICATION.md §1): apply one hand-picked bug at a time to src/, run the suite,
// record which tests fail, restore the file. A mutation that no test catches "survives" and the script exits 1.
//
//   npm run mutate              # human-readable report
//   npm run mutate -- --json    # also print results as JSON
//   npm run mutate -- --allow-dirty   # skip the clean-src/ safety check
//
// Each `find` must occur exactly once in its file. If the code is refactored, update the snippets here.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const repo = process.cwd();
const OFFERING = 'src/courseOffering.ts';

const dirty = spawnSync('git', ['status', '--porcelain', '--', 'src'], { cwd: repo, encoding: 'utf8' });
if (!process.argv.includes('--allow-dirty') && (dirty.status !== 0 || dirty.stdout.trim() !== '')) {
  console.error('Refusing to run: src/ has uncommitted changes (or this is not a git checkout).');
  console.error('Commit or stash first, or pass --allow-dirty (each file is still restored from memory after its mutant).');
  process.exit(2);
}

const mutations = [
  // Plan §4 Phase 4 (a)–(e)
  { id: 'a', name: 'capacity check off-by-one in enroll (< → <=)', file: OFFERING,
    find: 'if (this.enrolled.size < this.capacity) {', replace: 'if (this.enrolled.size <= this.capacity) {' },
  { id: 'b', name: 'promotion scans from the back of the queue', file: OFFERING,
    find: 'for (const head of this.waitlist) {', replace: 'for (const head of [...this.waitlist].reverse()) {' },
  { id: 'c', name: 'promotion ignores eligibility', file: OFFERING,
    find: 'if (completed !== undefined && isEligible(this.requiredCourseIds, completed)) return { promoted: head, skipped };',
    replace: 'return { promoted: head, skipped };' },
  { id: 'd', name: 'promoted learner not removed from waitlist', file: OFFERING,
    find: 'this.waitlist.splice(0, skipped.length + (promoted === null ? 0 : 1));', replace: 'this.waitlist.splice(0, skipped.length);' },
  { id: 'e', name: 'enroll mutates before the prerequisite check', file: OFFERING,
    find: `    if (missing.length > 0) return { ok: false, code: 'PREREQ_NOT_MET', missing };

    // All checks passed; mutate. By I7 a free seat implies an empty waitlist, so no one is jumped.
    if (this.enrolled.size < this.capacity) {
      this.enrolled.add(id);`,
    replace: `
    // All checks passed; mutate. By I7 a free seat implies an empty waitlist, so no one is jumped.
    if (this.enrolled.size < this.capacity) {
      this.enrolled.add(id);
      if (missing.length > 0) return { ok: false, code: 'PREREQ_NOT_MET', missing };` },
  // Promotion, ordering and later decisions
  { id: 'f', name: 'drop removes the promoted learner from the waitlist but never seats them', file: OFFERING,
    find: 'if (promoted !== null) this.enrolled.add(promoted);', replace: '' },
  { id: 'g', name: 'no ALREADY_WAITLISTED check (duplicate waitlist entries)', file: OFFERING,
    find: "if (this.waitlist.includes(id)) return { ok: false, code: 'ALREADY_WAITLISTED' };", replace: '' },
  { id: 'h', name: 'F1 regression: seat released before the directory lookups', file: OFFERING,
    find: `    const { promoted, skipped } = this.planPromotion();

    this.enrolled.delete(id);`,
    replace: `    this.enrolled.delete(id);
    const { promoted, skipped } = this.planPromotion();` },
  { id: 'i', name: 'promotion stops at the first ineligible head (block, not skip)', file: OFFERING,
    find: '      skipped.push(head);\n    }\n    return { promoted: null, skipped };',
    replace: '      skipped.push(head);\n      break;\n    }\n    return { promoted: null, skipped };' },
  { id: 'j', name: 'enroll checks prerequisites before membership', file: OFFERING,
    find: `    if (this.enrolled.has(id)) return { ok: false, code: 'ALREADY_ENROLLED' };
    if (this.waitlist.includes(id)) return { ok: false, code: 'ALREADY_WAITLISTED' };

    const missing = missingPrerequisites(this.requiredCourseIds, completed);
    if (missing.length > 0) return { ok: false, code: 'PREREQ_NOT_MET', missing };`,
    replace: `    const missing = missingPrerequisites(this.requiredCourseIds, completed);
    if (missing.length > 0) return { ok: false, code: 'PREREQ_NOT_MET', missing };

    if (this.enrolled.has(id)) return { ok: false, code: 'ALREADY_ENROLLED' };
    if (this.waitlist.includes(id)) return { ok: false, code: 'ALREADY_WAITLISTED' };` },
  { id: 'k', name: 'option A reverted: drop looks up directory before membership', file: OFFERING,
    find: '    const { id } = parsed;\n',
    replace: "    const { id } = parsed;\n    if (this.directory.getCompletedCourses(id) === undefined) return { ok: false, code: 'UNKNOWN_LEARNER' };\n" },
  { id: 'l', name: 'request IDs not normalised (raw string used)', file: OFFERING,
    find: '  const id = normalizeId(raw);', replace: '  const id = raw.trim();' },
  { id: 'm', name: 'snapshot leaks internal waitlist array', file: OFFERING,
    find: 'waitlist: [...this.waitlist],', replace: 'waitlist: this.waitlist,' },
  { id: 'q', name: 'enroll waitlists even when a seat is free', file: OFFERING,
    find: 'if (this.enrolled.size < this.capacity) {', replace: 'if (false) {' },
  // Shared rule modules
  { id: 'n', name: 'prerequisite rule only checks the first required course', file: 'src/eligibility.ts',
    find: 'return [...need].filter((courseId) => !have.has(courseId));',
    replace: 'return [...need].slice(0, 1).filter((courseId) => !have.has(courseId));' },
  { id: 'o', name: 'prerequisite comparison not normalised', file: 'src/eligibility.ts',
    find: 'const have = new Set([...completed].map(normalizeId));', replace: 'const have = new Set([...completed]);' },
  { id: 'p', name: 'normalizeId skips NFKC (full-width IDs not folded)', file: 'src/ids.ts',
    find: "return raw.normalize('NFKC').trim().toUpperCase();", replace: 'return raw.trim().toUpperCase();' },
];

// Restore on Ctrl-C so an interrupted run never leaves a mutated file behind.
let pending = null;
process.on('SIGINT', () => {
  if (pending) writeFileSync(pending.path, pending.original);
  process.exit(130);
});

const results = [];
for (const m of mutations) {
  const path = join(repo, m.file);
  const original = readFileSync(path, 'utf8');
  const count = original.split(m.find).length - 1;
  if (count !== 1) {
    results.push({ id: m.id, name: m.name, status: 'ERROR', detail: `find snippet occurs ${count} times in ${m.file}` });
    continue;
  }
  const json = join(tmpdir(), `course-waitlist-mutant-${m.id}-${process.pid}.json`);
  pending = { path, original };
  try {
    writeFileSync(path, original.replace(m.find, m.replace));
    const run = spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${json}`], {
      cwd: repo, timeout: 60_000, encoding: 'utf8',
    });
    if (run.error?.code === 'ETIMEDOUT') {
      results.push({ id: m.id, name: m.name, status: 'KILLED', detail: 'suite timed out (hang)', caughtBy: [] });
      continue;
    }
    const report = JSON.parse(readFileSync(json, 'utf8'));
    const caughtBy = report.testResults.flatMap((file) =>
      file.assertionResults
        .filter((t) => t.status !== 'passed')
        .map((t) => `${file.name.split('/tests/')[1]} › ${t.title}`));
    results.push({
      id: m.id, name: m.name,
      status: report.numFailedTests > 0 ? 'KILLED' : 'SURVIVED',
      detail: `${report.numFailedTests}/${report.numTotalTests} tests failed`,
      caughtBy,
    });
  } finally {
    writeFileSync(path, original);
    pending = null;
    rmSync(json, { force: true });
  }
}

for (const r of results) {
  console.log(`(${r.id}) ${r.status.padEnd(8)} ${r.name} — ${r.detail}`);
  for (const t of (r.caughtBy ?? []).slice(0, 3)) console.log(`        ${t}`);
  if ((r.caughtBy ?? []).length > 3) console.log(`        … +${r.caughtBy.length - 3} more`);
}
const killed = results.filter((r) => r.status === 'KILLED').length;
console.log(`\n${killed}/${results.length} mutants killed.`);
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
process.exit(killed === results.length ? 0 : 1);
