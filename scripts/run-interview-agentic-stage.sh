#!/usr/bin/env bash
set -euo pipefail

BOT_ID="${1:-${BOT_ID:-}}"
if [[ -z "$BOT_ID" ]]; then
  echo "Usage: scripts/run-interview-agentic-stage.sh <botId> [baseUrl]"
  exit 1
fi

BASE_URL="${2:-${BASE_URL:-https://btstage.voler.ai}}"
INTERVIEWEE_MODEL="${INTERVIEWEE_MODEL:-gpt-4o-mini}"
JUDGE_MODEL="${JUDGE_MODEL:-gpt-4.1}"
MAX_TURNS="${MAX_TURNS:-26}"
CLEANUP="${CLEANUP:-true}"
SCENARIO_FILTER="${SCENARIO_FILTER:-}"
OUTPUT_ROOT="${OUTPUT_ROOT:-/tmp/interview-agentic-regression-stage}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
OUTPUT_PREFIX="${OUTPUT_ROOT}-${RUN_ID}"
LOG_PATH="${OUTPUT_PREFIX}.log"

mkdir -p "$(dirname "$OUTPUT_PREFIX")"

CMD=(
  npm run test:interview:agentic --
  --botId "$BOT_ID"
  --baseUrl "$BASE_URL"
  --intervieweeModel "$INTERVIEWEE_MODEL"
  --judgeModel "$JUDGE_MODEL"
  --maxTurns "$MAX_TURNS"
  --cleanup "$CLEANUP"
  --outputPrefix "$OUTPUT_PREFIX"
)

if [[ -n "$SCENARIO_FILTER" ]]; then
  CMD+=(--scenario "$SCENARIO_FILTER")
fi

echo "RUN_ID=$RUN_ID" | tee "$LOG_PATH"
echo "LOG_PATH=$LOG_PATH" | tee -a "$LOG_PATH"
echo "OUTPUT_PREFIX=$OUTPUT_PREFIX" | tee -a "$LOG_PATH"
echo "BASE_URL=$BASE_URL" | tee -a "$LOG_PATH"
echo "BOT_ID=$BOT_ID" | tee -a "$LOG_PATH"
echo "SCENARIO_FILTER=${SCENARIO_FILTER:-all}" | tee -a "$LOG_PATH"
echo "COMMAND=${CMD[*]}" | tee -a "$LOG_PATH"

"${CMD[@]}" 2>&1 | tee -a "$LOG_PATH"

echo "REPORT_JSON=${OUTPUT_PREFIX}-"*.json | tee -a "$LOG_PATH"
echo "REPORT_MD=${OUTPUT_PREFIX}-"*.md | tee -a "$LOG_PATH"
