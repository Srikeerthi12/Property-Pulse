import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url) });

const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

function getArg(name) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : null;
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

async function main() {
  const email = getArg('email') || 'admin.test@propertypulse.local';
  const password = getArg('password') || 'Admin@1234';

  const login = await json(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const token = login?.accessToken;
  if (!token) throw new Error('Login failed: missing accessToken');

  const users = await json(`${baseUrl}/api/admin/users`, {
    headers: { authorization: `Bearer ${token}` },
  });

  const agents = (users?.users || []).filter((u) => u.role === 'agent' && u.isActive);
  if (!agents.length) throw new Error('No active agents found to test assignment');

  const leads = await json(`${baseUrl}/api/admin/leads?page=1&limit=10`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const lead = (leads?.items || [])[0];
  if (!lead?.id) throw new Error('No leads found to test assignment');

  const currentAgentId = lead.agent?.id || null;
  const differentAgent = agents.find((a) => a.id !== currentAgentId) || null;

  async function fetchLeadAgentId() {
    const res = await json(`${baseUrl}/api/admin/leads?page=1&limit=10`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const found = (res?.items || []).find((i) => i.id === lead.id);
    return found?.agent?.id || null;
  }

  if (differentAgent) {
    const nextAgentId = differentAgent.id;
    await json(`${baseUrl}/api/admin/leads/${lead.id}/assign`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId: nextAgentId }),
    });

    const after = await fetchLeadAgentId();
    // eslint-disable-next-line no-console
    console.log({ baseUrl, leadId: lead.id, beforeAgentId: currentAgentId, afterAgentId: after });

    if (after !== nextAgentId) throw new Error('Assign lead did not update agentId as expected');
  } else {
    // Only one agent exists; test unassign and reassign.
    await json(`${baseUrl}/api/admin/leads/${lead.id}/assign`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId: null }),
    });
    const afterUnassign = await fetchLeadAgentId();
    if (afterUnassign !== null) throw new Error('Unassign lead did not clear agentId as expected');

    await json(`${baseUrl}/api/admin/leads/${lead.id}/assign`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify({ agentId: agents[0].id }),
    });
    const afterReassign = await fetchLeadAgentId();
    if (afterReassign !== agents[0].id) throw new Error('Reassign lead did not set agentId as expected');

    // eslint-disable-next-line no-console
    console.log({
      baseUrl,
      leadId: lead.id,
      beforeAgentId: currentAgentId,
      afterUnassignAgentId: afterUnassign,
      afterReassignAgentId: afterReassign,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Admin lead assignment: OK');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Admin lead assignment: FAILED');
  // eslint-disable-next-line no-console
  console.error(err?.message || err);
  if (err?.data) {
    // eslint-disable-next-line no-console
    console.error(JSON.stringify(err.data, null, 2));
  }
  process.exit(1);
});
