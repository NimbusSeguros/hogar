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

const router = Router();

// 3-Step Quote flow (global, no campaign needed)
router.get('/objects', getObjects);
router.get('/objects/:objectCode/indicios', getIndicios);
router.get('/objects/:objectCode/indicios/:indicioCode/form', getForm);
router.post('/objects/:objectCode/indicios/:indicioCode/form/submit', submitFormAnswers);
router.get('/consultas/:consultaId/planes', getPlansByConsultaId);

// Emission flow
router.post('/orders/create', createOrder);
router.post('/orders/:ordenVentaId/datocliente', submitClientData);
router.post('/orders/:ordenVentaId/form/submit', submitEmissionForm);
router.post('/orders/:ordenVentaId/infopago', submitPaymentInfo);
router.post('/orders/:ordenVentaId/confirm', confirmOrder);

export default router;
