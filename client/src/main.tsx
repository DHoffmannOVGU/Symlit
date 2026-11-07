import { createRoot } from "react-dom/client";
import { loadAppConfig } from "./lib/app-config";
import "./index.css";

async function bootstrap() {
  await loadAppConfig();
  // Imported after the configuration is loaded so module-level feature
  // flags see the server's values.
  const { default: App } = await import("./App");
  createRoot(document.getElementById("root")!).render(<App />);
}

void bootstrap();
