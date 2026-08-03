import {readFile} from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';

const root = process.cwd();
const composePath = path.join(root, 'compose.yml');
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

const runtimeText = await readFile(runtimePath, 'utf8');
assertNoUnsafeRuntimeText(runtimeText);
const runtime = YAML.parse(runtimeText, {merge: true});
for (const [name, service] of Object.entries(serviceMap(runtime))) {
  if (service.ports !== undefined) throw new Error(`RUNTIME_HOST_PORT_FORBIDDEN:${name}`);
  if (service.pids_limit === undefined || service.mem_limit === undefined || service.cpus === undefined) {
    throw new Error(`RUNTIME_RESOURCE_LIMIT_MISSING:${name}`);
  }
}

console.info(JSON.stringify({status: 'PASS', composeServices: Object.keys(services).length, runtimeServices: Object.keys(runtime.services).length}));
