set -euo pipefail
for attempt in {1..120}; do
  if docker info >/dev/null 2>&1; then break; fi
  sleep 2
done
docker info >/dev/null
mkdir -p /app
cd /app
git init -q
git remote add origin "https://github.com/${GITHUB_REPOSITORY}.git"
git fetch --depth=1 origin "$GITHUB_SHA"
git checkout --detach FETCH_HEAD
test "$(git rev-parse HEAD)" = "$GITHUB_SHA"
mkdir -p packages/frontend/public
printf '{"sha":"%s"}\n' "$GITHUB_SHA" >packages/frontend/public/deployment.json
# Secrets arrive as exec environment variables, never command arguments or files.
docker compose -f packages/backend/docker-compose.yml up --build -d
for attempt in {1..90}; do
  if curl --fail --silent --max-time 5 http://127.0.0.1:3000/api/health >/dev/null && \
     curl --fail --silent --max-time 5 http://127.0.0.1:3000/ >/dev/null; then
    test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:3000/api/users)" = 401
    test "$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 http://127.0.0.1:3000/api/auth/discord)" = 302
    exit 0
  fi
  sleep 2
done
echo 'Application health check failed' >&2
exit 1
