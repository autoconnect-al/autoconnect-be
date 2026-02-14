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

const testUser = {
  id: '987654321012345',
  email: 'critical.parity.user+local@autoconnect.test',
  username: 'critical.parity.user',
  name: 'Critical Parity User',
  password: 'CriticalParity#123',
};

function nowTs() {
  return Date.now();
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

function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = normalize(value[key]);
    return out;
  }
  return value;
}

function resultIds(payload) {
  const list = payload?.result;
  if (!Array.isArray(list)) return [];
  return list.map((row) => String(row?.id ?? ''));
}

function encodeFormUrl(data) {
  return Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function callApi(baseUrl, request) {
  const headers = Object.assign({}, request.headers || {});
  let body = request.body;

  if (request.bodyType === 'form-urlencoded') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = encodeFormUrl(request.body || {});
  } else if (request.bodyType === 'form-data') {
    const form = new FormData();
    for (const [k, v] of Object.entries(request.body || {})) {
      form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
    }
    body = form;
  } else if (request.bodyType === 'json') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
  } else if (body !== undefined && body !== null && typeof body !== 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${baseUrl}${request.path}`, {
      method: request.method || 'GET',
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
  } catch {
    return {
      status: 0,
      body: {
        success: false,
        message: 'upstream unavailable',
        statusCode: '0',
      },
    };
  }
}

function buildFilter(type, searchTerms, sortKey = 'renewedTime', sortOrder = 'DESC') {
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

function tinyPngDataUrl() {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}

function createPostPayload(email, tag, imageUrl) {
  return {
    post: {
      id: '',
      type: 'sidecar',
      email,
      createdTime: '',
      caption: `strict-${tag}-${nowTs()}`,
      sidecarMedias: [
        {
          id: `media-${tag}-${nowTs()}`,
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
        price: '15500',
        mileage: '152000',
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

async function login(baseUrl) {
  const req = {
    method: 'POST',
    path: '/user/login',
    bodyType: 'form-urlencoded',
    body: { username: testUser.email, password: testUser.password },
  };
  return callApi(baseUrl, req);
}

function assertPass(condition, message) {
  if (!condition) throw new Error(message);
}

function compareStrict(php, nest, opts = {}) {
  const errors = [];
  if (php.status !== nest.status) {
    errors.push(`status mismatch php=${php.status} nest=${nest.status}`);
  }

  const phpEnv = pickEnvelopeShape(php.body);
  const nestEnv = pickEnvelopeShape(nest.body);
  if (JSON.stringify(phpEnv) !== JSON.stringify(nestEnv)) {
    errors.push(`envelope mismatch php=${JSON.stringify(phpEnv)} nest=${JSON.stringify(nestEnv)}`);
  }

  if (opts.expectSuccess) {
    if (php.body?.success !== true) errors.push('php success!=true');
    if (nest.body?.success !== true) errors.push('nest success!=true');
  }

  if (opts.compareResultIds) {
    const phpIds = resultIds(php.body);
    const nestIds = resultIds(nest.body);
    if (JSON.stringify(phpIds) !== JSON.stringify(nestIds)) {
      errors.push(`result ids mismatch php=${JSON.stringify(phpIds)} nest=${JSON.stringify(nestIds)}`);
    }
  }

  if (opts.compareResultDeep) {
    const phpNorm = normalize(php.body?.result ?? null);
    const nestNorm = normalize(nest.body?.result ?? null);
    if (JSON.stringify(phpNorm) !== JSON.stringify(nestNorm)) {
      errors.push('deep result mismatch');
    }
  }

  if (opts.compareResultScalar) {
    const p = php.body?.result;
    const n = nest.body?.result;
    if (String(p) !== String(n)) {
      errors.push(`result mismatch php=${String(p)} nest=${String(n)}`);
    }
  }

  return errors;
}

async function uploadTmpImage(uploadId) {
  const res = await callApi(nestBaseUrl, {
    method: 'POST',
    path: '/data/upload-image',
    bodyType: 'json',
    body: { file: tinyPngDataUrl(), filename: `${uploadId}.png`, id: uploadId },
  });
  assertPass(res.status === 200 && res.body?.success === true, 'upload-image failed for strict admin checks');
  assertPass(typeof res.body?.result === 'string', 'upload-image result missing');
  return String(res.body.result);
}

async function createUserOwnedPost(nestToken) {
  const tmpUrl = await uploadTmpImage(`strict-admin-${nowTs()}`);
  const payload = createPostPayload('', 'admin-owned', `${nestBaseUrl}${tmpUrl}`);
  delete payload.post.email;

  const res = await callApi(nestBaseUrl, {
    method: 'POST',
    path: '/data/create-user-post',
    headers: { 'X-Http-Authorization': `Bearer ${nestToken}` },
    bodyType: 'json',
    body: payload,
  });

  assertPass(res.status === 200 && res.body?.success === true, 'failed creating admin-owned post');
  const postId = String(res.body?.result?.postId || '');
  assertPass(!!postId, 'missing created post id');
  return postId;
}

async function main() {
  const startedAt = new Date().toISOString();
  const conn = await mariadb.createConnection(dbConfig);
  await ensureTestUser(conn);

  const report = {
    startedAt,
    finishedAt: null,
    urls: { phpBaseUrl, nestBaseUrl },
    points: {},
    failures: [],
  };

  function runCheck(name, fn) {
    return fn()
      .then((details) => {
        report.points[name] = { pass: true, details };
      })
      .catch((error) => {
        report.points[name] = { pass: false, error: error.message || String(error) };
        report.failures.push({ name, error: error.message || String(error) });
      });
  }

  const phpLogin = await login(phpBaseUrl);
  const nestLogin = await login(nestBaseUrl);

  let phpToken = '';
  let nestToken = '';
  if (phpLogin.body?.success === true && typeof phpLogin.body?.result === 'string') phpToken = phpLogin.body.result;
  if (nestLogin.body?.success === true && typeof nestLogin.body?.result === 'string') nestToken = nestLogin.body.result;

  const carRows = await conn.query(
    `SELECT id, make, model, transmission, fuelType, bodyType, registration, price, mileage
     FROM search
     WHERE sold = 0 AND deleted = 0 AND type = 'car' AND make IS NOT NULL AND model IS NOT NULL
     ORDER BY dateUpdated DESC
     LIMIT 6`,
  );

  const motoRows = await conn.query(
    `SELECT id, make, model, transmission, fuelType, bodyType, registration, price, mileage
     FROM search
     WHERE sold = 0 AND deleted = 0 AND type = 'motorcycle' AND make IS NOT NULL AND model IS NOT NULL
     ORDER BY dateUpdated DESC
     LIMIT 6`,
  );

  await runCheck('1_search_success_strict', async () => {
    const failures = [];
    const cases = [];

    if (carRows[0]) {
      const row = carRows[0];
      cases.push(buildFilter('car', [{ key: 'make1', value: row.make }, { key: 'model1', value: row.model }]));
      cases.push(buildFilter('car', [{ key: 'make1', value: row.make }, { key: 'price', value: { from: '0', to: String(row.price || 0) } }]));
      cases.push(buildFilter('car', [{ key: 'make1', value: row.make }, { key: 'registration', value: { from: String(row.registration || ''), to: '' } }]));
    }
    if (carRows[1]) {
      const row = carRows[1];
      cases.push(buildFilter('car', [{ key: 'make1', value: row.make }, { key: 'mileage', value: { from: '0', to: String(row.mileage || 0) } }]));
      cases.push(buildFilter('car', [{ key: 'make1', value: row.make }, { key: 'fuelType', value: row.fuelType || '' }].filter((x) => x.value !== '')));
    }

    if (motoRows[0]) {
      const row = motoRows[0];
      cases.push(buildFilter('motorcycle', [{ key: 'make1', value: row.make }, { key: 'model1', value: row.model }]));
      cases.push(buildFilter('motorcycle', [{ key: 'make1', value: row.make }, { key: 'price', value: { from: '0', to: String(row.price || 0) } }]));
      cases.push(buildFilter('motorcycle', [{ key: 'make1', value: row.make }, { key: 'registration', value: { from: String(row.registration || ''), to: '' } }]));
    }
    if (motoRows[1]) {
      const row = motoRows[1];
      cases.push(buildFilter('motorcycle', [{ key: 'make1', value: row.make }, { key: 'mileage', value: { from: '0', to: String(row.mileage || 0) } }]));
      cases.push(buildFilter('motorcycle', [{ key: 'make1', value: row.make }, { key: 'bodyType', value: row.bodyType || '' }].filter((x) => x.value !== '')));
    }

    for (let i = 0; i < cases.length; i += 1) {
      const filter = cases[i];
      const req = {
        method: 'POST',
        path: '/car-details/search',
        bodyType: 'form-data',
        body: { filter: JSON.stringify(filter) },
      };
      // eslint-disable-next-line no-await-in-loop
      const php = await callApi(phpBaseUrl, req);
      // eslint-disable-next-line no-await-in-loop
      const nest = await callApi(nestBaseUrl, req);
      const errors = [];
      if (php.body?.success === true) {
        errors.push(...compareStrict(php, nest, { expectSuccess: true, compareResultIds: true }));
      } else if (!pickEnvelopeShape(nest.body)) {
        errors.push('nest envelope missing');
      }
      if (errors.length) failures.push({ idx: i + 1, errors });
    }

    assertPass(failures.length === 0, `search strict mismatches: ${JSON.stringify(failures)}`);
    return { totalCases: cases.length };
  });

  await runCheck('2_result_count_strict', async () => {
    const failures = [];
    const rows = [...carRows.slice(0, 3), ...motoRows.slice(0, 3)];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const type = i < 3 ? 'car' : 'motorcycle';
      const filter = buildFilter(type, [{ key: 'make1', value: row.make }, { key: 'model1', value: row.model }]);
      const req = {
        method: 'POST',
        path: '/car-details/result-count',
        bodyType: 'form-data',
        body: { filter: JSON.stringify(filter) },
      };
      // eslint-disable-next-line no-await-in-loop
      const php = await callApi(phpBaseUrl, req);
      // eslint-disable-next-line no-await-in-loop
      const nest = await callApi(nestBaseUrl, req);
      const errors = [];
      if (php.body?.success === true) {
        errors.push(...compareStrict(php, nest, { expectSuccess: true, compareResultScalar: true }));
      } else if (!pickEnvelopeShape(nest.body)) {
        errors.push('nest envelope missing');
      }
      if (errors.length) failures.push({ idx: i + 1, errors });
    }

    assertPass(failures.length === 0, `result-count strict mismatches: ${JSON.stringify(failures)}`);
    return { totalCases: rows.length };
  });

  await runCheck('3_models_full_true', async () => {
    const failures = [];
    const carMake = carRows[0]?.make;
    const motoMake = motoRows[0]?.make;
    assertPass(!!carMake && !!motoMake, 'missing make rows for full=true checks');

    const checks = [
      `/data/models/${encodeURIComponent(carMake)}?full=true`,
      `/data/models/motorcycles/${encodeURIComponent(motoMake)}?full=true`,
    ];

    for (const pathName of checks) {
      // eslint-disable-next-line no-await-in-loop
      const php = await callApi(phpBaseUrl, { method: 'GET', path: pathName });
      // eslint-disable-next-line no-await-in-loop
      const nest = await callApi(nestBaseUrl, { method: 'GET', path: pathName });
      const errors = [];
      if (php.body?.success === true) {
        errors.push(...compareStrict(php, nest, { expectSuccess: true, compareResultDeep: true }));
      } else if (!Array.isArray(nest.body?.result)) {
        errors.push('nest result is not an array');
      }
      if (errors.length) failures.push({ path: pathName, errors });
    }

    assertPass(failures.length === 0, `models full=true mismatches: ${JSON.stringify(failures)}`);
    return { checks: checks.length };
  });

  await runCheck('4_related_post_variants', async () => {
    const baseId = String(carRows[0]?.id || '');
    assertPass(!!baseId, 'missing base id for related post tests');

    const excluded = carRows.slice(1, 3).map((r) => String(r.id)).join(',');
    const getReqs = [
      `/car-details/related-post/${baseId}?type=car&excludedIds=${encodeURIComponent(excluded)}`,
      `/car-details/related-post/${baseId}?type=motorcycle&excludedIds=`,
    ];

    const failures = [];

    for (const p of getReqs) {
      // eslint-disable-next-line no-await-in-loop
      const php = await callApi(phpBaseUrl, { method: 'GET', path: p });
      // eslint-disable-next-line no-await-in-loop
      const nest = await callApi(nestBaseUrl, { method: 'GET', path: p });
      const errors = [];
      if (php.body?.success === true) {
        errors.push(...compareStrict(php, nest, { expectSuccess: true }));
      } else if (!pickEnvelopeShape(nest.body)) {
        errors.push('nest envelope missing');
      }
      if (errors.length) failures.push({ path: p, errors });
    }

    const filter = buildFilter('car', [
      { key: 'make1', value: carRows[0].make },
      { key: 'model1', value: carRows[0].model },
    ]);

    const postPath = `/car-details/related-post-filter?type=car&excludedIds=${encodeURIComponent(excluded)}`;
    const req = { method: 'POST', path: postPath, bodyType: 'form-data', body: { filter: JSON.stringify(filter) } };
    const phpPost = await callApi(phpBaseUrl, req);
    const nestPost = await callApi(nestBaseUrl, req);
    const postErrors = [];
    if (phpPost.body?.success === true) {
      postErrors.push(...compareStrict(phpPost, nestPost, { expectSuccess: true }));
    } else if (!pickEnvelopeShape(nestPost.body)) {
      postErrors.push('nest envelope missing');
    }
    if (postErrors.length) failures.push({ path: postPath, errors: postErrors });

    assertPass(failures.length === 0, `related post variant mismatches: ${JSON.stringify(failures)}`);
    return { totalChecks: getReqs.length + 1 };
  });

  await runCheck('5_refresh_token_success', async () => {
    assertPass(nestToken, 'missing nest login token for refresh tests');

    const php = await callApi(phpBaseUrl, {
      method: 'GET',
      path: '/user/refresh-token',
      headers: { 'X-Http-Authorization': `Bearer ${phpToken}` },
    });
    const nest = await callApi(nestBaseUrl, {
      method: 'GET',
      path: '/user/refresh-token',
      headers: { 'X-Http-Authorization': `Bearer ${nestToken}` },
    });

    const errors = [];
    if (php.body?.success === true) {
      errors.push(...compareStrict(php, nest, { expectSuccess: true }));
    }
    if (nest.body?.success === true) {
      const nestJwt = typeof nest.body?.result === 'string' ? nest.body.result : nest.body?.result?.jwt;
      if (typeof nestJwt !== 'string' || nestJwt.length < 20) errors.push('nest refresh token not jwt-like');
    } else {
      errors.push('nest refresh token failed');
    }
    assertPass(errors.length === 0, `refresh-token mismatches: ${JSON.stringify(errors)}`);
    return { status: 'ok' };
  });

  await runCheck('6_signup_success_and_duplicate', async () => {
    const suffix = String(nowTs());
    const user = {
      user: {
        name: `Strict User ${suffix}`,
        username: `strict.user.${suffix}`,
        email: `strict.user.${suffix}@autoconnect.test`,
        password: 'StrictParity#123',
        rewritePassword: 'StrictParity#123',
        phone: '',
        whatsapp: '',
        location: '',
      },
    };

    const phpFirst = await callApi(phpBaseUrl, { method: 'POST', path: '/user/create-user', bodyType: 'json', body: user });
    const nestFirst = await callApi(nestBaseUrl, { method: 'POST', path: '/user/create-user', bodyType: 'json', body: user });
    const firstErrors = [];
    if (nestFirst.body?.success !== true) {
      firstErrors.push('nest signup did not succeed');
    }

    const phpSecond = await callApi(phpBaseUrl, { method: 'POST', path: '/user/create-user', bodyType: 'json', body: user });
    const nestSecond = await callApi(nestBaseUrl, { method: 'POST', path: '/user/create-user', bodyType: 'json', body: user });
    const secondErrors = [];
    if (nestSecond.body?.success === true) {
      secondErrors.push('nest duplicate signup unexpectedly succeeded');
    }

    const all = [...firstErrors.map((e) => `first:${e}`), ...secondErrors.map((e) => `duplicate:${e}`)];
    assertPass(all.length === 0, `signup strict mismatches: ${JSON.stringify(all)}`);
    return { status: 'ok', email: user.user.email };
  });

  await runCheck('7_favourites_get_success', async () => {
    const favRows = await conn.query(
      `SELECT id FROM search WHERE sold = 0 AND deleted = 0 AND id < 2147483647 ORDER BY dateUpdated DESC LIMIT 3`,
    );
    const ids = favRows.map((r) => String(r.id));
    assertPass(ids.length > 0, 'no ids for favourites success test');
    const pathName = `/favourites/get?favourites=${ids.join(',')}`;

    const php = await callApi(phpBaseUrl, { method: 'GET', path: pathName });
    const nest = await callApi(nestBaseUrl, { method: 'GET', path: pathName });
    const errors = [];
    if (php.body?.success === true) {
      errors.push(...compareStrict(php, nest, { expectSuccess: true }));
    }
    if (!Array.isArray(nest.body?.result)) {
      errors.push('nest favourites/get result is not array');
    }

    assertPass(errors.length === 0, `favourites/get strict mismatches: ${JSON.stringify(errors)}`);
    return { idsChecked: ids.length };
  });

  await runCheck('8_vendor_details_bio_success', async () => {
    const vendorRows = await conn.query(
      `SELECT accountName FROM vendor WHERE deleted = 0 AND accountName IS NOT NULL AND accountName <> '' AND accountName LIKE '%.%' AND accountName NOT LIKE '% %' ORDER BY dateUpdated DESC LIMIT 20`,
    );
    const picked = vendorRows[0] || { accountName: 'autokorea.al' };
    assertPass(!!picked?.accountName, 'no vendor account for vendor success tests');

    const slug = String(picked.accountName).replace(/\./g, '-');
    const endpoints = [
      `/data/vendors/${encodeURIComponent(slug)}`,
      `/data/vendors/biography/${encodeURIComponent(slug)}`,
    ];

    const failures = [];
    for (const p of endpoints) {
      // eslint-disable-next-line no-await-in-loop
      const php = await callApi(phpBaseUrl, { method: 'GET', path: p });
      // eslint-disable-next-line no-await-in-loop
      const nest = await callApi(nestBaseUrl, { method: 'GET', path: p });
      const errors = [];
      if (php.body?.success === true) {
        errors.push(...compareStrict(php, nest, { expectSuccess: true, compareResultDeep: true }));
      }
      if (nest.body?.success !== true) {
        errors.push('nest vendor endpoint failed');
      }
      if (errors.length) failures.push({ path: p, errors });
    }

    assertPass(failures.length === 0, `vendor details/bio mismatches: ${JSON.stringify(failures)}`);
    return { vendor: picked.accountName };
  });

  await runCheck('9_most_wanted_query_variants', async () => {
    const now = Math.floor(Date.now() / 1000);
    let mostWantedRows = await conn.query(
      `SELECT id, accountName FROM search WHERE sold = 0 AND deleted = 0 AND mostWantedTo IS NOT NULL AND mostWantedTo > ? ORDER BY mostWantedTo DESC LIMIT 6`,
      [now],
    );

    if (mostWantedRows.length === 0 && carRows[0]?.id) {
      await conn.query('UPDATE search SET mostWantedTo = ? WHERE id = ?', [now + 7 * 24 * 3600, String(carRows[0].id)]);
      mostWantedRows = await conn.query(
        `SELECT id, accountName FROM search WHERE sold = 0 AND deleted = 0 AND mostWantedTo IS NOT NULL AND mostWantedTo > ? ORDER BY mostWantedTo DESC LIMIT 6`,
        [now],
      );
    }
    assertPass(mostWantedRows.length > 0, 'no most wanted rows available for strict checks');

    const excludeIds = mostWantedRows.slice(0, 2).map((r) => String(r.id)).join(',');
    const excludedAccounts = mostWantedRows.slice(0, 2).map((r) => String(r.accountName || '')).filter(Boolean).join(',');

    const paths = [
      `/car-details/most-wanted?excludeIds=${encodeURIComponent(excludeIds)}`,
      `/car-details/most-wanted?excludeIds=${encodeURIComponent(excludeIds)}&excludedAccounts=${encodeURIComponent(excludedAccounts)}`,
    ];

    const failures = [];
    for (const p of paths) {
      // eslint-disable-next-line no-await-in-loop
      const php = await callApi(phpBaseUrl, { method: 'GET', path: p });
      // eslint-disable-next-line no-await-in-loop
      const nest = await callApi(nestBaseUrl, { method: 'GET', path: p });
      const errors = [];
      if (php.body?.success === true) {
        errors.push(...compareStrict(php, nest, { expectSuccess: true, compareResultIds: true }));
      }
      if (nest.body?.success !== true) {
        errors.push('nest most-wanted failed');
      }
      if (errors.length) failures.push({ path: p, errors });
    }

    assertPass(failures.length === 0, `most-wanted variant mismatches: ${JSON.stringify(failures)}`);
    return { checks: paths.length };
  });

  await runCheck('10_admin_authorized_success_and_db_assertions', async () => {
    assertPass(nestToken, 'missing nest token for admin suite');

    const headersPhp = { 'X-Http-Authorization': `Bearer ${phpToken}` };
    const headersNest = { 'X-Http-Authorization': `Bearer ${nestToken}` };

    const failures = [];

    const getUserNest = await callApi(nestBaseUrl, { method: 'GET', path: '/admin/user', headers: headersNest });
    if (getUserNest.body?.success !== true) failures.push('admin/user GET: nest failed');

    const updateUserBody = {
      user: {
        id: testUser.id,
        name: testUser.name,
        username: testUser.username,
        email: testUser.email,
        password: '',
        rewritePassword: '',
        phone: `35569${String(nowTs()).slice(-6)}`,
        whatsapp: '355690000000',
        location: 'Tirane',
      },
    };

    const postUserNest = await callApi(nestBaseUrl, { method: 'POST', path: '/admin/user', headers: headersNest, bodyType: 'json', body: updateUserBody });
    if (postUserNest.body?.success !== true) failures.push('admin/user POST: nest failed');

    const userRow = await conn.query('SELECT phone, location FROM user WHERE id = ? LIMIT 1', [testUser.id]);
    assertPass(String(userRow[0]?.phone || '') === updateUserBody.user.phone, 'admin/user POST did not update phone in DB');

    const changePasswordBody = {
      user: {
        id: testUser.id,
        name: testUser.name,
        username: testUser.username,
        email: testUser.email,
        password: testUser.password,
        rewritePassword: testUser.password,
        phone: updateUserBody.user.phone,
        whatsapp: '355690000000',
        location: 'Tirane',
      },
    };

    const changeNest = await callApi(nestBaseUrl, { method: 'POST', path: '/admin/user/change-password', headers: headersNest, bodyType: 'json', body: changePasswordBody });
    if (changeNest.body?.success !== true) failures.push('admin/change-password: nest failed');

    const contactPayload = {
      vendor: {
        contact: {
          phone_number: `35568${String(nowTs()).slice(-6)}`,
          location: 'Tirane',
          whatsapp: '355690000000',
          email: testUser.email,
          address: 'Rruga e Kavajes',
        },
      },
    };

    const contactNest = await callApi(nestBaseUrl, { method: 'POST', path: '/admin/vendor/contact', headers: headersNest, bodyType: 'json', body: contactPayload });
    if (contactNest.body?.success !== true) failures.push('admin/vendor/contact: nest failed');

    const vendorContactRow = await conn.query('SELECT contact FROM vendor WHERE id = ? LIMIT 1', [testUser.id]);
    const parsedContact = JSON.parse(vendorContactRow[0]?.contact || '{}');
    assertPass(String(parsedContact.phone_number || '') === contactPayload.vendor.contact.phone_number, 'vendor contact not updated in DB');

    const bioPayload = { vendor: { biography: `Strict biography ${nowTs()}` } };
    const bioNest = await callApi(nestBaseUrl, { method: 'POST', path: '/admin/vendor/biography', headers: headersNest, bodyType: 'json', body: bioPayload });
    if (bioNest.body?.success !== true) failures.push('admin/vendor/biography: nest failed');

    const vendorBioRow = await conn.query('SELECT biography FROM vendor WHERE id = ? LIMIT 1', [testUser.id]);
    assertPass(String(vendorBioRow[0]?.biography || '') === bioPayload.vendor.biography, 'vendor biography not updated in DB');

    const picturePayload = { vendor: { profilePicture: tinyPngDataUrl() } };
    const picNest = await callApi(nestBaseUrl, { method: 'POST', path: '/admin/vendor/profile-picture', headers: headersNest, bodyType: 'json', body: picturePayload });
    if (picNest.body?.success !== true) failures.push('admin/vendor/profile-picture: nest failed');

    const vendorPicRow = await conn.query('SELECT profilePicture FROM vendor WHERE id = ? LIMIT 1', [testUser.id]);
    assertPass(String(vendorPicRow[0]?.profilePicture || '').length > 0, 'vendor profile picture not updated in DB');

    const postIdForSold = await createUserOwnedPost(nestToken);
    const soldNest = await callApi(nestBaseUrl, { method: 'GET', path: `/admin/posts/sold/${postIdForSold}`, headers: headersNest });
    if (soldNest.body?.success !== true) failures.push('admin/posts/sold: nest failed');

    const soldRow = await conn.query('SELECT sold FROM search WHERE id = ? LIMIT 1', [postIdForSold]);
    assertPass(Boolean(soldRow[0]?.sold) === true, 'admin sold did not update search.sold');

    const postIdForDelete = await createUserOwnedPost(nestToken);
    const deleteNest = await callApi(nestBaseUrl, { method: 'GET', path: `/admin/posts/delete/${postIdForDelete}`, headers: headersNest });
    if (deleteNest.body?.success !== true) failures.push('admin/posts/delete: nest failed');

    const deletedRow = await conn.query('SELECT deleted FROM post WHERE id = ? LIMIT 1', [postIdForDelete]);
    assertPass(Boolean(deletedRow[0]?.deleted) === true, 'admin delete did not update post.deleted');

    const postsNest = await callApi(nestBaseUrl, { method: 'GET', path: '/admin/posts', headers: headersNest });
    if (postsNest.body?.success !== true) failures.push('admin/posts: nest failed');

    const postByIdNest = await callApi(nestBaseUrl, { method: 'GET', path: `/admin/posts/${postIdForSold}`, headers: headersNest });
    if (postByIdNest.body?.success !== true) failures.push('admin/posts/{id}: nest failed');

    assertPass(failures.length === 0, `admin authorized mismatches: ${JSON.stringify(failures)}`);
    return { checks: 11 };
  });

  await runCheck('11_price_calculate_success_strict', async () => {
    const row = carRows.find(
      (r) => r.make && r.model && r.registration && r.fuelType,
    );
    assertPass(!!row, 'missing suitable row for price-calculate strict checks');

    const searchTerms = [
      { key: 'make1', value: row.make },
      { key: 'model1', value: row.model },
      { key: 'registration', value: { from: String(row.registration), to: '' } },
      { key: 'fuelType', value: row.fuelType },
    ];

    if (row.bodyType) searchTerms.push({ key: 'bodyType', value: row.bodyType });
    if (row.transmission) {
      searchTerms.push({ key: 'transmission', value: row.transmission });
    }

    const filter = buildFilter('car', searchTerms);
    const req = {
      method: 'POST',
      path: '/car-details/price-calculate',
      bodyType: 'form-data',
      body: { filter: JSON.stringify(filter) },
    };

    const php = await callApi(phpBaseUrl, req);
    const nest = await callApi(nestBaseUrl, req);
    const errors = compareStrict(php, nest, {
      expectSuccess: true,
      compareResultDeep: true,
    });

    assertPass(errors.length === 0, `price-calculate mismatches: ${JSON.stringify(errors)}`);
    return { make: row.make, model: row.model };
  });

  await runCheck('12_post_caption_success_strict', async () => {
    const row = carRows.find((r) => r.id);
    assertPass(!!row, 'missing row id for post/caption strict checks');

    const req = {
      method: 'GET',
      path: `/car-details/post/caption/${String(row.id)}`,
    };

    const php = await callApi(phpBaseUrl, req);
    const nest = await callApi(nestBaseUrl, req);
    const errors = compareStrict(php, nest, {
      expectSuccess: true,
      compareResultDeep: true,
    });

    assertPass(errors.length === 0, `post/caption mismatches: ${JSON.stringify(errors)}`);
    return { id: String(row.id) };
  });

  await conn.end();

  report.finishedAt = new Date().toISOString();
  const outPath = path.join(__dirname, '..', 'test', 'contracts', 'fe-strict-report.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

  const passed = Object.values(report.points).filter((p) => p.pass).length;
  const total = Object.keys(report.points).length;

  console.log(`Strict FE parity checks: ${passed}/${total} passed`);
  console.log(`Report: ${outPath}`);

  if (report.failures.length > 0) {
    for (const failure of report.failures) {
      console.log(`[FAIL] ${failure.name}: ${failure.error}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
