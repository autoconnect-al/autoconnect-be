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

## Contract Diff Runner

Run both services locally:
- PHP legacy backend (default expected at `http://localhost:8000`)
- Nest rewrite (default expected at `http://localhost:3000`)

Then execute:
```bash
npm run contract:diff
```

Override base URLs if needed:
```bash
PHP_BASE_URL=http://localhost:8080 NEST_BASE_URL=http://localhost:3001 npm run contract:diff
```

Report output:
- `test/contracts/report.json`

### AP Endpoint Contract Suites

Generate AP case fixtures:
```bash
npm run contract:cases:ap
```

Run AP suites independently:
```bash
npm run contract:diff:ap:auth
npm run contract:diff:ap:admin
npm run contract:diff:ap:tooling
```

Generate AP endpoint ownership matrix:
```bash
npm run contract:matrix:ap
```

Output:
- `docs/migration/ap-endpoint-matrix.json`

## Deferred Proxy Groups

See:
- `docs/migration/DEFERRED_PROXY_GROUPS.md`
