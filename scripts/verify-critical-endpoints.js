const fs = require('fs');
const path = require('path');
const mariadb = require('mariadb');

const phpBaseUrl = process.env.PHP_BASE_URL || 'http://127.0.0.1:8000';
const nestBaseUrl = process.env.NEST_BASE_URL || 'http://127.0.0.1:3000';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'rootroot',
  database: process.env.DB_NAME || 'tregu_makinave',
};

const mediaRoot = path.resolve(__dirname, '..', 'media');

const testUser = {
  id: '987654321012345',
  email: 'critical.parity.user+local@autoconnect.test',
  username: 'critical.parity.user',
  name: 'Critical Parity User',
  password: 'CriticalParity#123',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function pickEnvelopeShape(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return {
    hasSuccess: Object.prototype.hasOwnProperty.call(payload, 'success'),
    hasResult: Object.prototype.hasOwnProperty.call(payload, 'result'),
    hasMessage: Object.prototype.hasOwnProperty.call(payload, 'message'),
    hasStatusCode: Object.prototype.hasOwnProperty.call(payload, 'statusCode'),
  };
}

async function callApi(baseUrl, req) {
  const headers = Object.assign({}, req.headers || {});
  let body = req.body;

  if (body !== undefined && body !== null) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    if (headers['Content-Type'].includes('application/json') && typeof body !== 'string') {
      body = JSON.stringify(body);
    }
  }

  const res = await fetch(`${baseUrl}${req.path}`, {
    method: req.method,
    headers,
    body,
  });

  const text = await res.text();
  let payload = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // keep text
  }

  return {
    status: res.status,
    body: payload,
  };
}

function buildSearchFilter(type, searchTerms, sortKey = 'renewedTime', sortOrder = 'DESC') {
  return {
    type,
    generalSearch: '',
    keyword: '',
    searchTerms,
    sortTerms: [{ key: sortKey, order: sortOrder }],
    page: 0,
    promoPage: 0,
    maxResults: 24,
  };
}

