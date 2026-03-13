# ATC-20 Backend Dependency Refresh

## Summary

- Branch: `codex/atc-20-dependency-refresh`
- Version bump: `1.2.28` -> `1.2.29`
- Audit baseline: `27` vulnerabilities (`10 high`, `15 moderate`, `2 low`)
- Audit result: `17` vulnerabilities (`4 high`, `13 moderate`)

## Updated Packages

- Nest/runtime: `@nestjs/common`, `@nestjs/config`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, `bullmq`, `dotenv`, `mariadb`, `multer`, `resend`
- Prisma stack was tested on `7.5.0` and rolled back to `@prisma/adapter-mariadb@7.3.0`, `@prisma/client@7.2.0`, `prisma@7.2.0` because payment capture integration tests regressed on the newer patch line
- Tooling: `@eslint/eslintrc`, `@eslint/js`, `@nestjs/testing`, `@types/multer`, `eslint`, `typescript-eslint`
- Lockfile/transitives were refreshed with `npm audit fix`

## Validation

- `npm run test`
- `npm run test:int`
- `npm audit`

## Deferred Items

- Prisma still pulls `@prisma/dev` advisories (`hono`, `@hono/node-server`, `lodash` via `@mrleebo/prisma-ast`). The available audit fix downgrades Prisma to `6.19.2`, which is a breaking major direction from the current `7.x` stack and was not applied.
- Prisma `7.5.0` also caused `write-and-payments.int-spec.ts` payment capture failures in this repo, so the implementation stayed on the known-safe `7.2.0`/`7.3.0` combination.
- Nest CLI/schematics advisories remain tied to `@angular-devkit/*` and the available `npm audit fix --force` path downgrades `@nestjs/cli` / `@nestjs/schematics` to older majors. That path was intentionally not taken.
- `@nestjs/common` still reports a `file-type` advisory even on the latest available `11.1.x` line in this repo.
