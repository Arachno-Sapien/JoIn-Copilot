export async function setupSidePanelBehavior(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.sidePanel) return;
  // Open the panel from the click ourselves. A click handled here grants activeTab for
  // that tab, which lets the panel read or fill any page the user chose. When Chrome
  // opens the panel (openPanelOnActionClick: true) the click grants nothing.
  chrome.action?.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
  });
  await chrome.sidePanel.setPanelBehavior?.({ openPanelOnActionClick: false });
}

/** Creates a periodic alarm only if it is missing: creating it again restarts its timer. */
export async function ensureAlarm(name: string, periodInMinutes: number): Promise<void> {
  if (!(await chrome.alarms.get(name))) {
    chrome.alarms.create(name, { periodInMinutes });
  }
}
