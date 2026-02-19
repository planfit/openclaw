#!/usr/bin/env bash
# upstream-diff-report.sh — Upstream diff 분류 리포트 생성
# 의존성: git, bash 3.2+ (macOS 기본 호환)
# 출력: stdout → markdown
set -euo pipefail

# ── 설정 ─────────────────────────────────────────────────────────
MERGE_BASE="${MERGE_BASE:-53fd26a96}"
UPSTREAM_REF="${UPSTREAM_REF:-upstream/main}"
ORIGIN_REF="${ORIGIN_REF:-origin/main}"
UPSTREAM_URL="${UPSTREAM_URL:-https://github.com/openclaw/openclaw.git}"

# ── 임시 파일 ────────────────────────────────────────────────────
TMPDIR_REPORT=$(mktemp -d)
trap 'rm -rf "$TMPDIR_REPORT"' EXIT

FORK_SUBJECTS_FILE="${TMPDIR_REPORT}/fork_subjects.txt"
P0_FILE="${TMPDIR_REPORT}/p0.txt"
P1_FILE="${TMPDIR_REPORT}/p1.txt"
P2_FILE="${TMPDIR_REPORT}/p2.txt"
P3_FILE="${TMPDIR_REPORT}/p3.txt"

touch "$FORK_SUBJECTS_FILE" "$P0_FILE" "$P1_FILE" "$P2_FILE" "$P3_FILE"

# ── 로깅 ─────────────────────────────────────────────────────────
log() { echo "[upstream-diff] $*" >&2; }

# ── 정규화 함수 ──────────────────────────────────────────────────
normalize_subject() {
  echo "$1" | sed -E 's/\(#[0-9]+\)//g' | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sed -E 's/[[:space:]]+/ /g'
}

# ── 1. upstream fetch ────────────────────────────────────────────
if ! git remote get-url upstream &>/dev/null; then
  log "upstream remote 추가: ${UPSTREAM_URL}"
  git remote add upstream "${UPSTREAM_URL}"
fi
log "Fetching upstream..."
git fetch upstream --quiet 2>/dev/null || git fetch upstream 2>&1 | head -5 >&2
git fetch origin --quiet 2>/dev/null || true

# ── 2. fork subject 수집 (정규화 → 파일) ─────────────────────────
log "Fork 커밋 수집 (${MERGE_BASE}..${ORIGIN_REF})..."
while IFS= read -r line; do
  normalize_subject "$line"
done < <(git log --format='%s' "${MERGE_BASE}..${ORIGIN_REF}" 2>/dev/null) | sort -u > "$FORK_SUBJECTS_FILE"

FORK_COUNT=$(wc -l < "$FORK_SUBJECTS_FILE" | tr -d ' ')
log "Fork 커밋 ${FORK_COUNT}개 수집 완료"

# ── 3. 분류 키워드 ──────────────────────────────────────────────
P0_PATTERN='security|harden|OC-|SSRF|ssrf|sandbox|credential|vulnerab|CVE-|exploit|injection|traversal|overflow'
P1_FIX_CHANNELS='slack|telegram|gateway|session|cron|compaction|memory|delivery|agent'
REMOVED_CHANNELS='whatsapp|discord|instagram|facebook|messenger|twitter|line|viber|wechat|signal|matrix|rocket|teams|google.?chat|zulip|mattermost|gotify|ntfy|pushover|pushbullet|simplepush|apprise'
P2_FEAT_CHANNELS='slack|telegram|model|provider|ui|plugin|tool|mcp|api'

# ── 4. upstream 커밋 순회 + 분류 ─────────────────────────────────
log "Upstream 커밋 분류 (${MERGE_BASE}..${UPSTREAM_REF})..."
TOTAL_UPSTREAM=0
SKIP_CHERRY=0
SKIP_REMOVED=0

