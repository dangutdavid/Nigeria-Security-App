import { Writable } from "node:stream";

/**
 * Better Stack (Logs) shipping: a pino destination that batches log lines and
 * POSTs them to the source's HTTP ingesting endpoint — real-time search,
 * live tail and alerting on structured logs. Runs on the main thread (no
 * worker transport), so it bundles cleanly with esbuild.
 *
 *   BETTER_STACK_SOURCE_TOKEN   source token (Logs → Sources → your source)
 *   BETTER_STACK_INGEST_HOST    ingesting host shown on the source page,
 *                               e.g. s1234567.eu-nbg-2.betterstackdata.com
 *
 * Delivery is best-effort and never blocks or crashes request handling: lines
 * are buffered (bounded), flushed every second or every 200 lines, and dropped
 * with a counter if the endpoint is unreachable.
 */
const FLUSH_INTERVAL_MS = 1000;
const MAX_BATCH = 200;
const MAX_BUFFER = 10_000;

export function betterStackConfigured(): boolean {
  return Boolean(process.env.BETTER_STACK_SOURCE_TOKEN && process.env.BETTER_STACK_INGEST_HOST);
}

export let betterStackDropped = 0;

export function createBetterStackStream(): Writable {
  const token = process.env.BETTER_STACK_SOURCE_TOKEN!;
  const host = process.env.BETTER_STACK_INGEST_HOST!.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const url = `https://${host}`;
  const buffer: string[] = [];
  let inFlight = false;

  async function flush(): Promise<void> {
    if (inFlight || buffer.length === 0) return;
    inFlight = true;
    const batch = buffer.splice(0, MAX_BATCH);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        // pino lines are JSON objects; Better Stack accepts a JSON array.
        body: `[${batch.map((l) => l.trim()).filter(Boolean).join(",")}]`,
      });
      if (!res.ok) betterStackDropped += batch.length;
    } catch {
      betterStackDropped += batch.length;
    } finally {
      inFlight = false;
    }
  }

  const timer = setInterval(() => void flush(), FLUSH_INTERVAL_MS);
  timer.unref();
  const drainOnExit = () => void flush();
  process.once("beforeExit", drainOnExit);

  return new Writable({
    write(chunk, _enc, cb) {
      if (buffer.length >= MAX_BUFFER) betterStackDropped += 1;
      else buffer.push(chunk.toString());
      if (buffer.length >= MAX_BATCH) void flush();
      cb();
    },
    final(cb) {
      clearInterval(timer);
      void flush().finally(() => cb());
    },
  });
}

/**
 * Better Stack (Uptime) heartbeat: a dead-man's switch. The server pings the
 * heartbeat URL every 60s; if pings stop (process hung, crashed, or the event
 * loop is blocked), Better Stack alerts on-call — complementing the external
 * HTTP monitor on /api/healthz, which catches network/edge failures.
 *
 *   BETTER_STACK_HEARTBEAT_URL  https://uptime.betterstack.com/api/v1/heartbeat/<id>
 */
export function startHeartbeat(onError: (err: unknown) => void): void {
  const url = process.env.BETTER_STACK_HEARTBEAT_URL;
  if (!url) return;
  const beat = () => fetch(url, { method: "GET" }).catch(onError);
  void beat();
  setInterval(beat, Number(process.env.BETTER_STACK_HEARTBEAT_INTERVAL_MS ?? 60_000)).unref();
}
