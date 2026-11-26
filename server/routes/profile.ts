// Entrada da função serverless /api/profile (empacotada por scripts/build-api.mjs)
import { handle } from '../api';

const run = (req: Request) => handle('profile', req);
export const GET = run;
export const POST = run;
export const DELETE = run;
