import {NgbsIconClient, NgbsIconThermostat, NgbsIconController} from './client'
import {Socket} from 'net'

export class NgbsIconServiceClient implements NgbsIconClient {
    constructor(private host: string, private sysId: string, private port = 7992) {}

    // No-op, this protocol is not connection based but request/response based
    disconnect() {}

    async request(req: any): Promise<any> {
        return new Promise<void>((resolve, reject) => {
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
            socket.connect(this.port, this.host, () => {
                socket.end(JSON.stringify(req));
                let response = "";
                socket.on("data", (buf) => response += buf.toString());
                socket.once("end", () => {
                    socket.destroySoon();
                    try {
                        resolve(JSON.parse(response));
                    } catch(e) {
                        reject(new Error('Could not parse NGBS response: ' + response));
                    }
                });
            });
        });
    }

    async getSysId(): Promise<string> {
        const response = await this.request({"RELOAD": 6});
        if (response['SYSID']) {
            return response['SYSID'];
        } else if (response['ERR'] === 1) {
            // Versions prior to 1079 (from Jan 2023) require you to provide the SYSID in
            // every request, including this.
            return '';
        } else {
            throw new Error('Uknown response format: ' + JSON.stringify(response));
        }
    }

    async getThermostats(): Promise<NgbsIconThermostat[]> {
        const state = await this.request({"SYSID": this.sysId});
        const result = [];
        for (let ngbsId in state["DP"]) {
            // Individual thermostat
            const th = state["DP"][ngbsId];
            // No support for slave NGBS controllers
            if (!ngbsId.startsWith('1.')) continue;
            if (!th["ON"]) continue;
            // 0 based indexing to be consistent with the modbus client
            const id = parseInt(ngbsId.slice(2)) - 1;
            result.push({
                id,
                name: th["NAME"],
                valve: th["OUT"] === 1,
                eco: th["CE"] === 1,
                cooling: th["HC"] === 1,
                temperature: th["TEMP"],
                humidity: th["RH"],
                target: th["CE"] ? (th["HC"] ? th["ECOC"] : th["ECOH"]) : (th["HC"] ? th["XAC"] : th["XAH"]),
                targets: {
                    heating: th["XAH"],
                    cooling: th["XAC"],
                    ecoHeating: th["ECOH"],
                    ecoCooling: th["ECOC"],
                },
            })
        }
        return result;
        throw new Error("Not implemented");
    }

    async setThermostatTarget(id: number, cooling: boolean, eco: boolean, target: number) {
        throw new Error("Not implemented");
    }

    async getController(): Promise<NgbsIconController> {
        const state = await this.request({"SYSID": this.sysId, "RELOAD":1});
        return {
            name: state["CFG"]["NAME"],
            mixingValve: state["CFG"]["ICON1"]["STATUS"]["AO"],
            waterTemperature: state['WTEMP'],
            outsideTemperature: state['ETEMP'],
            // targetWaterTemperature is not implemented in the service protocol
        };
    }
}