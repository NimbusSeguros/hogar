import { Request, Response } from 'express';
import { InsuranceProviderFactory } from '../services/providers/InsuranceProviderFactory';
import { SupabaseProvider } from '../services/SupabaseProvider';
import { decrypt } from '../utils/security.utils';

const getTableName = (objectCode: string): string => {
    switch (objectCode?.toUpperCase()) {
        case 'BICICLETA': return 'bicicleta';
        case 'NOTEBOOK': return 'notebook';
        case 'MONOPATIN': return 'monopatin';
        case 'VIVIENDA': return 'hogar';
        default: return 'hogar';
    }
};

export const getObjects = async (req: Request, res: Response) => {
    try {
        const { provider: providerName = 'RUS' } = req.query;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();
        const objects = await provider.getGlobalObjects();
        res.json(objects);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: error.message, details: error?.response?.data });
    }
};

export const getIndicios = async (req: Request, res: Response) => {
    try {
        const { provider: providerName = 'RUS' } = req.query;
        const { objectCode } = req.params;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();
        const indicios = await provider.getIndicios(objectCode);
        res.json(indicios);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: error.message, details: error?.response?.data });
    }
};

export const getForm = async (req: Request, res: Response) => {
    try {
        const { provider: providerName = 'RUS' } = req.query;
        const { objectCode, indicioCode } = req.params;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();
        const form = await provider.getForm(objectCode, indicioCode);
        res.json(form);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: error.message, details: error?.response?.data });
    }
};

export const submitFormAnswers = async (req: Request, res: Response) => {
    try {
        const { provider: providerName = 'RUS' } = req.query;
        const { objectCode, indicioCode } = req.params;
        const { answers, consultaId } = req.body;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();
        const result = await provider.submitFormAnswers(objectCode, indicioCode, answers, consultaId);
        res.json(result);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: 'RUS API Error', details: error?.response?.data || error.message });
    }
};

export const getPlansByConsultaId = async (req: Request, res: Response) => {
    try {
        const { provider: providerName = 'RUS' } = req.query;
        const { consultaId } = req.params;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();
        const plans = await provider.getPlansByConsultaId(consultaId);
        res.json(plans);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: 'RUS API Error', details: error?.response?.data || error.message });
    }
};

// ===== EMISSION FLOW =====

export const createOrder = async (req: Request, res: Response) => {
    console.log('[Controller] createOrder reached with body:', JSON.stringify(req.body, null, 2));
    try {
        const { provider: providerName = 'RUS' } = req.query;
        const { idConsulta, plan, formaPago, personalData, objectCode, inicioVigencia, finVigencia } = req.body;
        console.log('[Controller] Received plan object:', JSON.stringify(plan, null, 2));
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();

        // 1. Iniciar orden en RUS
        const rusOrder = await provider.createOrder(idConsulta, plan, formaPago, inicioVigencia, finVigencia);
        const ordenVentaId = rusOrder.ordenVentaID;

        // 2. Guardar en Supabase (datos personales iniciales)
        const tableName = getTableName(objectCode);
        const dbOrder = await SupabaseProvider.saveOrder(tableName, {
            nombre: personalData.nombre,
            apellido: personalData.apellido,
            email: personalData.email,
            dni: personalData.numeroDocumento,
            plan_codigo: plan.codigo,
            precio_cuota: formaPago.precioCuota,
            order_id_rus: ordenVentaId,
            estado: 'orden_iniciada'
        });

        res.json({ rusOrder, dbOrder });
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: error.message, details: error?.response?.data });
    }
};

export const submitClientData = async (req: Request, res: Response) => {
    try {
        const { ordenVentaId } = req.params;
        const { clientData } = req.body;
        const { provider: providerName = 'RUS' } = req.query;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();

        const result = await provider.submitClientData(ordenVentaId, clientData);

        // Actualizar Supabase con más detalles si es necesario
        const resultFound = await SupabaseProvider.findOrderAnywhere(ordenVentaId as string);
        if (resultFound) {
            await SupabaseProvider.saveOrder(resultFound.tableName, {
                id: resultFound.data.id,
                telefono: `${clientData.codTelefonoArea}${clientData.numeroTelefono}`,
                fecha_nacimiento: clientData.fechaNacimiento,
                estado: 'datos_personales_completos'
            });
        }

        res.json(result);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: error.message, details: error?.response?.data });
    }
};

