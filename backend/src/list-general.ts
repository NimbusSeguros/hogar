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

async function listGeneral() {
  try {
    const token = await login();
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    console.log('Fetching objects in GENERAL...');
    const response = await apiClient.get('/objetos?codigoCategoria=GENERAL'); 
    console.log('Objects in GENERAL:', JSON.stringify(response.data, null, 2));

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

listGeneral();
