export function normalizeClientName(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function suggestClientDuplicates(clients, probe) {
  const name = String(probe?.name || '').trim();
  const normalized = normalizeClientName(name);
  const email = String(probe?.email || '').trim().toLowerCase();
  const tax = String(probe?.taxRegistrationNumber || '').trim();

  return (clients || []).filter((client) => {
    const clientName = String(client?.name || '');
    const normalizedClientName = normalizeClientName(clientName);
    const exactName = clientName.toLowerCase() === name.toLowerCase();
    const normalizedMatch = normalized.length >= 4 && normalizedClientName.includes(normalized);
    const emailMatch = Boolean(email && client?.email && String(client.email).toLowerCase() === email);
    const taxMatch = Boolean(tax && client?.taxRegistrationNumber && String(client.taxRegistrationNumber) === tax);
    return exactName || normalizedMatch || emailMatch || taxMatch;
  });
}

export function createClientInline(clients, payload, actorId = 'system') {
  const name = String(payload?.name || '').trim();
  if (!name) throw new Error('Client name is required.');

  const duplicates = suggestClientDuplicates(clients, payload);
  const exact = duplicates.find((row) => String(row.name || '').toLowerCase() === name.toLowerCase());
  if (exact) {
    throw new Error(`Client already exists: ${exact.name}`);
  }

  const now = new Date().toISOString();
  const created = {
    id: `cli-${Date.now()}`,
    name,
    industry: payload?.industry || undefined,
    contactPerson: payload?.contactPerson || undefined,
    email: payload?.email ? String(payload.email).toLowerCase() : undefined,
    phone: payload?.phone || undefined,
    billingAddress: payload?.billingAddress || undefined,
    country: payload?.country || undefined,
    taxRegistrationNumber: payload?.taxRegistrationNumber || undefined,
    notes: payload?.notes || undefined,
    profileStatus: 'needs_completion',
    ownerId: actorId,
    createdAt: now,
    updatedAt: now,
  };

  return {
    created,
    clients: [created, ...(clients || [])],
  };
}
