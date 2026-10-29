# Design: Course Waitlist Service

> **Status:** Signed off by the engineer (Phase 1). Implemented in `src/courseOffering.ts` (Phase 3).

## 1. Context and goals
No starter project was supplied, so this follows the spec's fallback: a small in-memory service for **one course
offering**. There is no frontend, database or CLI. Behaviour is demonstrated through automated tests.

**Goals:** correct capacity and queue behaviour; one clearly stated eligibility policy, applied the same way everywhere; every
request outcome returned as an explicit result code; and no state corruption from invalid or duplicate requests.

**Non-goals:** course catalog, multiple offerings or terms, payments, identity/auth, persistence, deployment,
configurable policies, notifications.

## 2. Service boundary
```
caller ──enroll(id)/drop(id)──▶ CourseOffering ──getCompletedCourses(id)──▶ LearnerDirectory (port)
                                  │ capacity, requiredCourseIds (fixed at construction)
                                  │ enrolled: Set, waitlist: array (owned, in memory)
```
- `CourseOffering` owns all enrollment and waitlist state for one offering. No other code mutates it.
- `LearnerDirectory` is an injected, read-only port that answers "is this learner known, and what have they
  completed?". `InMemoryLearnerDirectory` is the only implementation; in a real system this would be the records service.
  The offering **does not cache** directory answers, so eligibility always reflects current records.
- There is no I/O inside the offering. Every method is synchronous (see §7).

## 3. Data model
| Field | Type | Notes |
|---|---|---|
| `capacity` | `number` | Positive integer, fixed at construction. Anything else throws `RangeError`. |
| `requiredCourseIds` | `ReadonlySet<CourseId>` | The prerequisite set. Empty means no prerequisites. |
| `enrolled` | `Set<LearnerId>` | O(1) membership. Insertion order is enrollment order. |
| `waitlist` | `LearnerId[]` | Join order; index 0 is next in line. |

**ID normalisation:** every learner and course ID is put into canonical form at the boundary, by
`normalizeId` in `src/ids.ts`:
1. Unicode NFKC
2. trim leading and trailing whitespace
3. upper-case

So `' l1 '`, `'L1'` and full-width `'Ｌ１'` are the same learner. State and results always hold the canonical form; a request
for `' l1 '` that is promoted shows up as `L1`. Separators, internal whitespace and leading zeros are **not** folded: `L-1`,
`L 1` and `L01` are different from `L1`. Folding them could merge two IDs that really are different. Directory seed data
whose IDs collapse to the same canonical form (`l1` and `L1`) is rejected at construction rather than merged.

## 4. API
```ts
new CourseOffering({ capacity, requiredCourseIds, directory })
enroll(learnerId: LearnerId): EnrollResult
drop(learnerId: LearnerId): DropResult
snapshot(): OfferingSnapshot          // defensive copy, used for inspection and tests
```
Request-level outcomes are **returned, never thrown**. Only programmer errors at construction throw.
`ok` is `true` only when the request changed state as asked (full types in `src/types.ts`).

| Method | Code | `ok` | State change |
|---|---|---|---|
| enroll | `ENROLLED` | ✔ | added to `enrolled` |
| enroll | `WAITLISTED {position}` | ✔ | appended to `waitlist` (`position` is 1-based) |
| enroll | `ALREADY_ENROLLED` / `ALREADY_WAITLISTED` | ✘ | none (idempotent) |
| enroll | `PREREQ_NOT_MET {missing}` | ✘ | none |
| drop | `DROPPED {promoted, skipped}` | ✔ | seat freed and promotion run, as one step |
| drop | `LEFT_WAITLIST` | ✔ | removed from `waitlist`; no promotion |
| drop | `NOT_ENROLLED` | ✘ | none. Covers both never-enrolled and a repeated drop. |
| both | `UNKNOWN_LEARNER` | ✘ | none |
| both | `INVALID_REQUEST {reason}` | ✘ | none. The ID is not a string, or is blank after normalisation. |

**Validation order.** Both methods first apply the same format check (`INVALID_REQUEST`). After that:
- **enroll:** `UNKNOWN_LEARNER` → membership (`ALREADY_ENROLLED` / `ALREADY_WAITLISTED`) → prerequisites
  (`PREREQ_NOT_MET`). Membership is checked before prerequisites, so an enrolled learner whose prerequisite is later
  revoked gets `ALREADY_ENROLLED` and is not evicted.
- **drop:** membership first (waitlisted → `LEFT_WAITLIST`, enrolled → `DROPPED`); only for a learner in neither list,
  `UNKNOWN_LEARNER` or `NOT_ENROLLED`. A learner already in the offering can therefore always leave it, even if their
  directory record has been deleted. Otherwise their seat would be stuck forever. (Engineer decision "option A", Phase 3.)

