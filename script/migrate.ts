import { loadConfig } from "../server/config";
import { openDatabase } from "../server/db";
import { loadDotEnv } from "../server/env";

loadDotEnv();

const config = loadConfig();
const handle = await openDatabase(config.database);
await handle.close();
console.log(`Migrations applied (${config.database.driver}).`);
