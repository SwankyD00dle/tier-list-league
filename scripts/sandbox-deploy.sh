set -euo pipefail
cd /app
# Also serialize remote executions if a GitHub job is cancelled while its exec continues.
exec 9>/tmp/tier-list-league-deploy.lock
flock -n 9

test "$(git branch --show-current)" = main
git diff --quiet
git diff --cached --quiet
compose=(docker compose -f packages/backend/docker-compose.yml)
"${compose[@]}" config --quiet
"${compose[@]}" stop frontend backend
git pull --ff-only origin main
# The existing Dockerfiles install workspace dependencies with npm ci.
"${compose[@]}" build
"${compose[@]}" run --rm --no-deps migrate
"${compose[@]}" up -d --no-deps --wait backend frontend
for attempt in {1..60}; do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/api/health >/dev/null && \
     curl --fail --silent --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    exit 0
  fi
  sleep 2
done
echo 'Application health check failed' >&2
exit 1