while IFS=$'\t' read -r hash subject; do
  TOTAL_UPSTREAM=$((TOTAL_UPSTREAM + 1))

  normalized=$(normalize_subject "$subject")
  lower_subject=$(echo "$subject" | tr '[:upper:]' '[:lower:]')

  # cherry-pick 매칭 (정규화된 subject가 fork에 있는지)
  if grep -qFx "$normalized" "$FORK_SUBJECTS_FILE" 2>/dev/null; then
    SKIP_CHERRY=$((SKIP_CHERRY + 1))
    continue
  fi

  # P0: 보안 키워드
  if echo "$lower_subject" | grep -qE "$P0_PATTERN"; then
    printf '%s\t%s\n' "$hash" "$subject" >> "$P0_FILE"
    continue
  fi

  # P1: fix + 핵심 채널
  if echo "$lower_subject" | grep -qE '^fix' && echo "$lower_subject" | grep -qE "$P1_FIX_CHANNELS"; then
    printf '%s\t%s\n' "$hash" "$subject" >> "$P1_FILE"
    continue
  fi

  # 제거된 채널 → SKIP
  if echo "$lower_subject" | grep -qE "$REMOVED_CHANNELS"; then
    SKIP_REMOVED=$((SKIP_REMOVED + 1))
    continue
  fi

  # P2: feat + 관심 채널
  if echo "$lower_subject" | grep -qE '^feat' && echo "$lower_subject" | grep -qE "$P2_FEAT_CHANNELS"; then
    printf '%s\t%s\n' "$hash" "$subject" >> "$P2_FILE"
    continue
  fi

  # P3: 나머지
  printf '%s\t%s\n' "$hash" "$subject" >> "$P3_FILE"
done < <(git log --format='%h%x09%s' "${MERGE_BASE}..${UPSTREAM_REF}" 2>/dev/null)

P0_COUNT=$(wc -l < "$P0_FILE" | tr -d ' ')
P1_COUNT=$(wc -l < "$P1_FILE" | tr -d ' ')
P2_COUNT=$(wc -l < "$P2_FILE" | tr -d ' ')
P3_COUNT=$(wc -l < "$P3_FILE" | tr -d ' ')

log "총 ${TOTAL_UPSTREAM}개 커밋 분류 완료"

# ── 5. 마크다운 출력 ────────────────────────────────────────────
P3_LIMIT=50
NOW=$(date -u '+%Y-%m-%d %H:%M UTC')

cat <<EOF
# Upstream Diff Report

> Generated: ${NOW}
> Merge base: \`${MERGE_BASE}\`
> Upstream: \`${UPSTREAM_REF}\` | Origin: \`${ORIGIN_REF}\`

## Summary

| Category | Count | Description |
|----------|-------|-------------|
| Total upstream | ${TOTAL_UPSTREAM} | ${MERGE_BASE} 이후 전체 upstream 커밋 |
| Already in fork | ${SKIP_CHERRY} | cherry-pick / 동일 subject 매칭 |
| Removed channels | ${SKIP_REMOVED} | 제거된 채널 관련 (무시) |
| **P0 — Security** | **${P0_COUNT}** | 보안 패치 (즉시 적용 필요) |
| **P1 — Critical Fix** | **${P1_COUNT}** | 핵심 채널 버그 수정 |
| **P2 — Feature** | **${P2_COUNT}** | 관심 기능 추가 |
| P3 — Other | ${P3_COUNT} | 기타 |

EOF

print_commit_table() {
  local label="$1"
  local file="$2"
  local count
  count=$(wc -l < "$file" | tr -d ' ')

  if [ "$count" -eq 0 ]; then
    return
  fi

  echo "## ${label}"
  echo ""
  echo "| # | Commit | Subject |"
  echo "|---|--------|---------|"

  local i=1
  while IFS=$'\t' read -r hash subject; do
    echo "| ${i} | \`${hash}\` | ${subject} |"
    i=$((i + 1))
  done < "$file"
  echo ""
}

print_commit_table "P0 — Security (즉시 적용)" "$P0_FILE"
print_commit_table "P1 — Critical Fix (핵심 채널)" "$P1_FILE"
print_commit_table "P2 — Feature (관심 기능)" "$P2_FILE"

# P3는 limit 적용
if [ "$P3_COUNT" -gt 0 ]; then
  echo "## P3 — Other (상위 ${P3_LIMIT}개)"
  echo ""
  echo "| # | Commit | Subject |"
  echo "|---|--------|---------|"

  i=1
  while IFS=$'\t' read -r hash subject; do
    if [ "$i" -gt "$P3_LIMIT" ]; then
      echo "| ... | | _${P3_COUNT} 중 ${P3_LIMIT}개만 표시_ |"
      break
    fi
    echo "| ${i} | \`${hash}\` | ${subject} |"
    i=$((i + 1))
  done < "$P3_FILE"
  echo ""
fi

echo "---"
echo "_Report generated by \`scripts/upstream-diff-report.sh\`_"
