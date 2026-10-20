import {
  MINIMUM_PASSWORD_LENGTH,
  createAccount,
  getAuthState,
  resetLocalProfile,
  signIn,
  startSession
} from '../services/auth-service.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function readRedirectTarget() {
  const params = new URLSearchParams(window.location.search);
  const target = params.get('next') || params.get('redirect') || '';
  if (target.startsWith('#')) return `./index.html${target}`;
  if (target.startsWith('./') || target.startsWith('/')) return target;
  return './index.html#dashboard';
}

function goToApp() {
  window.location.replace(readRedirectTarget());
}

function scorePassword(value) {
  const password = String(value || '');
  let score = 0;
  if (password.length >= MINIMUM_PASSWORD_LENGTH) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  return score;
}

function strengthLabel(score) {
  if (score <= 1) return { level: 'weak', label: 'Weak password' };
  if (score === 2) return { level: 'fair', label: 'Fair password' };
  if (score === 3) return { level: 'good', label: 'Good password' };
  return { level: 'strong', label: 'Strong password' };
}

function initAuthPage({ mode }) {
  const isSignUp = mode === 'signup';
  const form = document.querySelector('#auth-form');
  const alert = document.querySelector('#auth-alert');
  const passwordInput = document.querySelector('#auth-password');
  const confirmInput = document.querySelector('#auth-confirm-password');
  const rememberInput = document.querySelector('#auth-remember');
  const toggleButtons = [...document.querySelectorAll('[data-password-toggle]')];
  const strengthFill = document.querySelector('#auth-strength-fill');
  const strengthLabelNode = document.querySelector('#auth-strength-label');
  const requirementNodes = [...document.querySelectorAll('[data-requirement]')];
  const submitButton = document.querySelector('#auth-submit');

  function showAlert(message) {
    alert.textContent = message;
    alert.hidden = false;
  }

  function clearAlert() {
    alert.textContent = '';
    alert.hidden = true;
  }

  function updateStrength() {
    if (!strengthFill || !strengthLabelNode) return;
    const score = scorePassword(passwordInput.value);
    const { level, label } = strengthLabel(score);
    strengthFill.dataset.level = level;
    strengthFill.style.width = `${Math.min(100, score * 25)}%`;
    strengthLabelNode.textContent = passwordInput.value ? label : 'Use at least 8 characters.';
  }

  function updateRequirements() {
    const value = passwordInput.value;
    requirementNodes.forEach((node) => {
      const rule = node.dataset.requirement;
      const met = rule === 'length'
        ? value.length >= MINIMUM_PASSWORD_LENGTH
        : rule === 'case'
          ? /[a-z]/.test(value) && /[A-Z]/.test(value)
          : /[^\w\s]/.test(value);
      node.dataset.met = String(met);
    });
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy
      ? (isSignUp ? 'Creating profile…' : 'Signing in…')
      : (isSignUp ? 'Create profile' : 'Sign in');
  }

  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.passwordToggle;
      const input = document.querySelector(`#${target}`);
      if (!input) return;
      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';
      button.textContent = isHidden ? 'Hide' : 'Show';
      button.setAttribute('aria-label', `${isHidden ? 'Hide' : 'Show'} password`);
    });
  });

  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      updateStrength();
      updateRequirements();
      if (confirmInput && confirmInput.value) {
        confirmInput.setCustomValidity(
          confirmInput.value === passwordInput.value ? '' : 'The passwords do not match.'
        );
      }
    });
  }

  if (confirmInput && passwordInput) {
    confirmInput.addEventListener('input', () => {
      confirmInput.setCustomValidity(
        confirmInput.value === passwordInput.value ? '' : 'The passwords do not match.'
      );
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();
    setBusy(true);
    try {
      if (isSignUp) {
        const account = await createAccount({
          displayName: form.elements.displayName.value,
          email: form.elements.email.value,
          password: form.elements.password.value
        });
        await startSession(account.id, { remember: rememberInput?.checked === true });
      } else {
        await signIn({
          email: form.elements.email.value,
          password: form.elements.password.value,
          remember: rememberInput?.checked === true
        });
      }
      goToApp();
    } catch (error) {
      showAlert(error.message || 'Sign in could not be completed.');
      setBusy(false);
    }
  });

  return { form, showAlert, clearAlert };
}

async function initLoginPage() {
  const controller = initAuthPage({ mode: 'login' });
  const authState = await getAuthState();

  if (!authState.hasAccount) {
    const notice = document.querySelector('#auth-no-account');
    if (notice) notice.hidden = false;
    const signUpLink = document.querySelector('[data-auth-signup-link]');
    if (signUpLink) signUpLink.textContent = 'Create a profile';
    const resetBlock = document.querySelector('#auth-reset-block');
    if (resetBlock) resetBlock.hidden = true;
  }

  if (authState.isAuthenticated) {
    goToApp();
  }

  const resetButton = document.querySelector('#auth-reset-profile');
  resetButton?.addEventListener('click', async () => {
    if (!window.confirm('Reset the local profile? The password is removed and you can create a new one. Every reminder and diary entry stays on this device.')) return;
    resetButton.disabled = true;
    try {
      await resetLocalProfile();
      window.location.replace('./signup.html');
    } catch (error) {
      controller.showAlert(error.message || 'The profile could not be reset.');
      resetButton.disabled = false;
    }
  });

  return controller;
}

async function initSignUpPage() {
  const controller = initAuthPage({ mode: 'signup' });
  const authState = await getAuthState();

  if (authState.hasAccount) {
    const notice = document.querySelector('#auth-account-exists');
    if (notice) notice.hidden = false;
    const signInLink = document.querySelector('[data-auth-signin-link]');
    if (signInLink) signInLink.textContent = 'Sign in instead';
  }

  updateStrengthOnLoad();
  return controller;
}

function updateStrengthOnLoad() {
  const passwordInput = document.querySelector('#auth-password');
  if (passwordInput) passwordInput.dispatchEvent(new Event('input'));
}

export { initAuthPage, initLoginPage, initSignUpPage, readRedirectTarget };
