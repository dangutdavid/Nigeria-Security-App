import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { buildCorsMiddleware } from "./lib/cors";
import { logger } from "./lib/logger";
import { requestMetrics } from "./lib/metrics";
import { initSentry } from "./lib/sentry";
import { attachAuth } from "./middlewares/authMiddleware";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { rejectPollutedBodies, securityHeaders } from "./middlewares/securityHeaders";

// Error tracking (no-op unless SENTRY_DSN is set).
initSentry();

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    // Correlation id: honour an inbound X-Request-Id (proxy-assigned) or mint
    // one; echoed on the response so clients and logs can be cross-referenced.
    genReqId(req, res) {
      const inbound = req.headers["x-request-id"];
      const id = typeof inbound === "string" && inbound.length <= 128 ? inbound : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(securityHeaders);
app.use(requestMetrics);
app.use(buildCorsMiddleware());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(rejectPollutedBodies);

// Parse the bearer token (if any) and attach verified claims before routing.
app.use(attachAuth);

app.use("/api", router);

// Consistent JSON error surface for unknown paths and uncaught errors.
app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
