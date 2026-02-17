import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'node:path';

import { errorMiddleware } from './middleware/error.middleware.js';
import { rateLimitMiddleware } from './middleware/rateLimit.middleware.js';
import { ensureUploadsDir, getUploadsRoot } from './config/uploads.js';

import authRoutes from './routes/auth.routes.js';
import propertyRoutes from './routes/property.routes.js';
import dealRoutes from './routes/deal.routes.js';
import visitRoutes from './routes/visit.routes.js';
import requirementRoutes from './routes/requirement.routes.js';
import chatRoutes from './routes/chat.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import adminRoutes from './routes/admin.routes.js';
import agentRoutes from './routes/agent.routes.js';
import inquiryRoutes from './routes/inquiry.routes.js';
import favoriteRoutes from './routes/favorite.routes.js';
import sellerRoutes from './routes/seller.routes.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(rateLimitMiddleware());

ensureUploadsDir();
app.use('/uploads', express.static(getUploadsRoot()));

app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    service: 'propertypulse-api',
    features: {
      adminStats: true,
      adminUsers: true,
      adminSetActive: true,
      crmLeads: true,
      favorites: true,
    },
    time: new Date().toISOString(),
  }),
);

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/requirements', requirementRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/seller', sellerRoutes);

app.use(errorMiddleware);

export default app;
