import express from 'express';
import { generateAgentResponse } from '../services/openaiService.js';

const router = express.Router();
const pages = new Set([
  '/dashboard', '/dashboard/onboarding', '/dashboard/campaigns',
  '/dashboard/products', '/dashboard/social', '/dashboard/analytics',
  '/dashboard/growth', '/dashboard/paid-ads', '/dashboard/clipping',
  '/dashboard/content', '/dashboard/video', '/dashboard/billing',
  '/dashboard/media-library', '/dashboard/connectors',
]);
const platformFacts = [
  'Business Setup saves business information and supports a customer review before campaign generation.',
  'Campaigns shows saved draft strategies and generated content. Opening a campaign does not publish it.',
  'Social helps customers review publishing to their authorised connected accounts.',
  'Content Studio supports content review and editing.',
  'Clipping Agency helps customers repurpose authorised video footage.',
  'Growth Check-In supports optional self-reported progress, without revenue disclosure.',
  'Paid advertising requires explicit separate spending authorisation.',
  'Customer-directed scheduling is self-service; autonomous ongoing management is a distinct paid Manager capability when available.',
  'Manager consultation and revenue optimisations must not be represented as active without confirmed integration and entitlements.',
];
router.post('/ask', async (req, res, next) => {
  try {
    const question=req.body?.question;
    const page=req.body?.page;
    if(typeof question!=='string'||question.trim().length<3||question.length>1000||!pages.has(page)) {
      return res.status(400).json({error:'Ask a short question from a recognised Marketing page.'});
    }
    const answer=await generateAgentResponse('platform-guide',question.trim(),{
      userId:req.user.id,
      currentPage:page,
      facts:platformFacts,
      instruction:'Answer with existing product guidance only; describe uncertain features as unverified. Do not ask for passwords, tokens, bank records or secrets.',
    });
    if(answer.fallback || !answer.content) {
      return res.status(503).json({error:'AI help is temporarily unavailable. You can still use the guided walkthrough or contact support.',code:'guided_help_unavailable'});
    }
    return res.json({answer:answer.content,mode:'guidance_only',actionsExecuted:false});
  } catch(error) {
    return next(error);
  }
});
export default router;
