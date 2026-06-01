import { RusProvider } from './services/providers/rus/RusProvider';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkAllNotebookValues() {
    try {
        const provider = new RusProvider();
        await provider.authenticate();

        const values = ['150k', '200k', '300k', '400k', '500k', '625k', '750k', '950', '1200', '1500mm'];
        
        console.log("--- CHECKING ALL NOTEBOOK PLAN DURATIONS ---");
        for (const v of values) {
            try {
                const resForm = await provider.submitFormAnswers('NOTEBOOK', 'FREESTYLE_ROBO_NOTEBOOK', { 'Valores_Notebook': v });
                const plans = await provider.getPlansByConsultaId(resForm.consultaId);
                plans.forEach((p: any) => {
                    console.log(`Value: ${v}, Plan: ${p.codigo}, Duration: ${JSON.stringify(p.duracion)}`);
                });
            } catch (e) {
                console.log(`Value ${v} failed to get plans`);
            }
        }

    } catch (e: any) {
        console.error("Error:", e.message);
    }
}
checkAllNotebookValues();
