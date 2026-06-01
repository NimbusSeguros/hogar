import { RusProvider } from './src/services/providers/rus/RusProvider';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    try {
        const provider = new RusProvider();
        await provider.authenticate();

        const resForm = await provider.submitFormAnswers('BICICLETA', 'ROBO_BICICLETA_FREESTYLE', {
            'BICICLETA_ROBO_FREESTYLE_VALORES_NUEVOS': 'BICICLETA_ROBO__FREESTYLE_VALOR_250_PARTICULAR'
        });

        const consultaId = resForm.consultaId;
        const plans = await provider.getPlansByConsultaId(consultaId);
        const plan = plans[0];
        const formaPago = plan.formasPagos[0];
        
        const body = {
            consultaID: consultaId,
            codigoPlan: plan.codigo,
            cantidadCuotas: formaPago.cantidadCuotas,
            precioCuota: formaPago.precioCuota,
            codigoISOMoneda: formaPago.codigoISOMoneda || 'ARS',
            medioPago: formaPago.mediosPago[0],
            inicioVigencia: new Date().toISOString().split('T')[0],
            finVigencia: (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 3);
                return d.toISOString().split('T')[0];
            })(),
            cantidadObjetos: 1,
            codigoProductor: "9254" 
        };
        const orderRes = await provider.apiClient.post('/ordenventa', body);
        console.log("Submitting client data...");
            try {
                const clientPayload = {
                    nombre: "Nahuel",
                    apellido: "Test",
                    tipoDocumento: "DNI",
                    numeroDocumento: "30123321",
                    nacionalidad: "ARG",
                    fechaNacimiento: "1990-05-15",
                    email: "nahuel@test.com",
                    codTelefonoPais: "54",
                    codTelefonoArea: "3442",
                    numeroTelefono: "441055",
                    tipoPersona: "FISICA",
                    condicionFiscal: "CONSUMIDORFINAL",
                    domicilio: {
                        calle: "Pablo Sceliga",
                        numero: "1195",
                        localidad: "Concepcion del Uruguay",
                        codigoPostal: "3260"
                    }
                };
                await provider.submitClientData(orderRes.data.ordenVentaID, clientPayload);
                console.log("Client data submitted successfully");
            } catch (clientErr: any) {
                console.error("CLIENT DATA ERROR:", JSON.stringify(clientErr.response?.data || clientErr.message, null, 2));
                return;
            }
        const ordenVentaId = orderRes.data.ordenVentaID;

        const emissionForm = await provider.apiClient.get(`/ordenventas/${ordenVentaId}/formularios`);
        console.log("All Question Codes:", emissionForm.data.formularioDTO.preguntas.map((p: any) => p.codigo));

    } catch (e: any) {
        console.error("Error:", e.response?.data || e.message);
    }
}

main();
