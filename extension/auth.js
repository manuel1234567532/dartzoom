// ============================================
// AUTH MODULE — Reusable across extensions
// ============================================

const AUTH_CONFIG = {
  apiUrl: 'https://followdarts.com/api/license',
  appKey: 'dartzoom',
  redirectUrl: 'popup.html',
  appName: 'Welcome',
  appSubtitle: 'Log in to your account',
  logoSrc: 'logo_labs.png',
  discordUrl: 'https://discord.gg/PTuCpkJ8fy',
  minUsernameLength: 3,
  minPasswordLength: 4,
};

// ============================================

document.addEventListener('DOMContentLoaded', () => {

  // ---------- Apply config to DOM ----------

  const titleEl = document.getElementById('authTitle');
  const subtitleEl = document.getElementById('authSubtitle');
  const logoImg = document.getElementById('authLogoImg');
  const discordLink = document.getElementById('authDiscordLink');
  const footerEl = document.getElementById('authFooter');

  if (titleEl) titleEl.textContent = AUTH_CONFIG.appName;
  if (subtitleEl) subtitleEl.textContent = AUTH_CONFIG.appSubtitle;
  if (logoImg) logoImg.src = AUTH_CONFIG.logoSrc;

  if (AUTH_CONFIG.discordUrl && discordLink) {
    discordLink.href = AUTH_CONFIG.discordUrl;
  } else if (footerEl) {
    footerEl.style.display = 'none';
  }

  // ---------- Elements ----------

  const authError = document.getElementById('authError');
  const authLoading = document.getElementById('authLoading');
  const authTabs = document.querySelectorAll('.auth-tab');
  const authTabsContainer = document.getElementById('authTabs');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const loginBtn = document.getElementById('loginBtn');
  const registerBtn = document.getElementById('registerBtn');

  const loginUsername = document.getElementById('loginUsername');
  const loginPassword = document.getElementById('loginPassword');
  const registerUsername = document.getElementById('registerUsername');
  const registerPassword = document.getElementById('registerPassword');
  const registerLicenseKey = document.getElementById('registerLicenseKey');

  let currentMode = 'login';

  // ---------- Helpers ----------

  function showError(msg) {
    if (authError) authError.textContent = msg;
  }

  function setLoading(loading) {
    const activeBtn = currentMode === 'login' ? loginBtn : registerBtn;
    if (activeBtn) activeBtn.style.display = loading ? 'none' : 'flex';
    if (authLoading) authLoading.classList.toggle('show', loading);

    [loginUsername, loginPassword, registerUsername, registerPassword, registerLicenseKey].forEach(el => {
      if (el) el.disabled = loading;
    });
  }

  function onAuthSuccess(username, password, data) {
    const storageData = {
      authUsername: username,
      authPassword: password,
      authValid: true,
      authCheckedAt: Date.now()
    };
    if (data.updateAvailable) storageData.updateAvailable = true;
    if (data.latestVersion) storageData.latestVersion = data.latestVersion;
    if (data.downloadUrl) storageData.downloadUrl = data.downloadUrl;
    if (data.subscription) storageData.subscription = data.subscription;
    if (data.expiry) storageData.expiry = data.expiry;
    if (data.timeleft) storageData.timeleft = data.timeleft;
    chrome.storage.local.set(storageData, () => {
      window.location.href = AUTH_CONFIG.redirectUrl;
    });
  }

  function showBanned(username) {
    if (loginForm) loginForm.classList.add('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (authTabsContainer) authTabsContainer.classList.add('hidden');

    const bannedInfo = document.getElementById('authBannedInfo');
    if (bannedInfo) {
      bannedInfo.classList.add('show');
      const bannedKey = document.getElementById('bannedKeyDisplay');
      if (bannedKey) bannedKey.textContent = username;
    }
    showError('');
  }

  function resetToLogin() {
    if (loginForm) loginForm.classList.remove('hidden');
    if (registerForm) registerForm.classList.add('hidden');
    if (authTabsContainer) {
      authTabsContainer.classList.remove('hidden');
      authTabsContainer.classList.remove('register-active');
    }

    const bannedInfo = document.getElementById('authBannedInfo');
    if (bannedInfo) bannedInfo.classList.remove('show');

    authTabs.forEach(t => t.classList.remove('active'));
    const loginTab = document.querySelector('[data-tab="login"]');
    if (loginTab) loginTab.classList.add('active');
    currentMode = 'login';

    chrome.storage.local.remove(['authUsername', 'authPassword', 'authValid', 'authCheckedAt', 'updateAvailable']);
    if (loginUsername) loginUsername.value = '';
    if (loginPassword) loginPassword.value = '';
    showError('');
  }

  // ---------- Check existing session ----------

  function checkExistingAuth() {
    chrome.storage.local.get(['authUsername', 'authPassword', 'authValid'], (result) => {
      if (result.authUsername && result.authPassword && result.authValid) {
        verifySession(result.authUsername, result.authPassword);
      }
    });
  }

  async function verifySession(username, password) {
    const checking = document.getElementById('authChecking');
    if (checking) checking.classList.add('show');

    try {
      const res = await fetch(`${AUTH_CONFIG.apiUrl}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, app: AUTH_CONFIG.appKey, version: chrome.runtime.getManifest().version })
      });
      const data = await res.json();
      if (checking) checking.classList.remove('show');

      if (data.success) {
        chrome.storage.local.set({ authCheckedAt: Date.now() });
        // ★ Update-Info speichern
        if (data.updateAvailable) {
          chrome.storage.local.set({ updateAvailable: true, downloadUrl: data.downloadUrl || null });
        } else if (data.latestVersion) {
          chrome.storage.local.set({ latestVersion: data.latestVersion, downloadUrl: data.downloadUrl || null });
          chrome.storage.local.remove('updateAvailable');
        }
        // ★ Subscription-Info speichern
        if (data.subscription) chrome.storage.local.set({ subscription: data.subscription });
        if (data.expiry) chrome.storage.local.set({ expiry: data.expiry });
        if (data.timeleft) chrome.storage.local.set({ timeleft: data.timeleft });
        window.location.href = AUTH_CONFIG.redirectUrl;
      } else if (data.banned) {
        chrome.storage.local.set({ authValid: false }, () => showBanned(username));
      } else {
        chrome.storage.local.set({ authValid: false });
        showError(data.message || 'Session expired. Please log in again.');
      }
    } catch (e) {
      if (checking) checking.classList.remove('show');
      window.location.href = AUTH_CONFIG.redirectUrl;
    }
  }

  // ---------- Login ----------

  async function handleLogin() {
    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (!username || !password) {
      showError('Please enter username and password');
      return;
    }

    setLoading(true);
    showError('');

    try {
      const res = await fetch(`${AUTH_CONFIG.apiUrl}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, app: AUTH_CONFIG.appKey, version: chrome.runtime.getManifest().version })
      });
      const data = await res.json();

      if (data.success) {
        onAuthSuccess(username, password, data);
      } else if (data.banned) {
        setLoading(false);
        showBanned(username);
      } else {
        showError(data.message || 'Login failed');
        setLoading(false);
      }
    } catch (e) {
      showError('Could not connect to server');
      setLoading(false);
    }
  }

  // ---------- Register ----------

  async function handleRegister() {
    const username = registerUsername.value.trim();
    const password = registerPassword.value;
    const licenseKey = registerLicenseKey.value.trim();

    if (!username || !password || !licenseKey) {
      showError('Please fill in all fields');
      return;
    }
    if (username.length < AUTH_CONFIG.minUsernameLength) {
      showError(`Username must be at least ${AUTH_CONFIG.minUsernameLength} characters`);
      return;
    }
    if (password.length < AUTH_CONFIG.minPasswordLength) {
      showError(`Password must be at least ${AUTH_CONFIG.minPasswordLength} characters`);
      return;
    }

    setLoading(true);
    showError('');

    try {
      const res = await fetch(`${AUTH_CONFIG.apiUrl}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, licenseKey, app: AUTH_CONFIG.appKey, version: chrome.runtime.getManifest().version })
      });
      const data = await res.json();

      if (data.success) {
        onAuthSuccess(username, password, data);
      } else {
        showError(data.message || 'Registration failed');
        setLoading(false);
      }
    } catch (e) {
      showError('Could not connect to server');
      setLoading(false);
    }
  }

  // ---------- Tab switching ----------

  authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      currentMode = tab.dataset.tab;

      authTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (authTabsContainer) {
        authTabsContainer.classList.toggle('register-active', currentMode === 'register');
      }

      if (currentMode === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }

      showError('');
    });
  });

  // ---------- Event listeners ----------

  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (registerBtn) registerBtn.addEventListener('click', handleRegister);

  [loginUsername, loginPassword].forEach(input => {
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
  });

  [registerUsername, registerPassword, registerLicenseKey].forEach(input => {
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleRegister(); });
  });

  const bannedNewKeyBtn = document.getElementById('bannedNewKeyBtn');
  if (bannedNewKeyBtn) bannedNewKeyBtn.addEventListener('click', resetToLogin);

  // ---------- Start ----------

  checkExistingAuth();
});