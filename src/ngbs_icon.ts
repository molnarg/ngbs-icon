import {NgbsIconModbusTcpClient, NgbsIconClient} from '.';
import minimist from 'minimist';

let argv = minimist(process.argv.slice(2));
let c: NgbsIconClient
if (argv['ip']) {
    c = new NgbsIconModbusTcpClient(argv['ip']);
} else {
    throw new Error('Missing mandatory flag: --ip')
}

async function run() {
    const command = argv._;
    if (command[0] === 'thermostat') {
        if (command[1] === 'get') {
            const thermostats = await c.getThermostats();
            if (command[2] !== undefined) {
                const id = parseInt(command[2]);
                console.log(JSON.stringify(thermostats.find(t => t.id === id)));
            } else {
                console.log(JSON.stringify(thermostats));
            }
        } else if (command[1] === 'set') {
            if (command[2] === undefined) throw new Error('Missing thermostat ID');
            if (!['cooling', 'heating'].includes(command[3])) throw new Error('Invalid target type');
            if (command[4] === undefined) throw new Error('Missing target temperature');
            await c.setThermostatTarget(
                parseInt(command[2]),
                command[3] == 'cooling',
                !!argv['eco'],
                parseFloat(command[4]),
            );
        }
    } else if (command[0] === 'controller') {
        if (command[1] === 'get') {
            const controller = await c.getController();
            console.log(JSON.stringify(controller));
        }
    } else {
        throw new Error('No known command specified')
    }
    c.disconnect();
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});