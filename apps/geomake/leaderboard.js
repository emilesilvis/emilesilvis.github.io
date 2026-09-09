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
    saveToken(created);
    return created;
  }
  function saveToken(value) {
    const previous = stores.map(store => {
      try { return store().getItem(key); } catch { return null; }
    });
    for (const store of stores) {
      try { store().setItem(key, value); } catch { /* Try tab storage. */ }
    }
    if (token() === value) return;
    // A readable but unwritable older store must not silently win on reload.
    stores.forEach((store, i) => {
      try {
        if (previous[i] === null) store().removeItem(key);
        else store().setItem(key, previous[i]);
      } catch { /* A failed store remains unchanged. */ }
    });
    throw new Error('Allow browser storage to save your name and progress.');
  }
  async function request(path, data, authenticated = true, credential = token()) {
    const headers = {};
    if (authenticated) {
      if (!credential) throw new Error('Enter your name or log in with a recovery code.');
      headers.Authorization = `Bearer ${credential}`;
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
    logOut() {
      for (const store of stores) {
        try { store().removeItem(key); } catch { /* Try the other store. */ }
      }
      if (token()) throw new Error('Allow browser storage to log out.');
    },
    recoveryCode: () => token()?.match(/.{8}/g).join('-') || '',
    async restorePlayer(code) {
      const candidate = typeof code === 'string' ? code.trim().toLowerCase().replace(/[\s-]/g, '') : '';
      if (!validToken(candidate)) throw new Error('Enter the full private recovery code.');
      let player;
      try { player = await request('/player', undefined, true, candidate); }
      catch (error) {
        if (error.status === 401) throw new Error('That recovery code was not recognised. Check it and try again.');
        throw error;
      }
      saveToken(candidate);
      return player;
    },
    check: (day, answer) => request('/check', { day, answer }),
    loadBoard: () => request('/leaderboard', undefined, false),
  };
}
