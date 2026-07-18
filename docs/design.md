# Concord — design

> **Thesis:** treat every spec change as a content-addressed amendment pinned to the base it
> was derived from, so base-drift becomes a *compile error instead of a silent overwrite*, and
> two proposals that touch the same requirement in different places *merge automatically*.
>
> "git rebase for specs."

## 1. The problem

Spec-driven-development (SDD) tools like [OpenSpec](https://github.com/Fission-AI/OpenSpec)
keep a behavioural contract as structured markdown — requirements, each with scenarios — and
land changes as *deltas*: `## MODIFIED Requirements`, `## ADDED`, `## REMOVED`, `## RENAMED`.
A `MODIFIED` requirement carries the **full new text** of that requirement and replaces the old
block by name when the change is archived into the canonical specs.

A delta records only the *after* text. It does **not** record the base it was derived from.
That single omission makes concurrent work unsafe:

- **No drift detection.** Nothing notices that the requirement changed underneath you between
  the moment you branched and the moment you land.
- **No 3-way merge.** With no recorded base, there is nothing to merge *against*.
- **Silent data loss.** Two proposals modify requirement R off the same base. Alice lands
  first. Bob rebases onto main (his branch never touched the canonical spec, so the rebase is
  clean), then archives — and his stale full-block replacement **silently overwrites Alice's
  change**, with no git conflict and no validation error, because Bob's block is
  self-consistent on its own.

The only mitigation practised today is team discipline plus a sharp final reviewer. That is a
process patch for a tooling gap.

## 2. Is it already solved? (No.)

Surveyed against the capability set — **(a)** stores a base version/hash per requirement,
**(b)** detects drift when the base moved, **(c)** does a structured 3-way merge of two
proposals, **(d)** detects cross-change overlap across open work:

| Tool | (a) base hash | (b) drift | (c) 3-way merge | (d) overlap |
|---|:--:|:--:|:--:|:--:|
| OpenSpec | planned | partial¹ | planned | ✗ |
| GitHub Spec Kit | ✗ | ✗ | ✗ (git line-merge) | ✗ |
| AWS Kiro | ✗ | ✗ | ✗ | ✗ |
| Tessl | ✗ | agent-judged | ✗ | ✗ |
| ADR tooling | ✗ | ✗ | ✗ | ✗ |
| Doorstop | ✓ (SHA-256 per item) | ✓ ("suspect links") | ✗ | ✗ |
| OpenFastTrace | ✓ (`type~name~revision`) | ✓ (outdated/predated) | ✗ | ✗ |
| StrictDoc | ✓ (content HKey) | ✓ | ✗ | ✗ |
| oasdiff / buf | baseline-per-run | ✓ (2-way) | ✗ | ✗ |

¹ OpenSpec v1.6.0 shipped a *tripwire*: a stale `MODIFIED` halts the archive in one narrow
case instead of silently deleting an earlier change's scenario. Its own
[`openspec-parallel-merge-plan.md`](https://github.com/Fission-AI/OpenSpec/blob/main/openspec-parallel-merge-plan.md)
names this exact failure mode and lays out four phases — base-snapshot store (`meta.json` +
SHA-256), a `sync`/rebase 3-way merge, scenario-level granularity, and a stable
requirement-ID graph — of which only the tripwire is built. The
[team-workflow doc](https://github.com/Fission-AI/OpenSpec/blob/main/docs/team-workflow.md)
still tells you to resolve same-requirement collisions as a raw git conflict by hand.

**Verdict.** Base-drift *detection* exists in the requirements-engineering world
(Doorstop / OpenFastTrace / StrictDoc), but it is *vertical* (an item vs its base) and
*report-only*. No surveyed tool does a structured 3-way merge of two concurrent proposals, and
none detects cross-change overlap before it becomes a conflict. Every mature normative-text
process (IETF, W3C, TC39, Rust RFC, Python PEP, Kubernetes KEP, and legislative drafting)
leans on the same human bottleneck: a single editor's memory noticing that two proposals touch
the same section. The one machine-checkable convention any of them uses — legislative
"strike X insert Y **against Section N of base version V**" — is precisely what an SDD tool
can automate and none has.

The gap is real. The building blocks all exist. The novelty is composing them.

## 3. Prior art we build on

- **Optimistic concurrency / HTTP `ETag` + `If-Match` → `412`.** The drift check verbatim:
  record the base's hash, refuse to apply if the live hash moved. Also JPA `@Version`,
  compare-and-swap.
- **kubectl Server-Side Apply `managedFields`.** The upgrade path beyond whole-block hashing:
  track *ownership per field/subpath* so disjoint edits auto-merge and only
  same-field-different-value conflicts — with an explicit `--force` escape hatch. Conflicts
  fail only *declarative apply*, never a raw update.
- **`diff3` / dpkg conffiles.** Classic 3-way from a recorded base; dpkg stores the md5sum of
  the shipped config and prompts with a diff when the on-disk hash no longer matches.
- **Kubernetes strategic-merge-patch + FSTMerge / JDime.** The merge algorithm: match
  unordered children **by a key** (not array position), recurse, text-merge only the leaves.
  Requirement name and scenario name are the keys.
- **GumTree.** AST matching (top-down isomorphic, then bottom-up similarity) to align nodes
  across base/left/right and catch a *renamed* or *moved* block a naive key-match would miss.
- **Mergiraf.** The reference blueprint (tree-sitter → GumTree match → PCS triples → merge →
  rebuild); GPLv3 and no markdown grammar — copy the design, not the binary.
- **PR-overlap actions; merge queues (GitHub / Mergify / Graphite).** Overlap surfacing across
  open PRs, and the one place a *post-merge* semantic check sees true state.
- **RFC/KEP/PEP intent-numbering; legislative base-pinned amendments.** Reserve an ID before
  you write; pin every change to an exact section of an exact base version.

Deliberately rejected: CRDT/OT as the storage format — binary, unreviewable in a PR, and they
mask *semantic* conflicts rather than catch them. Plain markdown stays the source of truth.

## 4. Design principles

1. **Plain markdown stays the source of truth.** It must diff and review in a PR.
2. **Fail safe, then fail smart.** First guarantee no change is ever silently lost
   (detection); then auto-resolve everything that isn't a true overlap (merge).
3. **Degrade gracefully.** Works on brownfield specs with zero adoption effort; gets sharper
   as a team opts into stable IDs and stored base snapshots.
4. **CI-native.** Value lands as a required status check and a PR comment.
5. **Tool-agnostic core.** The engine shouldn't know about OpenSpec; adapters map formats in.

## 5. Architecture

### 5.1 Interchange model

Normalise any structured spec into a tree of identified nodes and any change into typed
operations carrying provenance:

```text
Spec      := Node*
Node      := { id, kind, key, body, children[] }        // requirement → scenario → clause
Operation := Add(node) | Modify(target, newNode, base)
           | Remove(target, base) | Rename(target, newKey, base)
Base      := { hash, body, ref? }                       // the provenance the delta lacks today
```

### 5.2 The five pillars

1. **Content-addressed provenance.** Every `Modify/Remove/Rename` records the hash and body of
   the block it was derived from — hashed over a **canonicalised** form (parse → normalise
   whitespace → serialise) so reformatting never false-positives. In v0 this provenance is
   *reconstructed from git history* (see §6); stored snapshots come later for the cases git
   can't reconstruct.
2. **Drift check** (`concord check`, shipped). Recompute the live block's canonical hash;
   mismatch → loud early failure with a redline. The HTTP 412 of specs.
3. **Structured 3-way merge** (`concord rebase` / `merge`, roadmap). Keyed recursive merge over
   requirement → scenario → clause; disjoint edits auto-merge, same-leaf edits fall back to
   diff3 with conflict markers written into the delta. The piece no tool ships.
4. **Cross-change overlap** (`concord overlap`, shipped; forge bot on the roadmap). Index every
   open change's claimed requirements; warn on any node claimed twice. An optional intent
   registry (RFC/KEP-style) moves detection to before a line is written.
5. **Semantic invariants** (roadmap). Lint the *merged* spec — unique names, resolvable
   references, no contradictory duplicates — in the merge queue, where the true post-merge
   state is visible. Catches "merges cleanly but is wrong".

### 5.3 Stable IDs (the keystone, later)

Names as keys are fragile: a rename reads as delete+add. Optional stable IDs per node make
matching survive renames and moves — and stay opt-in, so brownfield specs work immediately via
name matching with similarity fallback.

### 5.4 Adapters

A thin per-format module maps a real spec ↔ the interchange model. OpenSpec is the first
adapter (its v1.6.0 header regexes are mirrored exactly); spec-kit, ADRs, Doorstop items, and
OpenAPI/JSON-Schema are candidates.

## 6. v0: why `concord check` needs no stored state

For a PR branch, the base a `MODIFIED` block was derived from **is** the requirement's text at
`merge-base(HEAD, base)` — and the version it will land on is the text at the base tip. Both
are reconstructible from git history, so the drift check works on any existing repo with zero
format changes and zero buy-in. Rebasing or merging the base branch advances the merge-base,
which clears the finding exactly when the author has (or must) re-derive the block.

What git *cannot* reconstruct — a delta hand-edited after a partial re-derivation, provenance
across an archive, cross-repo bases — is what stored base snapshots are for. Detection first,
resolution second.

## 7. How it retires the discipline

| Manual discipline (today) | Concord |
|---|---|
| grep open changes for the same requirement before proposing | `concord overlap` (and, later, the PR bot) |
| never carry a stale `MODIFIED` block | `concord check` in CI fails the build with a redline |
| human-check the final specs diff for vanished content | drift caught pre-merge, mechanically |
| serialise contended requirements by talking | overlap surfaced on day one (later: intent registry) |

## 8. Relationship to OpenSpec

Two complementary paths: contribute the base-snapshot/drift pieces upstream (they align with
OpenSpec's published plan), and grow the tool-agnostic engine here. concord leads with the
narrow, immediately-useful slice — detection — and is architected so the core stays extractable
for other formats.

## 9. Risks and open questions

- **Hash brittleness** to semantically-null reformatting → always hash the canonicalised form.
- **Rename false-matches** in the future merge → similarity thresholds must conflict rather
  than guess on ambiguity.
- **Ordered vs unordered children** → scenarios are a set; `WHEN`/`THEN` clauses are
  order-significant and need an ordered merge with honest conflicts.
- **Force must never be default** → any override that discards another party's change is
  explicit and logged (à la `kubectl --force-conflicts`).
- **Scope discipline** → SDD specs are the wedge; resist becoming a general document-merge
  tool on day one.
