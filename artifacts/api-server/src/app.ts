import { randomUUID } from "node:crypto";
import express, { type Express } from "express";
import pinoHttp from "pino-http";
import router from "./routes";
import { buildCorsMiddleware } from "./lib/cors";
import { logger } from "./lib/logger";
import { requestMetrics } from "./lib/metrics";
import { initSentry } from "./lib/sentry";
import { attachAuth } from "./middlewares/authMiddleware";
import { dbContext } from "./middlewares/dbContext";
import { enforceMfaScope } from "./middlewares/mfaScope";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { rejectPollutedBodies, securityHeaders } from "./middlewares/securityHeaders";

// Error tracking (no-op unless SENTRY_DSN is set).
initSentry();

const app: Express = express();

// Client IP behind a reverse proxy. Rate limits and lockouts key on req.ip, so
// behind Caddy/a load balancer every request would otherwise share the proxy's
// IP (one abuser could throttle everyone). Set TRUST_PROXY to the number of
// proxy hops (e.g. "1") or the proxy subnets ("loopback, 172.16.0.0/12").
// Unset = trust nothing, so a directly exposed server can't be fooled by a
// forged X-Forwarded-For header.
const trustProxy = process.env["TRUST_PROXY"]?.trim();
if (trustProxy) {
  app.set("trust proxy", /^\d+$/.test(trustProxy) ? Number(trustProxy) : trustProxy);
}

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

// Restricted sessions (MFA enrolment pending) may only reach enrolment.
app.use(enforceMfaScope);

// Stamp the caller's identity on its database connection (row-level security).
app.use(dbContext);

app.use("/api", router);

// Consistent JSON error surface for unknown paths and uncaught errors.
app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
