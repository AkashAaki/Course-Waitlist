# Engineer-run evidence

This file is the engineer's own terminal output from running the project on their own machine (macOS, zsh), at each phase of the
assessment. The engineer copied it from the terminal and supplied it to the AI. It is the **Engineer-run** evidence that
[AI_USAGE.md](../AI_USAGE.md) cites. Times are local (IST, UTC+05:30) on 2026-10-29.

**Edits the AI made to the paste, and nothing else:**
1. **Deduplicated.** The paste held the Phase 0 block twice: once cut off before `exit=0`, once complete. It also held
   the Phase 2–3 block twice. The complete or first copy is kept. The second Phase 2–3 copy differed only in blank lines
   inside the coverage table, which are paste artefacts. The only lines unique to it are the Phase 3 `clear` / `git add` /
   `git commit`, and those are kept.
2. **Redacted.** The shell prompt `<user>@<host> <dir> %` is shown as `$`, and the repository path as `~/…`.
3. **Re-indented.** The 4-space indent added by the note-taking export is removed.
4. **Grouped** by phase under headings, with the commit-hash mapping below.

All other output is unchanged, byte for byte. That includes the mistyped `pm`, blank lines, the code fences that the
export put around git's hint text, and the truncation from `| tail -N`, so some coverage tables are partial.

## At a glance
A summary of the raw output below; the raw blocks are the evidence.

| Phase | Time (IST) | What the engineer ran | Result | Shown in full? |
|---|---|---|---|---|
| 0 | 16:55 | `npm ci`, `npm test`, typecheck | 50 packages, 0 vulnerabilities; 1/1 passed; `exit=0` | Yes |
| 1 | 17:03 | `npm test`, typecheck | 9/9 passed; `exit=0` | Yes. Predates entry 4 |
| 2 | 17:19 | `npm test`, typecheck | **58 failed / 28 passed**: the expected tests-first red; `exit=0` | Summary lines only (`tail -6`) |
| 3 | 17:23 | `npm test`, coverage, typecheck | 86/86 passed; every file row shown at 100%; `exit=0` | Coverage partial (`tail -7`) |
| 4 | 17:46 | `npm test`, coverage, `npm run mutate` twice | 94/94 passed; rows shown at 100%; mutate **refused** on a dirty tree, then **17/17 killed** after the commit | Coverage partial (`tail -6`) |
| 5 | 17:48 | `npm test`, typecheck | 94/94 passed; `exit=0` | Summary lines only |
| Final | 23:15 | `npm ci`, typecheck, `npm test`, coverage, `npm run mutate` | 0 vulnerabilities; `exit=0`; 94/94 passed; **every row 100%, including `All files`**; **17/17 killed**; `exit=0` | Yes, no `tail` |

## Commit hashes: old → current
After Phase 6, the engineer found the commits had been made under the wrong git account. At the engineer's request, the
AI rewrote the history (`git filter-branch`) to fix the author identity. In the same pass it carried back a redaction:
one local filename in AI_USAGE.md row 0 became "a Markdown file outside this repo". Every hash printed below is therefore an **old** hash.
Map them by commit message and time:

| Phase | Old hash (printed below) | Current hash | Commit time (IST) | Last engineer run before the commit |
|---|---|---|---|---|
| 0 | `b06164d` | `3f2c373` | 16:59:44 | 16:55:50 |
| 1 work, committed as "Phase 2" | `e1a6248` | `b50b5d3` | 17:10:14 | 17:03:28 |
| 2 | `d9d3773` | `22c2fae` | 17:20:03 | 17:19:33 |
| 3 | `d0e680d` | `9fee9bb` | 17:29:12 | 17:23:18 |
| 4 | `4dec293` | `adf98c6` | 17:46:28 | 17:46:01 (the mutate run came after the commit) |
| 5 | `1a77787` | `3f660a6` | 17:48:52 | 17:48:36 |

