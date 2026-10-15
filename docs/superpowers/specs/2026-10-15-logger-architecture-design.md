# Logger Architecture Design

## 1. Goal

Rebuild `libs/logger` as a small observability core using Pino as the only logging dependency. The module must support readable local output, structured production output, daily file rotation, request correlation, trace/span identifiers, sampling, runtime log-level changes, redaction, error cause serialization, and graceful shutdown.

The redesign is a one-time migration. Existing ambiguous call patterns are not a compatibility contract. All application call sites will move to an explicit structured API.

## 2. Design Principles

- One normalized `LogEvent` enters the logging core; sinks do not invent fields.
- Business logging and Nest framework logging use separate adapters.
- Request context is propagated with Node's `AsyncLocalStorage`; it is never stored as mutable state on a singleton logger.
- Pino remains the only logging package. Node built-ins and existing Nest/RxJS APIs are sufficient for context, formatting, rotation, and lifecycle handling.
- Errors, warnings, and failed requests are retained. Sampling applies to low-value events only.
- Configuration is validated at startup and controls behavior without changing the public event shape.

## 3. Components

### 3.1 `LoggerCore`

The core owns level filtering, sampling, redaction, event construction, and Pino emission. It receives a level, message, fields, optional error, and immutable logger fields. It reads the current request context from `LogContextStore`.

### 3.2 `AppLoggerService`

The business facade is a transient child logger with immutable fields. Its API is explicit:

```ts
child(fields: LogFields): AppLoggerService
trace(message: string, fields?: LogFields): void
debug(message: string, fields?: LogFields): void
info(message: string, fields?: LogFields): void
warn(message: string, fields?: LogFields): void
error(error: unknown, message: string, fields?: LogFields): void
fatal(error: unknown, message: string, fields?: LogFields): void
```

`setContext()` and positional argument guessing are removed. The default context is supplied at the injection boundary with `child({ context: ServiceName })`.

### 3.3 `NestLoggerAdapter`

This adapter alone implements Nest's `LoggerService`. It translates Nest's framework calls to `LoggerCore`, including the legacy `error(message, stack, context)` shape. It is installed with `app.useLogger()` during bootstrap. Application services do not implement or depend on this ambiguous contract.

### 3.4 `LogContextStore`

The store exposes `run(context, callback)`, `get()`, and `merge(fields)`. A context contains `requestId`, `traceId`, `spanId`, and optional request metadata. The store is backed by `AsyncLocalStorage<Readonly<LogContext>>` and has no dependency on Fastify or Nest.

### 3.5 Sinks

Pino writes to a multistream assembled by the module:

- Console sink: development uses a custom human-readable line formatter implemented in this module; production writes JSON lines.
- Application file sink: all accepted events, daily files named `app-YYYY-MM-DD.log`.
- Error file sink: `error` and `fatal` events, daily files named `error-YYYY-MM-DD.log`.

Each file sink owns rotation, flushing, and closing. The module lifecycle closes all sinks on shutdown.

## 4. Event Shape

Every emitted JSON event contains:

```ts
interface LogEvent {
  time: string;
  level: LogLevelName;
  message: string;
  service: string;
  environment: string;
  context?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  fields?: Record<string, unknown>;
  err?: SerializedError;
}
```

`SerializedError` includes `name`, `message`, `stack`, and recursively serialized `cause` values with a bounded depth. Circular values fall back to a stable string marker. Sensitive paths are redacted before Pino serializes the event.

## 5. Request and Trace Context

The HTTP interceptor creates a request context before subscribing to the controller observable and closes the request with exactly one completion event. It:

1. Reuses a valid incoming `x-request-id`; otherwise generates a UUID and writes it to the response.
2. Reads a valid W3C `traceparent` or `x-trace-id`; otherwise generates a 32-character trace ID.
3. Generates a 16-character span ID for the current request.
4. Runs the observable subscription inside `LogContextStore.run()` so downstream logs inherit the identifiers.
5. Records method, route, URL, status code, duration, and outcome.

This supplies correlation identifiers without pretending to implement a distributed tracing SDK. The event fields are intentionally compatible with a future OpenTelemetry bridge.

## 6. Sampling and Dynamic Levels

The logger keeps the configured level in a `RuntimeLogLevel` provider. `setLevel(level)` updates the Pino level immediately and `getLevel()` reports the current value. No HTTP administration endpoint is added by this module.

Sampling configuration has independent rates for `debug`, `info`, and successful HTTP requests. `warn`, `error`, and `fatal` are never sampled out. A random source is injected into the sampler for deterministic tests.

## 7. Configuration

The logger configuration becomes:

```yaml
logger:
  level: info
  service: gateway
  console:
    enabled: true
    format: pretty # pretty | json
  file:
    enabled: true
    dir: logs
  sampling:
    debug: 1
    info: 1
    requestSuccess: 1
  redact: []
```

Development defaults to `console.format=pretty`; production defaults to `json`. Existing `level`, `file.enabled`, `file.dir`, and `redact` settings remain valid.

## 8. Migration

- Replace `new Logger(...)` in Prisma and Redis with injected `AppLoggerService` children.
- Replace `setContext()` calls with `child({ context: ... })` at construction or use-site boundaries.
- Update the exception filter and Swagger service to call `error(error, message, fields)` and `warn(message, fields)`.
- Register `NestLoggerAdapter` in `main.ts` so Nest framework logs use the same sinks and context rules.
- Keep the HTTP interceptor and exception filter as separate global concerns; the interceptor records transport outcome, while the filter maps and logs exception semantics.

## 9. Verification

Unit tests will cover:

- Event normalization and immutable child fields.
- Nest adapter translation.
- Context inheritance and cleanup across async boundaries.
- Trace/request ID parsing and response header behavior.
- Error cause serialization and redaction.
- Sampling boundaries and runtime level changes.
- Pretty and JSON console formatting.
- Daily file rotation, error fan-out, flush, and close.
- Exactly one HTTP completion event for success and error paths.

The repository build, logger tests, core tests, and gateway end-to-end tests must pass after migration.

