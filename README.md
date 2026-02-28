# vehicle-api (PHP parity rewrite)

This branch (`codex/php-parity-rewrite`) is a fresh NestJS rewrite focused on parity with:
- `/Users/reipano/Personal/tregu-makinave`

## Setup

1. Install dependencies
```bash
npm install
```

2. Pull Prisma schema from local MySQL snapshot
```bash
npm run prisma:pull
npm run prisma:generate
```

3. Start API
```bash
npm run start:dev
```

## Integration Tests (Ephemeral MySQL)

Node 20 is required for integration tests.

### Local run

1. Use Node 20
```bash
nvm use 20
```

2. Start disposable MySQL
```bash
npm run test:int:db:up
```

3. Run integration tests (migrations + tests)
```bash
npm run test:int
```

4. Tear down disposable MySQL
```bash
npm run test:int:db:down
```

### Environment contract

Defaults are provided by `test/integration/setup.ts`, including:
- `DATABASE_URL` (default: `mysql://root:rootroot@127.0.0.1:3307/vehicle_api_int`)
- `JWT_SECRET`
- `INSTAGRAM_CLIENT_ID`
- `INSTAGRAM_CLIENT_SECRET`
- `INSTAGRAM_REDIRECT_URI`
- `AP_ADMIN_CODE`
- `CODE`
- `ADMIN_CODE`
- `DOCS_ACCESS_CODE`
- `AUTOCONNECT_BASE_URL`
- `AUTOCONNECT_CODE`
- `IMPORT_QUEUE_ENABLED=false`

Outbound network is blocked during integration tests by default.
To allow it temporarily:
```bash
ALLOW_OUTBOUND_NETWORK=true npm run test:int
```

### Troubleshooting

- If migration/test startup fails right after DB up, rerun `npm run test:int`.
- If port `3307` is occupied, stop the conflicting process or override `DATABASE_URL`.
- If Docker resources are stale, run `npm run test:int:db:down` and then `npm run test:int:db:up`.

## Legacy Docs Gate

Set:
```bash
export DOCS_ACCESS_CODE="your-secret-code"
```

Then access:
- `/docs?code=your-secret-code`
- `/openapi.json?code=your-secret-code`

## AP Admin/Tooling Code Gate

AP-backoffice and scraper compatibility routes require query `code` and use:
```bash
export CODE="your-secret-code"
```

Examples:
- `/authentication/login-with-code?code=your-secret-code`
- `/post/get-most-liked?code=your-secret-code`
- `/vendor-management/all?code=your-secret-code`
- `/car-details/generate-prompt?code=your-secret-code`

## AP Endpoint Ownership Matrix

Generate AP endpoint ownership matrix:
```bash
npm run contract:matrix:ap
```

Output:
- `docs/migration/ap-endpoint-matrix.json`

## Test Strategy

Contract diff suites are deprecated and removed from active workflows.  
Integration tests (`npm run test:int`) are the parity and regression source of truth.

## Deferred Proxy Groups

See:
- `docs/migration/DEFERRED_PROXY_GROUPS.md`