function encodeForm(bodyObj) {
  return Object.entries(bodyObj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function ensureTestUser(conn) {
  const unixcrypt = await import('unixcrypt');
  const passwordHash = unixcrypt.encrypt(testUser.password, '$6$');

  await conn.query(
    `INSERT INTO user (id, name, username, blocked, attemptedLogin, password, email, phone, whatsapp, location, deleted, dateCreated, profileImage, verified, verificationCode)
     VALUES (?, ?, ?, 0, 0, ?, ?, '', '', '', 0, NOW(), '', 1, NULL)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       username = VALUES(username),
       blocked = 0,
       attemptedLogin = 0,
       password = VALUES(password),
       email = VALUES(email),
       deleted = 0,
       verified = 1,
       verificationCode = NULL`,
    [testUser.id, testUser.name, testUser.username, passwordHash, testUser.email],
  );

  await conn.query(
    `INSERT INTO vendor (id, dateCreated, deleted, contact, accountName, profilePicture, accountExists, initialised, biography, useDetailsForPosts)
     VALUES (?, NOW(), 0, '{"phone_number":"","email":"","whatsapp":""}', ?, '', 0, 1, '', 0)
     ON DUPLICATE KEY UPDATE
       deleted = 0,
       accountName = VALUES(accountName),
       initialised = 1`,
    [testUser.id, `${testUser.username}.vendor`],
  );

  await conn.query('DELETE FROM user_role WHERE user_id = ?', [testUser.id]);
  await conn.query('INSERT INTO user_role (user_id, role_id) VALUES (?, 1)', [testUser.id]);
}

async function loadSearchDataset(conn) {
  const carRows = await conn.query(
    `SELECT id, make, model, transmission, fuelType, bodyType, registration, price, mileage
     FROM search
     WHERE sold = 0 AND deleted = 0 AND type = 'car' AND make IS NOT NULL AND model IS NOT NULL
     ORDER BY dateUpdated DESC
     LIMIT 120`,
  );

  const motoRows = await conn.query(
    `SELECT id, make, model, transmission, fuelType, bodyType, registration, price, mileage
     FROM search
     WHERE sold = 0 AND deleted = 0 AND type = 'motorcycle' AND make IS NOT NULL AND model IS NOT NULL
     ORDER BY dateUpdated DESC
     LIMIT 120`,
  );

  return { carRows, motoRows };
}

function createSearchCasesFromRows(type, rows, minCases = 50) {
  const cases = [];
  const uniqueRows = rows.filter((row, idx) => idx < Math.max(minCases, 60));

  for (let i = 0; i < uniqueRows.length && cases.length < minCases; i += 1) {
    const row = uniqueRows[i];

    const baseTerms = [
      { key: 'make1', value: row.make },
      { key: 'model1', value: row.model },
    ];

    const variants = [
      baseTerms,
      [...baseTerms, { key: 'registration', value: { from: String(row.registration || ''), to: '' } }],
      [...baseTerms, { key: 'price', value: { from: '0', to: String(row.price || 0) } }],
      [...baseTerms, { key: 'mileage', value: { from: '0', to: String(row.mileage || 0) } }],
      row.transmission ? [...baseTerms, { key: 'transmission', value: row.transmission }] : baseTerms,
      row.fuelType ? [...baseTerms, { key: 'fuelType', value: row.fuelType }] : baseTerms,
      row.bodyType ? [...baseTerms, { key: 'bodyType', value: row.bodyType }] : baseTerms,
      [
        ...baseTerms,
        { key: 'price', value: { from: '0', to: String(row.price || 0) } },
        { key: 'registration', value: { from: String(row.registration || ''), to: '' } },
      ],
    ];

    for (const terms of variants) {
      if (cases.length >= minCases) break;
      cases.push({
        name: `${type}-combo-${String(cases.length + 1).padStart(2, '0')}`,
        filter: buildSearchFilter(type, terms),
      });
    }
  }

  return cases.slice(0, minCases);
}

async function runSearchValidation() {
  const conn = await mariadb.createConnection(dbConfig);
  try {
    const { carRows, motoRows } = await loadSearchDataset(conn);
    const carCases = createSearchCasesFromRows('car', carRows, 50);
    const motoCases = createSearchCasesFromRows('motorcycle', motoRows, 50);
    const allCases = [...carCases, ...motoCases];

    assert(allCases.length >= 100, `Expected at least 100 search cases, got ${allCases.length}`);

    const failures = [];

    for (const c of allCases) {
      const phpForm = new FormData();
      phpForm.append('filter', JSON.stringify(c.filter));
      const nestForm = new FormData();
      nestForm.append('filter', JSON.stringify(c.filter));

      // eslint-disable-next-line no-await-in-loop
      const phpResponse = await fetch(`${phpBaseUrl}/car-details/search`, { method: 'POST', body: phpForm });
      // eslint-disable-next-line no-await-in-loop
      const nestResponse = await fetch(`${nestBaseUrl}/car-details/search`, { method: 'POST', body: nestForm });

      // eslint-disable-next-line no-await-in-loop
      const phpText = await phpResponse.text();
      // eslint-disable-next-line no-await-in-loop
      const nestText = await nestResponse.text();

      let phpBody = phpText;
      let nestBody = nestText;
      try { phpBody = JSON.parse(phpText); } catch {}
      try { nestBody = JSON.parse(nestText); } catch {}

      const php = { status: phpResponse.status, body: phpBody };
      const nest = { status: nestResponse.status, body: nestBody };

      const phpEnvelope = pickEnvelopeShape(php.body);
      const nestEnvelope = pickEnvelopeShape(nest.body);

      const statusOk = php.status === nest.status;
      const envelopeOk = JSON.stringify(phpEnvelope) === JSON.stringify(nestEnvelope);
      const shouldCheckArray = php.body?.success === true || nest.body?.success === true;
      const resultsArrayOk = !shouldCheckArray || (Array.isArray(php.body?.result) && Array.isArray(nest.body?.result));

      if (!statusOk || !envelopeOk || !resultsArrayOk) {
        failures.push({
          case: c.name,
          phpStatus: php.status,
          nestStatus: nest.status,
          phpEnvelope,
          nestEnvelope,
          phpResultType: typeof php.body?.result,
          nestResultType: typeof nest.body?.result,
        });
      }
    }

    return {
      total: allCases.length,
      passed: allCases.length - failures.length,
      failed: failures.length,
      failures,
    };
  } finally {
    await conn.end();
  }
}

async function runLoginValidation() {
  const loginBody = encodeForm({ username: testUser.email, password: testUser.password });
  const req = {
    method: 'POST',
    path: '/user/login',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: loginBody,
  };

  const php = await callApi(phpBaseUrl, req);
  const nest = await callApi(nestBaseUrl, req);

  const phpOk = php.body?.success === true && typeof php.body?.result === 'string' && php.body.result.length > 20;
  const nestOk = nest.body?.success === true && typeof nest.body?.result === 'string' && nest.body.result.length > 20;

  return {
    php,
    nest,
    ok: php.status === nest.status && phpOk && nestOk,
    nestToken: nestOk ? nest.body.result : '',
  };
}

function tinyPngDataUrl() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

function buildPostPayload(email, tag, imageUrl) {
  return {
    post: {
      id: '',
      type: 'sidecar',
      email,
      createdTime: '',
      caption: `critical-${tag}-${Date.now()}`,
      sidecarMedias: [
        {
          id: `media-${tag}-${Date.now()}`,
          imageStandardResolutionUrl: imageUrl,
          type: 'image',
        },
      ],
      likesCount: 0,
      commentsCount: 0,
      details: {
        make: 'BMW',
        model: 'X5',
        variant: 'xDrive30d',
        price: '15000',
        mileage: '150000',
        registration: '2018',
        fuelType: 'Diesel',
        sold: false,
        contact: {
          phone_number: '355690000000',
          address: 'Tirane',
          whatsapp: '355690000000',
          email,
        },
        transmission: 'Automatic',
        engineSize: '3000',
        drivetrain: '4WD',
        seats: '5',
        numberOfDoors: '5',
        bodyType: 'SUV',
        customsPaid: true,
        canExchange: false,
        options: '',
        emissionGroup: 'Euro 6',
        type: 'car',
      },
    },
  };
}

async function uploadTmpImage(uploadId) {
  const req = {
    method: 'POST',
    path: '/data/upload-image',
    headers: { 'Content-Type': 'application/json' },
    body: {
      file: tinyPngDataUrl(),
      filename: `${uploadId}.png`,
      id: uploadId,
    },
  };

  const res = await callApi(nestBaseUrl, req);
  assert(res.status === 200, `upload-image http status ${res.status}`);
  assert(res.body?.success === true, 'upload-image returned unsuccessful response');
  assert(typeof res.body?.result === 'string' && res.body.result.includes('/media/tmp/'), 'upload-image missing tmp url');

  const relativeTmpPath = String(res.body.result).replace(/^\//, '');
  const absoluteTmpPath = path.resolve(__dirname, '..', relativeTmpPath);
  assert(fs.existsSync(absoluteTmpPath), `tmp file not found at ${absoluteTmpPath}`);

  return {
    relativeTmpPath: `/${relativeTmpPath}`,
    absoluteTmpPath,
  };
}

async function validateCreatedPost(postId) {
  const conn = await mariadb.createConnection(dbConfig);
  try {
    const posts = await conn.query('SELECT id, sidecarMedias, vendor_id FROM post WHERE id = ? LIMIT 1', [postId]);
    const details = await conn.query('SELECT id, post_id FROM car_detail WHERE id = ? LIMIT 1', [postId]);
    const searchRows = await conn.query('SELECT id FROM search WHERE id = ? LIMIT 1', [postId]);

    assert(posts.length === 1, `post ${postId} not found in post table`);
    assert(details.length === 1, `post ${postId} not found in car_detail table`);
    assert(searchRows.length === 1, `post ${postId} not found in search table`);

    const sidecar = JSON.parse(posts[0].sidecarMedias || '[]');
    assert(Array.isArray(sidecar) && sidecar.length > 0, 'sidecar medias are empty');

    for (const media of sidecar) {
      const std = path.resolve(__dirname, '..', String(media.imageStandardResolutionUrl || '').replace(/^\//, ''));
      const thumb = path.resolve(__dirname, '..', String(media.imageThumbnailUrl || '').replace(/^\//, ''));
      assert(fs.existsSync(std), `standard media missing: ${std}`);
      assert(fs.existsSync(thumb), `thumbnail media missing: ${thumb}`);
    }

    return {
      postId,
      vendorId: String(posts[0].vendor_id),
      sidecarCount: sidecar.length,
    };
  } finally {
    await conn.end();
  }
}

async function runPostFlowValidation(jwtToken) {
  const summary = [];

  const existingTmp = await uploadTmpImage(`critical-existing-${Date.now()}`);
  const existingPayload = buildPostPayload(
    testUser.email,
    'logged-out-existing',
    `${nestBaseUrl}${existingTmp.relativeTmpPath}`,
  );
  const existingRes = await callApi(nestBaseUrl, {
    method: 'POST',
    path: '/data/create-user-post',
    headers: { 'Content-Type': 'application/json' },
    body: existingPayload,
  });
  assert(existingRes.status === 200 && existingRes.body?.success === true, 'logged-out existing user post failed');
  const existingPostId = String(existingRes.body?.result?.postId || '');
  assert(existingPostId, 'logged-out existing user postId missing');
  summary.push({ flow: 'logged_out_existing_user', ...(await validateCreatedPost(existingPostId)) });

  const newTmp = await uploadTmpImage(`critical-new-${Date.now()}`);
  const newEmail = `critical.new.${Date.now()}@autoconnect.test`;
  const newPayload = buildPostPayload(newEmail, 'logged-out-new', `${nestBaseUrl}${newTmp.relativeTmpPath}`);
  const newRes = await callApi(nestBaseUrl, {
    method: 'POST',
    path: '/data/create-user-post',
    headers: { 'Content-Type': 'application/json' },
    body: newPayload,
  });
  assert(newRes.status === 200 && newRes.body?.success === true, 'logged-out new user post failed');
  const newPostId = String(newRes.body?.result?.postId || '');
  assert(newPostId, 'logged-out new user postId missing');
  summary.push({ flow: 'logged_out_new_user', ...(await validateCreatedPost(newPostId)) });

  const loggedInTmp = await uploadTmpImage(`critical-loggedin-${Date.now()}`);
  const loggedInPayload = buildPostPayload('', 'logged-in', `${nestBaseUrl}${loggedInTmp.relativeTmpPath}`);
  delete loggedInPayload.post.email;

  const loggedInRes = await callApi(nestBaseUrl, {
    method: 'POST',
    path: '/data/create-user-post',
    headers: {
      'Content-Type': 'application/json',
      'X-Http-Authorization': `Bearer ${jwtToken}`,
    },
    body: loggedInPayload,
  });
  assert(loggedInRes.status === 200 && loggedInRes.body?.success === true, 'logged-in user post failed');
  const loggedInPostId = String(loggedInRes.body?.result?.postId || '');
  assert(loggedInPostId, 'logged-in user postId missing');
  summary.push({ flow: 'logged_in_user', ...(await validateCreatedPost(loggedInPostId)) });

  return summary;
}

async function main() {
  const startedAt = new Date().toISOString();
  const conn = await mariadb.createConnection(dbConfig);
  await ensureTestUser(conn);
  await conn.end();

  const login = await runLoginValidation();
  assert(login.ok, 'login validation failed for php and nest');

  const search = await runSearchValidation();
  assert(search.failed === 0, `search validation failed for ${search.failed} cases`);

  const postFlows = await runPostFlowValidation(login.nestToken);

  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    urls: {
      phpBaseUrl,
      nestBaseUrl,
    },
    testUser,
    checks: {
      login: {
        ok: login.ok,
        phpStatus: login.php.status,
        nestStatus: login.nest.status,
      },
      search,
      postFlows,
    },
  };

  const outPath = path.join(__dirname, '..', 'test', 'contracts', 'critical-report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log('Critical endpoint validation complete');
  console.log(`Search cases: ${search.total}, passed: ${search.passed}, failed: ${search.failed}`);
  console.log(`Post flows validated: ${postFlows.length}`);
  console.log(`Report: ${outPath}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
