import {startHealthServer} from '@lumiclaw/process-health';

const port = Number.parseInt(process.env.PORT ?? '4001', 10);
startHealthServer('mission-worker', port);
