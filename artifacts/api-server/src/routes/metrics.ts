import { Router, type IRouter } from "express";
import { metricsRegistry } from "../lib/metrics";

const router: IRouter = Router();

/**
 * Prometheus scrape endpoint. When METRICS_TOKEN is set, requires
 * `Authorization: Bearer <token>` — set it in any deployment where /api is
 * internet-facing so route names and traffic volumes aren't public. Without
 * the env var (local dev, private networks) the endpoint is open.
 */
router.get("/metrics", async (req, res) => {
  const token = process.env["METRICS_TOKEN"];
  if (token) {
    const header = req.header("authorization") ?? "";
    if (header !== `Bearer ${token}`) {
      res.status(401).json({ error: "Metrics authentication required." });
      return;
    }
  }
  res.setHeader("Content-Type", metricsRegistry.contentType);
  res.send(await metricsRegistry.metrics());
});

export default router;
