# Planfit OpenClaw Fork

Planfit 내부용 OpenClaw 포크입니다. Claude Agent SDK 통합을 통해 타임아웃 문제를 해결합니다.

## 변경 사항

### Claude Agent SDK 통합

기존 subprocess 방식 대신 Claude Agent SDK를 사용하여 다음 문제를 해결합니다:

| 문제                     | 기존           | SDK 통합 후            |
| ------------------------ | -------------- | ---------------------- |
| 600초 타임아웃 → SIGKILL | ❌ 강제 종료   | ✅ 이벤트 기반, 불필요 |
| "살아있는지 모름"        | ❌ stdout 침묵 | ✅ yield하면 살아있음  |
| `--max-turns` 없음       | ❌ CLI 미지원  | ✅ SDK 내장            |
| stream-json 파이프 깨짐  | ❌ SIGPIPE     | ✅ SDK 내부 처리       |

## 설정

### 1. 환경 변수

```bash
# Anthropic API 키
export ANTHROPIC_API_KEY="your-api-key"

# 또는 Claude Pro/Max 구독 사용
# openclaw onboard 실행 시 설정
```

### 2. 타임아웃 설정 (선택)

`openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "timeoutSeconds": 1800
    }
  }
}
```

## 개발

### 빌드

```bash
pnpm install
pnpm build
```

### 테스트

```bash
pnpm test
```

### 로컬 실행

```bash
pnpm dev
```

## Upstream 동기화

```bash
# upstream 변경사항 가져오기
git fetch upstream

# main 브랜치에 병합
git merge upstream/main

# 충돌 해결 후 커밋
```

## 주요 파일

| 파일                            | 설명                         |
| ------------------------------- | ---------------------------- |
| `src/agents/timeout.ts`         | 타임아웃 설정 (600초 기본값) |
| `src/agents/bash-tools.exec.ts` | 명령 실행                    |
| `src/agents/`                   | 에이전트 핵심 로직           |

## 라이선스

MIT License (원본 OpenClaw 라이선스 유지)

원본 저장소: https://github.com/openclaw/openclaw
