import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// AUTH + SCOPES (Fix A — auditoría seguridad 20/10/2026)
//
// Dos tipos de token, dos niveles de acceso:
//
//   1. Token de APP (POST /api/auth/token con ClientSecret) → scope: 'quote'
//      Alcanza para cotizar. El ClientSecret vive en el bundle público, así
//      que este token se considera PÚBLICO por diseño.
//
//   2. Token de SUPABASE (sesión anónima del front: signInAnonymously) →
//      equivale a scope 'emission'. Requerido para orders/* cuando el
//      enforcement está activo. Cada emisión queda atada a un uid: trazable,
//      limitable por usuario y revocable.
//
// ROLLOUT SIN ROMPER NADA (flag SCOPE_ENFORCEMENT en .env):
//   - Sin la var / en 'false': requireEmissionScope solo OBSERVA (loguea qué
//     tipo de token llega a orders/*) y deja pasar. Todo funciona como hoy.
//   - En 'true': orders/* rechaza tokens de solo-cotización con 403.
//     Volver a 'false' revierte en un reinicio.
// ============================================================================

interface AuthUser {
    kind: 'app' | 'supabase';
    scope: 'quote' | 'emission';
    uid?: string;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

let supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabase() {
    if (supabaseAdmin) return supabaseAdmin;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) return null;
    supabaseAdmin = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return supabaseAdmin;
}

/** Verifica un access token de Supabase. Devuelve el uid o null. */
async function verifySupabaseToken(token: string): Promise<string | null> {
    const supabase = getSupabase();
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user?.id) return null;
        return data.user.id;
    } catch {
        return null;
    }
}

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // 1) Token de APP nuestro (verificación local, barata — el camino de hoy)
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('JWT_SECRET no está configurado en variables de entorno');
            return res.status(500).json({ error: 'Server configuration error' });
        }
        const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
        (req as any).user = {
            kind: 'app',
            scope: decoded.scope === 'emission' ? 'emission' : 'quote',
        } as AuthUser;
        return next();
    } catch {
        // no es un token de APP válido → probar Supabase antes de rechazar
    }

    // 2) Token de sesión Supabase (anónima o real) → habilita emisión
    const uid = await verifySupabaseToken(token);
    if (uid) {
        (req as any).user = { kind: 'supabase', scope: 'emission', uid } as AuthUser;
        return next();
    }

    res.status(403).json({ error: 'Invalid or expired token.' });
};

/**
 * Guarda de scope para las rutas de EMISIÓN (orders/*).
 *
 * Con SCOPE_ENFORCEMENT=false (default): solo loguea y deja pasar — fase de
 * observación del rollout. Con 'true': exige token con capacidad de emisión
 * (sesión Supabase o token de APP con scope 'emission').
 */
export const requireEmissionScope = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as AuthUser | undefined;
    const enforce = process.env.SCOPE_ENFORCEMENT === 'true';

    if (!enforce) {
        // Fase de observación: logueamos para verificar (en producción) que el
        // front ya está mandando tokens Supabase antes de activar enforcement.
        console.log(`[SCOPE] enforcement OFF · orders ${req.method} ${req.path} · token=${user?.kind ?? 'ninguno'} scope=${user?.scope ?? '?'}`);
        return next();
    }

    const puedeEmitir = user?.scope === 'emission';
    if (!puedeEmitir) {
        console.warn(`[SCOPE] BLOQUEADO · orders ${req.method} ${req.path} · token=${user?.kind ?? 'ninguno'} (requiere sesión Supabase)`);
        return res.status(403).json({ error: 'Esta operación requiere una sesión válida. Recargá la página e intentá de nuevo.' });
    }
    next();
};
