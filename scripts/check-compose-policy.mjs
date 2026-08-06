import {readFile} from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const root = process.cwd();
const composePath = path.join(root, 'compose.yml');
const liveComposePath = path.join(root, 'compose.live-deepseek-uat.yml');
const runtimeAcceptanceComposePath = path.join(root, 'compose.runtime-acceptance.yml');
const runtimePath = path.join(root, 'infra/agentteams/compose.agentteams-profile.yml');

function serviceMap(document) {
  if (document === null || typeof document !== 'object' || !('services' in document)) {
    throw new Error('COMPOSE_SERVICES_MISSING');
  }
  return document.services;
}

function assertNoUnsafeRuntimeText(value) {
  const forbidden = ['/var/run/docker.sock', '/host-share', '/Users/', '0.0.0.0:', '::'];
  const found = forbidden.filter((entry) => value.includes(entry));
  if (found.length > 0) throw new Error(`UNSAFE_RUNTIME_PROFILE:${found.join(',')}`);
}

const composeText = await readFile(composePath, 'utf8');
const compose = YAML.parse(composeText, {merge: true});
const services = serviceMap(compose);
for (const required of ['web', 'api', 'mission-worker', 'action-operator', 'postgres', 'migrate']) {
  if (!(required in services)) throw new Error(`COMPOSE_SERVICE_MISSING:${required}`);
}
for (const serviceName of ['web', 'api', 'mission-worker', 'action-operator']) {
  const service = services[serviceName];
  if (service.healthcheck === undefined) throw new Error(`HEALTHCHECK_MISSING:${serviceName}`);
  if (service.pids_limit === undefined || service.mem_limit === undefined || service.cpus === undefined) {
    throw new Error(`RESOURCE_LIMIT_MISSING:${serviceName}`);
  }
  if (!service.security_opt?.includes('no-new-privileges:true')) {
    throw new Error(`NO_NEW_PRIVILEGES_MISSING:${serviceName}`);
  }
}
if (services.postgres.ports !== undefined) throw new Error('POSTGRES_HOST_PORT_FORBIDDEN');
for (const serviceName of ['web', 'api']) {
  for (const port of services[serviceName].ports ?? []) {
    if (typeof port !== 'object' || port.host_ip !== '127.0.0.1') {
      throw new Error(`LOOPBACK_PORT_REQUIRED:${serviceName}`);
    }
  }
}
if (services['action-operator'].networks?.includes('runtime')) {
  throw new Error('ACTION_OPERATOR_RUNTIME_NETWORK_FORBIDDEN');
}
if (composeText.includes('DEEPSEEK_API_KEY') || composeText.includes('LUMICLAW_RUNTIME_BROKER_BOOTSTRAP') || composeText.includes('LUMICLAW_RUNTIME_IMPORT_TOKEN')) throw new Error('SECRET_AS_ORDINARY_COMPOSE_ENV_FORBIDDEN');

const liveComposeText = await readFile(liveComposePath, 'utf8');
assertNoUnsafeRuntimeText(liveComposeText);
const liveCompose = YAML.parse(liveComposeText, {merge: true});
const liveApiSecrets = serviceMap(liveCompose).api?.secrets;
if (!Array.isArray(liveApiSecrets) || liveApiSecrets.join(',') !== 'deepseek_api_key,lumiclaw_runtime_broker_bootstrap') throw new Error('LIVE_COMPOSE_SECRET_MOUNTS_INVALID');
if (liveCompose.secrets?.deepseek_api_key?.file !== '${LUMICLAW_DEEPSEEK_SECRET_FILE:?secure temporary DeepSeek secret file required}' || liveCompose.secrets?.lumiclaw_runtime_broker_bootstrap?.file !== '${LUMICLAW_RUNTIME_BOOTSTRAP_FILE:?secure temporary runtime bootstrap file required}') throw new Error('LIVE_COMPOSE_SECURE_TEMP_FILE_SECRET_INVALID');
if (serviceMap(liveCompose).api?.environment !== undefined) throw new Error('LIVE_SECRET_VALUE_IN_SERVICE_ENV_FORBIDDEN');

const runtimeAcceptanceComposeText = await readFile(runtimeAcceptanceComposePath, 'utf8');
assertNoUnsafeRuntimeText(runtimeAcceptanceComposeText);
const runtimeAcceptanceCompose = YAML.parse(runtimeAcceptanceComposeText, {merge: true});
if (serviceMap(runtimeAcceptanceCompose).api?.secrets?.join(',') !== 'lumiclaw_runtime_import_token' || runtimeAcceptanceCompose.secrets?.lumiclaw_runtime_import_token?.file !== '${LUMICLAW_RUNTIME_IMPORT_TOKEN_FILE:?Set LUMICLAW_RUNTIME_IMPORT_TOKEN_FILE to the verifier-owned 0600 temporary file}' || serviceMap(runtimeAcceptanceCompose).api?.environment !== undefined) throw new Error('RUNTIME_ACCEPTANCE_SECRET_FILE_INVALID');

const runtimeText = await readFile(runtimePath, 'utf8');
assertNoUnsafeRuntimeText(runtimeText);
const runtime = YAML.parse(runtimeText, {merge: true});
for (const [name, service] of Object.entries(serviceMap(runtime))) {
  if (service.ports !== undefined) throw new Error(`RUNTIME_HOST_PORT_FORBIDDEN:${name}`);
  if (service.pids_limit === undefined || service.mem_limit === undefined || service.cpus === undefined) {
    throw new Error(`RUNTIME_RESOURCE_LIMIT_MISSING:${name}`);
  }
}

console.info(JSON.stringify({status: 'PASS', composeServices: Object.keys(services).length, runtimeServices: Object.keys(runtime.services).length, liveSecretFiles: ['/run/secrets/deepseek_api_key', '/run/secrets/lumiclaw_runtime_broker_bootstrap'], runtimeAcceptanceSecretFile: '/run/secrets/lumiclaw_runtime_import_token', ingress: 'INTERACTIVE_TO_0600_TEMP_FILE_TO_COMPOSE_SECRET', dockerSocketMounted: false, secretAsServiceEnvironment: false}));
