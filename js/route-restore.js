// 404.html transports the complete relative URL in a reserved query parameter.
// Restore before the app initializes; <base href="/"> keeps assets root-relative.
(function () {
  const params = new URLSearchParams(location.search);
  const original = params.get('__spa_route');
  if (location.pathname !== '/' || !original) return;
  if (!original.startsWith('/') || original.startsWith('//')) return;
  try {
    const url = new URL(original, location.origin);
    if (url.origin !== location.origin) return;
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  } catch (_) { /* Leave malformed input for the normal router fallback. */ }
})();
