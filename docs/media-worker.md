# Media Worker local integration

Based on upstream dorakoo/doubao-studio commit `7eeb7b67a518e47ee4296c36e5c5f17942a9cff0`.

Start the built application with `--local-control`, `MEDIA_WORKER_STUDIO_USER_DATA` pointing to a dedicated private profile, and `MEDIA_WORKER_STUDIO_ASSET_ROOT` pointing to the Worker credential namespace's private asset directory. Create both directories before launch. Sign in through the visible account browser. Do not copy cookies from another profile. Build with `pnpm build`; a development Vite server is unnecessary in this mode.

The existing authenticated localhost control server gains `worker-v1` only in this dedicated mode. Its private discovery record and authenticated health response expose the PID and SHA-256 hashes of the canonical profile and asset root. Tokens stay in private local configuration. Worker clients must verify these fields and renderer readiness before polling work.

## Protocol

- `PUT /v1/worker/generations/{key}` accepts prompt, exactly one local image, accountId, model, duration and aspectRatio. The image must resolve inside the configured asset root. Key is 64 lowercase hex characters.
- `GET` on that path returns the same durable generation. Only `404 WORKER_NOT_FOUND` with `authoritative: true` proves absence. Ledger corruption or missing initialized ledger fails closed.
- `POST .../{key}/advance` drives the existing renderer. Start and confirmation intentions are persisted and fsynced before their effects. An uncertain action cannot be repeated through retry, deletion or another advance.
- `GET .../{key}/artifacts/{artifactId}` downloads the exact completed video and returns bounded MP4 bytes. It never selects the newest download or exposes local paths, cookies, prompts or provider URLs.

The stable key maps to one immutable request digest and one TaskService/Repository task. A changed request conflicts. The client must serialize admission and refuse a busy profile. Recovery observes the same task, account partition and exact conversation; it does not submit another prompt. If an effect cannot be proven after its intent was saved, preserve the task for inspection. A user challenge or uncertain confirmation requires human intervention, never an automatic resubmission.

The renderer reloads task projections without resetting active slots. Video mode selection uses the owning Doubao guest's trusted native events, and confirmation checks the exact session URL and empty editor before a single native Enter. Temporary diagnostic CDP is unnecessary for normal operation.

## Validation

`pnpm validate` runs type checking, lint, project/contract rules, unit tests and production builds. Unit coverage includes immutable keys, lost effects, strict lookup, sanitized responses, one-shot confirmation and projection refresh. A dedicated real-account smoke test confirmed automatic 5-second, 9:16 video generation without manual submission; public gateway acceptance and durable recovery are recorded by the consuming media_agent repository. Browser profile, tokens, generated media and deployment state are deliberately outside this source repository.
