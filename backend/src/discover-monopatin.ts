
import dotenv from 'dotenv';
import path from 'path';
import { RusProvider } from './services/providers/rus/RusProvider';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function discoverMonopatinForm() {
    try {
        const provider = new RusProvider();
        console.log("Authenticating...");
        await provider.authenticate();

        const objectCode = 'MONOPATIN';
        const indicioCode = 'ROBO_MONOPATIN_FREESTYLE';

        console.log(`Submitting form answers for ${objectCode}...`);
        const formSubmit = await provider.submitFormAnswers(objectCode, indicioCode, { 
            'MONOPATIN_ROBO_FREESTYLE_VALOR': '750mil' 
        });

        const consultaId = formSubmit.consultaId;
        console.log("Consulta ID:", consultaId);

        console.log("Fetching plans...");
        const plans = await provider.getPlansByConsultaId(consultaId);
        if (plans.length === 0) {
            console.error("No plans found for Monopatin");
            return;
        }

        const plan = plans[0];
        console.log("Using Plan:", JSON.stringify(plan, null, 2));

        console.log("Creating order...");
        const order = await provider.createOrder(consultaId, plan, plan.formasPagos[0]);
        const orderId = order.ordenVentaID;
        console.log("Order ID:", orderId);

        console.log("Fetching emission form questions...");
        const formRes = await provider.apiClient.get(`/ordenventas/${orderId}/formularios`);
        console.log("Emission Form Questions:", JSON.stringify(formRes.data, null, 2));

    } catch (e: any) {
        console.error("Error:", JSON.stringify(e.response?.data || e.message, null, 2));
    }
}

discoverMonopatinForm();
