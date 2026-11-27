# GitHub Actions deployment

On a push to `main` (including a merged PR), [Deploy sandbox](../.github/workflows/deploy.yml)
validates the code and executes `sandbox-deploy.sh` in your existing sandbox:

1. Stop the frontend and backend with Docker Compose, leaving PostgreSQL running.
2. Run `git pull --ff-only origin main` in `/app`.
3. Rebuild the Compose images. Their existing Dockerfiles use `npm ci` to install dependencies.
4. Run database migrations with the migration container.
5. Start the backend and frontend and check the homepage and API health.

The app is unavailable during deployment. A failed pull, build or migration stops
the deployment and leaves the app stopped for manual recovery. There is no rollback.
The script pulls the latest `main` when it executes, which may include newer merges
than the commit that triggered the workflow.

## Manual sandbox preparation

Prepare the sandbox and endpoint yourself before enabling deployment:

- Keep the sandbox running with Docker, the Compose plugin, Git, Bash, `flock` and curl available.
- Clone this repository into `/app`, check out `main`, and keep the checkout clean.
  Configure Git access there if the repository needs credentials.
- Create `/app/packages/backend/.env.compose` with the app's environment variables,
  including `APP_PUBLIC_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `JWT_SECRET`.
  See the [Compose setup](../packages/backend/README.md#run-the-full-app-with-docker-compose).
- Start the Compose stack using that env file and the default Compose project name.
  PostgreSQL must already be running when the deployment executes.
- Bind the public endpoint to port 3000 and register its Discord OAuth callback URL.
- Ensure platform execs can access `/app` and Docker. Deployments run as the sandbox's default user.

The workflow does not create, start, delete or reconfigure sandboxes or endpoints.
App secrets remain on the sandbox. PostgreSQL's existing Compose volume is reused.

## GitHub configuration

Create the GitHub environment `sandbox`, restrict deployment branches to `main`,
and add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `PLATFORM_API_KEY` | Organization API key created with `configId: platform`, authorized to execute commands in the sandbox and read execution status. |
| `PLATFORM_SANDBOX_ID` | ID of the running, manually prepared sandbox. |

Optionally set the environment variable `PLATFORM_API_URL`; it defaults to
`https://platform.adaptstaging.com`.

Merge to `main` to deploy, or run **Actions → Deploy sandbox → Run workflow** on `main`.
PRs run validation only. GitHub serializes deployments, and a sandbox-side lock
prevents overlapping remote executions if a job is cancelled. The workflow logs the
exec ID for diagnostics; inspect its output in the platform when a deployment fails.
A remote exec can continue after GitHub cancellation, so inspect it before retrying.

Standard `ubuntu-24.04` runners are free for this public repository. The workflow
uses no Actions caches or artifact uploads. Platform costs are separate. Revisit
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
if the repository becomes private.

## Validation

```bash
node --test scripts/deploy-sandbox.test.mjs
```

The workflow also runs formatting/lint checks, typechecks, unit tests and PostgreSQL
integration tests. Deployment tests use fake commands and API responses; they do not
change the live app.
