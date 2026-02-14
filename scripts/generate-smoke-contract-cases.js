const fs = require('fs');
const path = require('path');

const { legacyRoutes } = require('../dist/src/modules/legacy-docs/openapi-routes.js');

const outputDir = path.join(__dirname, '..', 'test', 'contracts', 'cases-smoke');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    if (fs.statSync(filePath).isFile() && entry.endsWith('.json')) {
      fs.unlinkSync(filePath);
    }
  }
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildPath(pathTemplate) {
  return pathTemplate
    .replace('{id}', '1')
    .replace('{make}', 'BMW')
    .replace('{name}', 'autokorea.al')
    .replace('{lang}', 'en')
    .replace('{category}', 'cars')
    .replace('{appName}', 'autoconnect')
    .replace('{orderID}', 'LOCAL-1');
}

function buildBody(route) {
  const method = route.method.toUpperCase();
  const p = route.path;
  if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH') return undefined;

  if (p === '/authentication/login' || p === '/user/login') {
    return { email: 'parity@example.com', password: 'invalid-password' };
  }
  if (p === '/user/create-user') {
    return {
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
    };
  }
  if (p === '/user/reset-password') {
    return { email: 'parity@example.com' };
  }
  if (p === '/user/verify-password') {
    return { email: 'parity@example.com', verificationCode: '123456', newPassword: 'Password123' };
  }
  if (p === '/car-details/search' || p === '/car-details/result-count' || p === '/car-details/related-post-filter') {
    return { searchTerms: [], page: 0, maxResults: 12, promoPage: 0, type: 'car' };
  }
  if (p === '/car-details/price-calculate') {
    return { make: 'BMW', model: 'X5', registration: '2020', mileage: '100000', fuelType: 'Diesel' };
  }
  if (p === '/data/create-post' || p === '/data/update-post') {
    return {
      vendorId: '1',
      post: {
        id: '1',
        type: 'car',
        make: 'BMW',
        model: 'X5',
        price: 10000,
      },
    };
  }
  if (p === '/data/create-user-post') {
    return {
      post: {
        email: 'parity-user-post@example.com',
        name: 'Parity Poster',
        username: 'parity-poster',
        type: 'car',
        make: 'BMW',
        model: 'X5',
        price: 10000,
      },
    };
  }
  if (p === '/data/upload-image') {
    return {};
  }
  if (p === '/admin/user' || p === '/admin/user/change-password') {
    return {
      id: '1',
      name: 'Admin',
      username: 'admin',
      email: 'admin@example.com',
      password: 'Password123',
      rewritePassword: 'Password123',
      phone: '',
      whatsapp: '',
      location: '',
    };
  }
  if (
    p === '/admin/vendor/contact' ||
    p === '/admin/vendor/biography' ||
    p === '/admin/vendor/profile-picture'
  ) {
    return {
      contact: { phone_number: '', email: '', whatsapp: '' },
      biography: '',
      profilePicture: '',
    };
  }
  if (p === '/api/v1/orders') {
    return {
      post_id: '1',
      cart: [{ id: 1 }],
    };
  }

  return {};
}

function buildQuery(pathname) {
  if (pathname === '/favourites/check' || pathname === '/favourites/get') {
    return '?favourites=1,2,3';
  }
  if (pathname === '/data/article/en/1') {
    return '?app=autoconnect';
  }
  if (pathname === '/data/articles/en/1') {
    return '?page=1&app=autoconnect';
  }
  if (pathname === '/data/articles/en/1/total') {
    return '?app=autoconnect';
  }
  if (pathname === '/data/latest/articles/en') {
    return '?app=autoconnect';
  }
  if (pathname === '/data/related/articles/en/cars') {
    return '?app=autoconnect';
  }
  if (pathname === '/data/metadata/articles/en/1') {
    return '?app=autoconnect';
  }
  return '';
}

function buildCase(route) {
  const method = route.method.toUpperCase();
  const cleanPath = buildPath(route.path);
  const fullPath = `${cleanPath}${buildQuery(cleanPath)}`;
  const body = buildBody(route);
  const headers = {};

  const c = {
    name: `Smoke ${method} ${route.path}`,
    request: {
      method,
      path: fullPath,
    },
    compare: {
      status: true,
      envelope: true,
      values: false,
    },
  };

  if (body !== undefined) {
    c.request.body = body;
    headers['Content-Type'] = 'application/json';
  }

  if (route.security) {
    headers['X-Http-Authorization'] = 'Bearer invalid-token';
  }

  if (Object.keys(headers).length > 0) {
    c.request.headers = headers;
  }

  return c;
}

function main() {
  ensureDir(outputDir);
  cleanDir(outputDir);

  const routes = legacyRoutes.filter((r) => !['/docs', '/openapi.json'].includes(r.path));
  let count = 0;

  for (const route of routes) {
    const c = buildCase(route);
    const filename = `${String(count + 1).padStart(3, '0')}-${slugify(`${route.method}-${route.path}`)}.json`;
    fs.writeFileSync(path.join(outputDir, filename), `${JSON.stringify(c, null, 2)}\n`);
    count += 1;
  }

  console.log(`Generated ${count} smoke cases in ${outputDir}`);
}

main();
