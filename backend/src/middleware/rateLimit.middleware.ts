import { Request } from 'express';
import rateLimit from 'express-rate-limit';

// ============================================================================
// RATE LIMITING (Fix B — auditoría seguridad 20/10/2026)
//
// Objetivo: frenar el abuso por script (mintear tokens en masa, crear órdenes
// basura) SIN afectar a usuarios reales. Los defaults son deliberadamente
// generosos y se pueden ajustar por env sin tocar código:
//
//   RATE_LIMIT_TOKEN_PER_HOUR   (default 30)   → POST /api/auth/token
//   RATE_LIMIT_QUOTES_PER_HOUR  (default 240)  → endpoints de cotización
//   RATE_LIMIT_ORDERS_PER_HOUR  (default 30)   → endpoints de emisión
//
// Por qué estos números:
//   - token: el front cachea el JWT 24 h en sessionStorage → 1 request por
//     visitante por día. 30/h cubre retries y NATs compartidos (oficinas).
//   - quotes: cotizar genera varios calls (objects → form → submit → planes);
//     240/h deja probar combinaciones con tranquilidad.
//   - orders: UNA emisión completa = 5 requests (create → datocliente →
//     form/submit → infopago → confirm). 30/h = 6 intentos/hora: cubre retries
//     legítimos (tarjeta rechazada, corrección de datos) pero bloquea scripts
//     (que harían cientos).
// ============================================================================

/**
 * IP real del cliente. Detrás de Cloudflare + nginx la IP del socket es la de
 * CF/nginx; el header CF-Connecting-IP (seteado por Cloudflare, no spoofeable
 * desde internet porque CF lo sobreescribe) es la fuente confiable.
 */
const clientIp = (req: Request): string => {
    const cf = req.headers['cf-connecting-ip'];
    if (typeof cf === 'string' && cf.length > 0) return cf;
    return req.ip || 'unknown';
};

const hours = (n: number) => n * 60 * 60 * 1000;

const envInt = (name: string, def: number): number => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v > 0 ? v : def;
};

const baseOptions = {
    standardHeaders: true as const,   // RateLimit-* headers (bien para el front)
    legacyHeaders: false as const,    // no X-RateLimit-* viejos
    keyGenerator: clientIp,
    // Desactivamos la validación de express-rate-limit sobre trust proxy:
    // nuestro keyGenerator usa CF-Connecting-IP, no X-Forwarded-For crudo.
    validations: { ip: false as const, xForwardedForHeader: false as const },
};

/** POST /api/auth/token — minteo de JWT. El punto más golbable. */
export const tokenLimiter = rateLimit({
    ...baseOptions,
    windowMs: hours(1),
    limit: envInt('RATE_LIMIT_TOKEN_PER_HOUR', 30),
    message: { error: 'Demasiadas solicitudes de token. Intentá más tarde.' },
});

/** Endpoints de cotización (objects / indicios / form / submit / planes). */
export const quotesLimiter = rateLimit({
    ...baseOptions,
    windowMs: hours(1),
    limit: envInt('RATE_LIMIT_QUOTES_PER_HOUR', 240),
    message: { error: 'Demasiadas cotizaciones desde esta conexión. Intentá más tarde.' },
});

/** Endpoints de EMISIÓN (orders/*) — crean órdenes reales en SIAPI. */
export const ordersLimiter = rateLimit({
    ...baseOptions,
    windowMs: hours(1),
    limit: envInt('RATE_LIMIT_ORDERS_PER_HOUR', 30),
    message: { error: 'Demasiados intentos de emisión. Intentá más tarde o contactanos.' },
});
