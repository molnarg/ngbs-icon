import { NgbsIconState, connect, getSysId } from '.';

let command = process.argv.slice(2);
if (command.length < 1) {
    throw new Error('Missing mandatory argument host')
}
let host = command.shift()!;

async function run() {
    if (command[0] === 'sysid') {
        const result = await getSysId(host);
        console.log(result || 'Could not retrieve SYSID, due to the controller running an old software version');
        return;
    } else if (command[0] === 'scan') {
        let results;
        if (host.includes(',')) {
            results = await scanHosts(host.split(','));
        } else if (host.includes('-')) {
            const [start, end] = host.split('-');
            results = await scanIpRange(start, end);
        } else {
            throw new Error('Invalid host range (use host1,host2,host3 or ip1-ip2)')
        }
        console.log(results);
        return;
    }

    // If only IP address is specified without SYSID, look up SYSID first 
    if (!host.startsWith('service://')) {
        const sysId = await getSysId(host);
        if (!sysId) {
            console.log(
                'Could not retrieve SYSID, due to the controller running an old software version. ' + 
                'Please specify it manually using the following format: service://123456789@192.168.1.2'
            );
            return;
        }
        host = 'service://' + sysId + '@' + host
    }

    const c = connect(host);
    const device = command[0];
    const operation = command[1];
    let state: NgbsIconState|undefined;
    if (device === 'thermostat') {
        const id = command[2];
        if (operation === 'get') {
            state = await c.getState();
        } else if (operation === 'set') {
            if (id === undefined) throw new Error('Missing thermostat ID');
            if (command[3] === 'limit') {
                state = await c!.setThermostatLimit(id, parseFloat(command[4]));
            } else if (command[3] === 'lock') {
                state = await c!.setThermostatParentalLock(id, command[4] === '1');
            } else if (command[3] === 'mode' && ['eco', 'comfort'].includes(command[4])) {
                state = await c!.setThermostatEco(id, command[4] === 'eco');
            } else if (command[3] === 'mode' && ['heating', 'cooling'].includes(command[4])) {
                state = await c!.setThermostatCooling(id, command[4] === 'cooling');
            } else if (!isNaN(parseFloat(command[3]))) {
                state = await c!.setThermostatTarget(id, parseFloat(command[3]));
            } else {
                const eco = Number(command[3] === 'eco');
                if (!['cooling', 'heating'].includes(command[3 + eco])) throw new Error('Invalid target type');
                if (command[4 + eco] === undefined) throw new Error('Missing target temperature');
                state = await c!.setThermostatTarget(
                    id,
                    parseFloat(command[4 + eco]),
                    command[3 + eco] == 'cooling',
                    Boolean(eco),
                );
            }
        } else {
            throw new Error('Unknown operation:' + operation);
        }
        if (id !== undefined) {
            console.log(state!.thermostats.find(t => t.id === id));
        } else {
            console.log(state!.thermostats);
        }
    } else if (device === 'controller') {
        if (operation === 'export') {
            console.log(JSON.stringify(await c.export()));
        } else if (operation === 'get') {
            state = await c.getState(true);
        } else if (operation === 'set') {
            if (command[2] === 'midpoints') {
                state = await c!.setThermostatLimitMidpoints(
                    parseFloat(command[3]),
                    parseFloat(command[4]),
                    parseFloat(command[5]),
                );
            } else if (command[2] === 'mode' && ['eco', 'comfort'].includes(command[3])) {
                state = await c!.setEco(command[3] === 'eco');
            } else if (command[2] === 'mode' && ['heating', 'cooling'].includes(command[3])) {
                state = await c!.setCooling(command[3] === 'cooling');
            } else {
                throw new Error('Invalid command');
            }
        } else if (operation === 'restart') {
            await c!.restart();
        } else if (operation === 'update') {
            await c!.softwareUpdate();
        }
        if (state !== undefined) console.log(state.controller);
    } else {
        throw new Error('No known command specified')
    }
}


// Scan the provided hosts by trying to retrieve the SYSID from each through the TCP service port.
// Scanning could be based on MAC address too, but that would require elevated provileges.
export async function scanHosts(hosts: string[]): Promise<{[host: string]: string}> {
    const results: {[host: string]: string} = {};
    // Get SYSID from all hosts in parallel
    await Promise.all(hosts.map(async (host) => {
        try {
            results[host] = await getSysId(host);
        } catch(e: any) {}
    }));
    return results;
}

// From https://github.com/ubcent/ping-subnet/blob/master/ipUtils.js
const numberToIp = (number: number) => [
    (number & (0xff << 24)) >>> 24,
    (number & (0xff << 16)) >>> 16,
    (number & (0xff << 8)) >>> 8,
    number & 0xff
  ].join('.');

// From https://github.com/ubcent/ping-subnet/blob/master/ipUtils.js with modifications
const ipToNumber = (ip: string) => {
    const ipArray = (ip + '').split('.');
    if (ipArray.length !== 4) {
        throw new Error('Invalid IP: ' + ip);
    } else {
        return ipArray.map(Number).map((segment, i) => {
            if (isNaN(segment) || segment < 0 || segment > 255) {
                throw new Error('Invalid IP address segment: ' + ipArray[i]);
            }
            return (segment || 0) << (8 * (3 - i));
        })
        .reduce((acc, cur) => acc | cur, 0) >>> 0;
    }
}

export async function scanIpRange(start: string, end: string): Promise<{[host: string]: string}> {
    const startNumber = ipToNumber(start);
    const endNumber = ipToNumber(end);
    if (startNumber > endNumber) throw new Error('End IP is lower than the start IP');
    const hosts = [];
    for (let ip = startNumber; ip < endNumber; ip++) {
        hosts.push(numberToIp(ip));
    };
    return scanHosts(hosts);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});