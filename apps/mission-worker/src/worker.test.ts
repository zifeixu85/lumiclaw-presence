import {describe,expect,it,vi} from 'vitest';
import {HttpGatewayTicketIssuer,assertLoopbackGatewayControlOrigin} from './worker.js';

describe('persistent mission worker gateway boundary',()=>{
  it('allows only an explicit high-port HTTP 127.0.0.1 control origin',()=>{expect(assertLoopbackGatewayControlOrigin('http://127.0.0.1:4303')).toBe('http://127.0.0.1:4303');for(const origin of ['https://127.0.0.1:4303','http://localhost:4303','http://host.docker.internal:4303','http://127.0.0.1:80','http://127.0.0.1:4303/path','http://user@127.0.0.1:4303','https://attacker.invalid'])expect(()=>assertLoopbackGatewayControlOrigin(origin)).toThrow('MODEL_GATEWAY_CONTROL_ORIGIN_FORBIDDEN');});

  it('fails before fetch so a bootstrap cannot be sent to an attacker-controlled URL',async()=>{const fetchSpy=vi.spyOn(globalThis,'fetch');expect(()=>new HttpGatewayTicketIssuer('https://attacker.invalid','bootstrap-must-not-leave-host')).toThrow('MODEL_GATEWAY_CONTROL_ORIGIN_FORBIDDEN');expect(fetchSpy).not.toHaveBeenCalled();fetchSpy.mockRestore();});
});
