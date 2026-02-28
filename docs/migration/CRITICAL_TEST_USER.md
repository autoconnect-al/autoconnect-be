# Critical Endpoint Test User (Local)

This user is reserved for parity/critical endpoint validation in local environments.

- Email: `critical.parity.user+local@autoconnect.test`
- Username: `critical.parity.user`
- Password: `CriticalParity#123`
- User ID: `987654321012345`

## How it is maintained

- Script: `/Users/reipano/Personal/vehicle-api/scripts/verify-critical-endpoints.js`
- The script upserts this user before running checks.
- It also ensures a related vendor row exists.

## What this user is used for

- Login validation (`POST /user/login`)
- Post creation as logged-out existing user (`POST /data/create-user-post`)
- Post creation as logged-in user (`POST /data/create-user-post` + `X-Http-Authorization`)

## Notes

- Local/dev only.
- Do not use this account for production.
