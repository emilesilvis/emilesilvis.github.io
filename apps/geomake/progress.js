/** Edition-scoped attempts and completion, with tab storage as a fallback. */
export function createProgress(edition, total, stores = [() => localStorage, () => sessionStorage]) {
  const key = (day, field) => `geomake:${edition}:${day}:${field}`;
  const validDay = day => Number.isInteger(day) && day >= 1 && day <= total;

  function values(day, field) {
    return stores.map(store => {
      try { return store().getItem(key(day, field)); } catch { return null; }
    });
  }

  function save(day, field, value) {
    let saved = false;
    for (const store of stores) {
      try { store().setItem(key(day, field), value); saved = true; } catch { /* Try the other store. */ }
    }
    return saved;
  }

  function completedThrough() {
    let day = 1;
    while (day <= total && values(day, 'solved').includes('true')) day++;
    return day - 1;
  }

  return {
    loadAnswer: day => values(day, 'answer').find(value => value !== null) || '',
    saveAnswer: (day, input) => save(day, 'answer', input),
    completedThrough,
    markSolved(day) {
      const completed = completedThrough();
      if (!validDay(day) || day > completed + 1) return false;
      return day <= completed || save(day, 'solved', 'true');
    },
  };
}
