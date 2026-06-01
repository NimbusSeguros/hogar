import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const apiClient = axios.create({
  baseURL: process.env.RUS_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

async function login() {
  const response = await axios.post(`${process.env.RUS_API_AUTH_URL}/login`, {
    username: process.env.RUS_USERNAME,
    password: process.env.RUS_PASSWORD,
  });
  return response.data.access_token;
}

async function discoverAllPlanes() {
  try {
    const token = await login();
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    const objects = ['EQUIPO_ELECTRONICO', 'NOTEBOOK', 'TABLET', 'MONOPATIN', 'CONSOLA', 'PC_ESCRITORIO', 'BOLSOPROTEGIDO'];

    for (const obj of objects) {
        console.log(`Checking plans for ${obj}...`);
        try {
            const indiciosResp = await apiClient.get(`/objetos/${obj}/indicios`);
            const indicios = indiciosResp.data;
            
            for (const ind of indicios) {
                console.log(`  Submitting for ${obj}/${ind.codigo}...`);
                try {
                    const submitResp = await apiClient.post(`/objetos/${obj}/indicios/${ind.codigo}/formulario/respuestas`, {
                        respuestas: [
                            { codigoPregunta: 'CPPPP', valores: ['1000'] } // Generic
                        ]
                    });
                    const consultaId = submitResp.data.consultaID;
                    const planesResp = await apiClient.get(`/consultas/${consultaId}/planes`);
                    console.log(`  Planes for ${obj}/${ind.codigo}:`, planesResp.data.map((p: any) => p.descripcion).join(', '));
                } catch (e: any) {
                    // console.error(`    Error for ${obj}/${ind.codigo}:`, e.response?.data?.errores?.[0]?.mensaje || e.message);
                }
            }
        } catch (e: any) {
            console.error(`Error for ${obj}:`, e.message);
        }
    }
  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

discoverAllPlanes();
