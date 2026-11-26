// Entrada da função serverless /api/status (empacotada por scripts/build-api.mjs)
import { handle } from '../api';

const run = (req: Request) => handle('status', req);
export const GET = run;
