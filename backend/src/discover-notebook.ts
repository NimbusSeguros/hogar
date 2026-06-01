
import dotenv from 'dotenv';
import path from 'path';
import { RusProvider } from './services/providers/rus/RusProvider';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function discoverNotebookForm() {
    try {
        const provider = new RusProvider();
        console.log("Authenticating...");
        await provider.authenticate();

        const objectCode = 'NOTEBOOK';
        const indicioCode = 'FREESTYLE_ROBO_NOTEBOOK';

        console.log(`Submitting form answers for ${objectCode}...`);
        const formSubmit = await provider.submitFormAnswers(objectCode, indicioCode, { 
            'Valores_Notebook': '150k' // Assuming this is a valid answer based on check-all-notebook-values.ts
        });

        const consultaId = formSubmit.consultaId;
        console.log("Consulta ID:", consultaId);

        console.log("Fetching plans...");
        const plans = await provider.getPlansByConsultaId(consultaId);
        if (plans.length === 0) {
            console.error("No plans found for Notebook");
            return;
        }

        const plan = plans[0];
        console.log("Using Plan:", plan.codigo);

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

discoverNotebookForm();
