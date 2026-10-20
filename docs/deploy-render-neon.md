# Deploy backend on Render Free with Neon Free

This deploys only the NestJS API. The React frontend is not deployed.

## 1. Create the Neon database

1. In [Neon](https://console.neon.tech/), create a Free project. Choose a Singapore region if available; the Render Blueprint uses Singapore.
2. Create a database named `tiktok_simulator` in the project. The simulator's reset endpoint requires `simulator` in the database name.
3. Open **Connect**, select the `tiktok_simulator` database and its primary branch, and copy the **pooled** PostgreSQL connection string. Keep `sslmode=require` in the URL. A typical shape is:

   ```text
   postgresql://USER:PASSWORD@ep-EXAMPLE-pooler.REGION.aws.neon.tech/tiktok_simulator?sslmode=require
   ```

   Do not commit or paste the real URL into repository files. The URL contains the database password.

## 2. Create the Render service

1. Push this repository, including `render.yaml`, to the Git branch you want to deploy.
2. In [Render](https://dashboard.render.com/), choose **New > Blueprint** and connect that repository and branch.
3. Review the Blueprint: it must create **one Free Web Service** and no Render database or frontend service. Set the prompted `DATABASE_URL` to the Neon URL from step 1.
4. Deploy. The existing backend Dockerfile builds the API, runs `prisma migrate deploy` at each start, and starts NestJS on port 8090. Render supplies a public HTTPS URL.

The Blueprint generates `TEST_ADMIN_TOKEN` and `SEED_APP_SECRET` as secrets. In Render's service **Environment** page, retrieve them when configuring SmartOmni or making test-admin calls. Keep both private. `SEED_APP_KEY` is `smartomni-dev-app-key`. The Blueprint sets `PUBLIC_API_BASE_URL` to Render's public URL automatically.

For an existing Render Web Service created without the Blueprint, use **Docker** with Dockerfile path `backend/Dockerfile` and Docker build context `backend`, Free plan, health check `/health/ready`, and the environment variables in `render.yaml`. Set `PUBLIC_API_BASE_URL` to its actual `https://...onrender.com` URL.

## 3. Verify

Replace `<api-url>` with the full Render URL (for example, `https://example.onrender.com`):

```bash
curl -i <api-url>/health/ready
curl -i <api-url>/api-docs-json
```

The first endpoint should return HTTP 200 with `database: up`. A first request after idle may take roughly a minute while Render starts the Free service. If deployment fails, inspect Render's build and runtime logs; a malformed Neon URL, wrong database name, or migration error will appear there. Do not post logs containing credentials publicly.

## 4. Connect SmartOmni (when ready)

| SmartOmni setting | Value |
|---|---|
| `TIKTOK_OPEN_API_BASE_URL`, `TIKTOK_TOKEN_BASE_URL` | Render API URL |
| `TIKTOK_APP_KEY` | `SEED_APP_KEY` in Render |
| `TIKTOK_APP_SECRET` | `SEED_APP_SECRET` in Render |
| `TIKTOK_REDIRECT_URI` | The real, public SmartOmni callback URL |

Set `SEED_APP_REDIRECT_URIS` in Render to the exact `TIKTOK_REDIRECT_URI` used by SmartOmni, then redeploy so the idempotent seed updates the simulated app. If SmartOmni needs a seller authorization URL, that flow uses the frontend's `/seller/authorize` page, which is not included in this backend-only deployment. The API and token endpoints can still be tested separately. Webhook receiver URLs must be publicly reachable from Render; `localhost` on Render cannot reach a SmartOmni app running on your laptop.

## Free-tier behavior

- Render Free web services spin down after 15 minutes without inbound traffic and need time to wake. Background webhook processing stops while the service is asleep and resumes on wake. Do not depend on prompt delivery during idle periods.
- Render Free has an ephemeral filesystem. Generated product media and shipping PDFs under `/data` can disappear after a restart, deploy, or spin-down. PostgreSQL records in Neon persist. Durable files require a separate object-storage integration.
- Neon Free has usage and storage quotas. Check the current limits in the Neon console; large simulator logs and test data can consume storage.
- `/test-admin/*` is publicly reachable but requires `x-test-admin-token`. Protect that token. This is a fake-data simulator, not a production TikTok integration.

Official references: [Render Free limits](https://render.com/docs/free), [Render Blueprint spec](https://render.com/docs/blueprint-spec), [Neon with Prisma](https://neon.com/blog/better-postgres-with-prisma-experience).
