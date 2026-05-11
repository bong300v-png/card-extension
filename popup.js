// ========== RANDOM BIN PREFIXES ==========
const KNOWN_BINS = [
  '400000','411111','431274','438857','446200','453978','461046','471624','476173','491427',
  '510510','511111','520082','530101','535502','541333','552000','554506','558855','559000',
  '601100','622126','640000','650000','356600','357400','358000','376900','378282',
  '402360','402361','407728','409402','422222','424242','445670','459150'
];

function randomBIN() {
  // Randomly pick a known prefix OR generate a plausible one
  if (Math.random() < 0.5) {
    return KNOWN_BINS[Math.floor(Math.random() * KNOWN_BINS.length)];
  }
  // Generate random Visa/MC/Discover prefix
  const prefixes = ['4', '51', '52', '53', '54', '55', '6011', '65'];
  let bin = prefixes[Math.floor(Math.random() * prefixes.length)];
  while (bin.length < 6) bin += Math.floor(Math.random() * 10);
  return bin.slice(0, 6);
}

// ========== CARD DATA ==========
const COUNTRY_DATA = {
  US: {
    name: 'United States', flag: '🇺🇸',
    phone: () => `+1 ${rand(200,999)}-${rand(100,999)}-${rand(1000,9999)}`,
    streets: ['Main St','Oak Ave','Maple Dr','Cedar Ln','Elm St','Park Blvd','Lake Rd'],
    locations: [
      { city: 'New York', state: 'NY', zip: '10001' },
      { city: 'Los Angeles', state: 'CA', zip: '90001' },
      { city: 'Chicago', state: 'IL', zip: '60601' },
      { city: 'Houston', state: 'TX', zip: '77001' },
      { city: 'Miami', state: 'FL', zip: '33101' },
      { city: 'Seattle', state: 'WA', zip: '98101' },
      { city: 'Boston', state: 'MA', zip: '02108' }
    ]
  },
  ES: {
    name: 'Spain', flag: '🇪🇸',
    phone: () => `+34 6${rand(10,99)} ${rand(100,999)} ${rand(100,999)}`,
    streets: ['Calle Mayor','Gran Vía','Paseo de Gracia','Calle Serrano','Calle Alcalá'],
    locations: [
      { city: 'Madrid', state: 'Madrid', zip: '28001' },
      { city: 'Barcelona', state: 'Catalonia', zip: '08001' },
      { city: 'Valencia', state: 'Valencia', zip: '46001' },
      { city: 'Seville', state: 'Andalusia', zip: '41001' },
      { city: 'Zaragoza', state: 'Aragon', zip: '50001' }
    ]
  },
  GB: {
    name: 'United Kingdom', flag: '🇬🇧',
    phone: () => `+44 7${rand(100,999)} ${rand(100,999)} ${rand(100,999)}`,
    streets: ['High Street','Victoria Road','Church Lane','Station Road','King Street'],
    locations: [
      { city: 'London', state: 'England', zip: 'E1 6AN' },
      { city: 'Manchester', state: 'England', zip: 'M1 1AD' },
      { city: 'Birmingham', state: 'England', zip: 'B1 1BB' },
      { city: 'Glasgow', state: 'Scotland', zip: 'G1 1DA' },
      { city: 'Edinburgh', state: 'Scotland', zip: 'EH1 1BB' }
    ]
  },
  FR: {
    name: 'France', flag: '🇫🇷',
    phone: () => `+33 6 ${rand(10,99)} ${rand(10,99)} ${rand(10,99)} ${rand(10,99)}`,
    streets: ['Rue de la Paix','Boulevard Saint-Germain','Rue du Faubourg','Rue de Rivoli'],
    locations: [
      { city: 'Paris', state: 'Île-de-France', zip: '75001' },
      { city: 'Marseille', state: 'Provence-Alpes-Côte d\'Azur', zip: '13001' },
      { city: 'Lyon', state: 'Auvergne-Rhône-Alpes', zip: '69001' },
      { city: 'Toulouse', state: 'Occitanie', zip: '31000' },
      { city: 'Nice', state: 'Provence-Alpes-Côte d\'Azur', zip: '06000' }
    ]
  },
  DE: {
    name: 'Germany', flag: '🇩🇪',
    phone: () => `+49 15${rand(1,9)} ${rand(1000,9999)} ${rand(1000,9999)}`,
    streets: ['Hauptstraße','Bahnhofstraße','Gartenstraße','Kirchgasse','Bergstraße'],
    locations: [
      { city: 'Berlin', state: 'Berlin', zip: '10115' },
      { city: 'Munich', state: 'Bavaria', zip: '80331' },
      { city: 'Hamburg', state: 'Hamburg', zip: '20095' },
      { city: 'Cologne', state: 'North Rhine-Westphalia', zip: '50667' },
      { city: 'Frankfurt', state: 'Hesse', zip: '60311' }
    ]
  },
  IT: {
    name: 'Italy', flag: '🇮🇹',
    phone: () => `+39 3${rand(10,99)} ${rand(100,999)} ${rand(1000,9999)}`,
    streets: ['Via Roma','Via Garibaldi','Corso Italia','Via Nazionale','Piazza del Popolo'],
    locations: [
      { city: 'Rome', state: 'Lazio', zip: '00118' },
      { city: 'Milan', state: 'Lombardy', zip: '20121' },
      { city: 'Naples', state: 'Campania', zip: '80121' },
      { city: 'Turin', state: 'Piedmont', zip: '10121' },
      { city: 'Florence', state: 'Tuscany', zip: '50122' }
    ]
  },
  CA: {
    name: 'Canada', flag: '🇨🇦',
    phone: () => `+1 ${rand(200,999)}-${rand(100,999)}-${rand(1000,9999)}`,
    streets: ['Main St','Maple Ave','Oak Drive','King Street','Queen Street'],
    locations: [
      { city: 'Toronto', state: 'ON', zip: 'M5H 2N2' },
      { city: 'Vancouver', state: 'BC', zip: 'V6B 1A1' },
      { city: 'Montreal', state: 'QC', zip: 'H3Z 2Y7' },
      { city: 'Calgary', state: 'AB', zip: 'T2P 2G8' },
      { city: 'Ottawa', state: 'ON', zip: 'K1P 1J1' }
    ]
  },
  AU: {
    name: 'Australia', flag: '🇦🇺',
    phone: () => `+61 4${rand(10,99)} ${rand(100,999)} ${rand(100,999)}`,
    streets: ['George St','Pitt St','Collins St','Bourke St','Crown St'],
    locations: [
      { city: 'Sydney', state: 'NSW', zip: '2000' },
      { city: 'Melbourne', state: 'VIC', zip: '3000' },
      { city: 'Brisbane', state: 'QLD', zip: '4000' },
      { city: 'Perth', state: 'WA', zip: '6000' },
      { city: 'Adelaide', state: 'SA', zip: '5000' }
    ]
  },
  BR: {
    name: 'Brazil', flag: '🇧🇷',
    phone: () => `+55 ${rand(11,99)} 9${rand(1000,9999)}-${rand(1000,9999)}`,
    streets: ['Rua das Flores','Av. Paulista','Alameda Santos','Av. Brasil'],
    locations: [
      { city: 'São Paulo', state: 'SP', zip: '01000-000' },
      { city: 'Rio de Janeiro', state: 'RJ', zip: '20000-000' },
      { city: 'Belo Horizonte', state: 'MG', zip: '30130-000' },
      { city: 'Brasília', state: 'DF', zip: '70040-000' },
      { city: 'Curitiba', state: 'PR', zip: '80010-000' }
    ]
  },
  VN: {
    name: 'Vietnam', flag: '🇻🇳',
    phone: () => `+84 9${rand(10,99)} ${rand(100,999)} ${rand(1000,9999)}`,
    streets: ['Nguyen Hue','Le Loi','Hai Ba Trung','Tran Hung Dao','Ly Thuong Kiet'],
    locations: [
      { city: 'Hanoi', state: 'Hanoi', zip: '100000' },
      { city: 'Ho Chi Minh City', state: 'Ho Chi Minh', zip: '700000' },
      { city: 'Da Nang', state: 'Da Nang', zip: '550000' },
      { city: 'Can Tho', state: 'Can Tho', zip: '900000' },
      { city: 'Hai Phong', state: 'Hai Phong', zip: '180000' }
    ]
  },
  TH: {
    name: 'Thailand', flag: '🇹🇭',
    phone: () => `+66 ${rand(80,99)}-${rand(100,999)}-${rand(1000,9999)}`,
    streets: ['Sukhumvit Rd','Silom Rd','Rama IV Rd','Ratchadaphisek Rd'],
    locations: [
      { city: 'Bangkok', state: 'Bangkok', zip: '10110' },
      { city: 'Chiang Mai', state: 'Chiang Mai', zip: '50000' },
      { city: 'Phuket', state: 'Phuket', zip: '83000' },
      { city: 'Pattaya', state: 'Chonburi', zip: '20150' },
      { city: 'Khon Kaen', state: 'Khon Kaen', zip: '40000' }
    ]
  },
  SG: {
    name: 'Singapore', flag: '🇸🇬',
    phone: () => `+65 ${rand(8000,9999)} ${rand(1000,9999)}`,
    streets: ['Orchard Road','Marina Boulevard','Raffles Place','Shenton Way'],
    locations: [
      { city: 'Singapore', state: 'Central', zip: '018956' },
      { city: 'Singapore', state: 'East', zip: '469000' },
      { city: 'Singapore', state: 'West', zip: '609915' },
      { city: 'Singapore', state: 'North', zip: '730000' },
      { city: 'Singapore', state: 'North-East', zip: '540000' }
    ]
  },
  JP: {
    name: 'Japan', flag: '🇯🇵',
    phone: () => `+81 ${rand(80,90)}-${rand(1000,9999)}-${rand(1000,9999)}`,
    streets: ['Shibuya','Shinjuku','Ginza','Akihabara','Roppongi'],
    locations: [
      { city: 'Tokyo', state: 'Tokyo', zip: '100-0001' },
      { city: 'Osaka', state: 'Osaka', zip: '530-0001' },
      { city: 'Kyoto', state: 'Kyoto', zip: '600-8001' },
      { city: 'Yokohama', state: 'Kanagawa', zip: '220-0001' },
      { city: 'Sapporo', state: 'Hokkaido', zip: '060-0000' }
    ]
  },
  NL: {
    name: 'Netherlands', flag: '🇳🇱',
    phone: () => `+31 6 ${rand(10,99)} ${rand(10,99)} ${rand(10,99)} ${rand(10,99)}`,
    streets: ['Keizersgracht','Herengracht','Prinsengracht','Leidsestraat'],
    locations: [
      { city: 'Amsterdam', state: 'North Holland', zip: '1011 AB' },
      { city: 'Rotterdam', state: 'South Holland', zip: '3011 AA' },
      { city: 'The Hague', state: 'South Holland', zip: '2511 AA' },
      { city: 'Utrecht', state: 'Utrecht', zip: '3511 AA' },
      { city: 'Eindhoven', state: 'North Brabant', zip: '5611 AA' }
    ]
  },
  MX: {
    name: 'Mexico', flag: '🇲🇽',
    phone: () => `+52 ${rand(55,99)} ${rand(1000,9999)} ${rand(1000,9999)}`,
    streets: ['Av. Insurgentes','Paseo de la Reforma','Av. Juárez','Calle Madero'],
    locations: [
      { city: 'Mexico City', state: 'CDMX', zip: '06000' },
      { city: 'Guadalajara', state: 'Jalisco', zip: '44100' },
      { city: 'Monterrey', state: 'Nuevo León', zip: '64000' },
      { city: 'Puebla', state: 'Puebla', zip: '72000' },
      { city: 'Tijuana', state: 'Baja California', zip: '22000' }
    ]
  }
};

