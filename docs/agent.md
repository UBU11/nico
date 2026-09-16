

## Project Overview
You are building an event-driven, autonomous Site Reliability Engineering (SRE) remediation agent. The agent ingests incident webhooks (Prometheus Alertmanager, GitHub Actions failures), models the triage and diagnostic lifecycle via a deterministic LangGraph.js state machine, runs read-only diagnostic telemetry tools, tests remediation patches within isolated rootless Podman containers, and halts at a human-in-the-loop (HITL) gate before issuing Pull Requests.

---

## Technical Stack & Runtime Invariants

* **Runtime:** Bun (>= 1.1) with TypeScript in strict mode (`"strict": true`, `"noUncheckedIndexedAccess": true`).
* **HTTP Gateway:** Hono.js running natively on Bun.
* **Orchestration:** LangGraph.js (`@langchain/langgraph`, `@langchain/langgraph-checkpoint-postgres`).
* **Database & ORM:** Neon Postgres (serverless) connected via pooled TCP (`pg.Pool`), queried with Drizzle ORM and typed with `drizzle-zod`.
* **Type Validation:** Zod for all external boundaries (Hono payloads, LLM tool inputs/outputs, environment variables).
* **Isolation Sandbox:** Podman rootless UNIX domain socket (`/run/user/<UID>/podman/podman.sock`) accessed via `dockerode` or Bun native UNIX socket `fetch`.
* **Telemetry & LLM:** Langfuse / OpenTelemetry traces, structured LLM outputs via tool calling.

---

## Non-Negotiable System Invariants

1. **No Raw Shell Spawning:** Never invoke `bun:spawn(["podman", ...])` or shell out with unescaped bash strings. All container interactions must use the Podman UNIX domain socket engine directly.
2. **Sandbox Hard Boundaries:** Every container created for reproduction or verification MUST enforce:
   * `NetworkMode: "none"` (zero external network egress).
   * Hard memory ceiling: `512MB` (`Memory: 536870912`).
   * Hard CPU ceiling: `1.0 CPU` (`NanoCpus: 1000000000`).
   * Execution timeout: Max 30 seconds before forceful SIGKILL.
3. **Database Connection Separation:** LangGraph's `PostgresSaver` must use a persistent TCP connection pool string (`-pooler.postgres.neon.tech` via `pg.Pool`), NOT the stateless HTTP driver (`@neondatabase/serverless`).
4. **Tool Access Tiers:** Tools are strictly categorized:
   * **Tier 1 (Read-Only Diagnostics):** Query Loki logs, query Prometheus metrics, inspect Git diffs. Allowed autonomously.
   * **Tier 2 (Isolated Ephemeral):** Apply diff and run reproduction tests in rootless Podman. Allowed autonomously.
   * **Tier 3 (State-Mutating Production):** Git branch creation, Pull Request generation, and issue comments. Strictly blocked by the Human Gate node.

---

## Repository Structure

Maintain the following project directory structure:

```text
├── src/
│   ├── index.ts                # Application entrypoint (Bun.serve / Hono)
│   ├── config/                 # Env validation with Zod
│   │   └── env.ts
│   ├── db/
│   │   ├── client.ts           # Drizzle client & pg.Pool initialization
│   │   ├── schema/             # Drizzle tables (incidents, audit_logs)
│   │   └── checkpointer.ts     # LangGraph PostgresSaver instance
│   ├── gateway/
│   │   ├── app.ts              # Hono application setup
│   │   └── routes/             # Alertmanager & CI webhook endpoints
│   ├── graph/
│   │   ├── state.ts            # LangGraph Annotation.Root definition
│   │   ├── workflow.ts         # Graph assembly, conditional routing, edges
│   │   └── nodes/              # Triage, Query, Hypothesis, Sandbox, Gate
│   ├── tools/
│   │   ├── diagnostics/        # Loki, Prometheus, Git tree readers
│   │   └── sandbox/            # Podman engine socket manager & test runner
│   └── types/                  # Shared Zod schemas & TypeScript types
├── evals/                      # Synthetic incident evaluation benchmark
│   ├── scenarios/              # JSON/YAML incident fixtures
│   └── runner.eval.ts          # Bun test harness measuring resolution rate
├── drizzle.config.ts
├── tsconfig.json
└── package.json

```

---

## Implementation Guidelines

### 1. LangGraph State Machine Specification

* Define state channels using `Annotation.Root`:
* `incidentId: Annotation<string>`
* `alert: Annotation<AlertPayload>`
* `logs: Annotation<string[]>({ reducer: (a, b) => a.concat(b) })`
* `metrics: Annotation<Record<string, unknown>>`
* `hypothesis: Annotation<string | null>`
* `patchDiff: Annotation<string | null>`
* `sandboxResult: Annotation<SandboxExecutionResult | null>`
* `humanApproved: Annotation<boolean>`
* `retryCount: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 })`


* **Flow Transitions:**
1. `triageNode` -> Validate alert, clean PII, route to `queryNode`.
2. `queryNode` -> Call Tier 1 read-only tools to fetch logs and metrics.
3. `hypothesisNode` -> Generate root-cause analysis and a unified diff patch.
4. `sandboxNode` -> Run patch in Podman. If tests fail and `retryCount < 3`, cycle back to `hypothesisNode` with execution failure logs.
5. `humanGateNode` -> Interrupt execution using LangGraph's `interrupt()` primitive.
6. `prNode` -> Triggered only after resume input confirms approval.



### 2. Sandbox Execution Contract

When implementing `src/tools/sandbox/podman.ts`:

* Dynamically resolve the user socket:
```typescript
const socketPath = process.env.PODMAN_SOCKET_PATH || `/run/user/${process.getuid?.() ?? 1000}/podman/podman.sock`;

```


* Always wrap executions in a `try...finally` block that guarantees container cleanup via `container.remove({ force: true })`.
* Pipe container stdout/stderr through a size truncator (limit to 4,000 characters) to prevent token context blowout.

### 3. Drizzle & Zod Validation Patterns

* Always use `createInsertSchema` and `createSelectSchema` from `drizzle-zod` to expose database schemas to tools.
* Route handlers in Hono must use `@hono/zod-validator` on incoming payloads before dispatching to the graph:
```typescript
app.post("/webhooks/alert", zValidator("json", AlertmanagerPayloadSchema), async (c) => { ... });

```



### 4. Deterministic Output Formatting

* Force the LLM to output hypotheses and patches adhering strictly to JSON Schema via structured outputs (`withStructuredOutput` or tool calling).
* Patches must always be structured as standard Unified Diffs (`diff -u`) to be applied deterministically with `git apply` inside the sandbox.

---

## Verification & Testing Standards

* **Type-checking:** Must pass `bun run tsc --noEmit` with zero errors or implicit `any` types.
* **Unit & Integration:** Run `bun test` for all isolated components (Zod schemas, tool wrappers, state machine node transforms).
* **Evaluation Suite:** Benchmark the agent against `/evals/scenarios` (synthetic crash loops, bad environment variables, missing migrations):
* Measure **Diagnostic Accuracy** (correct root cause identification).
* Measure **Tool Invocation Efficiency** (avoid infinite tool looping).
* Enforce that failing sandbox runs trigger automated hypothesis self-correction.



```
