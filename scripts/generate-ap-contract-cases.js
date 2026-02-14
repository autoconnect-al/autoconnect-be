const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const groups = {
  'cases-ap-auth': [
    {
      name: 'AP auth login-with-code wrong code parity',
      request: { method: 'GET', path: '/authentication/login-with-code?code=invalid' },
      compare: {
        status: true,
        envelope: true,
        values: true,
        keys: ['success', 'message', 'statusCode'],
        ignorePaths: [],
      },
    },
  ],
  'cases-ap-admin': [
    ['GET', '/role-management'],
    ['POST', '/role-management/create-role'],
    ['POST', '/role-management/update-role/1'],
    ['DELETE', '/role-management/delete-role/1'],
    ['GET', '/role-management/role/1'],
    ['GET', '/user-management'],
    ['POST', '/user-management/create-user'],
    ['POST', '/user-management/update-user/1'],
    ['DELETE', '/user-management/delete-user/1'],
    ['GET', '/user-management/user/1'],
    ['GET', '/user-management/user/username/admin'],
    ['POST', '/vendor/update'],
    ['DELETE', '/vendor/delete/1'],
  ].map(([method, pathName]) => ({
    name: `AP admin guard parity ${method} ${pathName}`,
    request: {
      method,
      path: pathName,
      headers: {
        'X-Http-Authorization': 'Bearer invalid-token',
      },
      body: method === 'POST' ? {} : undefined,
    },
    compare: {
      status: true,
      envelope: true,
      values: true,
      keys: ['success', 'message', 'statusCode'],
      ignorePaths: [],
    },
  })),
  'cases-ap-tooling': [
    ['POST', '/post/save-post'],
    ['GET', '/post/scrape-posts'],
    ['GET', '/post/scrape-posts/create?vendorAccountName=test'],
    ['GET', '/post/scrape-posts/details'],
    ['POST', '/post/scrape-posts/update'],
    ['GET', '/post/scrape-posts/cleanPosts'],
    ['GET', '/post/scrape-posts/update-search'],
    ['GET', '/post/scrape-posts/fix-details'],
    ['GET', '/post/get-most-liked'],
    ['GET', '/post/auto-renew'],
    ['GET', '/post/posts?ids=1,2'],
    ['POST', '/post/update/1'],
    ['GET', '/vendor-management/all'],
    ['POST', '/vendor-management/add/1'],
    ['POST', '/vendor-management/add/details/1'],
    ['POST', '/vendor-management/edit/1'],
    ['GET', '/vendor-management/next-to-crawl'],
    ['GET', '/vendor-management/mark-vendor-for-crawl-next/1'],
    ['GET', '/vendor-management/toggle-deleted/1'],
    ['GET', '/car-details/generate-prompt'],
    ['GET', '/car-details/generate-prompt-fix-variant'],
    ['GET', '/car-details/generate-prompt-fix-registration'],
    ['GET', '/car-details/generate-prompt-fix-mileage'],
    ['GET', '/car-details/generate-prompt-fix-price'],
    ['GET', '/car-details/generate-prompt-fix-motorcycle-details'],
    ['GET', '/car-details/get-manual-draft-posts'],
    ['POST', '/car-details/import'],
    ['GET', '/car-details/clean-cache'],
    ['GET', '/make-model-data/makes'],
    ['GET', '/make-model-data/models/toyota'],
    ['GET', '/make-model-data/makes/motorcycle'],
    ['GET', '/make-model-data/models/motorcycle/yamaha'],
    ['GET', '/article/all'],
    ['POST', '/article/create'],
    ['POST', '/article/update/1'],
    ['GET', '/article/1'],
    ['GET', '/sitemap/generate'],
    ['GET', '/api/v1/orders/send-remind-emails'],
  ].map(([method, pathName]) => ({
    name: `AP code-gate parity ${method} ${pathName}`,
    request: {
      method,
      path: pathName,
      body: method === 'POST' ? {} : undefined,
    },
    compare: {
      status: true,
      envelope: true,
      values: true,
      keys: ['success', 'message', 'statusCode'],
      ignorePaths: [],
    },
  })),
};

for (const [dirName, rawCases] of Object.entries(groups)) {
  const dir = path.join(root, 'test', 'contracts', dirName);
  fs.mkdirSync(dir, { recursive: true });

  // Clear only generated files.
  for (const entry of fs.readdirSync(dir)) {
    if (entry.endsWith('.json')) {
      fs.unlinkSync(path.join(dir, entry));
    }
  }

  rawCases.forEach((testCase, index) => {
    const file = `${String(index + 1).padStart(3, '0')}.json`;
    fs.writeFileSync(path.join(dir, file), JSON.stringify(testCase, null, 2));
  });

  console.log(`Generated ${rawCases.length} AP contract cases in ${dirName}`);
}
