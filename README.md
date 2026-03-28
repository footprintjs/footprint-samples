# footprint-samples

Runnable examples for the [footprint](https://github.com/footprintjs/footPrint) library.

## Setup

```bash
# Clone both repos side-by-side
git clone https://github.com/footprintjs/footPrint.git
git clone https://github.com/footprintjs/footprint-samples.git

# Build the library first
cd footPrint
npm install && npm run build

# Then install samples (links to local footPrint via file: dependency)
cd ../footprint-samples
npm install
```

> The samples use `"footprint": "file:../footPrint"` so both repos must be siblings in the same parent directory.

## Quick Start

```bash
npm run quick-start
```

Full loan underwriting pipeline with auto-generated causal trace, decider branching, and narrative output.

## Feature Examples

Each example demonstrates a single feature in isolation:

| Example | Run | What it shows |
|---------|-----|---------------|
| **Values** | `npm run feature:values` | `setValue`/`getValue` with primitives, objects, arrays, nested data |
| **Narrative** | `npm run feature:narrative` | Auto-generated causal trace from scope operations |
| **Recorders** | `npm run feature:recorders` | Custom `Recorder` implementation for audit logging |
| **Typed Scope** | `npm run feature:typed-scope` | Zod-based schema validation for scope |
| **Metrics** | `npm run feature:metrics` | `MetricRecorder` for per-stage latency, read/write counts |
| **Streaming** | `npm run feature:streaming` | `addStreamingFunction` with token-by-token `StreamHandlers` |
| **Error Handling** | `npm run feature:errors` | Stage errors, try/catch, graceful degradation, `DebugRecorder` |
| **Debug + Mermaid** | `npm run feature:debug` | `DebugRecorder` full trace + `toMermaid()` flowchart diagram |
| **breakFn** | `npm run feature:break` | Early pipeline termination — validation gates, budget limits |
| **Contract & OpenAPI** | `npm run feature:contract` | `.contract()` with Zod/JSON Schema, OpenAPI 3.1 generation |

## Flowchart Examples

Incremental complexity — each builds on the previous:

| Example | Run | Pattern |
|---------|-----|---------|
| **Linear** | `npm run flow:linear` | `A → B → C` — stages in sequence |
| **Fork** | `npm run flow:fork` | Parallel branches that rejoin |
| **Decider** | `npm run flow:decider` | Conditional branching (pick one path) |
| **Selector** | `npm run flow:selector` | Multi-branch (run all matching paths) |
| **Subflow** | `npm run flow:subflow` | Nested pipeline mounted inside parent |
| **Loops** | `npm run flow:loops` | `loopTo` + `breakFn` for iteration |

## Run All

```bash
npm run all
```

## License

MIT
