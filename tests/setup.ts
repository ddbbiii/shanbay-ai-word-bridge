import { beforeEach } from "vitest";

beforeEach(() => {
  document.body.replaceChildren();
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 80,
      width: 320,
      height: 80,
      toJSON: () => ({})
    })
  });
});
