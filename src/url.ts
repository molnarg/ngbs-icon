import { NgbsIconClient } from './client'
import { NgbsIconModbusTcpClient } from './modbus_tcp_client'
import { NgbsIconServiceClient } from './service_client'

export function connect(address: string): NgbsIconClient {
    const url = new URL(address);
    const port = url.port ? parseInt(url.port) : undefined;
    if (url.protocol == "modbus-tcp:") {
        return new NgbsIconModbusTcpClient(url.hostname, port);
    } else if (url.protocol == 'service:') {
        if (url.username === '') {
            throw new Error(
                'SYSID not specified (try service://SYSID@' + url.host +
                '; use sysid command to get the SYSID)'
            );
        }
        return new NgbsIconServiceClient(url.hostname, url.username, port);
    } else {
        throw new Error('Unknown protocol: ' + url.protocol);
    }
}