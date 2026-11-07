// src/diagram/hooks/useDiagramScreenshot.ts
import { useCallback, useState } from "react";
import { toPng } from "html-to-image";
import { useToast } from "@/hooks/use-toast";

export function useDiagramScreenshot() {
  const { toast } = useToast();
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const takeScreenshot = useCallback(async () => {
    const wrapper = document.querySelector(".react-flow") as HTMLElement | null;
    if (!wrapper) return;

    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;

    const dataUrl = await toPng(wrapper, {
      backgroundColor: "#f8fafc",
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      pixelRatio: 2,
      style: { width: `${width}px`, height: `${height}px`, overflow: "hidden" },
      filter: (node) => {
        const el = node as HTMLElement;
        return ![
          "react-flow__panel",
          "react-flow__controls",
          "react-flow__attribution",
        ].some((cls) => el.classList?.contains(cls));
      },
      skipFonts: true,
    });

    setScreenshot(dataUrl);
    setIsOpen(true);
  }, []);

  const copyToClipboard = useCallback(async () => {
    if (!screenshot) return;
    try {
      const response = await fetch(screenshot);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      toast({
        title: "Copied!",
        description: "Screenshot copied to clipboard.",
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Could not copy image to clipboard.",
        variant: "destructive",
      });
    }
  }, [screenshot, toast]);

  const downloadImage = useCallback(() => {
    if (!screenshot) return;
    const link = document.createElement("a");
    link.download = `diagram-export-${Date.now()}.png`;
    link.href = screenshot;
    link.click();
  }, [screenshot]);

  return {
    screenshot,
    isScreenshotOpen: isOpen,
    setIsScreenshotOpen: setIsOpen,
    takeScreenshot,
    copyToClipboard,
    downloadImage,
  };
}
