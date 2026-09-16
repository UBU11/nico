import { Hono } from "hono";
import { logger } from "hono/logger";
import { webhookRoutes, incidentRoutes } from "./routes";

export function createGatewayApp(): Hono {
  const app = new Hono();

  app.use("*", logger());

  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  app.route("/", webhookRoutes);
  app.route("/", incidentRoutes);

  app.onError((err, c) => {
    console.error("[gateway:error]", err);
    return c.json(
      {
        error: "Internal Server Error",
        message: err.message,
      },
      500
    );
  });

  return app;
}

export const app = createGatewayApp();
