import {buildApi} from '../apps/api/src/server.js';
import {PostgresActionRepository, PostgresCampaignRepository} from '@lumiclaw/db';
import {PostgresShadowMissionRepository} from '@lumiclaw/governed-shadow';
import {importEd25519PrivateKey, importEd25519PublicKey} from '@lumiclaw/domain';

const connectionString = process.env.DATABASE_URL;
const privateKey = process.env.SDD003_SIGNER_PRIVATE_KEY;
const publicKey = process.env.SDD003_SIGNER_PUBLIC_KEY;
const port = Number.parseInt(process.env.PORT ?? '4210', 10);
if (!connectionString || !privateKey || !publicKey) throw new Error('DATABASE_URL and SDD003 signer keys are required.');

const app = buildApi({
  repository: new PostgresCampaignRepository(connectionString),
  actionRepository: new PostgresActionRepository(connectionString),
  shadowRepository: new PostgresShadowMissionRepository(connectionString),
  actionGrantSigner: {privateKey: importEd25519PrivateKey(privateKey), publicKey: importEd25519PublicKey(publicKey)},
  requirePersistentActionSigner: true,
});

await app.listen({host: '127.0.0.1', port});
const close = async () => { await app.close(); process.exit(0); };
process.once('SIGTERM', () => { void close(); });
process.once('SIGINT', () => { void close(); });
