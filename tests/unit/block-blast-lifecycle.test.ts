import { beforeEach, describe, expect, it, vi } from "vitest";
import { BlockBlastRenderer, createBlockBlastGame } from "../../src/games/block-blast/block-blast.js";

describe("block-blast lifecycle", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    localStorage.clear();
  });

  it("releases pointer capture from the tray element when destroyed mid-drag", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const originalSet = HTMLElement.prototype.setPointerCapture;
    const originalRelease = HTMLElement.prototype.releasePointerCapture;
    HTMLElement.prototype.setPointerCapture = setPointerCapture;
    HTMLElement.prototype.releasePointerCapture = releasePointerCapture;

    try {
      const renderer = new BlockBlastRenderer(createBlockBlastGame());
      renderer.mount(container);

      const slot = container.querySelector<HTMLElement>(".block-blast__tray-slot[data-shape]");
      expect(slot).not.toBeNull();

      const event = new Event("pointerdown", { bubbles: true, cancelable: true });
      Object.defineProperties(event, {
        clientX: { value: 1 },
        clientY: { value: 1 },
        pointerId: { value: 17 },
        pointerType: { value: "mouse" },
      });
      slot?.dispatchEvent(event);

      expect(setPointerCapture).toHaveBeenCalledWith(17);
      renderer.destroy();
      expect(releasePointerCapture).toHaveBeenCalledWith(17);
    } finally {
      HTMLElement.prototype.setPointerCapture = originalSet;
      HTMLElement.prototype.releasePointerCapture = originalRelease;
    }
  });
});
