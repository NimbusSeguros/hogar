import dotenv from 'dotenv';
import path from 'path';
import { InsuranceProviderFactory } from './services/providers/InsuranceProviderFactory';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testVivienda() {
    try {
        const provider: any = InsuranceProviderFactory.getProvider('RUS');
        await provider.authenticate();

        // Get VIVIENDA indicios
        console.log("Fetching VIVIENDA indicios...");
        const indiciosRes = await provider.apiClient.get('/objetos/VIVIENDA/indicios');
        console.log("Indicios:", JSON.stringify(indiciosRes.data, null, 2));

        if (indiciosRes.data?.length > 0) {
            const firstIndicio = indiciosRes.data[0].codigo;
            console.log(`\nFetching formulario for VIVIENDA / ${firstIndicio}...`);
            const formularioRes = await provider.apiClient.get(`/objetos/VIVIENDA/indicios/${firstIndicio}/formulario`);
            console.log("Formulario:", JSON.stringify(formularioRes.data, null, 2));
        }

    } catch (e: any) {
        console.error("Error:", e.response?.data || e.message);
    }
}
testVivienda();
