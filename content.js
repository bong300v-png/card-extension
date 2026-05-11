// Content Script - Form Filler

function setVal(el, value) {
  if (!el) return false;
  try {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  } catch (e) {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
}

function setSelectVal(el, tryValues) {
  if (!el) return false;
  const tries = Array.isArray(tryValues) ? tryValues : [tryValues];
  for (let tryVal of tries) {
    const lc = tryVal.toLowerCase();
    for (let opt of el.options) {
      if (
        opt.value.toLowerCase() === lc ||
        opt.value.toLowerCase().includes(lc) ||
        opt.text.toLowerCase() === lc ||
        opt.text.toLowerCase().includes(lc)
      ) {
        el.value = opt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
    }
  }
  return false;
}

function isVisible(el) {
  // More reliable than offsetParent — works with fixed/sticky/flex layouts
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  // Allow elements slightly off-screen (lazy-rendered sections)
  return rect.width > 0 || rect.height > 0 || el.tagName === 'SELECT';
}

// Find input associated with a <label> by its text content
function findFieldByLabel(keywords) {
  const labels = document.querySelectorAll('label, [data-label], p, span, div');
  for (let labelEl of labels) {
    const text = (labelEl.textContent || labelEl.getAttribute('data-label') || '').trim().toLowerCase();
    if (!text || text.length > 60) continue;
    for (let kw of keywords) {
      if (text === kw.toLowerCase() || text.startsWith(kw.toLowerCase())) {
        // 1. label[for] association
        if (labelEl.htmlFor) {
          const el = document.getElementById(labelEl.htmlFor);
          if (el && el.matches('input, select, textarea')) return el;
        }
        // 2. input inside the label element
        const inner = labelEl.querySelector('input, select, textarea');
        if (inner) return inner;
        // 3. next sibling
        let sib = labelEl.nextElementSibling;
        for (let i = 0; i < 4 && sib; i++) {
          if (sib.matches('input, select, textarea')) return sib;
          const found = sib.querySelector('input, select, textarea');
          if (found) return found;
          sib = sib.nextElementSibling;
        }
        // 4. parent’s next sibling
        const parent = labelEl.parentElement;
        if (parent) {
          let psib = parent.nextElementSibling;
          for (let i = 0; i < 2 && psib; i++) {
            const found = psib.querySelector('input, select, textarea');
            if (found) return found;
            psib = psib.nextElementSibling;
          }
        }
      }
    }
  }
  return null;
}

function findField(selectors, labelKeywords = []) {
  // 1st pass: exact CSS match, visible
  for (let sel of selectors) {
    try {
      const all = document.querySelectorAll(sel);
      for (let el of all) {
        if (isVisible(el)) return el;
      }
    } catch (_) {}
  }
  // 2nd pass: any CSS match (hidden behind tab/step)
  for (let sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el) return el;
    } catch (_) {}
  }
  // 3rd pass: label text detection (floating labels, aria-label)
  if (labelKeywords.length) {
    const el = findFieldByLabel(labelKeywords);
    if (el) return el;
  }
  return null;
}

