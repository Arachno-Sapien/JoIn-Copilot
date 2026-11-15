import { describe, it, expect, vi } from 'vitest';
import { setupSidePanelBehavior } from '../../entrypoints/background/sidepanel';

// Contract revision 5: the worker opens the panel from the toolbar click itself.
// When Chrome opens it (openPanelOnActionClick: true) the click grants no activeTab
// access, so the extension could not read or fill pages outside its host permissions.
describe('leaf-1.1.2:G8 Toolbar Action opens Side Panel', () => {
  it('opens the side panel from the action click', async () => {
    const setPanelBehavior = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(undefined);
    const addListener = vi.fn();
    (globalThis as any).chrome = {
      sidePanel: { setPanelBehavior, open },
      action: { onClicked: { addListener } },
    };

    await setupSidePanelBehavior();
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
    expect(addListener).toHaveBeenCalledTimes(1);

    addListener.mock.calls[0][0]({ id: 3, windowId: 9 });
    expect(open).toHaveBeenCalledWith({ windowId: 9 });
  });
});
