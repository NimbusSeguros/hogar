import dotenv from 'dotenv';
import path from 'path';
import { InsuranceProviderFactory } from './services/providers/InsuranceProviderFactory';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function verify() {
    try {
        console.log("Testing RUS Integration...");
        const provider = InsuranceProviderFactory.getProvider('RUS');

        console.log("Authenticating...");
        await provider.authenticate();
        console.log("Authentication successful!");

        // Assuming TECSO_SOCIOS or missing campaign might return empty or error.
        // Let's try grabbing objects for 'TECSO_SOCIOS' or 'AUTOMOVIL' 
        // Based on siapi.yml example: TECSO_SOCIOS
        const testCampaign = 'TECSO_SOCIOS';
        console.log(`Fetching objects for ${testCampaign}...`);

        try {
            const objs = ['BICICLETA', 'NOTEBOOK', 'MONOPATIN', 'EQUIPO_ELECTRONICO'];
            for (const obj of objs) {
                const indicios = await (provider as any).getIndicios(obj);
                console.log(`Indicios for ${obj}:`, JSON.stringify(indicios, null, 2));
            }
        } catch (objError: any) {
            console.log("Could not fetch global objects:", objError?.response?.data || objError.message);
        }

        console.log("Verification finished.");
    } catch (err: any) {
        console.error("Verification failed:", err?.response?.data || err.message);
    }
}

verify();
