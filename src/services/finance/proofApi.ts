// Attach a proof document to an existing payment / receipt. Backend creates
// the evidence document on the parent finance entry and stamps proofDocumentId,
// which clears reconciliation's missing_proof on the next run.
// Like budgetsApi/reconciliationApi, every call appends the actor (?userId=)
// so parseActorFromUrl resolves it for assertPermission.

import { apiRequest } from '../../lib/apiClient';

function getSessionUserId(): string | null {
  try {
    const raw = localStorage.getItem('neox-auth-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return String(parsed?.id || parsed?.user?.id || '').trim() || null;
  } catch {
    return null;
  }
}

function getSessionUserName(): string | null {
  try {
    const raw = localStorage.getItem('neox-auth-session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const name = parsed?.name || parsed?.user?.name || parsed?.email || parsed?.user?.email;
    return name ? String(name).trim() : null;
  } catch {
    return null;
  }
}

function withActor(path: string): string {
  const uid = getSessionUserId();
  const uname = getSessionUserName();
  if (!uid && !uname) return path;
  const sep = path.includes('?') ? '&' : '?';
  const parts: string[] = [];
  if (uid) parts.push(`userId=${encodeURIComponent(uid)}`);
  if (uname) parts.push(`userName=${encodeURIComponent(uname)}`);
  return `${path}${sep}${parts.join('&')}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || '');
      const base64 = raw.includes(',') ? raw.split(',')[1] : raw;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

async function postProof(path: string, file: File, notes?: string | null): Promise<void> {
  const contentBase64 = await fileToBase64(file);
  const uid = getSessionUserId();
  const uname = getSessionUserName();
  await apiRequest(withActor(path), {
    method: 'POST',
    body: {
      originalFileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      contentBase64,
      notes: notes || null,
      ...(uid ? { userId: uid } : {}),
      ...(uname ? { actorDisplayName: uname } : {}),
    },
  });
}

export function attachPaymentProof(paymentId: string, file: File, notes?: string | null): Promise<void> {
  return postProof(`/api/v1/finance/payments/${encodeURIComponent(paymentId)}/proof`, file, notes);
}

export function attachReceiptProof(receiptId: string, file: File, notes?: string | null): Promise<void> {
  return postProof(`/api/v1/finance/receipts/${encodeURIComponent(receiptId)}/proof`, file, notes);
}
