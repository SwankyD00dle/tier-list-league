# GitHub Actions sandbox deployment

[Deploy sandbox](../.github/workflows/deploy.yml) validates each main commit, then builds
that exact commit in a fresh platform sandbox using the existing Docker Compose setup.
PostgreSQL, migrations, backend and frontend run there after the GitHub job ends.
The workflow switches the existing public endpoint to port 3000 only after the app
passes its internal health checks, then verifies the deployed commit through the endpoint.

## One-time setup

Create a GitHub environment named `sandbox` under **Settings → Environments**. Restrict
its deployment branches to `main`. Add these environment secrets:

| Secret | Value |
| --- | --- |
| `PLATFORM_API_KEY` | Organization API key created with `configId: platform`, with sandbox read/write, exec read/write and ingress read/write access in the endpoint's organization. |
| `DISCORD_CLIENT_ID` | Discord application's OAuth client ID. |
| `DISCORD_CLIENT_SECRET` | Discord application's OAuth client secret. |
| `JWT_SECRET` | A stable random signing secret, e.g. generated with `openssl rand -hex 32`. |

Add these environment variables:

| Variable | Value |
| --- | --- |
| `PLATFORM_ENDPOINT_ID` | Existing public endpoint ID. For the current app: `b3c6c82e-2f51-4734-88a6-b1ebd7f3e4c4`. |
| `PLATFORM_API_URL` | Optional; defaults to `https://platform.adaptstaging.com`. |

The endpoint must be public HTTPS at the domain root. The script reads its URL from
the platform rather than storing another copy in GitHub. For the current endpoint,
register this redirect in the Discord developer portal:

```text
https://b3c6c82e-2f51-4734-88a6-b1ebd7f3e4c4.adapt.link/api/auth/discord/callback
```

Merge to `main` to deploy, or select **Actions → Deploy sandbox → Run workflow** on
`main`. Deployments are serialized. Missing settings fail before a sandbox is created.
The repository must remain publicly cloneable; the sandbox fetches the exact commit
from GitHub without a GitHub token. Do not expose the platform API key to the sandbox:
only the app secrets are sent through the platform's exec environment.

## Cost and lifetime

The workflow uses standard `ubuntu-24.04` GitHub-hosted runners. These are free for
this public repository; it does not use larger runners, artifact uploads or Actions
caches. If the repository becomes private, revisit the included minutes and billing
before enabling this workflow. See [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Platform sandbox/endpoint charges are separate from GitHub Actions.

Each deployment creates a sandbox with 2 CPUs, 4 GiB RAM, 30 GiB disk and no automatic
expiry. Docker runs as its startup process using the `vfs` storage driver because
nested overlay mounts are unavailable on this platform. PostgreSQL uses the existing
Compose volume inside that sandbox. **Every successful deployment starts with an
empty database**; sandbox replacement does not preserve users, games or sessions.

## Failure and cleanup

A build failure leaves the endpoint on its previous sandbox. If public verification
fails after switching, the script attempts to restore the previous binding before
removing the failed candidate. It retains the candidate if rollback cannot be
confirmed, so cleanup cannot intentionally delete the sandbox still serving the app.
The workflow logs sandbox and exec IDs, but does not print remote exec output, which
may contain sensitive application data. Inspect that output through the platform
when diagnosing a failed build.

After success, only the previous sandbox labeled as owned by this workflow and
repository is deleted. The first deployment retains the manually provisioned sandbox
`987928ec-eada-4c28-8cfe-72686f1d5268`; delete it through the platform after verifying
the new deployment. Do not delete the stable endpoint.

A forcibly cancelled job, runner failure or lost create response can leave a sandbox
behind. Inspect platform sandboxes labeled `owner=tier-list-league-actions` and the
commit/repository labels; verify the endpoint binding before deleting any orphan.
Avoid manually rebinding the endpoint during deployment: the script checks for
changes before switching, but the API does not offer an atomic compare-and-swap.

The deployment orchestration has isolated tests:

```bash
node --test scripts/deploy-sandbox.test.mjs
```

The workflow also runs formatting/lint checks, typechecks, workspace unit tests and
real PostgreSQL integration tests before deployment. A full deployment requires the
GitHub environment credentials; the isolated tests do not provision infrastructure.
