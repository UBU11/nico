import { app } from "./gateway/app";
import { env } from "./config/env";
import { setupCheckpointer } from "./db/checkpointer";

async function bootstrap() {
  try {
    await setupCheckpointer();
    console.log("[db] LangGraph checkpointer schema initialized");
  } catch (err) {
    console.warn("[db:warning] Checkpointer initialization skipped (database may be unreachable in offline mode):", err);
  }

  Bun.serve({
    fetch: app.fetch,
    port: env.PORT,
  });

  console.log(`[gateway] SRE Remediation Agent listening on port ${env.PORT} (${env.NODE_ENV})`);
}

bootstrap().catch((err) => {
  console.error("[fatal] Failed to bootstrap agent application:", err);
  process.exit(1);
});
