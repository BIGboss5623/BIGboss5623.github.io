(() => {
  'use strict';
  const search = document.getElementById('siteSearch');
  if (!search) return;
  const cards = [...document.querySelectorAll('.site-card')];
  const filters = [...document.querySelectorAll('[data-filter]')];
  let category = 'all';
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const card of cards) {
      const match = (category === 'all' || card.dataset.category === category) &&
        `${card.textContent} ${card.dataset.search}`.toLocaleLowerCase().includes(query);
      card.hidden = !match;
      visible += Number(match);
    }
    document.getElementById('siteCount').textContent = `显示 ${visible} / ${cards.length} 个入口`;
    document.getElementById('emptySites').hidden = visible !== 0;
  }
  search.addEventListener('input', update);
  search.addEventListener('keydown', event => { if (event.key === 'Escape') {search.value = ''; update();} });
  for (const filter of filters) filter.addEventListener('click', () => {
    category = filter.dataset.filter;
    for (const other of filters) other.setAttribute('aria-pressed', String(other === filter));
    update();
  });
  update();
})();
