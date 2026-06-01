// 🔥 PARCHE ANTES DE CUALQUIER OTRA COSA — Node 20 no tiene WebSocket nativo
const WS = require('ws');
(globalThis as any).WebSocket = WS.WebSocket || WS;

import dotenv from 'dotenv';
import path from 'path';

// dotenv must load BEFORE requiring app (imports are hoisted)
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('./app').default;

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