export const submitEmissionForm = async (req: Request, res: Response) => {
    console.log('[Controller] submitEmissionForm reached with body:', JSON.stringify(req.body, null, 2));
    try {
        const { ordenVentaId } = req.params;
        const { answers, addressData, personalData, objectCode } = req.body;
        const { provider: providerName = 'RUS' } = req.query;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();

        if (personalData && addressData) {
            // Transform frontend personalData into RUS exact schema, combining with the collected address
            const clientPayload = {
                nombre: personalData.nombre,
                apellido: personalData.apellido,
                tipoDocumento: personalData.tipoDocumento || 'DNI',
                numeroDocumento: personalData.numeroDocumento,
                nacionalidad: personalData.nacionalidad || 'ARG',
                fechaNacimiento: `${personalData.fechaNacimientoAno}-${String(personalData.fechaNacimientoMes || '').padStart(2, '0')}-${String(personalData.fechaNacimientoDia || '').padStart(2, '0')}`,
                email: personalData.email,
                // SIAPI Kontakt/Contacto expects flat fields for phone, NOT a telefonos array
                codTelefonoPais: "54", 
                codTelefonoArea: personalData.telefono_codigo_area,
                numeroTelefono: personalData.telefono_numero,
                tipoPersona: "FISICA",
                condicionFiscal: "CONSUMIDORFINAL",
                domicilio: {
                    calle: addressData.calle,
                    numero: addressData.numero,
                    localidad: addressData.localidad,
                    codigoPostal: addressData.codigoPostal
                }
            };

            try {
                console.log('[Controller] Submitting Client Data:', JSON.stringify(clientPayload, null, 2));
                await provider.submitClientData(ordenVentaId, clientPayload);
                console.log('[Controller] Step 2 OK');
            } catch (clientError: any) {
                console.error('[Controller] Step 2 FAILED:', clientError.response?.data || clientError.message);
                throw clientError;
            }
        }

        console.log('[Controller] Step 3: Submitting Emission Form for order', ordenVentaId);
        // 3. Submit the emission form answers (The actual underwriting questions)
        let finalAnswers = [...answers];

        // Ensure address questions use the specific CF codes ONLY for VIVIENDA
        if (objectCode === 'VIVIENDA') {
            const addressMap: any = {
                'CALLE_CF': addressData?.calle || 'SN',
                'ALT_CF': addressData?.numero || '0',
                'CPPPP': addressData?.codigoPostal || '0000',
            };

            for (const [codigo, valor] of Object.entries(addressMap)) {
                if (!finalAnswers.find((a: any) => a.codigoPregunta === codigo)) {
                    finalAnswers.push({ codigoPregunta: codigo, valores: [valor] });
                }
            }
        }

        // Add hidden mandatory answers with discovered internal IDs from emission_form_discovery.json
        if (objectCode === 'VIVIENDA') {
            const defaultQs: any = {
                'VIVIENDA_COMBINADOFAMILIAR_ACTIVIDAD': 'VIVIENDA_COMBINADOFAMILIAR_ACTIVIDAD1',
                'VIVIENDA_COMBINADOFAMILIAR_SINIESTROS': 'VIVIENDA_COMBINADOFAMILIAR_SINIESTROS2',
                'M222': 100, // Number, not string
                'VIVIENDA_COMBINADOFAMILIAR_DEPENDENCIAS': 'VIVIENDA_COMBINADOFAMILIAR_DEPENDENCIAS2',
                'VIVIENDA_COMBINADOFAMILIAR_OCUPACION': 'VIVIENDA_COMBINADOFAMILIAR_OCUPACION1',
                'med_seg_pack': 'ALARMA', 
                'VIVIENDA_COMBINADOFAMILIAR_MURO': 'VIVIENDA_COMBINADOFAMILIAR_MURO2',
                'tipoo': 'casss', // Discovered mandatory code for "Su vivienda es"
                'matconst': 'trad', // Discovered ID for Ladrillo
                'VIVIENDA_COMBINADOFAMILIAR_PREGUNTATIPOVIVIENDA_PACK': 'VIVIENDA_COMBINADOFAMILIAR_PREGUNTATIPOVIVIENDA_PACK1'
            };

            for (const [codigo, valor] of Object.entries(defaultQs)) {
                if (!finalAnswers.find((a: any) => a.codigoPregunta === codigo)) {
                    finalAnswers.push({ codigoPregunta: codigo, valores: [valor] });
                }
            }
        }
        // Add hidden mandatory answers for NOTEBOOK accessories (user is not asked, default = NO)
        if (objectCode === 'NOTEBOOK') {
            const notebookAccessoryDefaults: any = {
                'EQUIPO_ELECTRONICO_MOUSE': 'NO',
                'EQUIPO_ELECTRONICO_TECLADO': 'NO',
                'EQUIPO_ELECTRONICO_AURICULARES': 'NO',
                'EQUIPO_ELECTRONICO_MICROFONO': 'NO',
                'EQUIPO_ELECTRONICO_CAMARA': 'NO',
                'EQUIPO_ELECTRONICO_CASCOVR': 'NO',
                'EQUIPO_ELECTRONICO_JOYSTICK': 'NO',
            };

            for (const [codigo, valor] of Object.entries(notebookAccessoryDefaults)) {
                if (!finalAnswers.find((a: any) => a.codigoPregunta === codigo)) {
                    finalAnswers.push({ codigoPregunta: codigo, valores: [valor] });
                }
            }
        }


        const formResponse = await provider.apiClient.get(`/ordenventas/${ordenVentaId}/formularios`);
        const allowedCodes = formResponse.data.formularioDTO.preguntas.map((p: any) => p.codigo);
        console.log('[Controller] Allowed codes for this form:', allowedCodes);

        // Filter out any answer that is NOT in the allowed codes
        const filteredAnswers = finalAnswers.filter(a => allowedCodes.includes(a.codigoPregunta));
        console.log('[Controller] Submitting filtered answers:', JSON.stringify({ respuestas: filteredAnswers }, null, 2));

        const result = await provider.submitEmissionForm(ordenVentaId, filteredAnswers);

        // Guardar en Supabase - Guardamos telefono, nacimiento y limpiamos el json de domicilio
        const tableName = getTableName(objectCode);
        const existing = await SupabaseProvider.getOrderByRusId(tableName, ordenVentaId as string);
        if (existing) {
            // Extraer solo lo más importante del domicilio y datos del riesgo
            const cleanDomicilio: any = {
                calle: addressData?.calle || '',
                numero: addressData?.numero || '',
                piso: addressData?.piso || '',
                dpto: addressData?.dpto || '',
                localidad: addressData?.localidad || '',
                codigoPostal: addressData?.codigoPostal || ''
            };

            // Si es bicicleta, guardamos sus datos específicos también
            if (objectCode === 'BICICLETA') {
                cleanDomicilio.marca = addressData?.marca;
                cleanDomicilio.tipoBici = addressData?.tipoBici;
                cleanDomicilio.rodado = addressData?.rodado;
                cleanDomicilio.numeroCuadro = addressData?.numeroCuadro;
                cleanDomicilio.tieneFactura = addressData?.tieneFactura;
            } else if (objectCode === 'NOTEBOOK') {
                cleanDomicilio.marca = addressData?.marca;
                cleanDomicilio.modelo = addressData?.modelo;
                cleanDomicilio.serie = addressData?.serie;
            } else if (objectCode === 'MONOPATIN') {
                cleanDomicilio.marca = addressData?.marca;
                cleanDomicilio.modelo = addressData?.modelo;
                cleanDomicilio.serie = addressData?.serie;
                cleanDomicilio.anio = addressData?.anio;
            }

            const updatePayload: any = {
                id: existing.id,
                domicilio: cleanDomicilio,
                estado: 'domicilio_completado'
            };

            // Asegurar que guardamos telefono y fecha de nacimiento si vienen en personalData
            if (personalData) {
                updatePayload.telefono = `${personalData.telefono_codigo_area || ''}${personalData.telefono_numero || ''}`;
                updatePayload.fecha_nacimiento = `${personalData.fechaNacimientoAno}-${String(personalData.fechaNacimientoMes || '').padStart(2, '0')}-${String(personalData.fechaNacimientoDia || '').padStart(2, '0')}`;
            }

            await SupabaseProvider.saveOrder(tableName, updatePayload);
        }

        res.json(result);
    } catch (error: any) {
        const errorDetails = error.response?.data || error.message;
        console.error('Error in submitEmissionForm:', JSON.stringify(errorDetails, null, 2));
        res.status(400).json({ 
            error: 'Failed to submit emission form', 
            details: errorDetails
        });
    }
};

