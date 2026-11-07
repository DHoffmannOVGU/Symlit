const SPOTLIGHT_CLASS = "tutorial-spotlight";

/**
 * Draws attention to the first visible element matching one of the selectors.
 * Waits up to `timeoutMs` for it to appear (it may render after navigation).
 * Returns whether something was highlighted.
 */
export function spotlight(selectors: string[], timeoutMs = 3000): Promise<boolean> {
  const find = () => {
    for (const selector of selectors) {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const visible = candidates.find((element) => element.offsetParent !== null);
      if (visible) return visible;
    }
    return null;
  };
  return new Promise((resolve) => {
    const started = Date.now();
    const attempt = () => {
      const element = find();
      if (element) {
        element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        element.classList.add(SPOTLIGHT_CLASS);
        window.setTimeout(() => element.classList.remove(SPOTLIGHT_CLASS), 4000);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        resolve(false);
      } else {
        window.setTimeout(attempt, 150);
      }
    };
    attempt();
  });
}
