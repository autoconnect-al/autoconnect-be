const fs = require('fs');
const path = require('path');

const casesDir = process.env.CONTRACT_CASES_DIR
  ? path.resolve(process.env.CONTRACT_CASES_DIR)
  : path.join(__dirname, '..', 'test', 'contracts', 'cases');
const phpBaseUrl = process.env.PHP_BASE_URL || 'http://localhost:8000';
const nestBaseUrl = process.env.NEST_BASE_URL || 'http://localhost:3000';

function pickEnvelopeShape(payload) {
  if (!payload || typeof payload !== 'object') return null;
  return {
    hasSuccess: Object.prototype.hasOwnProperty.call(payload, 'success'),
    hasResult: Object.prototype.hasOwnProperty.call(payload, 'result'),
    hasMessage: Object.prototype.hasOwnProperty.call(payload, 'message'),
    hasStatusCode: Object.prototype.hasOwnProperty.call(payload, 'statusCode'),
  };
}

function isIgnored(pathName, ignored = []) {
  return ignored.includes(pathName);
}

function flatten(obj, prefix = '', out = {}) {
  if (obj === null || obj === undefined) {
    out[prefix] = obj;
    return out;
  }

  if (Array.isArray(obj)) {
    out[prefix] = `[array:${obj.length}]`;
    return out;
  }

  if (typeof obj !== 'object') {
    out[prefix] = obj;
    return out;
  }

  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    flatten(obj[key], full, out);
  }

  return out;
}

async function callApi(baseUrl, request) {
  const url = `${baseUrl}${request.path}`;
  const method = request.method || 'GET';
  const headers = Object.assign({}, request.headers || {});

  let body;
  if (request.body !== undefined && request.body !== null) {
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    body = headers['Content-Type'].includes('application/json')
      ? JSON.stringify(request.body)
      : request.body;
  }

  const response = await fetch(url, { method, headers, body });
  const text = await response.text();

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }

  return {
    status: response.status,
    body: json,
  };
}

async function runCase(testCase) {
  const php = await callApi(phpBaseUrl, testCase.request);
  const nest = await callApi(nestBaseUrl, testCase.request);

  const issues = [];
  if (testCase.compare?.status && php.status !== nest.status) {
    issues.push(`status mismatch: php=${php.status}, nest=${nest.status}`);
  }

  if (testCase.compare?.envelope) {
    const phpEnvelope = pickEnvelopeShape(php.body);
    const nestEnvelope = pickEnvelopeShape(nest.body);
    if (JSON.stringify(phpEnvelope) !== JSON.stringify(nestEnvelope)) {
      issues.push(`envelope mismatch: php=${JSON.stringify(phpEnvelope)} nest=${JSON.stringify(nestEnvelope)}`);
    }
  }

  if (Array.isArray(testCase.compare?.keys)) {
    for (const key of testCase.compare.keys) {
      const phpHas = php.body && typeof php.body === 'object' && key in php.body;
      const nestHas = nest.body && typeof nest.body === 'object' && key in nest.body;
      if (phpHas !== nestHas) {
        issues.push(`key presence mismatch for '${key}'`);
      }
    }
  }

  if (testCase.compare?.values !== false) {
    const ignored = testCase.compare?.ignorePaths || [];
    const phpFlat = flatten(php.body);
    const nestFlat = flatten(nest.body);
    for (const key of Object.keys(phpFlat)) {
      if (isIgnored(key, ignored)) continue;
      if (!(key in nestFlat)) {
        issues.push(`nest missing path '${key}'`);
        continue;
      }
      if (String(phpFlat[key]) !== String(nestFlat[key])) {
        issues.push(`value mismatch at '${key}'`);
      }
    }
  }

  return {
    name: testCase.name,
    path: testCase.request.path,
    method: testCase.request.method,
    pass: issues.length === 0,
    issues,
    php,
    nest,
  };
}

async function main() {
  const files = fs
    .readdirSync(casesDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort();

  const results = [];
  for (const file of files) {
    const testCase = JSON.parse(fs.readFileSync(path.join(casesDir, file), 'utf8'));
    // eslint-disable-next-line no-await-in-loop
    const result = await runCase(testCase);
    results.push(result);
  }

  const outputPath = path.join(__dirname, '..', 'test', 'contracts', 'report.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

  const failed = results.filter((r) => !r.pass);
  console.log(`Contract cases: ${results.length}`);
  console.log(`Passed: ${results.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);

  for (const fail of failed) {
    console.log(`\n[FAIL] ${fail.name} (${fail.method} ${fail.path})`);
    for (const issue of fail.issues) {
      console.log(`  - ${issue}`);
    }
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
