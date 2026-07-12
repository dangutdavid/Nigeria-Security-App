import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getPool, isDbConfigured } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  if (!isDbConfigured()) {
    res.json(HealthCheckResponse.parse({ status: "ok", db: "in-memory" }));
    return;
  }
  try {
    await getPool()?.query("SELECT 1");
    res.json(HealthCheckResponse.parse({ status: "ok", db: "postgres" }));
  } catch {
    res
      .status(503)
      .json(HealthCheckResponse.parse({ status: "degraded", db: "error" }));
  }
});

export default router;
