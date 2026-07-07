export async function getToken(): Promise<string | null> {
  const { token } = await chrome.storage.local.get('token') as { token?: string };
  return token || null;
}

export async function setToken(token: string) {
  await chrome.storage.local.set({ token });
}

export async function clearToken() {
  await chrome.storage.local.remove('token');
}