const FIRST_NAMES = ['James','John','Robert','Michael','William','David','Richard','Joseph','Thomas','Charles','Emily','Emma','Olivia','Ava','Sophia','Isabella','Mia','Charlotte','Amelia','Harper'];
const LAST_NAMES = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Wilson','Taylor','Anderson','Thomas','Jackson','White','Harris','Martin','Thompson','Young'];
const EMAIL_DOMAINS = ['gmail.com','yahoo.com','outlook.com','hotmail.com','proton.me','mail.com','icloud.com'];

// ========== UTILS ==========
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rndChar() { return 'ABCDEFGHJKLMNPQRSTUVWXYZ'[rand(0, 22)]; }
function pick(arr) { return arr[rand(0, arr.length - 1)]; }

// ========== LUHN ==========
function luhnCheck(number) {
  let sum = 0, alt = false;
  for (let i = number.length - 1; i >= 0; i--) {
    let n = parseInt(number[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ========== CARD TYPE ==========
function getCardType(bin) {
  if (/^4/.test(bin)) return { type: 'Visa', len: 16, cvvLen: 3 };
  if (/^5[1-5]/.test(bin) || /^2(2[2-9][1-9]|[3-6]\d{2}|7[01]\d|720)/.test(bin)) return { type: 'Mastercard', len: 16, cvvLen: 3 };
  if (/^3[47]/.test(bin)) return { type: 'Amex', len: 15, cvvLen: 4 };
  if (/^(6011|622|64[4-9]|65)/.test(bin)) return { type: 'Discover', len: 16, cvvLen: 3 };
  if (/^35(2[89]|[3-8]\d)/.test(bin)) return { type: 'JCB', len: 16, cvvLen: 3 };
  return { type: 'Unknown', len: 16, cvvLen: 3 };
}

function formatCard(number, type) {
  if (type === 'Amex') {
    return `${number.slice(0,4)} ${number.slice(4,10)} ${number.slice(10)}`;
  }
  return number.replace(/(.{4})/g, '$1 ').trim();
}

// ========== CARD GENERATION ==========
function generateCard(bin, opts = {}) {
  const info = getCardType(bin);
  let number = bin;
  while (number.length < info.len - 1) number += rand(0, 9);
  for (let d = 0; d <= 9; d++) {
    if (luhnCheck(number + d)) { number = number + d; break; }
  }

  // Expiry
  let month, year;
  if (opts.dateAuto || !opts.month) {
    const y = new Date().getFullYear() + rand(1, 5);
    month = String(rand(1, 12)).padStart(2, '0');
    year = String(y).slice(-2);
  } else {
    month = String(opts.month).padStart(2, '0');
    year = String(opts.year).padStart(2, '0');
  }

  // CVV
  let cvv;
  if (opts.cvvAuto || !opts.cvv) {
    cvv = Array.from({ length: info.cvvLen }, () => rand(0, 9)).join('');
  } else {
    cvv = opts.cvv;
  }

  return {
    number,
    formatted: formatCard(number, info.type),
    month,
    year,
    cvv,
    type: info.type
  };
}

// ========== FAKE DATA ==========
async function generateFakeData(countryCode) {
  const c = COUNTRY_DATA[countryCode] || COUNTRY_DATA.US;
  
  // Base data using our hardcoded fallback
  let firstName = pick(FIRST_NAMES);
  let lastName = pick(LAST_NAMES);
  let streetNum = rand(1, 999);
  let street = pick(c.streets || ['Main St']);
  let loc = pick(c.locations) || {};
  let city = loc.city || '';
  let state = loc.state || '';
  let zip = loc.zip || '';
  let phone = c.phone ? c.phone() : '';

  // Supported randomuser.me nationalities
  const supportedNats = ['AU', 'BR', 'CA', 'CH', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB', 'IE', 'IN', 'IR', 'MX', 'NL', 'NO', 'NZ', 'RS', 'TR', 'UA', 'US'];
  
  if (supportedNats.includes(countryCode)) {
    try {
      setStatus('⏳ Fetching real address data...', 'loading');
      const res = await fetch(`https://randomuser.me/api/?nat=${countryCode.toLowerCase()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results[0]) {
          const user = data.results[0];
          firstName = user.name.first;
          lastName = user.name.last;
          streetNum = user.location.street.number;
          street = user.location.street.name;
          city = user.location.city;
          state = user.location.state;
          zip = String(user.location.postcode);
          phone = user.phone;
        }
      }
    } catch (e) {
      console.warn("API fallback to local data", e);
    }
  }

  return {
    name: `${firstName} ${lastName}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${rand(1,99)}@${pick(EMAIL_DOMAINS)}`,
    phone: phone,
    address: `${streetNum} ${street}`,
    address2: rand(0, 1) ? `Apt ${rand(1, 999)}` : '',
    city: city,
    state: state,
    zip: zip,
    age: rand(18, 45),              // random age 18–45
    countryCode: countryCode,
    countryName: c.name
  };
}

// ========== UI HELPERS ==========
function setStatus(msg, type = 'info') {
  const el = document.getElementById('statusBar');
  el.className = `status-bar ${type}`;
  el.innerHTML = type === 'loading'
    ? `<span class="loader"></span> ${msg}`
    : msg;
}

function clearResults() {
  document.getElementById('results').innerHTML = '';
}

function addResult(html) {
  document.getElementById('results').insertAdjacentHTML('beforeend', html);
}

function copyText(text, btnEl) {
  navigator.clipboard.writeText(text).then(() => {
    btnEl.textContent = '✓ Copied';
    btnEl.classList.add('copied');
    setTimeout(() => {
      btnEl.textContent = '📋 Copy';
      btnEl.classList.remove('copied');
    }, 1500);
  });
}

function typeClass(type) {
  const map = { Visa: 'type-visa', Mastercard: 'type-mastercard', Amex: 'type-amex', Discover: 'type-discover' };
  return map[type] || 'type-unknown';
}

function renderCard(card, idx = 0) {
  return `
    <div class="card-item">
      <div class="card-number-row">
        <span class="card-number">${card.formatted}</span>
        <span class="card-type-badge ${typeClass(card.type)}">${card.type}</span>
        <button class="copy-btn" onclick="copyText('${card.number}|${card.month}/${card.year}|${card.cvv}', this)">📋 Copy</button>
      </div>
      <div class="card-details">
        <div class="card-detail">Exp: <span>${card.month}/${card.year}</span></div>
        <div class="card-detail">CVV: <span>${card.cvv}</span></div>
      </div>
    </div>`;
}

// ========== GET OPTIONS ==========
function getOptions() {
  return {
    bin: document.getElementById('binInput').value.trim().replace(/\D/g, ''),
    dateAuto: document.getElementById('dateAuto').checked,
    cvvAuto: document.getElementById('cvvAuto').checked,
    random: document.getElementById('randomMode').checked,
    month: document.getElementById('monthInput').value.trim(),
    year: document.getElementById('yearInput').value.trim(),
    cvv: document.getElementById('cvvInput').value.trim(),
    qty: Math.min(50, Math.max(1, parseInt(document.getElementById('qtyInput').value) || 1)),
    country: document.getElementById('countrySelect').value
  };
}

// ========== GENERATE ==========
function doGenerate() {
  const opts = getOptions();
  let binWasAuto = false;
  if (opts.bin.length < 6) {
    // Auto-generate a random BIN
    opts.bin = randomBIN();
    binWasAuto = true;
    document.getElementById('binInput').value = opts.bin;
    document.getElementById('binInput').style.borderColor = 'rgba(168,85,247,0.7)';
    setTimeout(() => document.getElementById('binInput').style.borderColor = '', 800);
  }

  clearResults();
  const cards = [];
  for (let i = 0; i < opts.qty; i++) {
    cards.push(generateCard(opts.bin, opts));
  }

  cards.forEach((c, i) => addResult(renderCard(c, i)));
  setStatus(`✅ Generated ${cards.length} card${cards.length > 1 ? 's' : ''}`, 'success');

  // Only clear BIN if it was auto-generated; keep user-entered BIN
  if (binWasAuto) {
    document.getElementById('binInput').value = '';
  }
  return cards;
}

// ========== VALIDATE ==========
function doValidate() {
  const opts = getOptions();
  const num = opts.bin.replace(/\s/g, '');
  if (num.length < 13) { setStatus('⚠️ Nhập số thẻ đầy đủ để validate', 'error'); return; }

  clearResults();
  const valid = luhnCheck(num);
  const info = getCardType(num.slice(0, 6));
  addResult(`
    <div class="validate-result ${valid ? 'validate-ok' : 'validate-fail'}">
      ${valid ? '✅ Valid card number' : '❌ Invalid card number (Luhn check failed)'}
      — ${info.type}
    </div>`);
  setStatus(valid ? '✅ Luhn check passed' : '❌ Luhn check failed', valid ? 'success' : 'error');
}

// ========== BIN CHECK ==========
async function doBinCheck() {
  const opts = getOptions();
  let bin = opts.bin.slice(0, 8);
  if (bin.length < 6) {
    bin = randomBIN();
    document.getElementById('binInput').value = bin;
  }

  clearResults();
  setStatus('🔍 Looking up BIN...', 'loading');

  try {
    const res = await fetch(`https://lookup.binlist.net/${bin}`, {
      headers: { 'Accept-Version': '3' }
    });
    if (!res.ok) throw new Error('Not found');
    const data = await res.json();

    addResult(`
      <div class="bin-info">
        <div class="bin-info-title">🔍 BIN ${bin} — ${data.scheme?.toUpperCase() || 'Unknown'}</div>
        <div class="bin-info-grid">
          <div class="bin-info-row">Type: <span>${data.type || '-'}</span></div>
          <div class="bin-info-row">Brand: <span>${data.brand || data.scheme || '-'}</span></div>
          <div class="bin-info-row">Bank: <span>${data.bank?.name || '-'}</span></div>
          <div class="bin-info-row">Country: <span>${data.country?.name || '-'} ${data.country?.emoji || ''}</span></div>
          <div class="bin-info-row">Category: <span>${data.prepaid ? 'Prepaid' : (data.type === 'credit' ? 'Credit' : 'Debit')}</span></div>
          <div class="bin-info-row">Currency: <span>${data.country?.currency || '-'}</span></div>
        </div>
      </div>`);
    setStatus('✅ BIN info loaded', 'success');
  } catch (e) {
    addResult(`<div class="validate-result validate-fail">❌ BIN not found or API unavailable</div>`);
    setStatus('❌ BIN lookup failed', 'error');
  }
}

// ========== GEN & FILL ==========
async function doGenFill() {
  const opts = getOptions();
  if (opts.bin.length < 6) {
    opts.bin = randomBIN();
    document.getElementById('binInput').value = opts.bin;
  }

  const card = generateCard(opts.bin, opts);
  const fakeData = await generateFakeData(opts.country);

  const fillData = {
    cardNumber: card.number,
    month: card.month,
    year: card.year,
    cvv: card.cvv,
    ...fakeData,
    countryCode: opts.country,          // ISO code from select (US/ES/GB...)
    countryName: (COUNTRY_DATA[opts.country] || COUNTRY_DATA.US).name
  };

  setStatus('⚡ Filling form...', 'loading');
  clearResults();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject content script
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['content.js']
      });
    } catch (_) {}

    let response = null;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { type: 'FILL_FORM', data: fillData });
    } catch (msgErr) {
      // Content script not reachable (chrome:// pages, etc.)
      setStatus('⚠️ Trang này không cho phép inject script', 'error');
      return;
    }

    // Show card info
    addResult(renderCard(card));

    // Build fill summary from results
    const results = response?.results || [];
    const filled  = results.filter(r => r.status === 'ok').map(r => r.field);
    const skipped = results.filter(r => r.status === 'skip').map(r => r.field);

    const summaryRows = [
      `<div class="bin-info-row">Name: <span>${fillData.name}</span></div>`,
      `<div class="bin-info-row">Email: <span>${fillData.email}</span></div>`,
      `<div class="bin-info-row">Phone: <span>${fillData.phone}</span></div>`,
      `<div class="bin-info-row">Address: <span>${fillData.address}${fillData.address2 ? ', ' + fillData.address2 : ''}</span></div>`,
      `<div class="bin-info-row">City: <span>${fillData.city}</span></div>`,
      `<div class="bin-info-row">ZIP: <span>${fillData.zip}</span></div>`,
      `<div class="bin-info-row">Country: <span>${fillData.countryCode} — ${fillData.countryName}</span></div>`,
    ].join('');

    const statusLine = filled.length > 0
      ? `<div style="font-size:10px;color:#10b981;margin-top:5px">✅ Filled: ${filled.join(', ')}</div>`
      : '';
    const skipLine = skipped.length > 0
      ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">⏭ Not found: ${skipped.join(', ')}</div>`
      : '';

    addResult(`
      <div class="bin-info">
        <div class="bin-info-title">📋 Fill Data</div>
        <div class="bin-info-grid">${summaryRows}</div>
        ${statusLine}${skipLine}
      </div>`);

    const totalFilled = filled.length;
    if (totalFilled === 0) {
      setStatus('⚠️ Không tìm thấy form field nào để fill', 'error');
    } else {
      setStatus(`✅ Filled ${totalFilled} field${totalFilled > 1 ? 's' : ''}`, 'success');
      // Auto-close popup after successful fill so user can see the form
      setTimeout(() => window.close(), 1200);
    }

  } catch (e) {
    // Never crash — just show soft warning
    setStatus('⚠️ Không fill được — thử reload trang rồi bấm lại', 'error');
    console.warn('GenFill error:', e);
  }
}

