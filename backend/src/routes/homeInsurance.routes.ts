import { Router } from 'express';
import {
    getObjects,
    getIndicios,
    getForm,
    submitFormAnswers,
    getPlansByConsultaId,
    createOrder,
    submitClientData,
    submitEmissionForm,
    submitPaymentInfo,
    confirmOrder
} from '../controllers/homeInsurance.controller';
import { quotesLimiter, ordersLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

// 3-Step Quote flow (global, no campaign needed)
router.get('/objects', quotesLimiter, getObjects);
router.get('/objects/:objectCode/indicios', quotesLimiter, getIndicios);
router.get('/objects/:objectCode/indicios/:indicioCode/form', quotesLimiter, getForm);
router.post('/objects/:objectCode/indicios/:indicioCode/form/submit', quotesLimiter, submitFormAnswers);
router.get('/consultas/:consultaId/planes', quotesLimiter, getPlansByConsultaId);

// Emission flow (crea órdenes REALES en SIAPI → límite más estricto)
router.post('/orders/create', ordersLimiter, createOrder);
router.post('/orders/:ordenVentaId/datocliente', ordersLimiter, submitClientData);
router.post('/orders/:ordenVentaId/form/submit', ordersLimiter, submitEmissionForm);
router.post('/orders/:ordenVentaId/infopago', ordersLimiter, submitPaymentInfo);
router.post('/orders/:ordenVentaId/confirm', ordersLimiter, confirmOrder);

export default router;
