// ========== TEMP MAIL CLIENT ==========
// Shared between popup.js and background.js — must work in both contexts.
//
// Talks to a cloudflare_temp_email deployment. The owner of this extension
// uses https://mail.drawo.ink. Override BASE URL / site password from the
// Settings panel; values persist in chrome.storage.local.

(function (root) {
  // -------- Owner defaults --------
  // Pre-filled so the extension works without manual setup for the owner of
  // this fork. Override at any time via the Settings panel (⚙️ icon).
  const DEFAULT_BASE_URL = 'https://mail.drawo.ink';
  const DEFAULT_SITE_PASSWORD = 'thuong1';   // x-custom-auth for mail.drawo.ink
  const DEFAULT_DOMAIN = '';                  // empty = let server pick
  const DEFAULT_POLL_INTERVAL_MS = 5000;      // active polling (panel open)
  const DEFAULT_POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes total
  const HISTORY_LIMIT = 20;

  const STORAGE_KEYS = {
    config: 'tempMailConfig',
    activeSession: 'tempMailActiveSession',
    history: 'tempMailHistory',
  };

  // ---------- Storage helpers ----------
  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (res) => resolve(res || {}));
    });
  }
  function storageSet(obj) {
    return new Promise((resolve) => {
      chrome.storage.local.set(obj, () => resolve());
    });
  }

  async function getConfig() {
    const res = await storageGet([STORAGE_KEYS.config]);
    const stored = res[STORAGE_KEYS.config] || {};
    // Honor explicit empty strings the user typed (e.g. clearing a password
    // because their server doesn't require one) — only fall back to the
    // default when the field has never been set at all.
    const pick = (key, def) => (stored[key] === undefined ? def : stored[key]);
    return {
      baseUrl: (pick('baseUrl', DEFAULT_BASE_URL) || '').replace(/\/+$/, ''),
      sitePassword: pick('sitePassword', DEFAULT_SITE_PASSWORD),
      domain: pick('domain', DEFAULT_DOMAIN),
      pollIntervalMs: stored.pollIntervalMs || DEFAULT_POLL_INTERVAL_MS,
      pollTimeoutMs: stored.pollTimeoutMs || DEFAULT_POLL_TIMEOUT_MS,
    };
  }

  async function saveConfig(partial) {
    const cur = await getConfig();
    const next = { ...cur, ...partial };
    if (typeof next.baseUrl === 'string') next.baseUrl = next.baseUrl.replace(/\/+$/, '');
    await storageSet({ [STORAGE_KEYS.config]: next });
    return next;
  }

  async function getActiveSession() {
    const res = await storageGet([STORAGE_KEYS.activeSession]);
    return res[STORAGE_KEYS.activeSession] || null;
  }

  async function setActiveSession(session) {
    await storageSet({ [STORAGE_KEYS.activeSession]: session });
  }

  async function clearActiveSession() {
    await storageSet({ [STORAGE_KEYS.activeSession]: null });
  }

  async function getHistory() {
    const res = await storageGet([STORAGE_KEYS.history]);
    return Array.isArray(res[STORAGE_KEYS.history]) ? res[STORAGE_KEYS.history] : [];
  }

  async function pushHistory(entry) {
    const list = await getHistory();
    const without = list.filter((it) => it.address !== entry.address);
    without.unshift(entry);
    const trimmed = without.slice(0, HISTORY_LIMIT);
    await storageSet({ [STORAGE_KEYS.history]: trimmed });
    return trimmed;
  }

  // ---------- HTTP ----------
  function buildHeaders(cfg, jwt) {
    const h = { 'Content-Type': 'application/json', 'x-lang': 'en' };
    if (cfg.sitePassword) h['x-custom-auth'] = cfg.sitePassword;
    if (jwt) h['Authorization'] = `Bearer ${jwt}`;
    return h;
  }

  async function httpJson(url, opts) {
    const res = await fetch(url, opts);
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }
    if (!res.ok) {
      const msg = typeof body === 'string' && body
        ? body
        : (body && body.error) || `HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  // ---------- API methods ----------
  async function createAddress({ name, domain } = {}) {
    const cfg = await getConfig();
    if (!cfg.baseUrl) throw new Error('Chưa cấu hình Base URL trong Settings');

    // Generate a name that is extremely unlikely to collide with previously
    // created ones (8 random alphanumeric + 4 char base36 timestamp suffix).
    // We also check local history so we never re-issue the same one.
    const usedNames = new Set(
      (await getHistory())
        .map((h) => (h.address || '').split('@')[0].toLowerCase())
    );
    let candidate = name;
    if (!candidate) {
      for (let i = 0; i < 8; i++) {
        const c = `${randomToken(8)}${Date.now().toString(36).slice(-4)}`;
        if (![...usedNames].some((u) => u.endsWith(c.toLowerCase()))) {
          candidate = c;
          break;
        }
        candidate = c;
      }
    }
    const body = {
      name: candidate,
      enableRandomSubdomain: false,
      cf_token: '',
    };
    if (domain || cfg.domain) body.domain = domain || cfg.domain;

    const res = await httpJson(`${cfg.baseUrl}/api/new_address`, {
      method: 'POST',
      headers: buildHeaders(cfg, null),
      body: JSON.stringify(body),
    });
    if (!res || !res.address || !res.jwt) {
      throw new Error('Server không trả về address/jwt — kiểm tra Base URL / Site Password');
    }
    return { address: res.address, jwt: res.jwt, addressId: res.address_id };
  }

  async function fetchSettings({ jwt }) {
    const cfg = await getConfig();
    return httpJson(`${cfg.baseUrl}/api/settings`, {
      method: 'GET',
      headers: buildHeaders(cfg, jwt),
    });
  }

  async function listMails({ jwt, limit = 10, offset = 0 }) {
    const cfg = await getConfig();
    return httpJson(`${cfg.baseUrl}/api/parsed_mails?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: buildHeaders(cfg, jwt),
    });
  }

  // ---------- Random helpers ----------
  function randomToken(len = 8) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    const arr = new Uint8Array(len);
    (self.crypto || crypto).getRandomValues(arr);
    for (let i = 0; i < len; i++) s += chars[arr[i] % chars.length];
    return s;
  }

  // ---------- OTP extraction ----------
  //
  // Returns an array of candidate OTPs ordered by confidence. Each entry:
  //   { code, confidence: 'high'|'medium'|'low', source: 'subject'|'text'|'html' }
  //
  // High-confidence: matches "code", "OTP", "verification", "passcode",
  //   "verify", "pin", "mã", "xác nhận", "xác thực" near a 4-8 digit number
  //   or alphanumeric 4-8 char token.
  // Medium: any standalone 4-8 digit number in subject.
  // Low: any standalone 4-8 digit number in body.
  function extractOtps(mail) {
    const candidates = [];
    const text = String(mail.text || '');
    const subject = String(mail.subject || '');
    const html = String(mail.html || '');
    const htmlPlain = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');

    const keyword = '(?:code|otp|passcode|password|verification|verify|pin|token|c[oó]de|m[aã]|x[aá]c\\s*nh[aậ]n|x[aá]c\\s*th[uự]c|m[aã]\\s*x[aá]c)';
    const sep = '(?:\\s*[:=\\-]?\\s*|\\s+is\\s+|\\s+l[aà]\\s+)';
    // Alphanumeric codes MUST contain at least one digit to avoid matching
    // plain English/Vietnamese words ("code", "your", "verify", ...) that
    // happen to follow a keyword like "Verify your account".
    const codeAlpha = '((?=[A-Z0-9]*\\d)[A-Z0-9]{4,8})';
    const codeDigit = '(\\d{4,8})';

    const tryPatterns = [
      { rx: new RegExp(keyword + sep + codeDigit, 'i'), confidence: 'high' },
      { rx: new RegExp(keyword + sep + codeAlpha, 'i'), confidence: 'high' },
      { rx: new RegExp('\\b' + codeDigit + '\\b(?=[^\\d])', 'g'), confidence: 'medium', subjectOnly: true },
    ];

    const sources = [
      { name: 'subject', text: subject },
      { name: 'text', text: text || htmlPlain },
    ];

    for (const src of sources) {
      for (const p of tryPatterns) {
        if (p.subjectOnly && src.name !== 'subject') continue;
        let m;
        if (p.rx.global) {
          p.rx.lastIndex = 0;
          while ((m = p.rx.exec(src.text)) !== null) {
            candidates.push({ code: m[1], confidence: p.confidence, source: src.name });
            if (candidates.length > 20) break;
          }
        } else {
          m = src.text.match(p.rx);
          if (m && m[1]) candidates.push({ code: m[1], confidence: p.confidence, source: src.name });
        }
      }
    }
    // Fallback: any standalone 4-8 digit number in body (low confidence) — pick the first.
    if (!candidates.some((c) => c.confidence === 'high')) {
      const m = (text || htmlPlain).match(/\b(\d{4,8})\b/);
      if (m) candidates.push({ code: m[1], confidence: 'low', source: 'text' });
    }
    // Dedup
    const seen = new Set();
    const unique = [];
    for (const c of candidates) {
      const key = c.code + '|' + c.confidence;
      if (!seen.has(key)) { seen.add(key); unique.push(c); }
    }
    // Sort by confidence (high > medium > low), keep ordering otherwise
    const rank = { high: 0, medium: 1, low: 2 };
    unique.sort((a, b) => rank[a.confidence] - rank[b.confidence]);
    return unique;
  }

  // ---------- Public API ----------
  const TempMail = {
    DEFAULTS: {
      baseUrl: DEFAULT_BASE_URL,
      pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
      pollTimeoutMs: DEFAULT_POLL_TIMEOUT_MS,
      historyLimit: HISTORY_LIMIT,
    },
    STORAGE_KEYS,
    getConfig,
    saveConfig,
    getActiveSession,
    setActiveSession,
    clearActiveSession,
    getHistory,
    pushHistory,
    createAddress,
    fetchSettings,
    listMails,
    extractOtps,
    randomToken,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TempMail;
  } else {
    root.TempMail = TempMail;
  }
})(typeof self !== 'undefined' ? self : this);
