// ========== BACKGROUND (Service Worker) ==========
// Side panel behavior + temp-mail background polling.
//
// Polling design:
//   - The active polling loop lives in the side panel (popup.js) at 5s
//     because side_panel JS stays alive while the user has it open.
//   - When the side panel is closed but a session is still active, this
//     service worker keeps polling via chrome.alarms at a slower 60s tick
//     so we can still fire a notification when OTP arrives.
//   - Polling stops when:
//       * timeout reached (default 5 min from session.startedAt)
//       * user stops via "Stop polling" button (clears active session)
//       * an OTP is detected and acknowledged

importScripts('tempmail.js');

const POLL_ALARM_NAME = 'tempmail-bg-poll';

chrome.runtime.onInstalled.addListener(() => {
  try {
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
  } catch (_) {}
  ensureBackgroundAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  try {
    chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true });
  } catch (_) {}
  ensureBackgroundAlarm();
});

async function ensureBackgroundAlarm() {
  try {
    const session = await TempMail.getActiveSession();
    if (session && !isExpired(session)) {
      await chrome.alarms.create(POLL_ALARM_NAME, { periodInMinutes: 1 });
    } else {
      await chrome.alarms.clear(POLL_ALARM_NAME);
    }
  } catch (e) {
    console.warn('ensureBackgroundAlarm error', e);
  }
}

function isExpired(session) {
  if (!session || !session.startedAt) return true;
  const cfg = (session.config || {});
  const timeout = cfg.pollTimeoutMs || TempMail.DEFAULTS.pollTimeoutMs;
  return (Date.now() - session.startedAt) > timeout;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== POLL_ALARM_NAME) return;
  try {
    const session = await TempMail.getActiveSession();
    if (!session) {
      await chrome.alarms.clear(POLL_ALARM_NAME);
      return;
    }
    if (isExpired(session)) {
      session.expired = true;
      await TempMail.setActiveSession(session);
      await chrome.alarms.clear(POLL_ALARM_NAME);
      return;
    }
    await pollOnce(session);
  } catch (e) {
    console.warn('background poll error', e);
  }
});

async function pollOnce(session) {
  let data;
  try {
    data = await TempMail.listMails({ jwt: session.jwt, limit: 10, offset: 0 });
  } catch (e) {
    if (session.lastPollError !== e.message) {
      session.lastPollError = e.message;
      await TempMail.setActiveSession(session);
    }
    console.warn('background pollOnce error', e);
    return;
  }
  const results = (data && data.results) || [];
  const knownIds = new Set((session.mails || []).map((m) => m.id));
  const newMails = results.filter((m) => !knownIds.has(m.id));
  if (newMails.length === 0) {
    // No state change → skip storage write to avoid flooding onChanged
    return;
  }
  session.mails = [...newMails, ...(session.mails || [])].slice(0, 20);
  let newOtps = session.otps || [];
  for (const mail of newMails) {
    const otps = TempMail.extractOtps(mail);
    if (otps.length > 0) {
      const top = otps[0];
      const entry = {
        code: top.code,
        confidence: top.confidence,
        mailId: mail.id,
        subject: mail.subject,
        sender: mail.sender,
        receivedAt: mail.created_at,
      };
      newOtps = [entry, ...newOtps];
      try {
        chrome.notifications.create(`otp-${mail.id}`, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icon128.png'),
          title: `OTP nhận được — ${top.code}`,
          message: `${mail.subject || '(no subject)'}\nTừ: ${mail.sender || mail.source || ''}`,
          priority: 2,
        });
      } catch (e) {
        console.warn('notifications.create failed', e);
      }
    }
  }
  session.otps = newOtps.slice(0, 20);
  session.lastPolledAt = Date.now();
  session.lastPollError = null;
  await TempMail.setActiveSession(session);
}

// Listen for messages from popup (e.g. "session started, please arm alarm")
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.type) return;
  if (msg.type === 'TEMPMAIL_SESSION_CHANGED') {
    ensureBackgroundAlarm();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === 'TEMPMAIL_POLL_NOW') {
    (async () => {
      const session = await TempMail.getActiveSession();
      if (session && !isExpired(session)) {
        try { await pollOnce(session); } catch (e) { console.warn(e); }
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});
