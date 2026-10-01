import express from 'express';
import { mountSocialPart1 } from './socialPart1.js';
import { mountSocialPart2a } from './socialPart2a.js';
import { mountSocialPart2b } from './socialPart2b.js';

const router = express.Router();
mountSocialPart1(router);
mountSocialPart2a(router);
mountSocialPart2b(router);
export default router;
