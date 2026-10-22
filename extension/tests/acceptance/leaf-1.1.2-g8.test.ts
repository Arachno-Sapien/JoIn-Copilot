import { describe, it, expect, vi } from 'vitest';
import { setupSidePanelBehavior } from '../../entrypoints/background/sidepanel';

describe('leaf-1.1.2:G8 Toolbar Action opens Side Panel', () => {
  it('configures openPanelOnActionClick: true', async () => {
    const setPanelBehavior = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).chrome = {
      sidePanel: {
        setPanelBehavior,
      },
    };

    await setupSidePanelBehavior();
    expect(setPanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: true });
  });
});
