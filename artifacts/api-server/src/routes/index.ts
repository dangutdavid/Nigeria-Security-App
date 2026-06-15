import { Router, type IRouter } from "express";
import healthRouter from "./health";
import citizenReportsRouter from "./citizen-reports";
import assistantRouter from "./assistant";
import mvpRouter from "./mvp";

const router: IRouter = Router();

router.use(healthRouter);
// Mounted before the MVP router so the mobile-aligned citizen report endpoints
// own POST /citizen-reports (and add track/timeline) ahead of the legacy handler.
router.use(citizenReportsRouter);
router.use(assistantRouter);
router.use(mvpRouter);

export default router;
