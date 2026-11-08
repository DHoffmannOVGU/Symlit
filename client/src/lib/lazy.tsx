import { lazy, Suspense, useState, type ComponentType, type ReactNode } from "react";

/** `React.lazy` for a named export: the module is downloaded on first render. */
export function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  // React.lazy needs a component that accepts any props; callers get the precise type back via M[K].
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return lazy(() => load().then((module) => ({ default: module[name] as ComponentType<any> }))) as M[K];
}

/**
 * Renders `children` (typically a lazily loaded panel or dialog) only once it
 * has been opened, then keeps it mounted so closing animations still run.
 */
export function MountWhenOpened({ open, children }: { open: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? <Suspense fallback={null}>{children}</Suspense> : null;
}
