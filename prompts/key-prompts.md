# Key prompts: how the AI was directed

This file is the evidence trail for the operating principle stated in [AI_USAGE.md](../AI_USAGE.md): it shows where the
engineer set the boundary, where the AI's reasoning was challenged or overruled, and what finally shipped. Each AI suggestion is traced to the file or test it became.

**Two AI roles, one decision-maker.**
```
          interpretation, design review,               plan (read-only), then one phase
          second opinions, the agent's prompt          at a time: tests first, implementation
  ┌────────────────────────┐   ┌──────────────┐   ┌───────────────────────────┐
  │ Advisory chat (Claude) │◀─▶│   Engineer   │◀─▶│ Coding agent (Claude Code)│
  └────────────────────────┘   │ decides,     │   └───────────────────────────┘
                               │ opens gates  │
                               └──────────────┘
```
The two AIs never talked to each other directly. The engineer carried each question and recommendation between them and
made every call. The coding agent worked under the [system prompt](system-prompt.md) (verbatim).

**How to read the labels.** Every prompt is labelled by how reliable its text is:
- **Verbatim:** the engineer supplied the exact text.
- **Quoted during the session:** the AI copied the words into AI_USAGE.md as they were typed, not from memory afterwards. _Engineer to confirm._
- **AI log (summary):** an end-of-response log block the advisory chat wrote during the session, which the engineer supplied
  afterwards. Its "prompt" line is the AI's summary of what the engineer asked, not the engineer's words.
- **Summary:** no source text; this is a description only.

