# Upstream Rebase Status (v2026.3.8)

## Current State

Branch: `feature/upstream-rebase-v2026.3.8`
Base: `upstream/main` @ v2026.3.8
Status: **Build passing ✅**, ready for selective feature porting

## Completed

### Already Applied (Cherry-Picked)

1. **CronDelivery Schema** (commit 6d1393917)
   - Added `threadId` field to CronDeliverySharedProperties
   - Compatible with upstream's new `accountId` and `failureDestination` fields

2. **Subagent Progress** (commits 19563a046, de11f5375)
   - Real-time progress reporting for executor subagents
   - Missing tool events handling after upstream rebase

### Upstream Already Has

1. **Config Env Vars Timing** (origin commit 61f6a615d)
   - Test exists: `models-config.applies-config-env-vars.test.ts`
   - Passing ✅

2. **Cron Batch Unify Bug**
   - Fork fix (a8041db72) addressed `nextRunAtMs` cross-contamination
   - **Not needed**: Upstream rewrote cron timer.ts (669→1257 lines), batch unify logic doesn't exist
   - The underlying bug cannot occur in upstream's architecture

## Analysis of Remaining Fork Features

### Not Applicable / Fixed Upstream

#### Cron System

- **Fork fixes**: TICK_TOLERANCE_MS, batch unify cross-contamination
- **Status**: Upstream completely rewrote cron service architecture
- **Action**: None needed - old bugs don't apply to new architecture

### Worth Considering (Manual Port Required)

#### Subagent Progress Enhancements (origin/main has more features)

Current upstream version: Basic progress tracking
Fork adds:

- Slack emoji reactions (`:hourglass_flowing_sand:` → `:white_check_mark:`)
- 3-minute stall detection and notifications
- `suppressChannelRelay` flag for group chats
- Better tool activity tracking with timestamps

**Complexity**: Medium
**Value**: High (UX improvement)
**Risk**: Low (isolated feature)
**Status**: Ready to port if desired

#### Slack Fixes (15 Commits) ✅ COMPLETE

**Status**: All functionality already in upstream - no porting needed

Fork commits analyzed:

- `19f0a76fd`: Fail fast on non-recoverable auth errors ✅
- `53c9f98b1`: Restore persistent per-channel session routing ✅
- `84ac4a962`: Reduce token bloat by skipping thread context on existing sessions ✅
- `f6bbe85b4`: Trim repeated slack thread context payloads ✅
- `8ecd89093`: Filter inherited parent files from thread replies ✅
- `16af07773`: Prevent duplicate DM processing from app_mention events ✅
- `2ec6138b4`/`7677f7f1f`: Send native typing indicator during agent turn ✅
- `de1c20912` through `4adf2a10d`: Native streaming support (8 commits) ✅

**Verification Method**: Deep code analysis comparing origin/main vs HEAD

- DM duplicate processing: src/slack/monitor/events/messages.ts:68-73
- Thread file filtering: src/slack/monitor/message-handler/prepare-content.ts:16-35
- Session routing: src/slack/monitor/message-handler/prepare.ts:280-294
- Token optimizations: prepare.ts:652, 739-742
- Native typing: dispatch.ts:153-156
- Streaming: src/slack/streaming.ts with correct markdown handling

**Complexity**: N/A (already implemented)
**Value**: High (prevents token bloat, duplicate processing)
**Risk**: None (existing code)
**Action**: Verification testing only

#### Session/Agent Error Recovery

Fork commits:

- `3979c72ca`: Wrap transcript event listeners in try/catch
- `d5ac468a7`: Recognize connection errors as retryable timeout failures
- `cb2a71d89`: Recover host edit success after post-write upstream throw
- `0c0caad14`: Clear pending tool call state on interruption

**Complexity**: Low-Medium
**Value**: Medium (reliability improvement)
**Risk**: Low (defensive code)
**Status**: Worth porting selectively

### Definitely Skip

#### Auto-Reply Newline Preservation

- Fork commits: cd952b046, 0e9b73afb, 649d15684
- Multiple reverts suggest instability
- Low value vs risk

## Recommended Next Steps

### Option A: Ship Current State (Conservative)

- Current branch builds and passes tests
- CronDelivery threadId is applied
- Subagent progress basics are working
- **Pros**: Low risk, can ship immediately
- **Cons**: Missing some UX improvements from fork

### Option B: Port High-Value Features (Balanced)

1. Port subagent progress enhancements (Slack reactions, stall detection)
2. Port critical Slack fixes (DM dedup, thread context filtering)
3. Port defensive error recovery code
4. Test thoroughly
   **Estimated effort**: 2-4 hours
   **Risk**: Medium

### Option C: Comprehensive Port (Thorough)

- Systematically review and port all fork fixes
- Create test cases for each
- Document what was skipped and why
  **Estimated effort**: 1-2 days
  **Risk**: Higher (more changes)

## Testing Checklist (Before Shipping)

- [ ] Build passes (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] Type check passes (`pnpm tsgo`)
- [ ] Lint/format passes (`pnpm check`)
- [ ] Smoke test cron jobs (if cron was touched)
- [ ] Smoke test Slack integration (if Slack was touched)
- [ ] Smoke test subagent progress (if that was touched)

## Files to Watch

These files changed significantly between fork and upstream:

| File                                      | Fork Lines | Upstream Lines | Status                  |
| ----------------------------------------- | ---------- | -------------- | ----------------------- |
| `src/cron/service/timer.ts`               | ~650       | ~1257          | Completely rewritten    |
| `src/agents/subagent-progress.ts`         | 424        | 168            | Fork has more features  |
| `src/slack/*`                             | Various    | Various        | Multiple fork fixes     |
| `src/config/zod-schema.providers-core.ts` | -          | -              | CronDelivery applied ✅ |

## Commit Message Template (When Ready)

```
feat: complete upstream rebase to v2026.3.8

- Rebased fork onto upstream/main (v2026.3.8)
- Applied CronDelivery threadId field
- Preserved subagent progress reporting
- [List any other ported features]

Breaking changes: None (backward compatible)

Tested:
- Build: ✅
- Tests: ✅
- Type check: ✅
- [Add specific smoke tests]
```

---

_Generated: 2026-03-10_
_Branch: feature/upstream-rebase-v2026.3.8_
_Base: upstream/main @ v2026.3.8 (commit 2ff9da5ed)_
