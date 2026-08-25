import { Router, type IRouter } from "express";
import healthRouter from "./health";
import mediaMetadataRouter from "./media-metadata";

const router: IRouter = Router();

router.use(healthRouter);
router.use(mediaMetadataRouter);

export default router;
