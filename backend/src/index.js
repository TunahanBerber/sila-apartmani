import app from './app.js';
import { init } from './db.js';

const PORT = Number(process.env.PORT) || 4000;

await init();
app.listen(PORT, () => console.log(`Sıla Apartmanı API http://localhost:${PORT}`));