**Code identity across the rewrite (AI-run, 2026-10-29).** The old commits are still in the engineer's local reflog. For
each of the 6 pairs, `git diff --quiet <old> <new> -- src tests scripts package.json package-lock.json tsconfig.json`
reported no difference, so the runs below apply unchanged to the current hashes. In every pair, the only difference is
one line of `AI_USAGE.md` row 0, the redacted filename. That redaction was first made in the Phase 6 commit, and the
rewrite carried it back to the earlier commits.
Reviewers cannot repeat this check, because reflog entries are local and expire. The engineer can, with the loop in
[§ Re-check](#re-check-the-code-identity-yourself).

**Engineer confirmation of the code-identity check:** _pending engineer_

## Phase 0
Environment and scaffold · 16:55 · `b06164d` → `3f2c373` · AI_USAGE entry 2
~~~~text
$ cd ~/…
node -v && npm -v
npm ci
npm test
npm run typecheck; echo "exit=$?"
v26.13.0
11.20.0

added 50 packages, and audited 51 packages in 724ms

13 packages are looking for funding
run `npm fund` for details

found 0 vulnerabilities
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   fsevents@2.3.3 (install: (install scripts present))
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.

> course-waitlist@0.1.0 test
vitest run
> 

RUN  v5.0.5 ~/…

✓ tests/smoke.test.ts (1 test) 1ms
✓ toolchain (1)
✓ runs a TypeScript test 1ms

Test Files  1 passed (1)
Tests  1 passed (1)
Start at  16:55:50
Duration  122ms (transform 57%, import 26%, worker 9%, tests 8%)

> course-waitlist@0.1.0 typecheck
tsc --noEmit
> 

exit=0
$ git add .
$ git commit -m "Phase 0 — Environment & scaffold"

[main (root-commit) b06164d] Phase 0 — Environment & scaffold
7 files changed, 1743 insertions(+)
create mode 100644 .gitignore
create mode 100644 .nvmrc
create mode 100644 AI_USAGE.md
create mode 100644 package-lock.json
create mode 100644 package.json
create mode 100644 tests/smoke.test.ts
create mode 100644 tsconfig.json
$ clear
~~~~

## Phase 1
Design spec, types, eligibility rule · 17:03 · `e1a6248` → `b50b5d3` (committed as "Phase 2") · AI_USAGE entry 3

This commit holds the **Phase 1** work: DESIGN.md, types, the eligibility rule and the directory. The 9-test run below
**predates entry 4** (ID normalisation): it still contains `matches course IDs exactly (no case or whitespace normalisation)`.
The entry-4 files (`src/ids.ts`, `tests/ids.test.ts`) were written after this run and went into the same commit at 17:10.
The engineer did not run that state on its own. It is covered by the Phase 2 run (28 passing within 86).
~~~~text
$ npm test

> course-waitlist@0.1.0 test
vitest run
> 

RUN  v5.0.5 ~/…

✓ tests/eligibility.test.ts (9 tests) 2ms
✓ prerequisite rule (5)
✓ treats every learner as eligible when no courses are required 1ms
✓ is eligible when every required course is completed (extra courses are ignored) 0ms
✓ is ineligible when only some required courses are completed, and reports the rest 0ms
✓ is ineligible when no required course is completed, listing all in required order 0ms
✓ matches course IDs exactly (no case or whitespace normalisation) 0ms
✓ InMemoryLearnerDirectory (4)
✓ returns undefined for an unknown learner 0ms
✓ distinguishes a known learner with no completed courses from an unknown one 0ms
✓ replaces a record on update, modelling a revoked prerequisite 0ms
✓ copies input arrays, so later caller mutation does not leak in 0ms

Test Files  1 passed (1)
Tests  9 passed (9)
Start at  17:03:28
Duration  128ms (transform 69%, import 19%, tests 6%, worker 6%)

$ npm run typecheck; echo "exit=$?"

> course-waitlist@0.1.0 typecheck
tsc --noEmit
> 

exit=0
$ git add .
$ git commit -m 'Phase 2'
[main e1a6248] Phase 2
10 files changed, 366 insertions(+), 9 deletions(-)
create mode 100644 DESIGN.md
create mode 100644 src/eligibility.ts
create mode 100644 src/ids.ts
create mode 100644 src/index.ts
create mode 100644 src/learnerDirectory.ts
create mode 100644 src/types.ts
create mode 100644 tests/eligibility.test.ts
create mode 100644 tests/ids.test.ts
delete mode 100644 tests/smoke.test.ts
~~~~

## Phase 2
Tests first, with a stub · 17:19 · `d9d3773` → `22c2fae` · AI_USAGE entries 4 and 5

58 failing and 28 passing matches the AI's recorded red count in entry 5 exactly. The 28 passing are the Phase 1 tests (entry 4).
The engineer's paste does not show the failure messages (`tail -6`). The AI recorded them as 53 × `Not implemented`
plus 5 × `expected function to throw`, from its own JSON-reporter run.
~~~~text
$ npm test 2>&1 | tail -6

Test Files  4 failed | 2 passed (6)
Tests  58 failed | 28 passed (86)
Start at  17:19:33
Duration  207ms (transform 66%, import 19%, tests 11%, worker 4%)

$ npm run typecheck; echo "exit=$?"

> course-waitlist@0.1.0 typecheck
tsc --noEmit
> 

exit=0
$ git add .
$ git commit -m "Phase 2"
[main d9d3773] Phase 2
8 files changed, 702 insertions(+)
create mode 100644 src/courseOffering.ts
create mode 100644 tests/drop.test.ts
create mode 100644 tests/enroll.test.ts
create mode 100644 tests/helpers.ts
create mode 100644 tests/invariants.test.ts
create mode 100644 tests/promotion.test.ts
$ git push
fatal: No configured push destination.
Either specify the URL from the command-line or configure a remote repository using

```
git remote add <name> <url>
```

and then push using the remote name

```
git push <name>
```
~~~~

## Phase 3
Implementation · 17:23 · `d0e680d` → `9fee9bb` · AI_USAGE entry 6

86 passed is entry 6's state. Commit `9fee9bb` also contains **entry 7** (the option-A fix, 90 tests), which was made
after this run. **No engineer run of the 90-test state is recorded.** The coverage table is cut off by `tail -7`: the
`All files` and `src` summary rows are not shown.
~~~~text
$ npm test 2>&1 | tail -5
Test Files  6 passed (6)
Tests  86 passed (86)
Start at  17:23:18
Duration  195ms (transform 52%, tests 26%, import 17%, worker 6%)

$ pm run coverage 2>&1 | tail -7
zsh: command not found: pm
$ npm run coverage 2>&1 | tail -7
...seOffering.ts |     100 |      100 |     100 |     100 |

eligibility.ts   |     100 |      100 |     100 |     100 |

ids.ts           |     100 |      100 |     100 |     100 |

...rDirectory.ts |     100 |      100 |     100 |     100 |

tests             |     100 |      100 |     100 |     100 |

helpers.ts       |     100 |      100 |     100 |     100 |

-------------------|---------|----------|---------|---------|-------------------
$ npm run typecheck; echo "exit=$?"

> course-waitlist@0.1.0 typecheck
tsc --noEmit
> 

exit=0
$ clear
$ git add .
$ git commit -m 'Phase 3'
[main d0e680d] Phase 3
6 files changed, 179 insertions(+), 14 deletions(-)
$
~~~~

## Phase 4
Independent verification and the F1 fix · 17:46 · `4dec293` → `adf98c6` · AI_USAGE entries 8 and 9

- **The mutation tool's dirty-tree guard was observed by the engineer.** The first `npm run mutate` refused to run on
  staged but uncommitted `src/`.
- **After the commit, `npm run mutate` reported 17/17 killed without `--allow-dirty`.** That is the run entry 9 asked the
  engineer to do. The line above the result is the last "caught by" entry, printed in the Phase 4 script's format.
- **Scope of this run:** it was against `adf98c6`. Phase 6 (`48fe5bb`) later changed `scripts/mutate.mjs`: a Windows
  `shell` option and the display of the "caught by" path. The 17 mutations themselves did not change. A run against the
  final commit is still to come.
- **Coverage is partial.** `tail -6` cut off the `courseOffering.ts`, `All files` and `src` rows.
~~~~text
$ git add .
$ npm test 2>&1 | tail -5
Test Files  6 passed (6)
Tests  94 passed (94)
Start at  17:46:01
Duration  191ms (transform 46%, tests 26%, import 23%, worker 5%)

$ pm run coverage 2>&1 | tail -6
zsh: command not found: pm
$ npm run coverage 2>&1 | tail -6
eligibility.ts   |     100 |      100 |     100 |     100 |

ids.ts           |     100 |      100 |     100 |     100 |

...rDirectory.ts |     100 |      100 |     100 |     100 |

tests             |     100 |      100 |     100 |     100 |

helpers.ts       |     100 |      100 |     100 |     100 |

-------------------|---------|----------|---------|---------|-------------------
$ npm run mutate 2>&1 | tail -3

Refusing to run: src/ has uncommitted changes (or this is not a git checkout).
Commit or stash first, or pass --allow-dirty (each file is still restored from memory after its mutant).
$ git commit -m "Phase 4"
[main 4dec293] Phase 4
8 files changed, 349 insertions(+), 32 deletions(-)
create mode 100644 VERIFICATION.md
create mode 100644 scripts/mutate.mjs
$ npm run mutate 2>&1 | tail -3
ids.test.ts › canonicalises "Ｌ１" to "L1"

17/17 mutants killed.
$
~~~~

## Phase 5
Deliverables · 17:48 · `1a77787` → `3f660a6` · AI_USAGE entry 10
~~~~text
$ npm test 2>&1 | tail -5
Test Files  6 passed (6)
Tests  94 passed (94)
Start at  17:48:36
Duration  170ms (tests 50%, import 30%, transform 12%, worker 8%)

$ npm run typecheck; echo "exit=$?"

> course-waitlist@0.1.0 typecheck
tsc --noEmit
> 

exit=0
$ git add . && git commit -m "Phase 5"
[main 1a77787] Phase 5
3 files changed, 148 insertions(+), 1 deletion(-)
create mode 100644 LIMITATIONS.md
create mode 100644 README.md
$
~~~~

## Final run
Full check, no `tail` · 23:15 · HEAD `03dd09e` · AI_USAGE entry 11

The working tree differed from `03dd09e` only in staged documentation (`git status --short` below; no file under `src/`,
`tests/`, `scripts/` or the package files). The code that ran is therefore the final code.
~~~~text
$ git status --short; node -v; npm ci && npm run typecheck; echo "exit=$?"; npm test && npm run coverage && npm run mutate; echo "exit=$?"
M  AI_USAGE.md
M  VERIFICATION.md
A  evidence/engineer-runs.md
A  prompts/key-prompts.md
A  prompts/system-prompt.md
v26.13.0

added 50 packages, and audited 51 packages in 678ms

13 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
npm warn install-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn install-scripts   fsevents@2.3.3 (install: (install scripts present))
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.

> course-waitlist@0.1.0 typecheck
> tsc --noEmit

exit=0

> course-waitlist@0.1.0 test
> vitest run


 RUN  v5.0.5 ~/…

 ✓ tests/ids.test.ts (14 tests) 2ms
 ✓ tests/eligibility.test.ts (15 tests) 3ms
 ✓ tests/enroll.test.ts (27 tests) 6ms
 ✓ tests/drop.test.ts (20 tests) 6ms
 ✓ tests/promotion.test.ts (13 tests) 6ms
 ✓ tests/invariants.test.ts (5 tests) 41ms

 Test Files  6 passed (6)
      Tests  94 passed (94)
   Start at  23:15:46
   Duration  206ms (transform 50%, tests 24%, import 21%, worker 5%)


> course-waitlist@0.1.0 coverage
> vitest run --coverage


 RUN  v5.0.5 ~/…
      Coverage enabled with v8

 ✓ tests/ids.test.ts (14 tests) 2ms
 ✓ tests/eligibility.test.ts (15 tests) 3ms
 ✓ tests/promotion.test.ts (13 tests) 6ms
 ✓ tests/enroll.test.ts (27 tests) 8ms
 ✓ tests/drop.test.ts (20 tests) 10ms
 ✓ tests/invariants.test.ts (5 tests) 45ms

 Test Files  6 passed (6)
      Tests  94 passed (94)
   Start at  23:15:46
   Duration  223ms (transform 40%, tests 24%, import 19%, worker 17%)

 % Coverage report from v8
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
----------------------|---------|----------|---------|---------|-------------------
All files             |     100 |      100 |     100 |     100 |
 src                  |     100 |      100 |     100 |     100 |
  courseOffering.ts   |     100 |      100 |     100 |     100 |
  eligibility.ts      |     100 |      100 |     100 |     100 |
  ids.ts              |     100 |      100 |     100 |     100 |
  learnerDirectory.ts |     100 |      100 |     100 |     100 |
 tests                |     100 |      100 |     100 |     100 |
  helpers.ts          |     100 |      100 |     100 |     100 |
----------------------|---------|----------|---------|---------|-------------------

> course-waitlist@0.1.0 mutate
> node scripts/mutate.mjs

(a) KILLED   capacity check off-by-one in enroll (< → <=) — 30/94 tests failed
        tests/drop.test.ts › removes a waitlisted learner without promoting anyone, keeping the others in order
        tests/drop.test.ts › returns NOT_ENROLLED for a known learner who never enrolled, without changing state
        tests/drop.test.ts › returns NOT_ENROLLED on a repeated drop, with no second promotion
        … +27 more
(b) KILLED   promotion scans from the back of the queue — 14/94 tests failed
        tests/drop.test.ts › returns NOT_ENROLLED on a repeated drop, with no second promotion
        tests/drop.test.ts › drop: an error while checking the waitlist head aborts the whole drop
        tests/drop.test.ts › lets a dropped learner re-enroll: a free seat if available, otherwise the back of the waitlist
        … +11 more
(c) KILLED   promotion ignores eligibility — 10/94 tests failed
        tests/drop.test.ts › drop: an error after earlier heads were found ineligible still changes nothing
        tests/invariants.test.ts › holds every invariant and post-condition across seeded random operation sequences
        tests/invariants.test.ts › is skipped as ineligible (DESIGN.md §6)
        … +7 more
(d) KILLED   promoted learner not removed from waitlist — 16/94 tests failed
        tests/drop.test.ts › returns NOT_ENROLLED on a repeated drop, with no second promotion
        tests/drop.test.ts › still lets an enrolled learner drop, freeing the seat and promoting the next learner
        tests/drop.test.ts › treats a promoted learner as enrolled: duplicate enroll is a no-op and they can drop
        … +13 more
(e) KILLED   enroll mutates before the prerequisite check — 6/94 tests failed
        tests/enroll.test.ts › rejects an ineligible learner even when a seat is free, without changing state
        tests/enroll.test.ts › rejects a learner who has only some prerequisites, listing the missing ones
        tests/enroll.test.ts › does not waitlist an ineligible learner
        … +3 more
(f) KILLED   drop removes the promoted learner from the waitlist but never seats them — 13/94 tests failed
        tests/drop.test.ts › returns NOT_ENROLLED on a repeated drop, with no second promotion
        tests/drop.test.ts › still lets an enrolled learner drop, freeing the seat and promoting the next learner
        tests/drop.test.ts › treats a promoted learner as enrolled: duplicate enroll is a no-op and they can drop
        … +10 more
(g) KILLED   no ALREADY_WAITLISTED check (duplicate waitlist entries) — 3/94 tests failed
        tests/enroll.test.ts › returns ALREADY_WAITLISTED for a waitlisted learner, keeping order and length
        tests/enroll.test.ts › never creates a second record however many times a learner retries
        tests/invariants.test.ts › holds every invariant and post-condition across seeded random operation sequences
(h) KILLED   F1 regression: seat released before the directory lookups — 2/94 tests failed
        tests/drop.test.ts › drop: an error while checking the waitlist head aborts the whole drop
        tests/drop.test.ts › drop: an error after earlier heads were found ineligible still changes nothing
(i) KILLED   promotion stops at the first ineligible head (block, not skip) — 8/94 tests failed
        tests/drop.test.ts › drop: an error after earlier heads were found ineligible still changes nothing
        tests/invariants.test.ts › holds every invariant and post-condition across seeded random operation sequences
        tests/invariants.test.ts › is skipped as ineligible (DESIGN.md §6)
        … +5 more
(j) KILLED   enroll checks prerequisites before membership — 2/94 tests failed
        tests/enroll.test.ts › keeps an enrolled learner whose prerequisite is later revoked (ALREADY_ENROLLED, no eviction)
        tests/invariants.test.ts › holds every invariant and post-condition across seeded random operation sequences
(k) KILLED   option A reverted: drop looks up directory before membership — 2/94 tests failed
        tests/drop.test.ts › still lets an enrolled learner drop, freeing the seat and promoting the next learner
        tests/drop.test.ts › still lets a waitlisted learner leave the waitlist
(l) KILLED   request IDs not normalised (raw string used) — 4/94 tests failed
        tests/drop.test.ts › accepts a differently formatted ID for the same learner
        tests/enroll.test.ts › stores the canonical ID for a non-canonical request
        tests/enroll.test.ts › treats a differently formatted ID as the same learner
        … +1 more
(m) KILLED   snapshot leaks internal waitlist array — 2/94 tests failed
        tests/invariants.test.ts › holds every invariant and post-condition across seeded random operation sequences
        tests/invariants.test.ts › returns copies: mutating a snapshot does not change the offering
(q) KILLED   enroll waitlists even when a seat is free — 54/94 tests failed
        tests/drop.test.ts › frees the seat when nobody is waiting
        tests/drop.test.ts › accepts a differently formatted ID for the same learner
        tests/drop.test.ts › removes a waitlisted learner without promoting anyone, keeping the others in order
        … +51 more
(n) KILLED   prerequisite rule only checks the first required course — 3/94 tests failed
        tests/eligibility.test.ts › is ineligible when only some required courses are completed, and reports the rest
        tests/eligibility.test.ts › is ineligible when no required course is completed, listing all in required order
        tests/enroll.test.ts › rejects a learner who has only some prerequisites, listing the missing ones
(o) KILLED   prerequisite comparison not normalised — 1/94 tests failed
        tests/eligibility.test.ts › matches course IDs in canonical form (case, surrounding whitespace, full-width)
(p) KILLED   normalizeId skips NFKC (full-width IDs not folded) — 3/94 tests failed
        tests/eligibility.test.ts › matches course IDs in canonical form (case, surrounding whitespace, full-width)
        tests/eligibility.test.ts › looks learners up by canonical ID and stores canonical course IDs
        tests/ids.test.ts › canonicalises "Ｌ１" to "L1"

17/17 mutants killed.
exit=0
$
~~~~

## Not yet run by the engineer
| What | Why it matters | Command |
|---|---|---|
| Entry 7 at its own commit (optional) | The 90-test state was never run by the engineer on its own | `git worktree add ../cw-p3 9fee9bb && cd ../cw-p3 && npm ci && npm test 2>&1 \| tail -5; cd - && git worktree remove --force ../cw-p3` |

### Re-check the code identity yourself
Works only on the engineer's machine, while the old commits are still in the reflog:
```sh
for p in "b06164d 3f2c373" "e1a6248 b50b5d3" "d9d3773 22c2fae" "d0e680d 9fee9bb" "4dec293 adf98c6" "1a77787 3f660a6"; do
  set -- $p; git diff --quiet $1 $2 -- src tests scripts package.json package-lock.json tsconfig.json \
    && echo "$1->$2 code identical" || echo "$1->$2 DIFFERS"; done
```
