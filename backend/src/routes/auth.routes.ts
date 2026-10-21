import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Simple endpoint to get a token for the frontend
// In a real app, this would involve validating user credentials
router.post('/token', (req: Request, res: Response) => {
    const { clientSecret: requestSecret } = req.body;
    
    const secret = process.env.JWT_SECRET;
    const envClientSecret = process.env.CLIENT_SECRET;
    if (!secret || !envClientSecret) {
        console.error('JWT_SECRET o CLIENT_SECRET no están configurados en variables de entorno');
        return res.status(500).json({ error: 'Server configuration error' });
    }
    
    if (requestSecret === envClientSecret) {
        // Fix A (seguridad): el token del ClientSecret público es SOLO para
        // cotizar. La emisión (orders/*) exige scope 'emission', que se obtiene
        // con sesión Supabase (ver requireEmissionScope en auth.middleware).
        const token = jwt.sign({ app: 'yuju-frontend', scope: 'quote' }, secret, { expiresIn: '24h' });
        return res.json({ token });
    }

    res.status(401).json({ error: 'Invalid client secret' });
});

export default router;
