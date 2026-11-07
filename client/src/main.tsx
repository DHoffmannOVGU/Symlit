import { createRoot } from "react-dom/client";
import { loadAppConfig } from "./lib/app-config";
// Fonts are bundled so the app works offline and makes no third-party requests.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "./index.css";

async function bootstrap() {
  await loadAppConfig();
  // Imported after the configuration is loaded so module-level feature
  // flags see the server's values.
  const { default: App } = await import("./App");
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
