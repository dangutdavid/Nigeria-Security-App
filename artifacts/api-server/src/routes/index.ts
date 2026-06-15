import { Router, type IRouter } from "express";
import healthRouter from "./health";
import citizenReportsRouter from "./citizen-reports";
import reportsRouter from "./reports";
import notificationsRouter from "./notifications";
import assistantRouter from "./assistant";
import mvpRouter from "./mvp";

const router: IRouter = Router();

router.use(healthRouter);
// Mounted before the MVP router so the mobile-aligned citizen report endpoints
// own POST /citizen-reports (and add track/timeline) ahead of the legacy handler.
router.use(citizenReportsRouter);
// Agency workflow endpoints: report lists, dashboard metrics, detail, status,
// reassignment, and timeline — all backed by the same in-memory store.
router.use(reportsRouter);
// Notification list/read/push-token endpoints, backed by the in-memory store.
router.use(notificationsRouter);
router.use(assistantRouter);
router.use(mvpRouter);

export default router;
