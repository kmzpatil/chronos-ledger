const params = new URLSearchParams(window.location.search);
const dom = params.get('domain');
if (dom) {
  const el = document.getElementById('domain-label');
  if (el) el.textContent = dom;
}
