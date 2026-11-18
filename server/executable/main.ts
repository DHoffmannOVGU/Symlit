// Order matters: prepare sets paths and the environment before the server
// modules read them at load time.
import "./prepare";
import { spawn } from "node:child_process";
import { startServer } from "../start";

function openBrowser(url: string) {
  if (process.env.SYMLIT_NO_BROWSER) return;
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    const child = spawn(command, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
  } catch {
    // No browser to open (e.g. a server without a desktop): the URL is printed anyway.
  }
}

console.log("Starting Symlit… (close this window to stop it)");
startServer({ onListening: openBrowser }).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  // Keep a double-clicked window open long enough to read the error.
  setTimeout(() => process.exit(1), 30_000);
});
