# DigitalOcean App Platform

This repo is a monorepo. The deployable components are not in the repository root:

- Backend service: `backend`
- Frontend static site: `frontend`

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
