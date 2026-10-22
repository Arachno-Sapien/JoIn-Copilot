export async function setupSidePanelBehavior(): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.sidePanel?.setPanelBehavior) {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}
