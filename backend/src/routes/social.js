import express from 'express';
import { mountSocialPart1 } from './socialPart1.js';
import { mountSocialPart2 } from './socialPart2.js';

const router = express.Router();
mountSocialPart1(router);
mountSocialPart2(router);
export default router;
