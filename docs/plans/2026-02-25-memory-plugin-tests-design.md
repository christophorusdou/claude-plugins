# Memory Plugin Test Suite Design

## Framework
Vitest (ESM-native, fast, built-in mocking). Co-located test files (`*.test.ts`).

## Embedding Strategy
- Unit tests: mock embeddings (deterministic fake vectors)
- Integration/e2e tests: real HuggingFace model (`Xenova/all-MiniLM-L6-v2`)

## DB Isolation
In-memory SQLite for all tests. Add `setDb()` export to `db.ts` for test injection. Each test gets a fresh DB instance.

## Test Layers

### Unit Tests (mock DB + mock embeddings)
| File | Coverage |
|------|----------|
| `project-detect.test.ts` | cwd detection: package.json name, /projects/ regex, basename, home dir fallback |
| `schema.test.ts` | migration v1→v2, compound unique index behavior |
| `tools/store.test.ts` | scope-aware hash dedup, category auto-detect, auto-project fill |
| `tools/vote.test.ts` | score/confidence math, clamping to [0,1] |
| `tools/cleanup.test.ts` | candidate rules: low score, unused 90+ days, low confidence auto-captures |
| `retrieval.test.ts` | re-ranking formula, conflict suppression (same category + score thresholds) |

### Integration Tests (real in-memory DB + real embeddings)
| File | Coverage |
|------|----------|
| `store-recall.integration.test.ts` | store→recall round trip, similarity scores |
| `scope.integration.test.ts` | two-pass search, scope boost, scope-aware dedup, conflict suppression |
| `sync.integration.test.ts` | JSONL export/import with scope-aware dedup |
| `lifecycle.integration.test.ts` | store→update→vote→recall→delete full lifecycle |

### E2E Test (real model, real DB, MCP tool handlers)
| File | Coverage |
|------|----------|
| `mcp-tools.e2e.test.ts` | calls actual tool handler functions end-to-end |

## Test Utilities (`src/__tests__/helpers.ts`)
- `createTestDb()` — in-memory SQLite with schema migrations
- `mockEmbed()` — deterministic fake 384-dim vectors
- `seedMemories()` — insert test fixtures
