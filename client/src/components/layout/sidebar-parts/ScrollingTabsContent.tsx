import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/**
 * A sidebar tab whose content scrolls. While more content is below, the bottom
 * edge fades out, so it is clear the list goes on.
 */
export function ScrollingTabsContent({ className, children, ...props }: ComponentProps<typeof TabsContent>) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [moreBelow, setMoreBelow] = useState(false);
  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    setMoreBelow(element.scrollHeight - element.scrollTop - element.clientHeight > 4);
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const child of Array.from(element.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [measure, children]);

  return (
    <TabsContent
      ref={ref}
      onScroll={measure}
      data-more-below={moreBelow ? "true" : "false"}
      className={cn(
        className,
        moreBelow && "[mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent)]",
      )}
      {...props}
    >
      {children}
    </TabsContent>
  );
}
