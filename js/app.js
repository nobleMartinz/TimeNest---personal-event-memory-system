import { initRemindersPage } from './pages/reminders-page.js';
import { initDashboardPage } from './pages/dashboard-page.js?v=2';
import { initDiaryPage } from './pages/diary-page.js';
import { initEventsPage } from './pages/events-page.js?v=3';
import { initCalendarPage } from './pages/calendar-page.js?v=2';
import { applySavedTheme, initSettingsPage } from './pages/settings-page.js?v=2';
import { checkAndNotifyReminders } from './services/notification-service.js';
import { registerServiceWorker } from './services/service-worker-service.js?v=2';
import { getAuthState } from './services/auth-service.js';

const sidebar = document.querySelector('[data-sidebar]');
const menuToggle = document.querySelector('[data-menu-toggle]');
const closeTriggers = document.querySelectorAll('[data-menu-close]');
const navigationLinks = document.querySelectorAll('.nav-link');
const main = document.querySelector('main');
const mobileHeader = document.querySelector('.mobile-header');
const remindersView = document.querySelector('#reminders-view');
const diaryView = document.querySelector('#diary-view');
const eventsView = document.querySelector('#events-view');
const calendarView = document.querySelector('#calendar-view');
const settingsView = document.querySelector('#settings-view');
const views = { reminders: remindersView, diary: diaryView, events: eventsView, calendar: calendarView, settings: settingsView };
const dashboardNodes = [...main.children].filter((node) => !Object.values(views).includes(node));
const connectionStatus = document.querySelector('#connection-status');
const connectionMessage = document.querySelector('[data-connection-message]');
const updateNotice = document.querySelector('#update-notice');
const applyUpdateButton = document.querySelector('#apply-update');

const AUTH_PAGES = ['login.html', 'signup.html'];

function renderConnectionStatus() {
  const offline = !navigator.onLine;
  connectionStatus.hidden = !offline;
  connectionMessage.textContent = offline
    ? 'Offline: using saved TimeNest files.'
    : 'Online: TimeNest is connected.';
}

window.addEventListener('online', renderConnectionStatus);
window.addEventListener('offline', renderConnectionStatus);

function isMobileNavigation() {
  return window.matchMedia('(max-width: 720px)').matches;
}

function setNavigationState(isOpen, { restoreFocus = true } = {}) {
  const mobile = isMobileNavigation();
  sidebar.classList.toggle('is-open', Boolean(isOpen && mobile));
  document.querySelector('.sidebar-backdrop').classList.toggle('is-visible', Boolean(isOpen && mobile));
  menuToggle.setAttribute('aria-expanded', String(Boolean(isOpen && mobile)));
  main.inert = Boolean(isOpen && mobile);
  mobileHeader.inert = Boolean(isOpen && mobile);
  if (!mobile) return;
  if (isOpen) sidebar.querySelector('[data-menu-close]').focus();
  else if (restoreFocus) menuToggle.focus();
}

menuToggle.setAttribute('aria-expanded', 'false');
menuToggle.addEventListener('click', () => setNavigationState(true));
closeTriggers.forEach((trigger) => {
  trigger.addEventListener('click', () => setNavigationState(false));
});

sidebar.addEventListener('keydown', (event) => {
  if (!sidebar.classList.contains('is-open') || !isMobileNavigation()) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    setNavigationState(false);
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [...sidebar.querySelectorAll('a[href], button:not([disabled])')];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

navigationLinks.forEach((link) => {
  link.addEventListener('click', () => {
    navigationLinks.forEach((item) => {
      item.classList.remove('is-active');
      item.removeAttribute('aria-current');
    });
    link.classList.add('is-active');
    link.setAttribute('aria-current', 'page');
    setNavigationState(false, { restoreFocus: false });
  });
});

let remindersPage;
let dashboardPage;
let diaryPage;
let eventsPage;
let calendarPage;
let settingsPage;

function renderRoute() {
  const route = window.location.hash.slice(1) || 'dashboard';
  const currentRoute = ['reminders', 'diary', 'events', 'calendar', 'settings'].includes(route) ? route : 'dashboard';
  dashboardNodes.forEach((node) => {
    node.hidden = currentRoute !== 'dashboard';
  });
  Object.entries(views).forEach(([name, view]) => {
    view.hidden = currentRoute !== name;
  });
  navigationLinks.forEach((link) => {
    const isActive = link.getAttribute('href') === `#${currentRoute}`;
    link.classList.toggle('is-active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  if (currentRoute === 'reminders') void remindersPage.refresh();
  else if (currentRoute === 'diary') void diaryPage.refresh();
  else if (currentRoute === 'events') void eventsPage.refresh();
  else if (currentRoute === 'calendar') void calendarPage.refresh();
  else if (currentRoute === 'settings') void settingsPage.refresh();
  else void dashboardPage.refresh();
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('timenest:data-changed', () => {
  void dashboardPage.refresh();
  void diaryPage.refresh();
  void eventsPage.refresh();
  void calendarPage.refresh();
  void settingsPage.refresh();
});

async function startApplication() {
  remindersPage = initRemindersPage();
  dashboardPage = initDashboardPage();
  diaryPage = initDiaryPage();
  eventsPage = initEventsPage();
  calendarPage = initCalendarPage();
  settingsPage = initSettingsPage();
  main.inert = false;
  mobileHeader.inert = false;

  renderRoute();
  void applySavedTheme();
  void checkAndNotifyReminders();
  renderConnectionStatus();
  void registerServiceWorker({
    onStatus: ({ supported, controlled }) => {
      document.documentElement.dataset.offlineReady = String(supported && controlled);
    },
    onUpdate: (applyUpdate) => {
      updateNotice.hidden = false;
      applyUpdateButton.onclick = applyUpdate;
    }
  }).catch(() => {
    document.documentElement.dataset.offlineReady = 'false';
  });
}

async function bootstrap() {
  let authState = { hasAccount: false, isAuthenticated: false, account: null };
  try {
    authState = await getAuthState();
  } catch {
    authState = { hasAccount: false, isAuthenticated: false, account: null };
  }

  if (authState.hasAccount && !authState.isAuthenticated) {
    // An installed app opens in its own browsing context, so the session
    // kept in `sessionStorage` is not visible here and the sign-in screen is
    // needed. If the shell was ever served for a sign-in URL, go to the plain
    // sign-in page instead of the one carrying `?next=`, which is always
    // cached and therefore cannot send the app round in circles.
    if (AUTH_PAGES.some((page) => window.location.pathname.endsWith(page))) {
      window.location.replace('./login.html');
      return;
    }
    const next = encodeURIComponent(window.location.hash || '#dashboard');
    window.location.replace(`./login.html?next=${next}`);
    return;
  }

  await startApplication();
}

bootstrap();
