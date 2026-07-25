import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";
import type { NextFunction, Request, Response } from "express";

/**
 * Prometheus metrics (roadmap Phase 3 / E4). One registry per process;
 * default Node metrics (event loop lag, heap, GC) plus HTTP request
 * rate/latency/errors by route, and rate-limit rejections.
 *
 * Scrape via GET /api/metrics — protected by METRICS_TOKEN when set (send
 * `Authorization: Bearer $METRICS_TOKEN`); open on a trusted network otherwise.
 */
export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "HTTP requests by method, route, and status code.",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency by method and route.",
  labelNames: ["method", "route"] as const,
  // Buckets sized for an API with a public mobile surface: 5ms to 10s.
  buckets: [0.005, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const rateLimitRejections = new Counter({
  name: "rate_limit_rejections_total",
  help: "Requests rejected by the in-process rate limiter, by limiter name.",
  labelNames: ["limiter"] as const,
  registers: [metricsRegistry],
});

/**
 * Normalize a path to a low-cardinality route label: strip query, collapse
 * path params (ids, references, UUIDs) so each logical route is one series.
 */
export function routeLabel(req: Request): string {
  // Express 5 keeps the matched route on req.route for terminal handlers;
  // fall back to a normalized originalUrl for 404s and middleware rejections.
  const base = req.baseUrl ?? "";
  const routePath = (req.route as { path?: string } | undefined)?.path;
  if (routePath && typeof routePath === "string") return `${base}${routePath}`;
  const path = (req.originalUrl ?? req.url ?? "").split("?")[0] ?? "";
  return path
    .split("/")
    .map((segment) =>
      /^([0-9a-f-]{16,}|[A-Z]{2,4}-\d{4,}-[A-Z0-9]+|\d+)$/i.test(segment) ? ":param" : segment,
    )
    .join("/");
}

/** Express middleware: observe every request's count and latency. */
export function requestMetrics(req: Request, res: Response, next: NextFunction): void {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const route = routeLabel(req);
    httpRequestsTotal.inc({ method: req.method, route, status: String(res.statusCode) });
    end({ method: req.method, route });
  });
  next();
}
