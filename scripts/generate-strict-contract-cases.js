const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'test', 'contracts', 'cases');

function write(name, payload) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, `${JSON.stringify(payload, null, 2)}\n`);
}

function commonCompare(includeResult = false) {
  const keys = ['success', 'message', 'statusCode'];
  if (includeResult) keys.push('result');
  return {
    status: true,
    envelope: true,
    values: true,
    keys,
    ignorePaths: [],
  };
}

const invalidAuthHeader = {
  'X-Http-Authorization': 'Bearer invalid-token',
};

const strictCases = [
  {
    file: 'strict-001-authentication-login-error.json',
    data: {
      name: 'Strict authentication/login error parity',
      request: { method: 'POST', path: '/authentication/login', body: { email: 'x', password: 'y' } },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-002-user-login-error.json',
    data: {
      name: 'Strict user/login error parity',
      request: { method: 'POST', path: '/user/login', body: { email: 'x', password: 'y' } },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-003-refresh-token-error.json',
    data: {
      name: 'Strict refresh-token error parity',
      request: { method: 'GET', path: '/user/refresh-token' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-004-instagram-no-code.json',
    data: {
      name: 'Strict instagram missing code parity',
      request: { method: 'GET', path: '/instagram-sync/get-access-token' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-005-search-error.json',
    data: {
      name: 'Strict search error parity',
      request: { method: 'POST', path: '/car-details/search', body: {} },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-006-price-calculate-error.json',
    data: {
      name: 'Strict price-calculate error parity',
      request: { method: 'POST', path: '/car-details/price-calculate', body: {} },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-007-most-wanted-error.json',
    data: {
      name: 'Strict most-wanted error parity',
      request: { method: 'GET', path: '/car-details/most-wanted' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-008-result-count-error.json',
    data: {
      name: 'Strict result-count error parity',
      request: { method: 'POST', path: '/car-details/result-count', body: {} },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-009-related-post-filter-error.json',
    data: {
      name: 'Strict related-post-filter error parity',
      request: { method: 'POST', path: '/car-details/related-post-filter', body: {} },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-010-data-vendor-route-error.json',
    data: {
      name: 'Strict data/vendors route parity',
      request: { method: 'GET', path: '/data/vendors/autokorea.al' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-011-data-vendor-bio-route-error.json',
    data: {
      name: 'Strict data/vendors/biography route parity',
      request: { method: 'GET', path: '/data/vendors/biography/autokorea.al' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-012-data-create-post-error.json',
    data: {
      name: 'Strict data/create-post error parity',
      request: {
        method: 'POST',
        path: '/data/create-post',
        body: { vendorId: '1', post: { id: '1', make: 'BMW', model: 'X5' } },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-013-data-update-post-error.json',
    data: {
      name: 'Strict data/update-post error parity',
      request: {
        method: 'POST',
        path: '/data/update-post',
        body: { vendorId: '1', post: { id: '1', make: 'BMW', model: 'X5' } },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-014-data-create-user-post-error.json',
    data: {
      name: 'Strict data/create-user-post error parity',
      request: {
        method: 'POST',
        path: '/data/create-user-post',
        body: { post: { email: 'parity-user-post@example.com', name: 'Parity Poster' } },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-015-favourites-get-error.json',
    data: {
      name: 'Strict favourites/get error parity',
      request: { method: 'GET', path: '/favourites/get?favourites=1,2,3' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-016-admin-posts-unauthorized.json',
    data: {
      name: 'Strict admin/posts unauthorized parity',
      request: { method: 'GET', path: '/admin/posts', headers: invalidAuthHeader },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-017-admin-post-by-id-unauthorized.json',
    data: {
      name: 'Strict admin/posts/{id} unauthorized parity',
      request: { method: 'GET', path: '/admin/posts/1', headers: invalidAuthHeader },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-018-admin-delete-unauthorized.json',
    data: {
      name: 'Strict admin/posts/delete unauthorized parity',
      request: { method: 'GET', path: '/admin/posts/delete/1', headers: invalidAuthHeader },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-019-admin-sold-unauthorized.json',
    data: {
      name: 'Strict admin/posts/sold unauthorized parity',
      request: { method: 'GET', path: '/admin/posts/sold/1', headers: invalidAuthHeader },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-020-admin-user-get-unauthorized.json',
    data: {
      name: 'Strict admin/user GET unauthorized parity',
      request: { method: 'GET', path: '/admin/user', headers: invalidAuthHeader },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-021-admin-user-post-unauthorized.json',
    data: {
      name: 'Strict admin/user POST unauthorized parity',
      request: { method: 'POST', path: '/admin/user', headers: invalidAuthHeader, body: { user: {} } },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-022-admin-change-password-unauthorized.json',
    data: {
      name: 'Strict admin/user/change-password unauthorized parity',
      request: {
        method: 'POST',
        path: '/admin/user/change-password',
        headers: invalidAuthHeader,
        body: { user: {} },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-023-admin-vendor-contact-unauthorized.json',
    data: {
      name: 'Strict admin/vendor/contact unauthorized parity',
      request: { method: 'POST', path: '/admin/vendor/contact', headers: invalidAuthHeader, body: { vendor: {} } },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-024-admin-vendor-biography-unauthorized.json',
    data: {
      name: 'Strict admin/vendor/biography unauthorized parity',
      request: {
        method: 'POST',
        path: '/admin/vendor/biography',
        headers: invalidAuthHeader,
        body: { vendor: {} },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-025-admin-vendor-profile-picture-unauthorized.json',
    data: {
      name: 'Strict admin/vendor/profile-picture unauthorized parity',
      request: {
        method: 'POST',
        path: '/admin/vendor/profile-picture',
        headers: invalidAuthHeader,
        body: { vendor: {} },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-026-orders-create-error.json',
    data: {
      name: 'Strict orders create error parity',
      request: { method: 'POST', path: '/api/v1/orders', body: { post_id: '1', cart: [{ id: 1 }] } },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-027-orders-capture-error.json',
    data: {
      name: 'Strict orders capture error parity',
      request: { method: 'POST', path: '/api/v1/orders/LOCAL-1/capture' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-028-user-create-error.json',
    data: {
      name: 'Strict user/create-user parity',
      request: {
        method: 'POST',
        path: '/user/create-user',
        body: {
          user: {
            name: 'Parity User',
            username: 'parity-user',
            email: 'parity-user@example.com',
            password: 'Password123',
            rewritePassword: 'Password123',
            phone: '',
            whatsapp: '',
            location: '',
          },
        },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-029-user-reset-password.json',
    data: {
      name: 'Strict user/reset-password parity',
      request: { method: 'POST', path: '/user/reset-password', body: { email: 'parity@example.com' } },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-030-user-verify-password.json',
    data: {
      name: 'Strict user/verify-password parity',
      request: {
        method: 'POST',
        path: '/user/verify-password',
        body: { email: 'parity@example.com', verificationCode: '123456', newPassword: 'Password123' },
      },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-031-car-details-post.json',
    data: {
      name: 'Strict car-details/post parity',
      request: { method: 'GET', path: '/car-details/post/1' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-032-car-details-post-caption.json',
    data: {
      name: 'Strict car-details/post/caption parity',
      request: { method: 'GET', path: '/car-details/post/caption/1' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-033-car-details-related-post.json',
    data: {
      name: 'Strict car-details/related-post parity',
      request: { method: 'GET', path: '/car-details/related-post/1' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-034-sitemap-get-sitemap.json',
    data: {
      name: 'Strict sitemap/get-sitemap parity',
      request: { method: 'GET', path: '/sitemap/get-sitemap/autoconnect' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-035-data-models.json',
    data: {
      name: 'Strict data/models/{make} parity',
      request: { method: 'GET', path: '/data/models/BMW' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-036-data-makes-motorcycles.json',
    data: {
      name: 'Strict data/makes/motorcycles parity',
      request: { method: 'GET', path: '/data/makes/motorcycles' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-037-data-models-motorcycles.json',
    data: {
      name: 'Strict data/models/motorcycles/{make} parity',
      request: { method: 'GET', path: '/data/models/motorcycles/BMW' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-038-data-article.json',
    data: {
      name: 'Strict data/article/{lang}/{id} parity',
      request: { method: 'GET', path: '/data/article/en/1?app=autoconnect' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-039-data-articles.json',
    data: {
      name: 'Strict data/articles/{lang}/{id} parity',
      request: { method: 'GET', path: '/data/articles/en/1?page=1&app=autoconnect' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-040-data-articles-total.json',
    data: {
      name: 'Strict data/articles/{lang}/{id}/total parity',
      request: { method: 'GET', path: '/data/articles/en/1/total?app=autoconnect' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-041-data-latest-articles.json',
    data: {
      name: 'Strict data/latest/articles/{lang} parity',
      request: { method: 'GET', path: '/data/latest/articles/en?app=autoconnect' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-042-data-related-articles.json',
    data: {
      name: 'Strict data/related/articles/{lang}/{category} parity',
      request: { method: 'GET', path: '/data/related/articles/en/cars?app=autoconnect' },
      compare: commonCompare(false),
    },
  },
  {
    file: 'strict-043-data-metadata-articles.json',
    data: {
      name: 'Strict data/metadata/articles/{lang}/{id} parity',
      request: { method: 'GET', path: '/data/metadata/articles/en/1?app=autoconnect' },
      compare: commonCompare(false),
    },
  },
];

for (const c of strictCases) {
  write(c.file, c.data);
}

console.log(`Generated ${strictCases.length} strict cases in ${outDir}`);