function fillForm(data) {
  const results = [];

  // tryFill with label support
  function tryFill(fieldName, selectors, fillFn, labelKws = []) {
    try {
      const el = findField(selectors, labelKws);
      if (!el) { results.push({ field: fieldName, status: 'skip' }); return; }
      const ok = fillFn(el);
      results.push({ field: fieldName, status: ok ? 'ok' : 'fail' });
    } catch (e) {
      results.push({ field: fieldName, status: 'error', msg: e.message });
    }
  }

  // Card number — IMPORTANT: avoid broad selectors that match name/other fields
  tryFill('Card Number', [
    '[autocomplete="cc-number"]',
    '[name*="card_number"]', '[name*="cardnumber"]', '[name*="card-number"]',
    '[name*="number"][name*="card"]',
    '[id*="card_number"]', '[id*="cardnumber"]', '[id*="card-number"]',
    '[id*="cardNumber"]',
    '[data-elements-stable-field-name="cardNumber"]',
    '[data-field="cardNumber"]', '[data-testid*="card-number"]',
    'input[placeholder*="Card number"]', 'input[placeholder*="card number"]',
    'input[placeholder*="1234 5678"]', 'input[placeholder*="•••• ••••"]'
  ], el => {
    // Fill exact number string (no spaces) to prevent masking script interference
    return setVal(el, data.cardNumber);
  }, ['card number', 'card no', 'card details', 'số thẻ']);

  // Expiry combined
  const expEl = findField([
    '[autocomplete="cc-exp"]',
    '[name*="expiry"]', '[name*="expdate"]', '[name*="exp_date"]',
    '[name*="card_exp"]', '[id*="expiry"]', '[id*="cardExpiry"]',
    'input[placeholder*="MM / YY"]', 'input[placeholder*="MM/YY"]',
    'input[placeholder*="MM/YYYY"]'
  ]);
  if (expEl) {
    try { setVal(expEl, `${data.month}/${data.year}`); results.push({ field: 'Expiry', status: 'ok' }); }
    catch (e) { results.push({ field: 'Expiry', status: 'error' }); }
  } else {
    // Separate month / year
    try {
      const monthEl = findField([
        '[autocomplete="cc-exp-month"]',
        '[name*="exp_month"]', '[name*="expiry_month"]', '[name*="exp-month"]',
        'select[name*="month"]', '[id*="expMonth"]', '[placeholder*="MM"]'
      ]);
      const yearEl = findField([
        '[autocomplete="cc-exp-year"]',
        '[name*="exp_year"]', '[name*="expiry_year"]', '[name*="exp-year"]',
        'select[name*="year"]', '[id*="expYear"]', '[placeholder*="YY"]'
      ]);
      if (monthEl) { setSelectVal(monthEl, [data.month]) || setVal(monthEl, data.month); }
      if (yearEl)  { setSelectVal(yearEl,  [data.year])  || setVal(yearEl,  data.year);  }
      if (monthEl || yearEl) results.push({ field: 'Expiry (split)', status: 'ok' });
      else results.push({ field: 'Expiry', status: 'skip' });
    } catch (e) { results.push({ field: 'Expiry', status: 'error' }); }
  }

  // CVV
  tryFill('CVV', [
    '[autocomplete="cc-csc"]',
    '[name*="cvv"]', '[name*="cvc"]', '[name*="csc"]',
    '[name*="security_code"]', '[name*="security-code"]',
    '[id*="cvv"]', '[id*="cvc"]', '[id*="cardCvc"]',
    'input[placeholder*="CVV"]', 'input[placeholder*="CVC"]',
    'input[placeholder*="security"]', 'input[placeholder*="123"]'
  ], el => setVal(el, data.cvv));

  // Name — try full name first, then first+last separately
  const [firstName, ...lastParts] = data.name.split(' ');
  const lastName = lastParts.join(' ');
  const fullNameEl = findField([
    '[autocomplete="cc-name"]', '[autocomplete="name"]',
    '[name*="full_name"]', '[name*="fullname"]', '[name*="full-name"]',
    '[name*="cardholder"]', '[name*="card_name"]', '[name*="card-name"]',
    '[name*="name_on_card"]', '[id*="cardName"]', '[id*="cardholder"]',
    '[id*="full_name"]', '[id*="fullname"]',
    'input[placeholder*="Name on card"]', 'input[placeholder*="Cardholder"]',
    'input[placeholder*="Full name"]', 'input[placeholder*="Full Name"]',
    'input[placeholder*="Your name"]', 'input[placeholder*="Tên đầy đủ"]'
  ], ['full name', 'full name', 'name on card', 'cardholder name', 'cardholder', 'tên đầy đủ']);
  if (fullNameEl) {
    setVal(fullNameEl, data.name);
    results.push({ field: 'Name', status: 'ok' });
  } else {
    // Try first name + last name separate fields
    const firstEl = findField([
      '[autocomplete="given-name"]',
      '[name*="first_name"]', '[name*="firstname"]', '[name*="first-name"]',
      '[id*="first_name"]', '[id*="firstname"]',
      'input[placeholder*="First name"]', 'input[placeholder*="First Name"]',
      'input[placeholder*="Given name"]'
    ]);
    const lastEl = findField([
      '[autocomplete="family-name"]',
      '[name*="last_name"]', '[name*="lastname"]', '[name*="last-name"]',
      '[name*="surname"]', '[id*="last_name"]', '[id*="lastname"]',
      'input[placeholder*="Last name"]', 'input[placeholder*="Last Name"]',
      'input[placeholder*="Surname"]'
    ]);
    if (firstEl) setVal(firstEl, firstName);
    if (lastEl)  setVal(lastEl, lastName || firstName);
    if (firstEl || lastEl) results.push({ field: 'Name (split)', status: 'ok' });
    else results.push({ field: 'Name', status: 'skip' });
  }

  // Email
  tryFill('Email', [
    '[autocomplete="email"]', '[type="email"]',
    '[name*="email"]', '[id*="email"]',
    'input[placeholder*="email"]', 'input[placeholder*="Email"]'
  ], el => setVal(el, data.email));

  // Phone
  tryFill('Phone', [
    '[autocomplete="tel"]', '[type="tel"]',
    '[name*="phone"]', '[name*="telephone"]', '[name*="mobile"]',
    '[id*="phone"]', 'input[placeholder*="phone"]', 'input[placeholder*="Phone"]'
  ], el => setVal(el, data.phone));

  // Address line 1
  tryFill('Address', [
    '[autocomplete="street-address"]', '[autocomplete="address-line1"]',
    '[name*="address1"]', '[name*="address_1"]', '[name*="address-1"]',
    '[name="address"]', '[id*="address1"]', '[id*="address_line1"]',
    '[id*="address-line-1"]', '[name*="street"]', '[id*="street"]',
    'input[placeholder*="Street"]', 'input[placeholder*="Address line 1"]',
    'input[placeholder*="Address"]'
  ], el => setVal(el, data.address), ['address line 1', 'address', 'street address', 'địa chỉ']);

  // Address line 2
  try {
    const addr2El = findField([
      '[autocomplete="address-line2"]',
      '[name*="address2"]', '[name*="address_2"]', '[name*="apt"]',
      '[id*="address2"]', 'input[placeholder*="Apt"]', 'input[placeholder*="Suite"]',
      'input[placeholder*="Address line 2"]'
    ]);
    if (addr2El && data.address2) setVal(addr2El, data.address2);
  } catch (_) {}

  // City
  tryFill('City', [
    '[autocomplete="address-level2"]',
    '[name*="city"]', '[name*="billing_city"]', '[name*="shipping_city"]',
    '[name*="town"]', '[name*="suburb"]',
    '[id*="city"]', '[id*="billing-city"]', '[id*="shipping-city"]',
    'input[placeholder*="City"]', 'input[placeholder*="Town"]',
    'input[placeholder*="Suburb"]', 'input[placeholder*="Thành phố"]'
  ], el => setVal(el, data.city), ['city', 'town', 'suburb', 'thành phố']);

  // State / Province
  tryFill('State', [
    '[autocomplete="address-level1"]',
    '[name*="state"]', '[name*="province"]', '[id*="state"]',
    'select[name*="state"]', 'input[placeholder*="State"]', 'input[placeholder*="Province"]'
  ], el => {
    if (el.tagName === 'SELECT') return setSelectVal(el, [data.state]) || setVal(el, data.state);
    return setVal(el, data.state);
  });

  // ZIP / Postal
  tryFill('ZIP', [
    '[autocomplete="postal-code"]',
    '[name*="zip"]', '[name*="postal"]', '[name*="postcode"]', '[name*="post_code"]',
    '[name*="billing_postcode"]', '[name*="billing_zip"]', '[name*="shipping_zip"]',
    '[id*="zip"]', '[id*="postal"]', '[id*="postcode"]', '[id*="post-code"]',
    'input[placeholder*="ZIP"]', 'input[placeholder*="Zip code"]',
    'input[placeholder*="Postal"]', 'input[placeholder*="Post code"]',
    'input[placeholder*="Postcode"]', 'input[placeholder*="Mã bưu điện"]'
  ], el => setVal(el, data.zip), ['postal code', 'post code', 'postcode', 'zip', 'zip code', 'mã bưu điện']);

  // Age
  tryFill('Age', [
    '[name*="age"]', '[id*="age"]',
    'input[placeholder*="Age"]', 'input[placeholder*="age"]',
    'input[placeholder*="Your age"]', 'input[type="number"][min="18"]',
    '[name*="birth_year"]', '[name*="birthyear"]', '[id*="birthyear"]'
  ], el => {
    // If it's a select (e.g. year of birth), pick a matching year
    if (el.tagName === 'SELECT') {
      const birthYear = String(new Date().getFullYear() - data.age);
      return setSelectVal(el, [birthYear]) || setVal(el, birthYear);
    }
    return setVal(el, String(data.age));
  });

  tryFill('Country', [
    '[autocomplete="country"]', '[autocomplete="country-name"]',
    'select[name*="country"]', 'select[id*="country"]',
    '[name="country"]', '[name="billing_country"]', '[name="billing[country]"]',
    '[name="order[country]"]', '[name="address[country]"]',
    '[id="country"]', '[id="billing-country"]', '[id="shipping-country"]',
    '[data-field="country"]', '[data-testid*="country"]',
    'select[class*="country"]'
  ], el => {
    if (el.tagName === 'SELECT') {
      const ok = setSelectVal(el, [data.countryCode, data.countryName]);
      if (!ok) {
        for (let opt of el.options) {
          if (opt.value && opt.value.length >= 2 && !opt.disabled) {
            el.value = opt.value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
          }
        }
      }
      return ok;
    }
    return setVal(el, data.countryName);
  });

  // Tick terms/consent checkboxes
  try {
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      const label = document.querySelector(`label[for="${cb.id}"]`);
      const text = (label?.textContent || cb.closest('label')?.textContent || '').toLowerCase();
      if (text.includes('agree') || text.includes('terms') || text.includes('accept') || text.includes('consent')) {
        if (!cb.checked) {
          cb.checked = true;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
  } catch (_) {}

  return results;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FILL_FORM') {
    try {
      const results = fillForm(message.data);
      sendResponse({ success: true, results });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }
  if (message.type === 'PING') {
    sendResponse({ alive: true });
  }
  return true;
});
