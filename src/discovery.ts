import { Socket } from 'net'

// Get the SYSID from the given host through the 7992 TCP service port.
export async function getSysId(host: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = new Socket();
        socket.setTimeout(2000);
        socket.once('timeout', () => {
            socket.destroy();
            reject(new Error('Connection timeout'));
        });
        socket.once('error', (e) => {
            socket.destroy();
            reject(e);
        });
        socket.connect(7992, host, () => {
            socket.write('{"RELOAD":6}');
            socket.once('data', (data: Buffer) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response['SYSID']) {
                        resolve(response['SYSID']);
                    } else {
                        // Versions prior to 1079 (from Jan 2023) require you to provide the SYSID in every request, including this
                        reject(new Error('SYSID not found in response (please update the controller software): ' + data.toString()));
                    }
                } catch (e: any) {
                    reject(new Error('Non-JSON response from host: ' + data.toString()));
                }
                socket.destroySoon();
            });
        });
    });
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