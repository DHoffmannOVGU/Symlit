import type { TutorialHighlight } from "@shared/tutorial";

const SPOTLIGHT_CLASS = "tutorial-spotlight";

function findVisible(target: TutorialHighlight): HTMLElement | null {
  const selector = typeof target === "string" ? target : target.selector;
  const text = typeof target === "string" ? null : target.text.toLowerCase();
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => element.getClientRects().length > 0,
  );
  if (text === null) return candidates[0] ?? null;
  const textOf = (element: HTMLElement) => (element.textContent ?? "").trim().toLowerCase();
  // An entry that starts with the text is the one named so; others only mention it.
  return (
    candidates.find((element) => textOf(element).startsWith(text)) ??
    candidates.find((element) => textOf(element).includes(text)) ??
    null
  );
}

/**
 * Draws attention to the first visible element matching one of the targets.
 * Waits up to `timeoutMs` for it to appear (it may render after navigation).
 * Returns whether something was highlighted.
 */
export function spotlight(targets: TutorialHighlight[], timeoutMs = 3000): Promise<boolean> {
  const find = () => {
    for (const target of targets) {
      const visible = findVisible(target);
      if (visible) return visible;
    }
    return null;
  };
  return new Promise((resolve) => {
    const started = Date.now();
    const attempt = () => {
      const element = find();
      if (element) {
        // Diagram elements are positioned by the canvas; scrolling does not apply to them.
        if (!element.closest(".react-flow__viewport")) {
          element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        }
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
