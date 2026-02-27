import 'dotenv/config';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from './middleware/auth.js';
import { initDatabase } from './db/client.js';

const PORT = parseInt(process.env.PORT || '3200', 10);
const REQUEST_SIZE_LIMIT = process.env.REQUEST_SIZE_LIMIT || '5mb';

async function main() {
    // Initialize database before starting server
    await initDatabase();

    // Dynamic imports after DB init
    const { accountRoutes } = await import('./routes/accounts.js');
    const { categoryRoutes } = await import('./routes/categories.js');
    const { transactionRoutes } = await import('./routes/transactions.js');
    const { budgetRoutes } = await import('./routes/budgets.js');
    const { analyticsRoutes } = await import('./routes/analytics.js');
    const { recurringRoutes } = await import('./routes/recurring.js');
    const { installmentRoutes } = await import('./routes/installments.js');
    const { systemRoutes } = await import('./routes/system.js');
    const cors = (await import('cors')).default;

    const app = express();

    // --- Global Middleware ---
    app.use(cors());
    app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));

    // TraceId propagation
    app.use((req, _res, next) => {
        if (!req.headers['x-trace-id']) {
            req.headers['x-trace-id'] = uuidv4();
        }
        next();
    });

    // --- Health & Readiness ---
    app.get('/healthz', (_req, res) => {
        res.status(200).json({ status: 'ok' });
    });

    app.get('/readyz', (_req, res) => {
        res.status(200).json({ status: 'ready' });
    });

    app.get('/version', (_req, res) => {
        res.json({ app: 'mm2-tool-gateway', version: '1.0.0' });
    });

    // --- Auth middleware for all /api routes ---
    app.use('/api', authMiddleware);

    // --- Routes ---
    app.use('/api/v1', accountRoutes);
    app.use('/api/v1', categoryRoutes);
    app.use('/api/v1', transactionRoutes);
    app.use('/api/v1', budgetRoutes);
    app.use('/api/v1', analyticsRoutes);
    app.use('/api/v1', recurringRoutes);
    app.use('/api/v1', installmentRoutes);
    app.use('/api/v1', systemRoutes);

    // --- Global Error Handler ---
    app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err);
        res.status(err.status || 500).json({
            error: { code: err.code || 'INTERNAL', message: err.message || 'Internal server error' },
            traceId: req.headers['x-trace-id'] || '',
        });
    });

    // --- Start ---
    app.listen(PORT, () => {
        console.log(`mm2 Tool Gateway running on http://localhost:${PORT}`);
        console.log(`Health: http://localhost:${PORT}/healthz`);
        console.log(`API: http://localhost:${PORT}/api/v1`);
    });
}

main().catch(err => { console.error('Failed to start:', err); process.exit(1); });
