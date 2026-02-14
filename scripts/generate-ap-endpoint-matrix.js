const fs = require('fs');
const path = require('path');

const auditPath = '/Users/reipano/Personal/tregu-makinave/admin-endpoints-audit.json';
const outPath = path.join(__dirname, '..', 'docs', 'migration', 'ap-endpoint-matrix.json');

const audit = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
const endpoints = audit.allAdminEndpoints || [];

function classify(pathName) {
  if (pathName.startsWith('/api/v1/save-post')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'internal', target: 'legacy-group-b' };
  if (pathName.startsWith('/api/v1/create-user-and-post')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'internal', target: 'legacy-group-b+legacy-group-a' };
  if (pathName.startsWith('/api/v1/post/')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'jwt', target: 'legacy-group-b' };
  if (pathName.startsWith('/api/v1/user/edit')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'jwt', target: 'legacy-group-a' };
  if (pathName.startsWith('/api/v1/user/change-password')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'jwt', target: 'legacy-group-a' };
  if (pathName.startsWith('/api/v1/vendor/')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'jwt', target: 'legacy-group-a' };
  if (pathName.startsWith('/api/v1/user/reset-password')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'public', target: 'legacy-group-a' };
  if (pathName.startsWith('/api/v1/user/update-password')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'public', target: 'legacy-group-a' };

  if (pathName.startsWith('/authentication/login-with-code')) return { caller: 'ap-frontend,scraper', exposure: 'public', auth: 'code', target: 'legacy-ap-auth' };
  if (pathName.startsWith('/user/signup')) return { caller: 'internal-only', exposure: 'internal-only', auth: 'public', target: 'legacy-group-a' };

  if (pathName.startsWith('/role-management') || pathName.startsWith('/user-management') || pathName.startsWith('/vendor/update') || pathName.startsWith('/vendor/delete')) {
    return { caller: 'ap-backoffice', exposure: 'public', auth: 'jwt-admin', target: 'legacy-ap-admin' };
  }

  if (
    pathName.startsWith('/post/') ||
    pathName.startsWith('/vendor-management/') ||
    pathName.startsWith('/car-details/generate') ||
    pathName.startsWith('/car-details/get-manual-draft-posts') ||
    pathName.startsWith('/car-details/import') ||
    pathName.startsWith('/car-details/clean-cache') ||
    pathName.startsWith('/make-model-data/') ||
    pathName.startsWith('/article/') ||
    pathName.startsWith('/sitemap/generate') ||
    pathName.startsWith('/api/v1/orders/send-remind-emails')
  ) {
    return { caller: 'ap-frontend,scraper', exposure: 'public', auth: 'code', target: 'legacy-ap-admin' };
  }

  if (pathName.startsWith('/api/v1/orders') || pathName.startsWith('/authentication/login')) {
    return { caller: 'fe', exposure: 'public', auth: 'public', target: 'legacy-payments/legacy-auth' };
  }

  return { caller: 'unknown', exposure: 'review', auth: 'review', target: 'review' };
}

const matrix = endpoints.map((endpoint) => ({
  method: endpoint.method,
  path: endpoint.path,
  sourceFile: endpoint.sourceFile,
  migratedToVehicleApi: endpoint.migratedToVehicleApi,
  ...classify(endpoint.path),
}));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceAudit: auditPath,
      total: matrix.length,
      matrix,
    },
    null,
    2,
  ),
);

console.log(`Wrote AP endpoint matrix: ${outPath}`);
