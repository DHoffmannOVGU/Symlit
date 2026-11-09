import { useLayoutEffect, type RefObject } from "react";

/**
 * Fits text into its box: the font shrinks step by step down to a minimum;
 * if the text still does not fit, it is cut after the last whole line with
 * an ellipsis (the full text belongs in a `title` tooltip).
 *
 * The box is the element itself: give it a height (a flex child with
 * `min-h-0`) or a `max-height`, and `overflow: hidden`.
 */

export interface FitTextOptions {
  /** Largest font size in px (used when everything fits). */
  maxSize: number;
  /** Smallest font size in px before lines are cut. */
  minSize: number;
  /** Line height as a multiple of the font size. */
  lineHeight?: number;
}

export interface FitResult {
  fontSize: number;
  /** Lines to show before cutting, or null when everything fits. */
  clampLines: number | null;
}

/**
 * The largest font size from `maxSize` down to `minSize` at which `fits`
 * holds; otherwise `minSize` with the number of whole lines that fit.
 */
export function chooseFit(
  fits: (fontSize: number) => boolean,
  boxHeight: number,
  { maxSize, minSize, lineHeight = 1.3 }: FitTextOptions,
): FitResult {
  for (let size = maxSize; size >= minSize; size -= 1) {
    if (fits(size)) return { fontSize: size, clampLines: null };
  }
  const lines = Math.max(1, Math.floor(boxHeight / (minSize * lineHeight)));
  return { fontSize: minSize, clampLines: lines };
}

function applyFit(element: HTMLElement, options: FitTextOptions) {
  const lineHeight = options.lineHeight ?? 1.3;
  const style = element.style;
  style.lineHeight = String(lineHeight);
  style.display = "";
  style.clipPath = "";
  style.webkitLineClamp = "";
  style.setProperty("-webkit-box-orient", "");
  const result = chooseFit(
    (size) => {
      style.fontSize = `${size}px`;
      return element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1;
    },
    element.clientHeight,
    options,
  );
  style.fontSize = `${result.fontSize}px`;
  if (result.clampLines !== null) {
    style.display = "-webkit-box";
    style.setProperty("-webkit-box-orient", "vertical");
    style.webkitLineClamp = String(result.clampLines);
    // Only whole lines: without this the box shows part of the next line.
    style.clipPath = `inset(0 0 calc(100% - ${result.clampLines * result.fontSize * lineHeight}px) 0)`;
  }
  element.dataset.fitClamped = result.clampLines !== null ? "true" : "false";
}

/** Keeps the text in `ref` fitted while the text or the box size changes. */
export function useFitText(
  ref: RefObject<HTMLElement | null>,
  text: string | undefined,
  { maxSize, minSize, lineHeight }: FitTextOptions,
  enabled = true,
) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    const options = { maxSize, minSize, lineHeight };
    let frame = 0;
    let lastBox = "";
    const fit = () => {
      const box = `${element.clientWidth}x${element.clientHeight}`;
      if (box === lastBox) return;
      applyFit(element, options);
      lastBox = `${element.clientWidth}x${element.clientHeight}`;
    };
    applyFit(element, options);
    lastBox = `${element.clientWidth}x${element.clientHeight}`;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref, text, maxSize, minSize, lineHeight, enabled]);
}
