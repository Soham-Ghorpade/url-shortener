/**
 * URL Shortener Frontend Application Logic
 * Pure vanilla JavaScript with zero external dependencies.
 */

// Key used to store the JWT authentication token in browser localStorage
const TOKEN_STORAGE_KEY = 'token';
const EMAIL_STORAGE_KEY = 'user_email';

// Cached DOM elements
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const authStatus = document.getElementById('auth-status');
const userDisplay = document.getElementById('user-display');
const logoutBtn = document.getElementById('logout-btn');
const noticeEl = document.getElementById('notice');

const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');

const shortenForm = document.getElementById('shorten-form');
const linksTbody = document.getElementById('links-tbody');

/**
 * Normalizes varied backend error structures into a single readable string.
 * Handles:
 * 1. Plain string or HTML response.
 * 2. Simple object error: { error: "..." } or { message: "..." }.
 * 3. Raw Zod error serialization: { error: { issues: [...] } } or { issues: [...] }.
 * 4. Zod .format() tree: { error: { _errors: [], field: { _errors: [] } } }.
 */
function parseApiError(errorData, fallbackStatus = 'Request failed') {
  if (!errorData) {
    return fallbackStatus;
  }

  // If the server responded with a plain text string
  if (typeof errorData === 'string') {
    return errorData;
  }

  // If an inner error property is present, inspect it
  const payload = errorData.error !== undefined ? errorData.error : errorData;

  // Direct string error: { error: "that short code is already taken" }
  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload.message === 'string') {
    return payload.message;
  }

  // Raw Zod validation error containing an issues array
  const issues = Array.isArray(payload.issues) ? payload.issues : (Array.isArray(errorData.issues) ? errorData.issues : null);
  if (issues && issues.length > 0) {
    return issues
      .map((issue) => {
        const path = issue.path && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
        return `${path}${issue.message}`;
      })
      .join(', ');
  }

  // Zod .format() tree traversal
  const collectedErrors = [];
  function walkZodFormat(node, path = '') {
    if (!node || typeof node !== 'object') return;

    if (Array.isArray(node._errors) && node._errors.length > 0) {
      const field = path ? `${path}: ` : '';
      collectedErrors.push(`${field}${node._errors.join(', ')}`);
    }

    for (const key of Object.keys(node)) {
      if (key !== '_errors' && typeof node[key] === 'object' && node[key] !== null) {
        const nextPath = path ? `${path}.${key}` : key;
        walkZodFormat(node[key], nextPath);
      }
    }
  }

  walkZodFormat(payload);

  if (collectedErrors.length > 0) {
    return collectedErrors.join('; ');
  }

  return fallbackStatus;
}

/**
 * Display a user-facing notice/alert banner.
 * Uses textContent to ensure no unescaped HTML can be injected.
 */
function showNotice(message, type = 'error') {
  noticeEl.textContent = message;
  noticeEl.className = `notice ${type}`;
  noticeEl.classList.remove('hidden');
}

/**
 * Dismiss the notice banner.
 */
function clearNotice() {
  noticeEl.textContent = '';
  noticeEl.className = 'notice hidden';
}

/**
 * Wrapper for fetch that injects the Authorization header,
 * automatically parses JSON/text, and handles 401 session expiry.
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  // Handle unauthorized / expired token
  if (response.status === 401) {
    handleUnauthorized();
    throw new Error('Session expired or unauthorized. Please log in again.');
  }

  // Parse JSON or text response body
  let responseData = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMsg = parseApiError(responseData, `HTTP ${response.status} ${response.statusText}`);
    const error = new Error(errorMsg);
    error.status = response.status;
    error.data = responseData;
    throw error;
  }

  return responseData;
}

/**
 * Clears local credentials and resets the UI to logged-out state.
 */
function handleUnauthorized() {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(EMAIL_STORAGE_KEY);
  updateAuthViews();
  showNotice('Session expired. Please log in again.', 'error');
}

/**
 * Update UI view visibility based on authentication status.
 */
function updateAuthViews() {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const userEmail = localStorage.getItem(EMAIL_STORAGE_KEY);

  if (token) {
    authSection.classList.add('hidden');
    appSection.classList.remove('hidden');
    authStatus.classList.remove('hidden');
    userDisplay.textContent = userEmail || 'Logged in';
    fetchLinks();
  } else {
    authSection.classList.remove('hidden');
    appSection.classList.add('hidden');
    authStatus.classList.add('hidden');
    userDisplay.textContent = '';
  }
}

/**
 * Switch tabs between Login and Sign Up.
 */
function switchTab(mode) {
  clearNotice();
  if (mode === 'login') {
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
  } else {
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
  }
}

// Tab click handlers
tabLogin.addEventListener('click', () => switchTab('login'));
tabSignup.addEventListener('click', () => switchTab('signup'));

/**
 * Handles User Login.
 */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearNotice();

  const submitBtn = document.getElementById('login-submit-btn');
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';

  try {
    const data = await apiRequest('/user/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data && data.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
      loginForm.reset();
      updateAuthViews();
      showNotice('Logged in successfully.', 'success');
    } else {
      showNotice('Login response did not contain a token.', 'error');
    }
  } catch (err) {
    showNotice(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Log In';
  }
});

/**
 * Handles User Sign Up, followed by automatic login.
 */
signupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearNotice();

  const submitBtn = document.getElementById('signup-submit-btn');
  const firstname = document.getElementById('signup-firstname').value.trim();
  const lastname = document.getElementById('signup-lastname').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing up...';

  try {
    // 1. Sign up user
    await apiRequest('/user/signup', {
      method: 'POST',
      body: JSON.stringify({ firstname, lastname, email, password })
    });

    // 2. Automatically log in after successful signup
    submitBtn.textContent = 'Logging in...';
    const loginData = await apiRequest('/user/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (loginData && loginData.token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, loginData.token);
      localStorage.setItem(EMAIL_STORAGE_KEY, email);
      signupForm.reset();
      updateAuthViews();
      showNotice('Account created and logged in.', 'success');
    } else {
      // Fallback if auto-login token wasn't returned
      switchTab('login');
      showNotice('Account created. Please log in.', 'success');
    }
  } catch (err) {
    showNotice(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign Up';
  }
});

/**
 * Handles User Logout.
 */
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(EMAIL_STORAGE_KEY);
  updateAuthViews();
  clearNotice();
  showNotice('Logged out.', 'success');
});

/**
 * Handles Creating a Short URL.
 */
shortenForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearNotice();

  const submitBtn = document.getElementById('shorten-submit-btn');
  const urlInput = document.getElementById('target-url');
  const codeInput = document.getElementById('custom-code');

  const url = urlInput.value.trim();
  const code = codeInput.value.trim();

  const payload = { url };
  if (code) {
    payload.code = code;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';

  try {
    await apiRequest('/shorten', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    urlInput.value = '';
    codeInput.value = '';
    showNotice('Short URL created.', 'success');
    fetchLinks();
  } catch (err) {
    showNotice(err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Short URL';
  }
});

/**
 * Fetches the user's links from the backend and renders them in the table.
 */
async function fetchLinks() {
  renderLoadingState();

  try {
    const data = await apiRequest('/codes');
    const links = Array.isArray(data?.codes) ? data.codes : [];
    renderLinksTable(links);
  } catch (err) {
    // If not a 401 (handled separately), display error in table
    renderErrorState(err.message);
  }
}

/**
 * Renders the loading state in the table.
 */
function renderLoadingState() {
  clearTable();
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 3;
  cell.className = 'loading-state';
  cell.textContent = 'Loading links...';
  row.appendChild(cell);
  linksTbody.appendChild(row);
}

/**
 * Renders an error message row in the table.
 */
function renderErrorState(message) {
  clearTable();
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.colSpan = 3;
  cell.className = 'empty-state';
  cell.textContent = `Failed to load links: ${message}`;
  row.appendChild(cell);
  linksTbody.appendChild(row);
}

/**
 * Clears all rows from the table body.
 */
function clearTable() {
  while (linksTbody.firstChild) {
    linksTbody.removeChild(linksTbody.firstChild);
  }
}

/**
 * Renders links into the table.
 * Strictly uses DOM creation and textContent to prevent XSS.
 */
function renderLinksTable(links) {
  clearTable();

  if (links.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.className = 'empty-state';
    cell.textContent = 'No shortened links yet.';
    row.appendChild(cell);
    linksTbody.appendChild(row);
    return;
  }

  links.forEach((item) => {
    const fullShortUrl = `${window.location.origin}/${item.shortCode}`;

    const row = document.createElement('tr');

    // 1. Short URL column
    const shortUrlCell = document.createElement('td');
    const codeSpan = document.createElement('span');
    codeSpan.className = 'url-code';
    codeSpan.textContent = fullShortUrl;
    shortUrlCell.appendChild(codeSpan);
    row.appendChild(shortUrlCell);

    // 2. Original URL column
    const targetUrlCell = document.createElement('td');
    targetUrlCell.className = 'target-url-cell';
    targetUrlCell.title = item.targetURL;
    targetUrlCell.textContent = item.targetURL;
    row.appendChild(targetUrlCell);

    // 3. Actions column
    const actionsCell = document.createElement('td');
    actionsCell.className = 'actions-cell';

    const actionsGroup = document.createElement('div');
    actionsGroup.className = 'actions-group';

    // Copy Button
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-secondary';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyToClipboard(fullShortUrl, copyBtn));
    actionsGroup.appendChild(copyBtn);

    // Open in New Tab Button
    const openBtn = document.createElement('button');
    openBtn.type = 'button';
    openBtn.className = 'btn-secondary';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => {
      window.open(fullShortUrl, '_blank', 'noopener,noreferrer');
    });
    actionsGroup.appendChild(openBtn);

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => handleDeleteLink(item.id, item.shortCode));
    actionsGroup.appendChild(deleteBtn);

    actionsCell.appendChild(actionsGroup);
    row.appendChild(actionsCell);

    linksTbody.appendChild(row);
  });
}

/**
 * Copies the short URL to clipboard and gives brief button feedback.
 */
async function copyToClipboard(text, buttonElement) {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Copied!';
    setTimeout(() => {
      buttonElement.textContent = originalText;
    }, 1500);
  } catch {
    showNotice('Failed to copy link to clipboard.', 'error');
  }
}

/**
 * Confirms with user and sends DELETE /:id to remove the link.
 */
async function handleDeleteLink(id, shortCode) {
  const confirmed = window.confirm(`Are you sure you want to delete /${shortCode}?`);
  if (!confirmed) return;

  clearNotice();

  try {
    await apiRequest(`/${id}`, {
      method: 'DELETE'
    });
    showNotice(`Deleted /${shortCode}.`, 'success');
    fetchLinks();
  } catch (err) {
    showNotice(err.message, 'error');
  }
}

// Initial view setup on page load
updateAuthViews();
