# DigitalOcean App Platform

This repo is a monorepo. The deployable components are not in the repository root:

- Backend service: `backend`
- Frontend static site: `frontend`

To make DigitalOcean's auto-detector happier, the repo root now also includes:

- [package.json](C:/Users/zacha/Documents/zach%20docs/liquor-pos-system/package.json)

That lets App Platform detect the repository as a Node app even if it does not immediately pick up the monorepo structure.

To avoid the "No components detected" error, use the included app spec:

- App spec file: [.do/app.yaml](C:/Users/zacha/Documents/zach%20docs/liquor-pos-system/.do/app.yaml)

## What The Spec Creates

- `api`: Node.js web service from `backend`
- `web`: static site from `frontend`
- ingress routing:
  - `/api` -> backend
  - `/` -> frontend
- region: `blr`
- GitHub branch: `master`

Because both components share the same app domain, the frontend uses:

- `VITE_API_URL=/api`

and the backend uses:

- `FRONTEND_URL=${APP_URL}`

## Before You Deploy

Replace these placeholder secrets in the spec or in the App Platform UI:

- `MONGODB_URI`
- `JWT_SECRET`
- `SMTP_USER`
- `SMTP_PASS`

These values are already mapped in the spec because your backend expects them:

- `NODE_ENV=production`
- `PORT=8080`
- `JWT_EXPIRE=7d`
- `FRONTEND_URL=${APP_URL}`
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `MAIL_FROM=Liquor POS Admin <no-reply@example.com>`

## How To Deploy

### Option A: Easiest Control Panel Path

Use the repo root as a single web service:

1. In App Platform, choose the repository root.
2. Let DigitalOcean detect the root `package.json`.
3. Set build command to:
   `npm run build`
4. Set run command to:
   `npm start`
5. Set HTTP port to:
   `8080`

This works because the backend already serves `frontend/dist` in production after the frontend build completes.

### Option B: App Spec / Split Components

1. In DigitalOcean App Platform, create a new app from GitHub.
2. Choose the repository `zachariachesoni/liquor-pos`.
3. Use the app spec in `.do/app.yaml` if prompted, or create the app from spec via CLI/API.
4. Set the secret values for `MONGODB_URI`, `JWT_SECRET`, `SMTP_USER`, and `SMTP_PASS`.
5. Deploy.

## Notes

- The frontend is configured as a static site with `catchall_document: index.html` so React routing works.
- The backend health check is `GET /api/health`.
- The spec uses `blr`, which is a current App Platform region and a reasonable regional fit for East Africa.
- If you later rename the GitHub branch from `master`, update `.do/app.yaml` as well.
