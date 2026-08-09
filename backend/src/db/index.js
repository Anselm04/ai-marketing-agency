import jsonAdapter from './jsonAdapter.js';
import mongoAdapter from './mongoAdapter.js';

const USE_MONGO = process.env.USE_MONGO === 'true' || process.env.MONGODB_URI;
const adapter = USE_MONGO ? mongoAdapter : jsonAdapter;

export async function connectDB() {
  if (USE_MONGO) {
    await adapter.connect();
  }
}

export async function disconnectDB() {
  if (USE_MONGO) {
    await adapter.disconnect();
  }
}

export default adapter;
