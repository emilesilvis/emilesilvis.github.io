/** Public scores, with a private browser token used only for this API origin. */
export function createLeaderboard(api, edition, stores = [() => localStorage, () => sessionStorage], send = fetch) {
  const key = `geomake:player:${new URL(api).origin}`;
  const validToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
  function token() {
    for (const store of stores) {
      try { const saved = store().getItem(key); if (validToken(saved)) return saved; } catch { /* Try tab storage. */ }
    }
    return null;
  }
  function ensureToken() {
    const existing = token();
    if (existing) return existing;
    const created = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
    let saved = false;
    for (const store of stores) {
      try { store().setItem(key, created); saved = true; } catch { /* Try tab storage. */ }
    }
    if (!saved) throw new Error('Allow browser storage to save your name and progress.');
    return created;
  }
  async function request(path, data, authenticated = true) {
    const headers = {};
    if (authenticated) {
      const saved = token();
      if (!saved) throw new Error('Enter your name to save progress.');
      headers.Authorization = `Bearer ${saved}`;
    }
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const response = await send(`${api}${path}?edition=${encodeURIComponent(edition)}`, {
      method: data === undefined ? 'GET' : 'POST', headers,
      body: data === undefined ? undefined : JSON.stringify(data), credentials: 'omit',
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || 'Could not load the leaderboard. Please try again.');
      error.status = response.status;
      throw error;
    }
    return result;
  }
  return {
    async loadPlayer() {
      if (!token()) return null;
      try { return await request('/player'); }
      catch (error) { if (error.status === 401) return null; throw error; }
    },
    savePlayer(name) { ensureToken(); return request('/player', { name }); },
    check: (day, answer) => request('/check', { day, answer }),
    loadBoard: () => request('/leaderboard', undefined, false),
  };
}