The "What shipped" column is an **AI-run check** of the current repo (DESIGN.md, `src/`, `tests/`), made on 2026-10-29.
Every Status in the source logs is still **PENDING**; the engineer marks them in [AI_USAGE.md](../AI_USAGE.md#log).

## Highlights: where the engineer challenged, narrowed or overruled the AI
| ID | AI position | Engineer action | What shipped |
|---|---|---|---|
| 0a → 0c, 0f, 0k | Eligibility must be able to change, or the queue-front case is untestable | **Challenged it repeatedly** (0c, 0f, 0k): the service never records course completions, so an ineligible learner stays ineligible. The AI conceded its rationale didn't fit | The service never writes completions. Records come through an injected, uncached port and can change outside the service (revocation, grade correction), so the re-check at promotion is a real, tested path ([DESIGN §2](../DESIGN.md#2-service-boundary), [§6](../DESIGN.md#6-eligibility-and-waitlist-policy)) |
| 0b | Recommended Python + pytest for a demonstrable thread-based concurrency test | **Chose TypeScript** instead | TS + Vitest. The AI's caveat that a Node concurrency test proves little was kept, and drove the honest "regression guard" label (0p) |
| 0m, 0n | Advised skipping the CLI, then pushed back on file persistence: two processes writing one file threaten the capacity and FIFO invariants | Asked about both. The AI's pushback and time estimates are on record; who cut them is not | **No CLI and no persistence shipped** ([DESIGN §1](../DESIGN.md#1-context-and-goals)). The shared `snapshot()` read method was kept and is tested for isolation (S2) |
| 0g–0i | Drafted the coding agent's planning prompt | **Corrected it twice** (empty repo, no starter, timebox) before using it | The coding agent's entry 1 ran in plan mode with a hard stop before code |
| 0o–0r | The coding agent asked 4 policy questions (A3, A7, A4, A1/A5) | **Got a second opinion from the advisory chat, then decided** | Skip-and-remove plus invariant I7; synchronous calls plus labelled race tests; re-enroll to the back; injected directory plus result codes (AI_USAGE entry 1) |
| 4 | Exact-match IDs (entry 3, choice 3) | **Rejected** | NFKC + trim + upper-case normalisation, with distinct-ID cases pinned in tests |
| 7 | Presented options for a seat held forever by a deleted learner record | **Chose option A** | `drop` checks membership before the directory lookup ([DESIGN §4](../DESIGN.md#4-api)) |
| 9 | Presented options for Finding F1 (partial state on directory failure) | **Chose read-then-write** | Every lookup happens before the first mutation; mutant (h) pins it |

## 1. Before the build: interpretation and design review (advisory chat)
### Entry 0a: what "eligible learner" means
**Prompt: verbatim.**
> With this task, what do you understand by eligible learner?

**AI response: excerpt, verbatim.** "[…]" marks text the engineer left out when supplying it.
> […] **Eligibility has to be able to change, or AC4 means nothing.** The spec says “eligible learners join the waitlist”,
> which implies we check eligibility at join time. If eligibility is also fixed after that, an ineligible learner can never
> reach the front of the queue. The skip-or-retain policy would then be dead code that can’t be tested. So the model needs
> eligibility that can change after joining. Realistic causes include a prerequisite grade being corrected, an in-progress
> prerequisite failing, or a record being revoked. This is also what makes the choice between SKIP-and-remove and
> SKIP-and-retain meaningful. […]

**Engineer follow-up: summary.** Accepted the reasoning and asked for an explicit eligibility criterion. The engineer later
challenged the "can change" premise (0f, 0k below), which narrowed it to changes *outside* the service.

### Design review log (AI log, summary)
IDs 0b–0r follow the order of the supplied log file, which records no dates, so the order may not be chronological. The
file's planning log is entry 0's own log and is folded into [Entry 0](#3-build-entries-without-source-text).

| ID | Activity | Engineer prompt (AI summary) | AI suggestion (summary) | What shipped (AI-run check) |
|---|---|---|---|---|
| 0b | Technology selection | No starter; asked for a recommended stack with pros and cons | Python + pytest with `threading.Lock`; TS + Vitest as runner-up, warning that a Node concurrency test is largely meaningless; Java has the most setup | **Overruled:** TS + Vitest (`package.json`). The caveat survives as the "regression guard" wording in [DESIGN §7](../DESIGN.md#7-concurrency-and-persistence) |
| 0c | Design review: eligibility model | Options for checking eligibility, given that learners don't complete courses during the project | Options E1–E4. Recommended E2, a static snapshot behind one checker used at join and at promotion. **Self-correction:** its own earlier "eligibility can change" rationale was invalid under this constraint | One rule used at both points (I6, `src/eligibility.ts`). The "static" framing was later replaced by an uncached records port ([DESIGN §2](../DESIGN.md#2-service-boundary)) |
| 0d | Scope clarification | Is promotion in scope? | Yes, AC3 requires it. Separated it from the actual open decision, whether to re-check eligibility at promotion | Promotion with a re-check at the queue front (`tests/promotion.test.ts`) |
| 0e | Assumption definition | Define ineligibility | Not having completed *every* required course; empty list means everyone is eligible; rejected at join with `PREREQ_NOT_MET`; check order validate → unknown → duplicate → prerequisite; asked "all or any?" | **All**, as proposed. `enroll` order is `INVALID_REQUEST` → `UNKNOWN_LEARNER` → membership → prerequisites ([DESIGN §4](../DESIGN.md#4-api)). Empty-list test in `tests/eligibility.test.ts` |
| 0f | Design clarification | **Engineer stated** that, because completions are never recorded, ineligible learners stay ineligible permanently | Agreed. The promotion-time case can't arise from in-service changes. Recommended E2 for consistency and a limitations note | Rule shared at join and promotion. The final design re-checks because *records* can change outside the service ([DESIGN §6](../DESIGN.md#6-eligibility-and-waitlist-policy)) |
| 0j | Design review | Does "a learner may enroll only once" conflict with prerequisites? Confirmed TypeScript, A3 and A4 | No conflict. **Self-correction:** it had not flagged that this phrase is the main argument against re-enrolling. Recommended the "at most one active record" reading, plus a re-enroll test that asserts position | That exact reading is in [DESIGN §6](../DESIGN.md#6-eligibility-and-waitlist-policy). Test D16 asserts the full waitlist order `['L3', 'L1']` |
| 0k | Correcting an assumption | **Engineer pointed out** that prerequisites are static, so ineligible learners are ineligible forever, and asked what to do | **Conceded** that the A1 rationale didn't fit the model and A3 was unreachable in normal use. Recommended a join check plus a defensive guard at promotion using the same function, and rejected letting ineligible learners queue | Ineligible learners never queue (test "does not waitlist an ineligible learner"). The single shared rule shipped; the "defensive guard" wording was superseded by the records-port framing |
| 0l | Interface choice | Do we define users and courses ourselves, and use a CLI? | Seed fake learners in an in-memory directory; course IDs are plain strings; the service class is the interface; skip the CLI (separate commands lose in-memory state) | `InMemoryLearnerDirectory`; no catalog; no CLI; tests are the interface ([README](../README.md)) |
| 0m | Scoping an optional feature | How hard is a CLI, and can it come after the core? | About 0.75 h as a thin REPL. Add `snapshot()` now. Make the CLI the first thing cut if over the timebox | **`snapshot()` shipped** (copies, test S2). CLI not built |
| 0n | Scope pushback | Store data in a text file so the CLI keeps its state | **Pushed back:** concurrent writers threaten capacity and FIFO, partial writes corrupt data, and it adds 45–60 min. Offered a read-only seed file as a middle ground | No persistence ([DESIGN §7](../DESIGN.md#7-concurrency-and-persistence)). No seed file |

## 2. Coding agent

### 2a. Writing the agent's planning prompt (AI log, summary)
| ID | Engineer prompt (AI summary) | AI suggestion (summary) | Result |
|---|---|---|---|
| 0g | Generate a prompt for Claude Code to analyse the assessment files and produce an implementation plan | A plan-mode prompt: analysis → assumptions → phased plan, flagging conflicts between the documents, invariant tracking, scope guardrails, a map from tests to criteria, and a hard stop before code | Seeds entry 1 |
| 0h | The repo is empty with no starter; fix the starter-detection paragraph | Replaced it with an explicit in-memory TS/Node/Vitest fallback. Flagged that the concurrency test becomes optional, and offered sync vs async-with-lock as a decision | Concurrency became assumption A7, for the engineer to decide |
| 0i | Merge the fixes (empty repo, timebox wording) into one final prompt | Consolidated the prompt, with the concurrency choice as an assumption to decide | Entry 1: plan mode, read-only, Q1–Q12, 35 tests mapped to criteria, no code |

### 2b. Second opinion on the agent's decision questions (AI log, summary)
The coding agent raised multiple-choice questions in entry 1. The engineer took each to the advisory chat, reviewed its
recommendation, and decided. The decisions are recorded in [AI_USAGE.md entry 1](../AI_USAGE.md#log).

| ID | Agent's question | Advisory recommendation (summary) | What shipped (AI-run check) |
|---|---|---|---|
| 0o | A3: ineligible learner at the front of the queue | Option 1, skip-and-remove. Option 2's "regain eligibility" benefit doesn't apply, and option 3 conflicts with AC3. **Checked the agent's own invariant claim**, "waitlist non-empty ⇒ course full": it holds only under option 1, so it recommended adding it | Skip-and-remove ([DESIGN §6](../DESIGN.md#6-eligibility-and-waitlist-policy)); invariant **I7** ([§5](../DESIGN.md#5-invariants)), asserted after every call by `checked()`; mutants (f) and (i) killed |
| 0p | A7: concurrency approach | Option 1: synchronous methods plus a last-seat `Promise.all` test labelled a regression guard, since `Promise.all` over synchronous calls runs them in sequence. Rejected option 3 as scope drift | Two race tests ([DESIGN §7](../DESIGN.md#7-concurrency-and-persistence)); [LIMITATIONS #3](../LIMITATIONS.md#scope-and-runtime) states they are not proof. The suggested async mutation check was **not run** (see §5) |
| 0q | A4: may a learner who dropped enroll again? | Option 1, at the back of the waitlist; extend it to learners who left the waitlist; I7 stops a returning learner jumping the queue | Re-enrollment rule in [DESIGN §6](../DESIGN.md#6-eligibility-and-waitlist-policy); D16 asserts the full order |
| 0r | A1/A5: unknown learners and result codes | Option 1: injected directory plus result codes. Rejected caller-asserted eligibility (makes the promotion check impossible) and exceptions for expected outcomes. Added a fixed validation order and a discriminated union with `promoted` and `skipped` | `LearnerDirectory` port; `EnrollResult`/`DropResult` unions in `src/types.ts`; outcomes returned, never thrown ([DESIGN §4](../DESIGN.md#4-api)); `INVALID_REQUEST` cases in test E11 |

## 3. Build: entries without source text
| Entry | What was asked (summary) |
|---|---|
| 0 | A project plan. Advisory chat log: 21 tasks (about 7.6 h), assumptions A1–A8 recommending skip-and-remove and re-enrolment as a new request, promotion pseudocode, a mutation-check step; frontend and deployment items excluded as out of scope |
| 1 | Read the spec and the prior plan; summarise, flag conflicts, propose assumptions with tradeoffs, and produce a phased TDD plan. No code (plan mode). Prompt drafted in 0g–0i |
| 2 | Create the TypeScript + Vitest skeleton per the approved plan |
| 3 | Write DESIGN.md, the result types, the prerequisite rule and the in-memory directory, with unit tests. No `CourseOffering` logic |

## 4. Build: phase gates and decisions (coding agent)
Every phase opened only on the engineer's word. The table shows what each gate actually approved. Where approval was
implicit, it says so: that is lesson 2 in [AI_USAGE.md](../AI_USAGE.md#prompt-iteration-and-lessons).

| Entry | Engineer's words (quoted during the session) | What it approved |
|---|---|---|
| 4 | "update to trim typecase and other formats" | Rejected exact-match IDs. Ambiguous: the AI had to interpret "other formats", and its interpretation was then pinned in tests. Lesson 1 shows how the engineer would phrase it now |
| 5 | "start next phase" | **Implicit:** sign-off on DESIGN.md §4–§6 and entry 3's choices 1, 2 and 4, then Phase 2 (tests first) |
| 6 | "On to the next phase" | Phase 2 test list accepted; Phase 3 (implementation) opened |
| 7 | option A (summary of the engineer's selection) | Membership checked before the directory lookup in `drop` |
| 8 | "start phase 4" | Independent verification: mutation checks, hand trace, invariant review |
| 9 | "Read, then write" · "Commit it" (selections from options the AI offered) | The F1 fix design; committing `scripts/mutate.mjs` |
| 10 | "start phase 5" | Deliverables |
| 11 | "start phase 6" | Final self-review |

## 5. Suggestions not adopted or not carried out
Listed so that no suggestion above reads as done when it wasn't (AI-run check of the repo):

| Source | Suggestion | Status in repo |
|---|---|---|
| 0j, 0r | Reject an offering that lists itself as a prerequisite | Not built. The final API gives an offering no course ID of its own, so a self-prerequisite can't be expressed |
| 0r | Prove exhaustiveness by deleting a `switch` case and watching `tsc` fail | Not done. `src/` has no `switch` over result codes |
| 0p | Mutation check: add an `await` inside `enroll` and confirm the race test fails | **Not done.** It is not in the 17 mutants, so LIMITATIONS #3's "would catch someone adding an `await`" is reasoned, not demonstrated |
| 0m, 0n | CLI, `npm run demo`, read-only seed file | Not built; cut for scope |
| 0f, 0k | Call the promotion re-check "defensive"; add a limitations note that completions are static | Superseded by the records-port framing ([DESIGN §6](../DESIGN.md#6-eligibility-and-waitlist-policy)). How that framing was settled is **not in the supplied logs**; _engineer to confirm_ |

## 6. Documentation pass (after the build)
After the code was finished, the engineer directed a separate AI pass over the evidence and documents (entries 12–14).
It is recorded here because the AI drafted the documents a reviewer reads, and the spec asks candidates to be candid about
what AI contributed.

**Entry 12: excerpt, verbatim.** "[…]" marks omitted text; the full prompt is available on request.
````text
# Role
You are my engineering assistant finishing the deliverables for a timed assessment
("Focused AI-Assisted Engineering Assessment: Course Waitlist"). I am the engineer and decision-maker.
The code is complete (94 tests, 100% coverage, 17/17 mutants killed). This task is about the EVIDENCE
and PRESENTATION of the work. Do not change src/ or tests/ behaviour.
[…]
# Honesty rules (non-negotiable; part of the grade)
- NEVER mark an AI_USAGE.md Status as Accepted/Edited/Rejected yourself. Leave it PENDING and give
  me a checklist. I will fill it in.
- NEVER write engineer-run verification results I haven't pasted to you. Label every piece of
  evidence "AI-run" or "Engineer-run".
- Do not invent prompts. Verbatim prompts come only from what I paste. Mark anything else "summary".
- Do not overstate. If something is partial, say so. Keep VERIFICATION.md §4 verdicts honest.
- Fake IDs only (L1, L2…). Redact local paths, emails and usernames.
- Do not rewrite git history.
[…]
# Step 4: Modern practices (propose only; I decide each one)
[…]
# Working style
Small, reviewable steps. Show a diff per file. Pause after Steps 0, 1, 4 and 6.
[…]
````

**Entries 13–14: summary.** The engineer explained that the commits had been made under the wrong git account and then
rewritten, and asked whether to re-run tests at the old commits or exclude them from the docs. The engineer chose
disclosure, with a code-identity check ([evidence](../evidence/engineer-runs.md#commit-hashes-old--current)). The engineer
then approved Steps 1 and 1b and set the principle for the documents, verbatim:
> Agents execute under defined autonomy boundaries; humans own oversight, approvals, and final quality

## 7. Reusable prompt templates (post-assessment)
These were **not used during the session**. They generalise what worked and fix what didn't, following the lessons in
[AI_USAGE.md](../AI_USAGE.md#prompt-iteration-and-lessons). The revised system prompt that carries them is in
[system-prompt.md § v2](system-prompt.md#revised-version-v2-post-assessment).

**Phase gate** (replaces "start next phase"; lesson 2)
```text
Gate: Phase <n> → Phase <n+1>.
Approved: <sections and decisions, by ID>. Rejected or changed: <ID → replacement>.
Exit evidence I ran (untrimmed): <pasted output>.
In scope for this phase: <list>. Out of scope: <list>. Stop and ask before: <decisions>.
```

**Ambiguous requirement** (lesson 1): state the rule, then list inputs that must match it and inputs that must stay
distinct, and ask for both lists to be pinned in tests. The rewritten ID-normalisation prompt in lesson 1 is the worked example.

**Invariant review and root cause** (generalised from what entries 8–9 did; the actual prompt was "start phase 4")
```text
Review <file> against invariants I1–I7. For each, cite the lines that uphold it on every path, including when an
injected dependency throws. For any violation: (1) reproduce it with a failing test before proposing a fix;
(2) give 2–3 fix options with trade-offs and a recommendation; (3) change no code until I choose.
Then propose a mutant that reintroduces the bug, so the fix stays pinned.
```
