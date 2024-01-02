import {NgbsIconClient} from './client'
import {Socket} from 'net'
import {ModbusTCPClient} from 'jsmodbus'

function bitmap(x: number) {
    const bits = [];
    for (let i = 0; i < 8; i++) {
        bits.push(Boolean((x >> i) & 1));
    }
    return bits;
}

function decode(x: number) {
    return (x < 32768 ? x : (x - 65536)) / 10;
}

function encode(x: number) {
    x = Math.round(x * 10);
    return x < 0 ? (65536 + x) : x;
}

export class NgbsIconModbusTcpClient implements NgbsIconClient {
    private modbus: ModbusTCPClient;
    private socket: Socket;

    constructor(private ip: string, private port = 502) {
        this.socket = new Socket();
        this.modbus = new ModbusTCPClient(this.socket);
    }

    private async connect() {
        return new Promise<void>(resolve => {
            if (this.socket.connecting) {
                this.socket.once("connect", resolve);
            } else if (this.socket.pending || this.socket.closed) {
                // First connection, or reconnection if it was closed (iCON closes it every 30s)
                this.socket.connect(this.port, this.ip, resolve);
            } else {
                resolve();
            }
        });
    }

    disconnect() {
        this.socket.resetAndDestroy();
    }

    async getThermostats() {
        await this.connect();
        const bitmaps = (await this.modbus.readHoldingRegisters(0, 9)).response.body.values;
        const valve = bitmap(bitmaps[0]);
        const eco = bitmap(bitmaps[4]);
        const cooling = bitmap(bitmaps[6]);
        const inactive = bitmap(bitmaps[8]);
        const measurements = (await this.modbus.readHoldingRegisters(25, 16)).response.body.values.map(decode);
        const temperature = measurements.slice(0, 8);
        const humidity = measurements.slice(8);
        const registers = (await this.modbus.readHoldingRegisters(387, 32)).response.body.values.map(decode);
        const targets = Array.from({length: 8}, (_, id) => ({
            heating: registers[id*4],
            cooling: registers[id*4 + 1],
            ecoHeating: registers[id*4 + 2],
            ecoCooling: registers[id*4 + 3],
        }));
        const target = Array.from({length: 8}, (_, id) => {
            return registers[id*4 + Number(eco[id])*2 + Number(cooling[id])];
        });
        const thermostats = [];
        for (let id = 0; id < 8; id++) {
            if (inactive[id]) continue;
            thermostats.push({
                id: id,
                temperature: temperature[id],
                humidity: humidity[id],
                cooling: cooling[id],
                eco: eco[id],
                target: target[id],
                targets: targets[id],
                valve: valve[id],
            });
        }
        return thermostats;
    }

    async setThermostatTarget(id: number, cooling: boolean, eco: boolean, target: number) {
        await this.connect();
        const register = 387 + id*4 + Number(eco)*2 + Number(cooling);
        const value = encode(target);
        await this.modbus.writeSingleRegister(register, value);
    }

    async getController() {
        await this.connect();
        const reg1 = (await this.modbus.readHoldingRegisters(16, 3)).response.body.values.map(decode);
        const reg2 = (await this.modbus.readHoldingRegisters(420, 1)).response.body.values.map(decode);
        return {
            mixingValve: reg1[0],
            waterTemperature: reg1[1],
            outsideTemperature: reg1[2],
            targetWaterTemperature: reg2[0],
        };
    }
}