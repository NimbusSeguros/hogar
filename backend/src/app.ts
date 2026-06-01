import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();

// CORS: restrict to allowed origins from env
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (!allowedOrigin) {
    throw new Error('ALLOWED_ORIGIN no está configurado en variables de entorno');
}

const corsOptions: cors.CorsOptions = {
    origin: allowedOrigin.includes(',') ? allowedOrigin.split(',') : allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

import homeInsuranceRoutes from './routes/homeInsurance.routes';
import authRoutes from './routes/auth.routes';
import { authenticateToken } from './middleware/auth.middleware';

// Main entry
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/insurance/home', authenticateToken, homeInsuranceRoutes);

// Basic Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
        message: err.message || 'Internal Server Error',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
});

export default app;
