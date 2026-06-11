import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mvpRouter from "./mvp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mvpRouter);

export default router;
