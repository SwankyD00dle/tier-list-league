set -euo pipefail
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  docker.io docker-compose-v2 docker-buildx git curl ca-certificates
mkdir -p /etc/docker
# Overlay mounts are unavailable inside the platform sandbox.
printf '%s\n' '{"storage-driver":"vfs","features":{"containerd-snapshotter":false}}' >/etc/docker/daemon.json
# The startup process owns the sandbox lifetime; keep Docker in the foreground.
exec dockerd