## 5. Invariants
| ID | Invariant | Enforced by |
|---|---|---|
| I1 | `enrolled.size ≤ capacity` | `enroll` adds only when `size < capacity`. A drop removes one learner and promotes at most one. |
| I2 | A learner appears at most once across `enrolled ∪ waitlist` | Membership checks run before any insert. Promotion moves the learner: it removes them from the waitlist and adds them to `enrolled`, never copying. |
| I3 | Waitlist is strictly FIFO by join order; promotion takes the earliest *eligible* entry | Append-only joins; promotion scans from index 0 only |
| I4 | A rejected or no-op request changes no state | All checks, **including every directory lookup**, finish before the first mutation (read, then write). A throwing directory also leaves state unchanged. |
| I5 | Drop and promotion happen in one atomic step | A single synchronous method with no `await` (§7). The promotion plan is computed before the seat is released (F1). |
| I6 | The eligibility rule is identical at join and promotion | Both call the one function `missingPrerequisites` / `isEligible` in `src/eligibility.ts` |
| I7 | `waitlist.length > 0 ⇒ enrolled.size === capacity` | Joins only when full; promotion fills the seat or empties the waitlist trying |

Planned tests (Phase 2) will assert I1, I2 and I7 after every operation, I4 by comparing snapshots before and after, and I3/I6 through targeted scenarios.

## 6. Eligibility and waitlist policy
- **Prerequisite rule:** a learner is eligible if and only if they have completed **every** course in `requiredCourseIds`.
- **At join time:** an ineligible learner is rejected with `PREREQ_NOT_MET`, whether or not seats are free. They
  never enter the waitlist, because the spec says only *eligible* learners join it.
- **At promotion time (queue front): skip and remove.** Eligibility can change after joining (e.g. a grade
  correction revokes a prerequisite), so it is re-checked. An ineligible head is removed from the waitlist and reported in
  `DROPPED.skipped`, and the scan continues with the next entry. This is the same outcome as at join time: an ineligible learner
  never holds a queue position. They may enroll again later as a fresh request.
- **Re-enrollment:** a learner who dropped, left the waitlist or was skipped may enroll again. It is a fresh request:
  a seat if one is free, otherwise the **back** of the waitlist. "Enroll only once" means at most one active record.

### Promotion algorithm
```
drop(L):
  check L's format                             # INVALID_REQUEST, no change
  if L in waitlist: remove L; return LEFT_WAITLIST
  if L not in enrolled: return UNKNOWN_LEARNER or NOT_ENROLLED   # no change
  # read phase: directory lookups only, no mutation
  promoted = null; skipped = []
  for head in waitlist, front to back:         # earliest joiner first
    if isEligible(required, directory(head)): promoted = head; break
    else: skipped.push(head)                   # skip and remove
  # write phase: no calls out, cannot fail part-way
  enrolled.delete(L)
  waitlist.removeFront(skipped.length + (promoted ? 1 : 0))
  if promoted: enrolled.add(promoted)
  return DROPPED { promoted, skipped }
```
A drop frees exactly one seat. By I7, a non-empty waitlist means the course was full, so promoting at most one learner
refills the course and preserves I1 and I7. A waitlisted learner missing from the directory is treated as ineligible and
skipped, since only known learners can join.

**Read, then write (Finding F1):** the directory is an external dependency and may throw, for example if a real records
service times out. All lookups therefore happen before the first mutation. If one throws, the exception propagates and the
offering is exactly as it was. An earlier version released the seat and removed each head from the queue *before* looking
it up, so a failure left the dropper gone and the head lost. Phase 4 review found this; see `VERIFICATION.md`.

## 7. Concurrency and persistence
- **Approach: synchronous methods on a single thread.** `enroll` and `drop` contain no `await` and do no I/O. In Node, each
  call runs to completion before any other JavaScript runs, so validate → plan promotion → mutate cannot interleave with
  another request. This is what makes I4 and I5 hold.
- **Test:** one `Promise.all` test sends two enrolls for the last seat and expects exactly one `ENROLLED`. Because the
  methods are synchronous this is a **regression guard** (it would catch someone adding an `await` mid-operation),
  **not** proof of thread safety. `LIMITATIONS.md` will label it that way.
- **Out of scope, but the next step:** with a real store, the same boundary would need a per-offering transaction
  or lock, such as a row lock on the offering or an optimistic version check, covering seat release and promotion together.
- **Persistence:** none. State lives in process memory and is lost on restart.

## 8. Tradeoffs
| Choice | Why | Cost |
|---|---|---|
| Skip and remove (vs skip and retain, or block) | Keeps I7. No stale entries rescanned on every drop. Matches the join-time rule. | A learner who regains eligibility must re-join at the back |
| Return codes (vs exceptions) | Every outcome is explicit and typed, and "no change" is easy to assert | Callers must check `code` |
| Duplicates are no-ops with distinct codes | Idempotent retries are safe, and the caller still learns why | `ok: false` covers both "harmless" and "rejected" |
| Injected directory, not cached | Eligibility is current at promotion, which is what makes the queue-front case real | One directory lookup per learner examined |
| Normalise IDs (NFKC + trim + upper-case), but not separators or zeros | Casing and spacing differences in caller input can't create a second record for the same learner (protects I2) | IDs that differ only by case can't coexist. Separator variants (`L-1`) still count as distinct IDs. |
| `waitlist` as an array (front removal via `splice`) | Simplest correct FIFO structure | O(n) per front removal or `includes`. Fine for one offering's waitlist. |
| No drop history | Smaller state, no extra policy | A repeated drop and a never-enrolled drop return the same `NOT_ENROLLED` |
| Revoked prerequisite doesn't evict an enrolled learner | Eviction is a separate policy the spec doesn't ask for | Enrolled learners may become ineligible (see LIMITATIONS) |
