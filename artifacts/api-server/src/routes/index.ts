import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mediaMetadataRouter from "./media-metadata";
import drivePlayerRouter from "./drive-player";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mediaMetadataRouter);
router.use(drivePlayerRouter);

export default router;
