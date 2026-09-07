(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const number = new Intl.NumberFormat('en-GB');
  const tooltip = $('tooltip');
  const container = $('treemap');
  let data = [];
  let region = 'eu';
  let view = 'chart';
  let activeCell = null;
  let svg;
  let exposureColor;

  const employment = row => number.format(Math.round(row[region] * 1000));
  const regionName = () => region === 'eu' ? 'Europe' : 'the Netherlands';

  function hideTooltip() {
    tooltip.hidden = true;
    activeCell?.setAttribute('aria-expanded', 'false');
    activeCell = null;
  }

  function showTooltip(event, row, cell) {
    hideTooltip();
    activeCell = cell;
    cell.setAttribute('aria-expanded', 'true');
    $('tt-title').textContent = row.title;
    $('tt-category').textContent = `${row.category} · ISCO ${row.isco}`;
    $('tt-stats').textContent = `${employment(row)} employed · Exposure ${row.exposure} / 10`;
    $('tt-rationale').textContent = row.rationale;
    tooltip.hidden = false;
    const box = cell.getBoundingClientRect();
    const pointer = event.type.startsWith('pointer') || event.type === 'click';
    const x = pointer ? event.clientX : box.left + box.width / 2;
    const y = pointer ? event.clientY : box.top + box.height / 2;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const left = x + 14 + width > innerWidth ? x - width - 14 : x + 14;
    const top = y + 14 + height > innerHeight ? y - height - 14 : y + 14;
    tooltip.style.left = Math.max(8, Math.min(left, innerWidth - width - 8)) + 'px';
    tooltip.style.top = Math.max(8, Math.min(top, innerHeight - height - 8)) + 'px';
  }

  function updateStats() {
    const total = data.reduce((sum, row) => sum + row[region], 0);
    const average = data.reduce((sum, row) => sum + row[region] * row.exposure, 0) / total;
    $('stat-total').textContent = (total / 1000).toFixed(1) + ' million';
    $('stat-avg').textContent = average.toFixed(1) + ' / 10';
    $('tier-list').replaceChildren();
    for (const [label, min, max] of [['Minimal', 0, 2], ['Low', 3, 4], ['Moderate', 5, 6], ['High', 7, 8], ['Very high', 9, 10]]) {
      const jobs = data.filter(row => row.exposure >= min && row.exposure <= max).reduce((sum, row) => sum + row[region], 0);
      const item = document.createElement('li');
      item.textContent = `${label} (${min}–${max}): ${(jobs / total * 100).toFixed(1)}%`;
      $('tier-list').append(item);
    }
  }

  function updateTable() {
    const query = $('occupation-search').value.trim().toLocaleLowerCase();
    const rows = data.filter(row => `${row.title} ${row.category} ${row.isco}`.toLocaleLowerCase().includes(query));
    const sort = $('sort-select').value;
    rows.sort((a, b) => {
      const difference = sort === 'jobs' ? b[region] - a[region] : sort === 'exposure' ? b.exposure - a.exposure : 0;
      return difference || a.title.localeCompare(b.title, 'en');
    });
    const fragment = document.createDocumentFragment();
    for (const row of rows) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = row.title;
      const category = document.createElement('small');
      category.textContent = `${row.category} · ISCO ${row.isco}`;
      th.append(category);
      tr.append(th);
      for (const value of [employment(row), row.exposure, row.rationale]) {
        const td = document.createElement('td');
        td.textContent = value;
        tr.append(td);
      }
      fragment.append(tr);
    }
    $('occupation-rows').replaceChildren(fragment);
    $('row-count').textContent = `${rows.length} of ${data.length} occupations${rows.length ? '' : ' — try a different search'}.`;
    $('table-caption').textContent = `Employment in ${regionName()} and estimated LLM exposure`;
  }

  function textColor(exposure) {
    const color = d3.rgb(exposureColor(exposure));
    const components = [color.r, color.g, color.b].map(value => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    const luminance = components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722;
    return luminance > 0.179 ? '#000' : '#fff';
  }

  function fitText(element, value, width) {
    element.textContent = width > 25 ? value : '';
    while (element.getComputedTextLength() > width && element.textContent.length > 1) {
      element.textContent = element.textContent.slice(0, -2) + '…';
    }
  }

  function draw() {
    if (!svg || !data.length || view !== 'chart') return;
    hideTooltip();
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const groups = d3.groups(data.filter(row => row[region] > 0), row => row.category);
    const root = d3.hierarchy({children: groups.map(([name, children]) => ({name, children}))})
      .sum(row => row[region] || 0).sort((a, b) => b.value - a.value);
    d3.treemap().size([width, height]).paddingInner(2).paddingOuter(3)
      .paddingTop(node => node.depth === 1 ? 18 : 3)
      .round(true).tile(d3.treemapSquarify.ratio(1.2))(root);

    const categories = svg.selectAll('g.category').data(root.children, d => d.data.name).join(enter => {
      const group = enter.append('g').attr('class', 'category').attr('aria-hidden', 'true');
      group.append('rect');
      group.append('text').attr('class', 'cat-label');
      return group;
    });
    categories.select('rect').attr('x', d => d.x0).attr('y', d => d.y0)
      .attr('width', d => d.x1 - d.x0).attr('height', d => d.y1 - d.y0).attr('fill', 'var(--surface)');
    categories.select('text').attr('x', d => d.x0 + 4).attr('y', d => d.y0 + 13)
      .each(function(d) { fitText(this, d.data.name, d.y1 - d.y0 > 24 ? d.x1 - d.x0 - 8 : 0); });

    const cells = svg.selectAll('g.cell').data(root.leaves(), d => d.data.isco).join(enter => {
      const cell = enter.append('g').attr('class', 'cell').attr('tabindex', '0').attr('role', 'button')
        .attr('aria-controls', 'tooltip').attr('aria-expanded', 'false');
      cell.append('rect');
      cell.append('text').attr('class', 'cell-title').attr('aria-hidden', 'true');
      cell.append('text').attr('class', 'cell-detail').attr('aria-hidden', 'true');
      return cell;
    });
    cells.attr('aria-label', d => `${d.data.title}: ${employment(d.data)} employed, exposure ${d.data.exposure} out of 10. ${d.data.rationale}`)
      .on('pointerenter focus', function(event, d) { showTooltip(event, d.data, this); })
      .on('click', function(event, d) { showTooltip(event, d.data, this); })
      .on('pointerleave blur', event => {
        if (!tooltip.contains(event.relatedTarget)) hideTooltip();
      })
      .on('keydown', function(event, d) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          showTooltip(event, d.data, this);
        } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(event.key)) {
          event.preventDefault();
          const nodes = cells.nodes();
          const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1;
          nodes[(nodes.indexOf(this) + direction + nodes.length) % nodes.length].focus();
        }
      });
    cells.select('rect').attr('x', d => d.x0).attr('y', d => d.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0)).attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', d => exposureColor(d.data.exposure));
    cells.selectAll('text').attr('fill', d => textColor(d.data.exposure));
    cells.select('.cell-title').attr('x', d => d.x0 + 4).attr('y', d => d.y0 + 14)
      .attr('font-size', '12px').attr('font-weight', '600')
      .each(function(d) { fitText(this, d.data.title, d.y1 - d.y0 >= 18 ? d.x1 - d.x0 - 8 : 0); });
    cells.select('.cell-detail').attr('x', d => d.x0 + 4).attr('y', d => d.y0 + 29).attr('font-size', '11px')
      .each(function(d) {
        fitText(this, `${employment(d.data)} · ${d.data.exposure}/10`, d.y1 - d.y0 >= 33 ? d.x1 - d.x0 - 8 : 0);
      });
    // Keep cells above category backgrounds after subsequent region changes.
    cells.raise();
  }

  function setView(next) {
    view = next;
    hideTooltip();
    document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    $('chart-panel').hidden = view !== 'chart';
    $('table-panel').hidden = view !== 'table';
    draw();
  }

  document.querySelectorAll('[data-region]').forEach(button => button.addEventListener('click', () => {
    region = button.dataset.region;
    document.querySelectorAll('[data-region]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    $('title').textContent = region === 'eu' ? 'LLM Exposure for EU Jobs' : 'LLM Exposure for Dutch Jobs';
    if (data.length) { updateStats(); updateTable(); draw(); }
  }));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('occupation-search').addEventListener('input', updateTable);
  $('sort-select').addEventListener('change', updateTable);
  $('close-tooltip').addEventListener('click', hideTooltip);
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
  document.addEventListener('pointerdown', event => {
    if (!tooltip.contains(event.target) && !event.target.closest('.cell')) hideTooltip();
  });
  window.addEventListener('resize', draw);
  window.addEventListener('scroll', hideTooltip, {passive: true});

  async function init() {
    $('retry').hidden = true;
    $('load-status').textContent = 'Loading occupations…';
    try {
      const response = await fetch('/static/data/job_market_data.json', {signal: AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Data request failed');
      const rows = await response.json();
      if (!Array.isArray(rows) || !rows.length || new Set(rows.map(row => row.isco)).size !== rows.length ||
          rows.some(row => !['title', 'category', 'isco', 'rationale'].every(key => typeof row[key] === 'string') ||
            !['eu', 'nl', 'exposure'].every(key => Number.isFinite(row[key]) && row[key] >= 0) || row.exposure > 10) ||
          ['eu', 'nl'].some(key => !rows.some(row => row[key] > 0))) throw new Error('Invalid occupation data');
      data = rows;
      updateStats();
      updateTable();
      $('explorer').hidden = false;
      if (window.d3) {
        exposureColor = d3.scaleLinear().domain([0, 5, 10]).range(['#228b22', '#c8b432', '#b41e1e']).clamp(true);
        svg = d3.select(container).append('svg').attr('role', 'group')
          .attr('aria-label', 'Occupations by employment and exposure').attr('aria-describedby', 'chart-help');
        $('load-status').hidden = true;
        draw();
      } else {
        $('load-status').textContent = 'The chart could not load. You can still explore all occupations in the table.';
        document.querySelector('[data-view="chart"]').disabled = true;
        setView('table');
      }
    } catch (error) {
      $('load-status').hidden = false;
      $('load-status').textContent = 'The occupation data could not load. Check your connection and try again.';
      $('retry').hidden = false;
    }
  }
  $('retry').addEventListener('click', init);
  init();
})();
