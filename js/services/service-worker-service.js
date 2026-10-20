function isServiceWorkerSupported() {
  return 'serviceWorker' in navigator && window.isSecureContext;
}

async function registerServiceWorker({ onUpdate, onStatus } = {}) {
  if (!isServiceWorkerSupported()) {
    onStatus?.({ supported: false, controlled: false });
    return null;
  }

  const registration = await navigator.serviceWorker.register('./sw.js?v=10');
  const reportStatus = () => onStatus?.({ supported: true, controlled: Boolean(navigator.serviceWorker.controller) });
  const offerUpdate = () => onUpdate?.(() => registration.waiting?.postMessage({ type: 'SKIP_WAITING' }));

  reportStatus();
  if (registration.waiting) offerUpdate();
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
      reportStatus();
    });
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
  navigator.serviceWorker.ready.then(reportStatus);
  return registration;
}

export { isServiceWorkerSupported, registerServiceWorker };
