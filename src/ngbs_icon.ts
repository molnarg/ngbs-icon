import {connect, getSysId} from '.';

let command = process.argv.slice(2);
if (command.length < 1) {
    throw new Error('Missing mandatory argument host')
}
const host = command.shift()!;

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
        console.log(JSON.stringify(results));
        return;
    }

    const c = connect(host);
    if (command[0] === 'thermostat') {
        if (command[1] === 'get') {
            const thermostats = (await c.getState()).thermostats;
            if (command[2] !== undefined) {
                console.log(JSON.stringify(thermostats.find(t => t.id === command[2])));
            } else {
                console.log(JSON.stringify(thermostats));
            }
        } else if (command[1] === 'set') {
            if (command[2] === undefined) throw new Error('Missing thermostat ID');
            if (command[3] === 'limit') {
                await c!.setThermostatLimit(command[2], parseFloat(command[4]));
            } else if (command[3] === 'lock') {
                await c!.setThermostatParentalLock(command[2], command[4] === '1');
            } else if (command[3] === 'mode' && ['eco', 'comfort'].includes(command[4])) {
                await c!.setThermostatEco(command[2], command[4] === 'eco');
            } else if (!isNaN(parseFloat(command[3]))) {
                await c!.setThermostatTarget(command[2], parseFloat(command[3]));
            } else {
                const eco = Number(command[3] === 'eco');
                if (!['cooling', 'heating'].includes(command[3 + eco])) throw new Error('Invalid target type');
                if (command[4 + eco] === undefined) throw new Error('Missing target temperature');
                await c!.setThermostatTarget(
                    command[2],
                    parseFloat(command[4 + eco]),
                    command[3 + eco] == 'cooling',
                    Boolean(eco),
                );
            }
        }
    } else if (command[0] === 'controller') {
        if (command[1] === 'get') {
            const controller = (await c.getState(true)).controller;
            console.log(JSON.stringify(controller));
        } else if (command[1] === 'set') {
            if (command[2] === 'midpoints') {
                await c!.setThermostatLimitMidpoints(
                    parseFloat(command[3]),
                    parseFloat(command[4]),
                    parseFloat(command[5]),
                );
            } else if (command[2] === 'mode' && ['eco', 'comfort'].includes(command[3])) {
                await c!.setEco(command[3] === 'eco');
            } else {
                throw new Error('Invalid command');
            }
        }
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