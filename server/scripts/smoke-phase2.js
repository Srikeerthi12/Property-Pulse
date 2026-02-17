import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

function randomEmail(prefix) {
  const n = Math.random().toString(16).slice(2);
  return `${prefix}.${Date.now()}.${n}@example.com`;
}

async function json(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const message = data?.error || `HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function registerAndLogin({ role, namePrefix }) {
  const email = randomEmail(role);
  const password = 'Test@1234A';

  await json(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({
      name: `${namePrefix} ${role}`,
      email,
      password,
      role,
      autoLogin: true,
    }),
  });

  const login = await json(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return { email, password, token: login?.accessToken, user: login?.user };
}

async function adminCreate({ email, password, name = 'Smoke Admin' }) {
  // Uses the existing server-side script endpoint pattern: we create a buyer first then promote via script.
  // But we can't promote via HTTP. Instead, require ADMIN_EMAIL/ADMIN_PASSWORD in env or reuse existing.
  if (!process.env.SMOKE_ADMIN_EMAIL || !process.env.SMOKE_ADMIN_PASSWORD) {
    throw new Error(
      'Set SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD in server/.env to an existing admin account for smoke test.',
    );
  }

  const login = await json(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.SMOKE_ADMIN_EMAIL,
      password: process.env.SMOKE_ADMIN_PASSWORD,
    }),
  });

  return { email: process.env.SMOKE_ADMIN_EMAIL, token: login?.accessToken, user: login?.user };
}

async function run() {
  // eslint-disable-next-line no-console
  console.log(`Using API base: ${baseUrl}`);

  const seller = await registerAndLogin({ role: 'seller', namePrefix: 'Smoke' });
  const buyer = await registerAndLogin({ role: 'buyer', namePrefix: 'Smoke' });
  const admin = await adminCreate({});

  // 1) Seller creates draft property
  const created = await json(`${baseUrl}/api/properties`, {
    method: 'POST',
    headers: { authorization: `Bearer ${seller.token}` },
    body: JSON.stringify({
      title: 'Smoke Test Property',
      description: 'Created by automated smoke test',
      price: 123456,
      location: 'Test City',
      propertyType: 'flat',
      bedrooms: 2,
      bathrooms: 2,
      submit: false,
    }),
  });

  const propertyId = created?.property?.id;
  if (!propertyId) throw new Error('Property create failed: missing id');
  // eslint-disable-next-line no-console
  console.log('Created property:', propertyId);

  // 2) Submit for approval
  await json(`${baseUrl}/api/properties/${propertyId}/submit`, {
    method: 'POST',
    headers: { authorization: `Bearer ${seller.token}` },
  });
  // eslint-disable-next-line no-console
  console.log('Submitted property');

  // 3) Admin sees it in pending list
  const pending = await json(`${baseUrl}/api/admin/properties/pending`, {
    headers: { authorization: `Bearer ${admin.token}` },
  });
  const found = (pending?.items || []).some((p) => p.id === propertyId);
  if (!found) throw new Error('Pending list did not include submitted property');
  // eslint-disable-next-line no-console
  console.log('Property found in pending');

  // 4) Admin approves
  await json(`${baseUrl}/api/admin/properties/${propertyId}/approve`, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${admin.token}` },
  });
  // eslint-disable-next-line no-console
  console.log('Approved property');

  // 5) Buyer can see it in approved list
  const list = await json(`${baseUrl}/api/properties?limit=5&page=1&q=Smoke`, {
    headers: { authorization: `Bearer ${buyer.token}` },
  });
  const listed = (list?.items || []).some((p) => p.id === propertyId);
  if (!listed) throw new Error('Approved list did not include approved property');
  // eslint-disable-next-line no-console
  console.log('Property appears in public approved list');

  // 6) Public detail works
  const detail = await json(`${baseUrl}/api/properties/${propertyId}`);
  if (detail?.property?.id !== propertyId) throw new Error('Property detail did not return expected id');
  // eslint-disable-next-line no-console
  console.log('Public detail OK');

  // eslint-disable-next-line no-console
  console.log('SMOKE TEST: OK');
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('SMOKE TEST: FAILED');
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  if (err?.data) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(err.data, null, 2));
  }
  process.exit(1);
});