// ========== EVENT LISTENERS ==========
document.addEventListener('DOMContentLoaded', () => {
  // Restore last user-entered BIN (if any) and clear results on popup open
  const binInput = document.getElementById('binInput');
  binInput.value = '';
  try {
    chrome.storage?.local.get(['savedBin'], (res) => {
      if (res && typeof res.savedBin === 'string') binInput.value = res.savedBin;
    });
  } catch (_) {}
  clearResults();
  // Toggle manual fields visibility based on checkbox state
  function updateManualRow() {
    const dateAuto = document.getElementById('dateAuto').checked;
    const cvvAuto = document.getElementById('cvvAuto').checked;
    const row = document.getElementById('manualRow');
    row.classList.toggle('hidden', dateAuto && cvvAuto);

    document.getElementById('monthInput').disabled = dateAuto;
    document.getElementById('yearInput').disabled = dateAuto;
    document.getElementById('cvvInput').disabled = cvvAuto;

    document.getElementById('monthInput').style.opacity = dateAuto ? '0.4' : '1';
    document.getElementById('yearInput').style.opacity = dateAuto ? '0.4' : '1';
    document.getElementById('cvvInput').style.opacity = cvvAuto ? '0.4' : '1';
  }

  document.getElementById('dateAuto').addEventListener('change', updateManualRow);
  document.getElementById('cvvAuto').addEventListener('change', updateManualRow);
  updateManualRow();

  // BIN input - only numbers + persist user-entered BIN
  document.getElementById('binInput').addEventListener('input', function () {
    this.value = this.value.replace(/\D/g, '');
    try {
      chrome.storage?.local.set({ savedBin: this.value });
    } catch (_) {}
  });

  // Buttons
  document.getElementById('generateBtn').addEventListener('click', doGenerate);
  document.getElementById('validateBtn').addEventListener('click', doValidate);
  document.getElementById('binCheckBtn').addEventListener('click', doBinCheck);
  document.getElementById('genFillBtn').addEventListener('click', doGenFill);
  document.getElementById('genOnlyBtn').addEventListener('click', doGenerate);

  // Enter key on BIN input
  document.getElementById('binInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doGenerate();
  });

  // Theme toggle (light/dark placeholder)
  document.getElementById('themeBtn').addEventListener('click', () => {
    document.getElementById('themeBtn').textContent =
      document.getElementById('themeBtn').textContent === '🌙' ? '☀️' : '🌙';
  });

  // Make copyText global
  window.copyText = copyText;
});