export const submitPaymentInfo = async (req: Request, res: Response) => {
    try {
        const { ordenVentaId } = req.params;
        let { paymentInfo, _enc } = req.body;
        const { provider: providerName = 'RUS' } = req.query;

        // Decrypt if requested by frontend using AES
        if (_enc) {
            if (paymentInfo.numeroTarjeta) {
                paymentInfo.numeroTarjeta = decrypt(paymentInfo.numeroTarjeta);
            }
            if (paymentInfo.CBU) {
                paymentInfo.CBU = decrypt(paymentInfo.CBU);
            }
        }

        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();

        const result = await provider.submitPaymentInfo(ordenVentaId, paymentInfo);

        // Actualizar estado en Supabase
        const resultFound = await SupabaseProvider.findOrderAnywhere(ordenVentaId as string);
        if (resultFound) {
            await SupabaseProvider.saveOrder(resultFound.tableName, {
                id: resultFound.data.id,
                estado: 'pago_ingresado'
            });
        }

        res.json(result);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: error.message, details: error?.response?.data });
    }
};

export const confirmOrder = async (req: Request, res: Response) => {
    try {
        const { ordenVentaId } = req.params;
        const { provider: providerName = 'RUS' } = req.query;
        const provider: any = InsuranceProviderFactory.getProvider(providerName as string);
        await provider.authenticate();

        const result = await provider.confirmOrder(ordenVentaId);

        // Actualizar estado final en Supabase
        const resultFound = await SupabaseProvider.findOrderAnywhere(ordenVentaId as string);
        if (resultFound) {
            await SupabaseProvider.saveOrder(resultFound.tableName, {
                id: resultFound.data.id,
                estado: 'emitido'
            });
        }

        res.json(result);
    } catch (error: any) {
        res.status(error?.response?.status || 500).json({ error: error.message, details: error?.response?.data });
    }
};

