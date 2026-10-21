import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';

const app = express();

// Detrás de nginx (+ Cloudflare): sin esto req.ip es la IP de nginx y el
// rate limit agruparía a todos los usuarios en un solo bucket.
app.set('trust proxy', 1);

// CORS: restrict to allowed origins from env
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (!allowedOrigin) {
    throw new Error('ALLOWED_ORIGIN no está configurado en variables de entorno');
}

const corsOptions: cors.CorsOptions = {
    origin: allowedOrigin.includes(',') ? allowedOrigin.split(',') : allowedOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // Headers que el browser puede mandar en requests cross-origin.
    // Si el front agrega un header que no está acá, el preflight lo rechaza y el
    // request entero se bloquea (bug 19/10/2026: 'x-client-secret' rompía Hogar).
    // Por eso además de los que se usan hoy dejamos x-client-secret tolerado,
    // aunque el backend no lo lea, para que un reintento no vuelva a romper todo.
    allowedHeaders: ['Content-Type', 'Authorization', 'x-client-secret', 'X-Client-Secret'],
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
import { tokenLimiter } from './middleware/rateLimit.middleware';

// Main entry
app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'OK', timestamp: new Date() });
});

// API Routes
app.use('/api/auth', tokenLimiter, authRoutes);
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
