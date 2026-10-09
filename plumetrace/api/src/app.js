/**
 * OWNER    : Yasho2
 * DUE      : D1 14:00
 * TASK     :
 *   Express 5 app: helmet, cors (Amplify origin + localhost:5173), compression (NOT on /agent/chat — breaks SSE), pino-http, json body, routes mounted at /, error middleware last.
 * DONE WHEN: All §8.4 routes respond (mock or real).
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import pinoHttp from 'pino-http';
import env from './libs/env.js';
import logger from './libs/logger.js';
import { attachUser } from './middlewares/auth.middlewares.js';
import { notFound, errorHandler } from './middlewares/error.middlewares.js';

import forecastRoutes from './routes/forecast.routes.js';
import actionsRoutes from './routes/actions.routes.js';
import fleetRoutes from './routes/fleet.routes.js';
import agentRoutes from './routes/agent.routes.js';
import ridersRoutes from './routes/riders.routes.js';

const app = express();
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.split(',').map((s) => s.trim()),
    credentials: true,
  }),
);
// Gzip everything EXCEPT the SSE chat stream (compression breaks SSE).
app.use(
  compression({
    filter: (req, res) => (req.path.endsWith('/agent/chat') ? false : compression.filter(req, res)),
  }),
);
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
app.use(express.json({ limit: '1mb' }));

// Health check (no auth) — Tejas's ApiStack / LWA probes this.
app.get('/health', (_req, res) => res.json({ ok: true, mock: env.MOCK_MODE }));

// Everything else needs an identity (mock user in MOCK_MODE).
app.use(attachUser);

app.use('/', forecastRoutes);
app.use('/', actionsRoutes);
app.use('/', fleetRoutes);
app.use('/', agentRoutes);
app.use('/', ridersRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
