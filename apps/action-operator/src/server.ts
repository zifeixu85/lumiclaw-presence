import {startHealthServer} from '@lumiclaw/process-health';

const port = Number.parseInt(process.env.PORT ?? '4002', 10);
startHealthServer('action-operator', port);
