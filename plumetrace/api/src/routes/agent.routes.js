/**
 * OWNER    : Yasho2
 * DUE      : D1 15:00
 * TASK     :
 *   POST /agent/chat (SSE stream) -> agent.controllers.js.
 * DONE WHEN: -
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Router } from 'express';
import { validate } from '../middlewares/validate.middlewares.js';
import { ChatRequest } from '@plumetrace/contracts';
import { chat } from '../controllers/agent.controllers.js';

const router = Router();

router.post('/agent/chat', validate(ChatRequest, 'body'), chat);

export default router;
