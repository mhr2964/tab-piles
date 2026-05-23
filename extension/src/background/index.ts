import { saveCurrentWindowAsPile } from '../lib/capture'
import { archiveStalePiles } from '../db/db'

const AUTO_ARCHIVE_ALARM = 'tab-piles:auto-archive'

function ensureAutoArchiveAlarm() {
  chrome.alarms.get(AUTO_ARCHIVE_ALARM, (existing) => {
    if (!existing) {
      chrome.alarms.create(AUTO_ARCHIVE_ALARM, {
        delayInMinutes: 1,
        periodInMinutes: 24 * 60,
      })
    }
  })
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
  ensureAutoArchiveAlarm()
})

chrome.runtime.onStartup.addListener(() => {
  ensureAutoArchiveAlarm()
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== AUTO_ARCHIVE_ALARM) return
  try {
    const n = await archiveStalePiles()
    if (n > 0) console.info(`[tab-piles] auto-archived ${n} stale pile(s)`)
  } catch (err) {
    console.error('[tab-piles] auto-archive failed', err)
  }
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-current-window') {
    try {
      const result = await saveCurrentWindowAsPile()
      await chrome.action.setBadgeText({ text: String(result.tabCount) })
      setTimeout(() => chrome.action.setBadgeText({ text: '' }), 2000)
    } catch (err) {
      console.error('[tab-piles] save failed', err)
    }
  }

  if (command === 'open-side-panel') {
    const win = await chrome.windows.getCurrent()
    if (win.id !== undefined) await chrome.sidePanel.open({ windowId: win.id })
  }
})

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'save-current-window') {
    saveCurrentWindowAsPile(msg.name)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }))
    return true
  }
  return false
})
