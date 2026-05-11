# CardFill Pro

A Chrome extension (Manifest V3) that generates **Luhn-valid test card numbers**
from a BIN and autofills payment / checkout forms during **development & testing**.

> ⚠️ This tool is intended for testing your own payment forms (e.g. validating
> client-side card-input UX). The generated numbers pass the Luhn checksum but
> are **not real, chargeable cards** and will be declined by any real payment
> processor. Do not use this tool against systems you do not own or are not
> authorized to test.

---

## Features

- Generate Luhn-valid card numbers from a 6–9 digit BIN
- Auto-detect card type (Visa / Mastercard / Amex / Discover / JCB)
- Optional auto-generated expiry date and CVV
- "Random" mode — pick a fresh random BIN every Generate
- Validate any card number with Luhn checksum
- BIN lookup via [binlist.net](https://binlist.net) (brand, bank, country)
- One-click "GEN & FILL" — generate a card and autofill the active page's form
- 15 country profiles with localized names, addresses, ZIPs and phone formats
- Light / dark themes (auto-detect + persistent)
- English / Vietnamese UI (auto-detect + togglable)
- Vietnamese-friendly system font stack (no external font CDN required)
- Keyboard-accessible with visible focus rings

## Install (Unpacked)

1. Open `chrome://extensions` in Chrome / Edge / Brave.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Click the CardFill Pro icon in your toolbar to open the popup.

## Usage

| Button       | What it does                                                   |
| ------------ | -------------------------------------------------------------- |
| Generate     | Generate `Qty` cards from the entered BIN (or a random BIN).   |
| Validate     | Run a Luhn check on whatever is in the BIN input.              |
| BIN Check    | Look up bank / country / brand information for a BIN.          |
| GEN & FILL   | Generate one card + fake identity and autofill the active tab. |
| Gen Only     | Same as Generate (no auto-fill).                               |

### Keyboard shortcuts

- **Enter** while focused on the BIN input → Generate.
- All buttons and inputs are keyboard-navigable via **Tab**.

### Settings

- 🌙 / ☀️ in the header toggles dark mode (persisted in `localStorage`).
- The language badge toggles between **EN** and **VI** (persisted).

## File layout

```
card-extension/
├── manifest.json   — MV3 manifest, icons, permissions
├── popup.html      — popup UI structure
├── popup.css       — styling, themes, responsive layout
├── popup.js        — popup logic, i18n, generation, BIN lookup
├── content.js      — injected into pages to autofill payment / checkout forms
├── icons/          — 16/32/48/128 px PNG icons + source SVG
└── README.md
```

## Privacy

CardFill Pro does **not** collect any personal data. The only external requests
it makes are:

- `https://lookup.binlist.net/<bin>` — when you click "BIN Check"
- `https://randomuser.me/api/?nat=<cc>` — to fetch a realistic fake address
  when filling forms (with a local fallback if the request fails)

All settings (last BIN, theme, language) are stored locally via
`chrome.storage.local` and `localStorage` on your own machine.

## License

MIT — see source files.
