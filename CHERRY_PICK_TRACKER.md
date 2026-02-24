# Cherry-Pick Tracker: Upstream 2026.2.17 Release Sync

## Status: IN PROGRESS

> **Note**: 별도의 보안 P0 cherry-pick이 `cherry-pick/upstream-security-p0` 브랜치에서 완료됨.
> 20개 보안 커밋 적용 (OC-02/06/07/22/25/53/65, SSRF 방어, prototype pollution 등).
> 상세: `CHERRY_PICK_PROGRESS.md` 참조.

| Phase                                    | Status  | Commits | Tag       |
| ---------------------------------------- | ------- | ------- | --------- |
| Phase 0: Prep                            | DONE    | -       | cp/base   |
| Phase 1: Security + Model                | PENDING | 5       | cp/phase1 |
| Phase 2: Small Safe Fixes                | PENDING | 13      | cp/phase2 |
| Phase 3: Telegram + Slack + Core         | PENDING | 22      | cp/phase3 |
| Phase 4: Cron + Subagent + Memory + Misc | PENDING | 15      | cp/phase4 |

## Detailed Log

### Phase 1: Security + Model

| #   | Hash      | Description               | Status  | Notes |
| --- | --------- | ------------------------- | ------- | ----- |
| 1.1 | 235794d9f | exec credential theft fix | PENDING |       |
| 1.2 | d1c00dbb7 | $include path traversal   | PENDING |       |
| 1.3 | c90b09cb0 | 1M context beta header    | PENDING |       |
| 1.4 | ae2c8f2cf | Sonnet 4.6 support        | PENDING |       |
| 1.5 | d7c6136c1 | Sonnet/Opus 4.6 tests     | PENDING |       |

### Phase 2: Small Safe Fixes

| #    | Hash      | Description                   | Status  | Notes             |
| ---- | --------- | ----------------------------- | ------- | ----------------- |
| 2.1  | 20957efa4 | SIGTERM→SIGKILL graceful      | PENDING |                   |
| 2.2  | 94eecaa44 | Windows atomic session writes | PENDING |                   |
| 2.3  | 0587e4cc7 | MEDIA: token parse limit      | PENDING |                   |
| 2.4  | 414b996b0 | image resize log              | PENDING |                   |
| 2.5  | c15385fc9 | voice-note DM transcription   | PENDING |                   |
| 2.6  | 01b37f1d3 | 20MB+ getFile error           | PENDING |                   |
| 2.7  | c762bf71f | IPv6→IPv4 autoSelectFamily    | PENDING |                   |
| 2.8  | 501e89367 | Unicode FTS tokens            | PENDING |                   |
| 2.9  | d4c057f8c | sender_id metadata            | PENDING | Conflict expected |
| 2.10 | bed8e7abe | inbound message identifiers   | PENDING | Conflict expected |
| 2.11 | 5f821ed06 | stale threadId leak fix       | PENDING |                   |
| 2.12 | a62ff19a6 | usage last-turn totals        | PENDING |                   |
| 2.13 | 19ae7a4e1 | session-memory /new fallback  | PENDING |                   |

### Phase 3: Telegram + Slack + Core

| #    | Hash      | Description                          | Status  | Notes                |
| ---- | --------- | ------------------------------------ | ------- | -------------------- |
| 3.1  | e91a5b021 | session lock watchdog                | PENDING |                      |
| 3.2  | b62bd290c | disableBlockStreaming removal        | PENDING |                      |
| 3.3  | 2a5f0d606 | WebChat history size limit           | PENDING |                      |
| 3.4  | 087dca8fa | read-tool overflow + reply threading | PENDING | HIGH RISK - 40 files |
| 3.5  | 244ed9db3 | draft stream preview replyToId       | PENDING |                      |
| 3.6  | 583844ecf | partial stream dedup                 | PENDING |                      |
| 3.7  | c4e9bb3b9 | command name normalize               | PENDING |                      |
| 3.8  | b2aa6e094 | slash command racing                 | PENDING |                      |
| 3.9  | 0cff8bc4e | DM topic thread_id                   | PENDING |                      |
| 3.10 | 6757a9fed | polling offset cleanup               | PENDING |                      |
| 3.11 | c62b90a2b | streamMode:off block streaming       | PENDING |                      |
| 3.12 | 86df16061 | stream preview finalize              | PENDING |                      |
| 3.13 | a69e82765 | stream replies dedup final           | PENDING |                      |
| 3.14 | 16327f21d | inline button style                  | PENDING |                      |
| 3.15 | cd4f7524e | user reaction events                 | PENDING | Conflict expected    |
| 3.16 | 7bb9a7dcf | sendPollTelegram handler             | PENDING |                      |
| 3.17 | 6945fbf10 | native text streaming                | PENDING | HIGH RISK            |
| 3.18 | 06efbd231 | ChatStreamer import fix              | PENDING |                      |
| 3.19 | bec974aba | draft message streaming              | PENDING |                      |
| 3.20 | 89ce1460e | configurable stream modes            | PENDING |                      |
| 3.21 | 1d23934c0 | streaming routing/tests              | PENDING |                      |
| 3.22 | b57d29d83 | forwarded attachment fix             | PENDING |                      |

### Phase 4: Cron + Subagent + Memory + Misc

| #    | Hash      | Description                 | Status  | Notes                |
| ---- | --------- | --------------------------- | ------- | -------------------- |
| 4.1  | bc67af6ad | webhook POST delivery       | PENDING | HIGH RISK - 33 files |
| 4.2  | c26cf6aa8 | stagger controls            | PENDING |                      |
| 4.3  | de6cc05e7 | spin loop prevention        | PENDING |                      |
| 4.4  | ddea5458d | usage telemetry             | PENDING |                      |
| 4.5  | dbe2ab6f6 | usage telemetry types       | PENDING |                      |
| 4.6  | c20ef582c | session key routing         | PENDING | Conflict expected    |
| 4.7  | 2ed43fd7b | cron accountId resolve      | PENDING |                      |
| 4.8  | 0ee348069 | model fallback preserve     | PENDING |                      |
| 4.9  | 57c8f6239 | webhook session reuse       | PENDING |                      |
| 4.10 | 75001a049 | announce routing/timeout    | PENDING |                      |
| 4.11 | 5a3a448bc | /subagents spawn command    | PENDING |                      |
| 4.12 | f24224683 | spawn group context         | PENDING |                      |
| 4.13 | 2362aac3d | spawn docs + context prefix | PENDING |                      |
| 4.14 | 65aedac20 | FTS fallback                | PENDING |                      |
| 4.15 | bcab2469d | LLM query expansion         | PENDING |                      |
| 4.17 | 76949001e | skill path ~ abbreviation   | PENDING |                      |
| 4.18 | cfd384ead | skill routing guide         | PENDING |                      |
| 4.19 | d6aa9adec | Docker Chromium+Xvfb        | PENDING |                      |
| 4.20 | b90eb5152 | plugin model override hook  | PENDING |                      |
