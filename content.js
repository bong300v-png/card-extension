// Content Script - Form Filler

// Guard: nếu đã inject rồi thì dừng ngay — tránh lỗi redeclare
if (window.__cardFillExtLoaded) { /* already loaded */ }
else { window.__cardFillExtLoaded = true;

// Pick the right prototype so the native setter bypasses React's value tracker
function getNativeValueSetter(el) {
  const tag = el && el.tagName;
  let proto;
  if (tag === 'SELECT') proto = window.HTMLSelectElement.prototype;
  else if (tag === 'TEXTAREA') proto = window.HTMLTextAreaElement.prototype;
  else proto = window.HTMLInputElement.prototype;
  return Object.getOwnPropertyDescriptor(proto, 'value').set;
}

function setVal(el, value) {
  if (!el) return false;
  try {
    // Reset React's internal value tracker so React detects the change
    if (el._valueTracker) el._valueTracker.setValue('');
    const nativeSetter = getNativeValueSetter(el);
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

let latestFillData = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setSelectVal(el, tryValues) {
  if (!el) return false;
  const tries = Array.isArray(tryValues) ? tryValues : [tryValues];
  for (let tryVal of tries) {
    if (tryVal === undefined || tryVal === null || tryVal === '') continue;
    const lc = String(tryVal).toLowerCase().trim();
    for (let opt of el.options) {
      const optValue = String(opt.value || '').toLowerCase().trim();
      const optText = String(opt.text || '').toLowerCase().trim();
      if (!optValue && !optText) continue;
      if (
        optValue === lc ||
        optValue.includes(lc) ||
        optText === lc ||
        optText.includes(lc) ||
        (optValue && lc.includes(optValue)) ||
        (optText && lc.includes(optText))
      ) {
        try {
          if (el._valueTracker) el._valueTracker.setValue('');
          const nativeSetter = getNativeValueSetter(el);
          nativeSetter.call(el, opt.value);
        } catch (_) {
          el.value = opt.value;
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
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
  if (rect.right < 0 || rect.bottom < 0) return false;
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

async function fillForm(data) {
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

  // Card number
  tryFill('Card Number', [
    '[autocomplete="cc-number"]',
    '[name*="card_number"]', '[name*="cardnumber"]', '[name*="card-number"]',
    '[name*="number"][name*="card"]',
    '[id*="card_number"]', '[id*="cardnumber"]', '[id*="card-number"]',
    '[id*="cardNumber"]',
    '[data-elements-stable-field-name="cardNumber"]',
    '[data-field="cardNumber"]', '[data-testid*="card-number"]',
    // aria-label (Stripe Elements dùng cái này, không phụ thuộc ngôn ngữ UI)
    'input[aria-label*="Card number"]', 'input[aria-label*="card number"]',
    'input[aria-label*="Card Number"]', 'input[aria-label*="卡号"]',
    'input[placeholder*="Card number"]', 'input[placeholder*="card number"]',
    'input[placeholder*="1234 5678"]', 'input[placeholder*="•••• ••••"]'
  ], el => {
    return setVal(el, data.cardNumber);
  }, ['card number', 'card no', 'card details', 'số thẻ']);

  // Expiry combined
  const expEl = findField([
    '[autocomplete="cc-exp"]',
    '[name*="expiry"]', '[name*="expdate"]', '[name*="exp_date"]',
    '[name*="card_exp"]', '[id*="expiry"]', '[id*="cardExpiry"]',
    // aria-label (Stripe dùng "Expiration", "Expiry date")
    'input[aria-label*="Expir"]', 'input[aria-label*="expir"]',
    'input[aria-label*="到期"]', 'input[aria-label*="Valid"]',
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
    // aria-label (Stripe dùng "CVC", "Security code")
    'input[aria-label*="CVC"]', 'input[aria-label*="CVV"]',
    'input[aria-label*="Security code"]', 'input[aria-label*="security code"]',
    'input[aria-label*="安全码"]',
    'input[placeholder*="CVV"]', 'input[placeholder*="CVC"]',
    'input[placeholder*="security"]', 'input[placeholder*="123"]'
  ], el => setVal(el, data.cvv));

  // Name — try full name first, then first+last separately
  const [firstName, ...lastParts] = data.name.split(' ');
  const lastName = lastParts.join(' ');
  const fullNameEl = findField([
    '[autocomplete="cc-name"]', '[autocomplete="name"]',
    '[name="name"]', '[id="name"]',
    '[name*="billingName"]', '[id*="billingName"]',
    '[name*="customer_name"]', '[id*="customer_name"]',
    '[data-testid*="name"] input', '[data-test*="name"] input',
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
    '[name="email"]', '[id="email"]',
    '[name*="customer_email"]', '[id*="customer_email"]',
    '[data-testid*="email"] input', '[data-test*="email"] input',
    '[name*="email"]', '[id*="email"]',
    'input[placeholder*="email"]', 'input[placeholder*="Email"]'
  ], el => setVal(el, data.email));

  // Phone
  tryFill('Phone', [
    '[autocomplete="tel"]', '[type="tel"]',
    '[name="phone"]', '[id="phone"]',
    '[name*="customer_phone"]', '[id*="customer_phone"]',
    '[data-testid*="phone"] input', '[data-test*="phone"] input',
    '[name*="phone"]', '[name*="telephone"]', '[name*="mobile"]',
    '[id*="phone"]', 'input[placeholder*="phone"]', 'input[placeholder*="Phone"]'
  ], el => setVal(el, data.phone ? String(data.phone).replace(/^\+\d+\s*/, '') : '9637711285'));

  tryFill('Business', [
    '[autocomplete="organization"]',
    '[name="Business name"]', '[id="businessName"]',
    '[name*="business"]', '[id*="business"]',
    '[name*="company"]', '[id*="company"]',
    '[name*="organization"]', '[id*="organization"]',
    '[data-testid*="business"] input', '[data-test*="business"] input',
    'input[placeholder*="Business"]', 'input[placeholder*="Company"]'
  ], el => setVal(el, `${lastName || firstName} Services`));

  tryFill('Phone Country', [
    '[autocomplete="never-autocomplete-country-code"]',
    'select[aria-label*="Phone number country code"]'
  ], el => {
    if (el.tagName === 'SELECT') return setSelectVal(el, [data.countryCode, data.countryName]);
    return false;
  });

  tryFill('Country', [
    '[autocomplete="country"]', '[autocomplete="country-name"]', '[autocomplete="billing country"]',
    'select[name*="country"]', 'select[id*="country"]',
    '[name="country"]', '[name="billingCountry"]', '[id="billingCountry"]', '[name="billing_country"]', '[name="billing[country]"]',
    '[name="order[country]"]', '[name="address[country]"]',
    '[id="country"]', '[id="billing-country"]', '[id="shipping-country"]',
    '[data-field="country"]', '[data-testid*="country"]',
    'select[class*="country"]'
  ], el => {
    if (el.tagName === 'SELECT') return setSelectVal(el, [data.countryCode, data.countryName]);
    return setVal(el, data.countryName);
  });

  // Give React-controlled forms a tick to re-render ZIP/State validation rules based on new country
  await sleep(200);

  // Address line 1
  tryFill('Address', [
    '[autocomplete="street-address"]', '[autocomplete="address-line1"]', '[autocomplete="billing address-line1"]',
    '[name="billingAddressLine1"]', '[id="billingAddressLine1"]',
    '[name*="address1"]', '[name*="address_1"]', '[name*="address-1"]',
    '[name="address"]', '[id*="address1"]', '[id*="address_line1"]',
    '[id*="address-line-1"]', '[name*="street"]', '[id*="street"]',
    'input[placeholder*="Street"]', 'input[placeholder*="Address line 1"]',
    'input[placeholder*="Address"]'
  ], el => setVal(el, data.address), ['address line 1', 'address', 'street address', 'địa chỉ']);

  // Address line 2
  try {
    const addr2El = findField([
      '[autocomplete="address-line2"]', '[autocomplete="billing address-line2"]',
      '[name="billingAddressLine2"]', '[id="billingAddressLine2"]',
      '[name*="address2"]', '[name*="address_2"]', '[name*="apt"]',
      '[id*="address2"]', 'input[placeholder*="Apt"]', 'input[placeholder*="Suite"]',
      'input[placeholder*="Address line 2"]'
    ]);
    if (addr2El && data.address2) setVal(addr2El, data.address2);
  } catch (_) {}

  // City
  tryFill('City', [
    '[autocomplete="address-level2"]', '[autocomplete="billing address-level2"]',
    '[name="billingLocality"]', '[id="billingLocality"]',
    '[name*="city"]', '[name*="billing_city"]', '[name*="shipping_city"]',
    '[name*="town"]', '[name*="suburb"]',
    '[id*="city"]', '[id*="billing-city"]', '[id*="shipping-city"]',
    'input[placeholder*="City"]', 'input[placeholder*="Town"]',
    'input[placeholder*="Suburb"]', 'input[placeholder*="Thành phố"]'
  ], el => setVal(el, data.city), ['city', 'town', 'suburb', 'thành phố']);

  // State / Province
  tryFill('State', [
    '[autocomplete="address-level1"]', '[autocomplete="billing address-level1"]',
    '[name="billingAdministrativeArea"]', '[id="billingAdministrativeArea"]',
    '[name*="state"]', '[name*="province"]', '[id*="state"]',
    'select[name*="state"]', 'input[placeholder*="State"]', 'input[placeholder*="Province"]'
  ], el => {
    if (el.tagName === 'SELECT') {
      const ok = setSelectVal(el, [data.state, data.city, data.countryName, data.countryCode]);
      if (!ok) {
        const fallback = Array.from(el.options).find(opt => opt.value && !opt.disabled);
        if (fallback) {
          el.value = fallback.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      }
      return ok;
    }
    return setVal(el, data.state);
  });

  // ZIP / Postal
  tryFill('ZIP', [
    '[autocomplete="postal-code"]', '[autocomplete="billing postal-code"]',
    '[name="billingPostalCode"]', '[id="billingPostalCode"]',
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
    '[autocomplete="country"]', '[autocomplete="country-name"]', '[autocomplete="billing country"]',
    'select[name*="country"]', 'select[id*="country"]',
    '[name="country"]', '[name="billingCountry"]', '[id="billingCountry"]', '[name="billing_country"]', '[name="billing[country]"]',
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


// ── Submit Form ──────────────────────────────────────────────
/**
 * Tìm và click nút submit trên trang hiện tại.
 * Thứ tự ưu tiên (giống stripe_pay.py nhưng bổ sung nhiều fallback
 * để hoạt động trên nhiều ngôn ngữ / nhiều loại trang):
 *  1. CSS class cố định của Stripe (không phụ thuộc ngôn ngữ)
 *  2. button[type="submit"] visible
 *  3. input[type="submit"] visible
 *  4. Nút có text khớp các từ khoá (đa ngôn ngữ)
 *  5. aria-label khớp từ khoá
 *  6. Fallback: submit form trực tiếp
 */
function findAndClickSubmit() {
  // 1. Stripe-specific class (language-agnostic)
  const stripeBtn = document.querySelector('button.SubmitButton');
  if (stripeBtn && isVisible(stripeBtn)) {
    stripeBtn.scrollIntoView({ block: 'center', behavior: 'smooth' });
    stripeBtn.click();
    return { found: true, method: 'stripe-class' };
  }

  // 2. button[type="submit"] — visible first
  const submitBtns = Array.from(document.querySelectorAll('button[type="submit"], input[type="submit"]'));
  const visibleSubmit = submitBtns.find(el => isVisible(el));
  if (visibleSubmit) {
    visibleSubmit.scrollIntoView({ block: 'center', behavior: 'smooth' });
    visibleSubmit.click();
    return { found: true, method: 'type-submit' };
  }

  // 3. Button with matching text / value (multi-language)
  const SUBMIT_KEYWORDS = [
    // English
    'submit', 'pay', 'place order', 'buy now', 'confirm', 'checkout',
    'subscribe', 'complete', 'purchase', 'continue', 'proceed',
    // Vietnamese
    'đặt hàng', 'thanh toán', 'xác nhận', 'mua ngay', 'tiếp tục', 'hoàn thành',
    // Chinese
    '提交', '支付', '确认', '下单', '购买', '继续',
    // Spanish
    'pagar', 'confirmar', 'comprar', 'enviar',
    // French
    'payer', 'confirmer', 'commander', 'envoyer',
    // German
    'bestellen', 'bezahlen', 'kaufen', 'weiter',
    // Portuguese
    'pagar', 'confirmar', 'comprar',
    // Japanese
    '購入', '注文', '支払',
  ];

  const allBtns = Array.from(document.querySelectorAll('button, [role="button"]'));
  for (const btn of allBtns) {
    if (!isVisible(btn)) continue;
    const text = (btn.textContent || btn.innerText || btn.value || '').trim().toLowerCase();
    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
    const combined = text + ' ' + ariaLabel;
    if (SUBMIT_KEYWORDS.some(kw => combined.includes(kw))) {
      btn.scrollIntoView({ block: 'center', behavior: 'smooth' });
      btn.click();
      return { found: true, method: 'keyword-match', text: text.slice(0, 30) };
    }
  }

  // 4. Any hidden type=submit (fallback for multi-step forms)
  if (submitBtns.length > 0) {
    submitBtns[0].click();
    return { found: true, method: 'hidden-submit' };
  }

  // 5. Submit the form directly (last resort)
  const form = document.querySelector('form');
  if (form) {
    const fakeSubmit = document.createElement('input');
    fakeSubmit.type = 'submit';
    fakeSubmit.style.display = 'none';
    form.appendChild(fakeSubmit);
    fakeSubmit.click();
    form.removeChild(fakeSubmit);
    return { found: true, method: 'form-submit' };
  }

  return { found: false, method: 'none' };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'FILL_FORM') {
    latestFillData = message.data;
    fillForm(message.data)
      .then(results => sendResponse({ success: true, results }))
      .catch(e => sendResponse({ success: false, error: e.message }));
  }

  // FILL_AND_SUBMIT: fill xong → đợi Stripe/React render → submit ngay trong frame này
  // Học từ stripe_pay.py: fill và submit trong cùng browser context, không relay qua popup
  if (message.type === 'FILL_AND_SUBMIT') {
    latestFillData = message.data;
    fillForm(message.data)
      .then(async (results) => {
        // Đợi 1500ms để React/Stripe re-render sau khi điền
        await new Promise(r => setTimeout(r, 1500));
        const submitResult = findAndClickSubmit();
        sendResponse({ success: true, results, submit: submitResult });
      })
      .catch(e => sendResponse({ success: false, error: e.message }));
  }

  if (message.type === 'SUBMIT_FORM') {
    try {
      const result = findAndClickSubmit();
      sendResponse({ success: result.found, method: result.method, text: result.text });
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  }

  if (message.type === 'PING') {
    sendResponse({ alive: true });
  }
  return true;
});


} // end guard
