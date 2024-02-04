import { NgbsIconServiceClient } from '.';

// Get the SYSID from the given host through the TCP service port.
export async function getSysId(host: string, port = 7992): Promise<string> {
    const c = new NgbsIconServiceClient(host, '', port);
    return c.getSysId();
}

// Check if the given host is an NGBS controller
export async function isNgbsHost(host: string): Promise<boolean> {
    try {
        await getSysId(host);
        return true;
    } catch(e: any) {
        return false;
    }
}

// Check if MAC address falls into one of the ranges reserved for iCON controllers
export function isNgbsMacAddress(mac: string): boolean {
    return mac.startsWith('66:55:44:00:0') ||
        mac.startsWith('00:50:C2:FD:A') ||
        mac.startsWith('00:50:C2:F2:7') ||
        mac.startsWith('00:50:C2:DE:7') ||
        mac.startsWith('40:D8:55:0D:2') ||
        mac.startsWith('E4:95:6E:5');
}