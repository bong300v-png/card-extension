// =====================================================================
// CardFill Pro — Content Script
// Robust form filler for payment + checkout forms.
//
// Strategy (in order of preference):
//   1) autocomplete="..." attributes (most reliable)
//   2) name / id / data-* / aria-* substring matches (incl. shadow DOM)
//   3) <label>-text association in multiple languages
//   4) <input placeholder> substring matches
//
// React / Vue / Solid all bypass `el.value = ...` because the value
// property is overridden by the framework. We use the native prototype
// setter and dispatch `input`, `change`, and (optionally) `blur` events
// so libraries like Cleave.js, IMask, Inputmask, and React controlled
// inputs all re-render with the new value.
// =====================================================================

(() => {
  if (window.__cardfillContentLoaded) return;
  window.__cardfillContentLoaded = true;

  // ----- DOM helpers -----

  const NATIVE_VALUE_SETTERS = {
    input: Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set,
    textarea: Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set,
    select: Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set
  };

  function fire(el, type, init) {
    const Ctor = (type === 'click' || type === 'pointerdown' || type === 'pointerup' ||
                  type === 'mousedown' || type === 'mouseup' || type === 'mouseover' ||
                  type === 'mouseenter' || type === 'mouseleave' || type === 'mouseout')
      ? MouseEvent
      : (type === 'keydown' || type === 'keyup' || type === 'keypress')
        ? KeyboardEvent
        : (type === 'input' || type === 'change' || type === 'focus' ||
           type === 'blur' || type === 'submit')
          ? (type === 'input' ? InputEvent : Event)
          : Event;

    try {
      el.dispatchEvent(new Ctor(type, Object.assign({ bubbles: true, cancelable: true }, init || {})));
    } catch (_) {
      el.dispatchEvent(new Event(type, { bubbles: true }));
    }
  }

  function setVal(el, value) {
    if (!el || value == null) return false;
    try {
      el.focus();
    } catch (_) {}

    try {
      const tag = (el.tagName || '').toLowerCase();
      const setter = NATIVE_VALUE_SETTERS[tag];
      if (setter) {
        setter.call(el, String(value));
      } else {
        el.value = String(value);
      }
    } catch (_) {
      try { el.value = String(value); } catch (_) { return false; }
    }

    // Some controlled-input libraries listen to `beforeinput` then mutate.
    fire(el, 'input', { data: String(value), inputType: 'insertText' });
    fire(el, 'change');
    return true;
  }

  function setSelectVal(el, tryValues) {
    if (!el || !el.options) return false;
    const tries = Array.isArray(tryValues) ? tryValues : [tryValues];
    const opts = Array.from(el.options);

    // Pass 1: exact value match
    for (const want of tries) {
      const w = String(want || '').trim().toLowerCase();
      if (!w) continue;
      const hit = opts.find(o => o.value.toLowerCase() === w);
      if (hit) return assignSelect(el, hit.value);
    }
    // Pass 2: exact text match
    for (const want of tries) {
      const w = String(want || '').trim().toLowerCase();
      if (!w) continue;
      const hit = opts.find(o => (o.text || '').toLowerCase() === w);
      if (hit) return assignSelect(el, hit.value);
    }
    // Pass 3: substring match (value or text)
    for (const want of tries) {
      const w = String(want || '').trim().toLowerCase();
      if (!w) continue;
      const hit = opts.find(o =>
        o.value.toLowerCase().includes(w) || (o.text || '').toLowerCase().includes(w)
      );
      if (hit) return assignSelect(el, hit.value);
    }
    return false;
  }

  function assignSelect(el, value) {
    const setter = NATIVE_VALUE_SETTERS.select;
    try {
      setter.call(el, value);
    } catch (_) {
      el.value = value;
    }
    fire(el, 'input');
    fire(el, 'change');
    return true;
  }

  function isVisible(el) {
    if (!el) return false;
    if (el.disabled) return false;
    if (el.type === 'hidden') return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    const rect = el.getBoundingClientRect();
    // Allow elements slightly off-screen (lazy-rendered sections, multi-step forms)
    return rect.width > 0 || rect.height > 0 || el.tagName === 'SELECT';
  }

  // ----- Shadow DOM / iframe-safe traversal -----

  function* walkAllRoots(root = document) {
    yield root;
    const stack = [root];
    while (stack.length) {
      const node = stack.pop();
      const tree = node.querySelectorAll ? node.querySelectorAll('*') : [];
      for (const el of tree) {
        if (el.shadowRoot) {
          stack.push(el.shadowRoot);
          yield el.shadowRoot;
        }
      }
    }
  }

  function queryAll(selectors) {
    const out = [];
    const seen = new Set();
    for (const root of walkAllRoots(document)) {
      for (const sel of selectors) {
        let list;
        try { list = root.querySelectorAll(sel); }
        catch (_) { continue; }
        for (const el of list) {
          if (seen.has(el)) continue;
          seen.add(el);
          out.push(el);
        }
      }
    }
    return out;
  }

  // ----- Field lookup -----

  // Find input/select/textarea associated with a label by its text content.
  function findFieldByLabel(keywords) {
    const lcKws = keywords.map(k => k.toLowerCase());

    for (const root of walkAllRoots(document)) {
      const labels = root.querySelectorAll
        ? root.querySelectorAll('label, [data-label], [aria-label]')
        : [];
      for (const labelEl of labels) {
        const text = (
          labelEl.textContent ||
          labelEl.getAttribute('data-label') ||
          labelEl.getAttribute('aria-label') ||
          ''
        ).trim().toLowerCase();
        if (!text || text.length > 80) continue;

        const matched = lcKws.some(kw => text === kw || text.startsWith(kw) || text.includes(kw));
        if (!matched) continue;

        // 1) label[for]
        if (labelEl.htmlFor) {
          const el = root.getElementById
            ? root.getElementById(labelEl.htmlFor)
            : document.getElementById(labelEl.htmlFor);
          if (el && el.matches && el.matches('input, select, textarea')) return el;
        }
        // 2) input inside the label
        const inner = labelEl.querySelector && labelEl.querySelector('input, select, textarea');
        if (inner) return inner;
        // 3) next siblings, up to 4 hops
        let sib = labelEl.nextElementSibling;
        for (let i = 0; i < 4 && sib; i++) {
          if (sib.matches && sib.matches('input, select, textarea')) return sib;
          const found = sib.querySelector && sib.querySelector('input, select, textarea');
          if (found) return found;
          sib = sib.nextElementSibling;
        }
        // 4) parent's next siblings (handles two-column layouts)
        const parent = labelEl.parentElement;
        if (parent) {
          let psib = parent.nextElementSibling;
          for (let i = 0; i < 3 && psib; i++) {
            const found = psib.querySelector && psib.querySelector('input, select, textarea');
            if (found) return found;
            psib = psib.nextElementSibling;
          }
        }
        // 5) aria-controls / aria-labelledby reverse lookup
        const labelId = labelEl.id;
        if (labelId) {
          const ref = document.querySelector(`[aria-labelledby~="${labelId}"], [aria-describedby~="${labelId}"]`);
          if (ref && ref.matches && ref.matches('input, select, textarea')) return ref;
        }
      }
    }
    return null;
  }

  function findField(selectors, labelKeywords = []) {
    // Pass 1: CSS selectors, visible only
    const visible = queryAll(selectors).filter(isVisible);
    if (visible.length) return visible[0];

    // Pass 2: CSS selectors, any state (handles steps / tabs)
    const any = queryAll(selectors);
    if (any.length) return any[0];

    // Pass 3: label text detection
    if (labelKeywords && labelKeywords.length) {
      const el = findFieldByLabel(labelKeywords);
      if (el) return el;
    }
    return null;
  }

  // ----- Stripe Element detection -----
  // Stripe / Adyen / Braintree mount card inputs inside cross-origin iframes
  // we cannot script. Surface this so the popup can warn the user.
  function detectHostedCardFrame() {
    const frames = document.querySelectorAll('iframe');
    for (const f of frames) {
      const src = (f.getAttribute('src') || '').toLowerCase();
      const name = (f.getAttribute('name') || '').toLowerCase();
      const title = (f.getAttribute('title') || '').toLowerCase();
      if (
        src.includes('js.stripe.com') || src.includes('elements.stripe') ||
        src.includes('checkout.adyen') || src.includes('braintreepayments') ||
        src.includes('squarecdn.com') || src.includes('paypal.com/sdk') ||
        name.includes('__privateStripeFrame') || name.includes('braintree') ||
        title.includes('card number') || title.includes('secure card')
      ) {
        return f.getAttribute('src') || f.getAttribute('name') || f.getAttribute('title') || 'hosted-frame';
      }
    }
    return null;
  }

  // ----- The actual fill orchestration -----

  function fillForm(data) {
    const results = [];

    const tryFill = (fieldName, selectors, fillFn, labelKws = []) => {
      try {
        const el = findField(selectors, labelKws);
        if (!el) {
          results.push({ field: fieldName, status: 'skip' });
          return null;
        }
        const ok = fillFn(el);
        results.push({ field: fieldName, status: ok ? 'ok' : 'fail' });
        return el;
      } catch (e) {
        results.push({ field: fieldName, status: 'error', msg: e && e.message });
        return null;
      }
    };

    // ----- CARD NUMBER -----
    tryFill('Card Number', [
      '[autocomplete="cc-number"]', '[autocomplete*="cc-number"]',
      'input[name*="card_number" i]', 'input[name*="cardnumber" i]',
      'input[name*="card-number" i]', 'input[name="cardNumber"]',
      'input[name*="card_no" i]', 'input[name*="ccnumber" i]',
      'input[id*="card_number" i]', 'input[id*="cardnumber" i]',
      'input[id*="card-number" i]', 'input[id*="cardNumber"]',
      'input[id*="ccnumber" i]',
      '[data-elements-stable-field-name="cardNumber"]',
      '[data-field="cardNumber"]', '[data-testid*="card-number" i]',
      '[data-test*="card-number" i]', '[data-cy*="card-number" i]',
      'input[placeholder*="Card number" i]',
      'input[placeholder*="1234" i]', 'input[placeholder*="•••• ••••"]',
      'input[aria-label*="Card number" i]', 'input[aria-label*="số thẻ" i]'
    ], el => setVal(el, data.cardNumber),
       ['card number', 'card no', 'card details', 'số thẻ', 'numero de tarjeta', 'numéro de carte', 'kartennummer']);

    // ----- EXPIRY (combined OR split) -----
    const expEl = findField([
      '[autocomplete="cc-exp"]',
      'input[name*="expiry" i]', 'input[name*="expdate" i]', 'input[name*="exp_date" i]',
      'input[name*="card_exp" i]', 'input[name*="cc-exp" i]', 'input[name*="cardexpiry" i]',
      'input[id*="expiry" i]', 'input[id*="cardExpiry"]', 'input[id*="cc-exp" i]',
      'input[placeholder*="MM / YY" i]', 'input[placeholder*="MM/YY" i]',
      'input[placeholder*="MM / YYYY" i]', 'input[placeholder*="MM/YYYY" i]',
      'input[data-elements-stable-field-name="cardExpiry"]',
      'input[aria-label*="expiry" i]', 'input[aria-label*="expiration" i]',
      'input[aria-label*="hết hạn" i]', 'input[aria-label*="hsd" i]'
    ], ['expiry', 'expiration', 'exp date', 'mm/yy', 'mm / yy', 'hsd', 'hết hạn', 'hết hạn thẻ']);
    if (expEl) {
      // Detect if the field expects YY vs YYYY based on placeholder/maxlength
      const placeholder = (expEl.placeholder || '').toUpperCase();
      const maxLen = parseInt(expEl.getAttribute('maxlength') || '0', 10);
      const useFullYear = placeholder.includes('YYYY') || maxLen >= 7;
      const yy = useFullYear ? `20${data.year}` : data.year;
      try {
        setVal(expEl, `${data.month}/${yy}`);
        results.push({ field: 'Expiry', status: 'ok' });
      } catch (e) {
        results.push({ field: 'Expiry', status: 'error', msg: e && e.message });
      }
    } else {
      // Split month / year fields
      const monthEl = findField([
        '[autocomplete="cc-exp-month"]',
        'input[name*="exp_month" i]', 'input[name*="expiry_month" i]',
        'input[name*="exp-month" i]', 'input[name*="card_exp_month" i]',
        'select[name*="month" i]', 'select[id*="month" i]',
        'input[id*="expMonth"]', 'input[id*="exp-month" i]',
        'input[placeholder="MM"]', 'input[placeholder*="MM" i][maxlength="2"]'
      ], ['expiration month', 'expiry month', 'month', 'tháng']);
      const yearEl = findField([
        '[autocomplete="cc-exp-year"]',
        'input[name*="exp_year" i]', 'input[name*="expiry_year" i]',
        'input[name*="exp-year" i]', 'input[name*="card_exp_year" i]',
        'select[name*="year" i]', 'select[id*="year" i]',
        'input[id*="expYear"]', 'input[id*="exp-year" i]',
        'input[placeholder="YY"]', 'input[placeholder="YYYY"]'
      ], ['expiration year', 'expiry year', 'year', 'năm']);
      let any = false;
      if (monthEl) {
        const monthValues = [
          data.month,
          String(parseInt(data.month, 10)), // strip leading zero
          new Date(2000, parseInt(data.month, 10) - 1).toLocaleString('en', { month: 'long' }),
          new Date(2000, parseInt(data.month, 10) - 1).toLocaleString('en', { month: 'short' })
        ];
        if (monthEl.tagName === 'SELECT' ? setSelectVal(monthEl, monthValues) : setVal(monthEl, data.month)) {
          any = true;
        }
      }
      if (yearEl) {
        const yearValues = [
          `20${data.year}`,
          data.year,
          parseInt(data.year, 10).toString()
        ];
        if (yearEl.tagName === 'SELECT' ? setSelectVal(yearEl, yearValues) : setVal(yearEl, yearValues[0])) {
          any = true;
        }
      }
      results.push({ field: 'Expiry', status: any ? 'ok' : 'skip' });
    }

    // ----- CVV -----
    tryFill('CVV', [
      '[autocomplete="cc-csc"]',
      'input[name*="cvv" i]', 'input[name*="cvc" i]', 'input[name*="csc" i]',
      'input[name*="security_code" i]', 'input[name*="security-code" i]',
      'input[name*="cardCvc" i]', 'input[name*="cardCvv" i]',
      'input[id*="cvv" i]', 'input[id*="cvc" i]', 'input[id*="cardCvc"]',
      'input[id*="security_code" i]', 'input[id*="security-code" i]',
      'input[data-elements-stable-field-name="cardCvc"]',
      'input[placeholder*="CVV" i]', 'input[placeholder*="CVC" i]',
      'input[placeholder*="security code" i]', 'input[placeholder*="•••"]',
      'input[aria-label*="security code" i]', 'input[aria-label*="CVV" i]'
    ], el => setVal(el, data.cvv),
       ['cvv', 'cvc', 'security code', 'card verification', 'mã bảo mật']);

    // ----- NAME ON CARD (preferred, then generic name) -----
    const cardNameEl = findField([
      '[autocomplete="cc-name"]',
      'input[name*="cc-name" i]', 'input[name*="card_name" i]', 'input[name*="card-name" i]',
      'input[name*="cardname" i]', 'input[name*="cardholder" i]',
      'input[name*="name_on_card" i]', 'input[name*="nameOnCard"]',
      'input[id*="cardName" i]', 'input[id*="cardholder" i]', 'input[id*="card_name" i]',
      'input[id*="nameOnCard"]',
      'input[data-elements-stable-field-name="cardName"]',
      'input[placeholder*="Name on card" i]', 'input[placeholder*="Cardholder" i]',
      'input[placeholder*="Card holder" i]', 'input[placeholder*="Tên trên thẻ" i]'
    ], ['name on card', 'cardholder', 'cardholder name', 'card holder', 'tên chủ thẻ', 'tên trên thẻ']);
    if (cardNameEl) {
      setVal(cardNameEl, data.name);
      results.push({ field: 'Name on Card', status: 'ok' });
    }

    // ----- FULL NAME / FIRST + LAST -----
    const [firstName, ...lastParts] = (data.name || '').split(' ');
    const lastName = lastParts.join(' ') || firstName;

    const fullNameEl = findField([
      '[autocomplete="name"]',
      'input[name="full_name" i]', 'input[name="fullname" i]', 'input[name="full-name" i]',
      'input[name="name" i]',
      'input[id="full_name" i]', 'input[id="fullname" i]', 'input[id="name" i]',
      'input[placeholder="Full name" i]', 'input[placeholder*="Your name" i]',
      'input[placeholder*="Họ và tên" i]', 'input[placeholder*="Tên đầy đủ" i]'
    ], ['full name', 'your name', 'name', 'họ và tên', 'họ tên', 'tên đầy đủ', 'nombre completo', 'nom complet']);
    if (fullNameEl && fullNameEl !== cardNameEl) {
      setVal(fullNameEl, data.name);
      results.push({ field: 'Name', status: 'ok' });
    } else if (!cardNameEl) {
      const firstEl = findField([
        '[autocomplete="given-name"]',
        'input[name*="first_name" i]', 'input[name*="firstname" i]',
        'input[name*="first-name" i]', 'input[name="fname" i]',
        'input[id*="first_name" i]', 'input[id*="firstname" i]', 'input[id*="fname" i]',
        'input[placeholder*="First name" i]', 'input[placeholder*="Given name" i]',
        'input[placeholder*="Tên" i]'
      ], ['first name', 'given name', 'tên', 'prénom', 'nombre', 'vorname']);
      const lastEl = findField([
        '[autocomplete="family-name"]',
        'input[name*="last_name" i]', 'input[name*="lastname" i]',
        'input[name*="last-name" i]', 'input[name="lname" i]',
        'input[name*="surname" i]', 'input[name*="family_name" i]',
        'input[id*="last_name" i]', 'input[id*="lastname" i]', 'input[id*="surname" i]',
        'input[placeholder*="Last name" i]', 'input[placeholder*="Surname" i]',
        'input[placeholder*="Family name" i]', 'input[placeholder*="Họ" i]'
      ], ['last name', 'surname', 'family name', 'họ', 'nom', 'apellido', 'nachname']);
      const middleEl = findField([
        '[autocomplete="additional-name"]',
        'input[name*="middle_name" i]', 'input[name*="middlename" i]',
        'input[name*="middle-name" i]',
        'input[id*="middle_name" i]', 'input[id*="middlename" i]',
        'input[placeholder*="Middle name" i]', 'input[placeholder*="Middle" i]'
      ], ['middle name', 'middle initial']);

      let nameAny = false;
      if (firstEl) { setVal(firstEl, firstName); nameAny = true; }
      if (lastEl)  { setVal(lastEl, lastName);   nameAny = true; }
      if (middleEl) setVal(middleEl, ''); // leave blank — we don't generate middle names
      results.push({ field: 'Name (split)', status: nameAny ? 'ok' : 'skip' });
    }

    // ----- EMAIL -----
    tryFill('Email', [
      '[autocomplete="email"]', 'input[type="email"]',
      'input[name*="email" i]', 'input[id*="email" i]',
      'input[placeholder*="email" i]', 'input[aria-label*="email" i]'
    ], el => setVal(el, data.email),
       ['email', 'email address', 'địa chỉ email', 'thư điện tử']);

    // ----- PHONE -----
    tryFill('Phone', [
      '[autocomplete="tel"]', 'input[type="tel"]',
      'input[name*="phone" i]', 'input[name*="telephone" i]', 'input[name*="mobile" i]',
      'input[id*="phone" i]', 'input[id*="mobile" i]', 'input[id*="telephone" i]',
      'input[placeholder*="phone" i]', 'input[placeholder*="mobile" i]',
      'input[aria-label*="phone" i]', 'input[placeholder*="số điện thoại" i]'
    ], el => setVal(el, data.phone),
       ['phone', 'phone number', 'mobile', 'telephone', 'số điện thoại', 'điện thoại']);

    // ----- COMPANY (optional, leave blank if no data) -----
    tryFill('Company', [
      '[autocomplete="organization"]',
      'input[name*="company" i]', 'input[name*="organization" i]', 'input[name*="business" i]',
      'input[id*="company" i]', 'input[id*="organization" i]',
      'input[placeholder*="company" i]', 'input[placeholder*="organization" i]',
      'input[placeholder*="công ty" i]'
    ], el => setVal(el, data.company || ''),
       ['company', 'company name', 'organization', 'business name', 'công ty']);

    // ----- ADDRESS LINE 1 -----
    tryFill('Address', [
      '[autocomplete="street-address"]', '[autocomplete="address-line1"]',
      'input[name*="address1" i]', 'input[name*="address_1" i]', 'input[name*="address-1" i]',
      'input[name="address" i]', 'input[name="street" i]',
      'input[name*="street_address" i]', 'input[name*="addressLine1" i]',
      'input[id*="address1" i]', 'input[id*="address_line1" i]',
      'input[id*="address-line-1" i]', 'input[id*="addressLine1" i]',
      'input[id*="street" i]',
      'input[placeholder*="Street" i]', 'input[placeholder*="Address line 1" i]',
      'input[placeholder*="Street address" i]', 'input[placeholder*="Address" i]',
      'input[placeholder*="Địa chỉ" i]'
    ], el => setVal(el, data.address),
       ['address', 'address line 1', 'street address', 'street', 'địa chỉ', 'adresse', 'dirección']);

    // ----- ADDRESS LINE 2 (only if we have value) -----
    if (data.address2) {
      tryFill('Address 2', [
        '[autocomplete="address-line2"]',
        'input[name*="address2" i]', 'input[name*="address_2" i]', 'input[name*="address-2" i]',
        'input[name*="addressLine2" i]', 'input[name*="apt" i]', 'input[name*="suite" i]',
        'input[id*="address2" i]', 'input[id*="addressLine2" i]',
        'input[placeholder*="Apt" i]', 'input[placeholder*="Suite" i]',
        'input[placeholder*="Address line 2" i]', 'input[placeholder*="Unit" i]'
      ], el => setVal(el, data.address2),
         ['address line 2', 'apartment', 'apt', 'suite', 'unit']);
    }

    // ----- CITY -----
    tryFill('City', [
      '[autocomplete="address-level2"]',
      'input[name*="city" i]', 'input[name*="billing_city" i]', 'input[name*="shipping_city" i]',
      'input[name*="town" i]', 'input[name*="suburb" i]', 'input[name*="locality" i]',
      'input[id*="city" i]', 'input[id*="billing-city" i]', 'input[id*="shipping-city" i]',
      'input[id*="town" i]',
      'input[placeholder*="City" i]', 'input[placeholder*="Town" i]',
      'input[placeholder*="Suburb" i]', 'input[placeholder*="Thành phố" i]'
    ], el => setVal(el, data.city),
       ['city', 'town', 'suburb', 'locality', 'thành phố', 'ville', 'ciudad', 'stadt']);

    // ----- STATE / PROVINCE / REGION -----
    tryFill('State', [
      '[autocomplete="address-level1"]',
      'select[name*="state" i]', 'select[name*="province" i]', 'select[name*="region" i]',
      'select[id*="state" i]', 'select[id*="province" i]', 'select[id*="region" i]',
      'input[name*="state" i]', 'input[name*="province" i]', 'input[name*="region" i]',
      'input[name*="county" i]',
      'input[id*="state" i]', 'input[id*="province" i]', 'input[id*="region" i]',
      'input[placeholder*="State" i]', 'input[placeholder*="Province" i]',
      'input[placeholder*="Region" i]', 'input[placeholder*="County" i]',
      'input[placeholder*="Tỉnh" i]'
    ], el => {
      if (el.tagName === 'SELECT') {
        return setSelectVal(el, [data.state, data.stateCode, data.state ? data.state.slice(0, 2) : '']) ||
               setVal(el, data.state);
      }
      return setVal(el, data.state);
    }, ['state', 'province', 'region', 'county', 'tỉnh', 'tỉnh thành']);

    // ----- ZIP / POSTAL CODE -----
    tryFill('ZIP', [
      '[autocomplete="postal-code"]',
      'input[name*="zip" i]', 'input[name*="postal" i]', 'input[name*="postcode" i]',
      'input[name*="post_code" i]', 'input[name*="postalCode" i]',
      'input[name*="billing_postcode" i]', 'input[name*="billing_zip" i]', 'input[name*="shipping_zip" i]',
      'input[id*="zip" i]', 'input[id*="postal" i]', 'input[id*="postcode" i]',
      'input[id*="post-code" i]', 'input[id*="postalCode" i]',
      'input[placeholder*="ZIP" i]', 'input[placeholder*="Zip code" i]',
      'input[placeholder*="Postal" i]', 'input[placeholder*="Post code" i]',
      'input[placeholder*="Postcode" i]', 'input[placeholder*="Mã bưu" i]'
    ], el => setVal(el, data.zip),
       ['postal code', 'post code', 'postcode', 'zip', 'zip code', 'pin code', 'mã bưu điện', 'mã bưu chính']);

    // ----- COUNTRY -----
    tryFill('Country', [
      '[autocomplete="country"]', '[autocomplete="country-name"]',
      'select[name*="country" i]', 'select[id*="country" i]',
      'select[name*="billing_country" i]', 'select[name*="shipping_country" i]',
      'input[name="country" i]', 'input[name="billing_country" i]',
      'input[name="billing[country]"]', 'input[name="order[country]"]', 'input[name="address[country]"]',
      'input[id="country" i]', 'input[id*="billing-country" i]', 'input[id*="shipping-country" i]',
      '[data-field="country"]', '[data-testid*="country" i]',
      'select[class*="country" i]'
    ], el => {
      if (el.tagName === 'SELECT') {
        const ok = setSelectVal(el, [
          data.countryCode,
          data.countryName,
          (data.countryName || '').toLowerCase()
        ]);
        return ok;
      }
      return setVal(el, data.countryName || data.countryCode);
    }, ['country', 'quốc gia', 'pays', 'país', 'land']);

    // ----- AGE / DATE OF BIRTH -----
    tryFill('Age', [
      'input[name*="age" i]:not([name*="page" i])',
      'input[id*="age" i]:not([id*="page" i])',
      'input[placeholder*="Age" i]:not([placeholder*="page" i])',
      'input[type="number"][min="18"]'
    ], el => setVal(el, String(data.age)),
       ['age', 'tuổi']);

    if (data.dob) {
      tryFill('Date of Birth', [
        '[autocomplete="bday"]',
        'input[name*="dob" i]', 'input[name*="birthday" i]', 'input[name*="birth_date" i]',
        'input[name*="date_of_birth" i]', 'input[name*="birthdate" i]',
        'input[id*="dob" i]', 'input[id*="birthday" i]', 'input[id*="birth-date" i]',
        'input[type="date"]'
      ], el => setVal(el, data.dob),
         ['date of birth', 'dob', 'birthday', 'ngày sinh']);
    }

    // ----- TERMS / CONSENT CHECKBOXES -----
    try {
      const seen = new Set();
      for (const root of walkAllRoots(document)) {
        if (!root.querySelectorAll) continue;
        const boxes = root.querySelectorAll('input[type="checkbox"]');
        for (const cb of boxes) {
          if (seen.has(cb)) continue;
          seen.add(cb);
          if (cb.checked || cb.disabled) continue;

          const label = (
            (cb.id && root.querySelector(`label[for="${cb.id}"]`)) ||
            cb.closest('label') ||
            cb.parentElement
          );
          const text = (label?.textContent || cb.getAttribute('aria-label') || '').toLowerCase();
          if (
            text.includes('agree') || text.includes('terms') ||
            text.includes('accept') || text.includes('consent') ||
            text.includes('privacy') || text.includes('điều khoản') ||
            text.includes('đồng ý')
          ) {
            cb.checked = true;
            fire(cb, 'click');
            fire(cb, 'input');
            fire(cb, 'change');
          }
        }
      }
    } catch (_) {}

    // Surface hosted-card-frame detection so the popup can warn the user.
    const hostedCard = detectHostedCardFrame();
    if (hostedCard) {
      results.push({ field: 'Card Number', status: 'hosted', msg: 'Hosted payment frame detected (' + hostedCard + ')' });
    }

    return results;
  }

  // ----- Public API + message bridge -----

  // Expose a direct function so the popup can call it via
  // chrome.scripting.executeScript({allFrames:true, func:..., args:[data]})
  // which returns results from every frame without webNavigation perms.
  window.__cardfillFill = (data) => {
    try {
      return { ok: true, frame: location.href, results: fillForm(data || {}) };
    } catch (e) {
      return { ok: false, frame: location.href, error: e && e.message };
    }
  };

  // Legacy/runtime message bridge for the top-frame fallback path.
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return false;
      if (message.type === 'PING') {
        sendResponse({ alive: true });
        return true;
      }
      if (message.type === 'FILL_FORM') {
        try {
          const results = fillForm(message.data || {});
          sendResponse({ success: true, results });
        } catch (e) {
          sendResponse({ success: false, error: e && e.message });
        }
        return true;
      }
      return false;
    });
  } catch (_) {}
})();
