# Upstream Sync — Cron 설정 가이드

OpenClaw fork를 upstream과 동기화하기 위한 자동 리포트 설정 가이드.

## 스크립트 위치

```
scripts/upstream-diff-report.sh
```

## 환경변수

| 변수           | 기본값                                     | 설명                |
| -------------- | ------------------------------------------ | ------------------- |
| `MERGE_BASE`   | `53fd26a96`                                | fork 분기점 커밋    |
| `UPSTREAM_REF` | `upstream/main`                            | upstream 브랜치     |
| `ORIGIN_REF`   | `origin/main`                              | fork 브랜치         |
| `UPSTREAM_URL` | `https://github.com/openclaw/openclaw.git` | upstream 저장소 URL |

## 수동 실행

```bash
# 기본 실행 (stdout 출력)
bash scripts/upstream-diff-report.sh

# 파일로 저장
bash scripts/upstream-diff-report.sh > reports/upstream-$(date +%Y%m%d).md 2>reports/upstream-$(date +%Y%m%d).log
```

## OpenClaw Cron Job 설정

OpenClaw의 내장 cron 시스템을 활용하여 매일 자동 실행할 수 있습니다.

### Agent 설정 예시

`config.yaml`에 cron job agent를 추가합니다:

```yaml
cron:
  upstream-sync-report:
    interval: "0 9 * * *" # 매일 오전 9시 (UTC)
    timezone: "Asia/Seoul" # KST 기준 → 오후 6시
    prompt: |
      Run the upstream diff report and summarize P0/P1 items.
      Command: bash scripts/upstream-diff-report.sh
    delivery:
      channel: slack
      target: "#dev-ops"
    timeout: 300 # 5분 타임아웃
```

### 시스템 crontab 방식 (대안)

서버에 직접 crontab을 설정하는 방식:

```bash
# crontab -e
# 매일 오전 9시 (UTC) 실행, Slack webhook으로 결과 전송
0 9 * * * cd /path/to/openclaw && bash scripts/upstream-diff-report.sh > /tmp/upstream-report.md 2>/tmp/upstream-report.log && curl -X POST -H 'Content-type: application/json' --data "{\"text\": \"$(cat /tmp/upstream-report.md | head -30)\"}" "$SLACK_WEBHOOK_URL"
```

### GitHub Actions 방식 (대안)

`.github/workflows/upstream-sync-report.yml`:

```yaml
name: Upstream Sync Report
on:
  schedule:
    - cron: "0 9 * * *" # 매일 09:00 UTC
  workflow_dispatch: # 수동 실행 가능

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Add upstream remote
        run: git remote add upstream https://github.com/openclaw/openclaw.git

      - name: Generate report
        run: bash scripts/upstream-diff-report.sh > report.md 2>report.log

      - name: Post to Slack (P0 items only)
        if: always()
        run: |
          P0_SECTION=$(sed -n '/## P0/,/^## /p' report.md | head -50)
          if [ -n "$P0_SECTION" ]; then
            curl -X POST -H 'Content-type: application/json' \
              --data "{\"text\": \"*Upstream Sync Report*\n\`\`\`${P0_SECTION}\`\`\`\"}" \
              "${{ secrets.SLACK_WEBHOOK_URL }}"
          fi

      - name: Upload report artifact
        uses: actions/upload-artifact@v4
        with:
          name: upstream-report-${{ github.run_number }}
          path: report.md
```

## 결과 확인

리포트에는 다음 섹션이 포함됩니다:

- **Summary**: 전체 통계 (총 커밋, 매칭 수, 카테고리별 수)
- **P0 — Security**: 즉시 적용이 필요한 보안 패치
- **P1 — Critical Fix**: 핵심 채널 버그 수정
- **P2 — Feature**: 관심 기능 추가
- **P3 — Other**: 기타 (상위 50개만 표시)

### P0 발견 시 대응

1. P0 커밋 목록 확인
2. `cherry-pick/upstream-security-p0` 브랜치 생성
3. 각 커밋을 cherry-pick하여 적용
4. `CHERRY_PICK_PROGRESS.md`에 진행 상황 기록
