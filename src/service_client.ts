import {NgbsIconClient, NgbsIconState} from './client'
import {Socket} from 'net'

export class NgbsIconServiceClient implements NgbsIconClient {
    constructor(private host: string, private sysId: string, private port = 7992) {}

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

    async getState(config = false): Promise<NgbsIconState> {
        return parseState(await this.request({"SYSID": this.sysId, "RELOAD": config ? 1 : undefined}))
    }
    
    async setThermostatTarget(id: string, cooling: boolean, eco: boolean, target: number): Promise<NgbsIconState> {
        return parseState(await this.request({
            "SYSID": this.sysId,
            "DP": {
                [id]: {
                    [cooling ? (eco ? "ECOC" : "XAC") : (eco ? "ECOH" : "XAH")]: target
                }
            },
        }))
    }
}

function parseState(state: any): NgbsIconState {
    const thermostats = [];
    for (let ngbsId in state["DP"]) {
        // Individual thermostat
        const th = state["DP"][ngbsId];
        if (!th["ON"]) continue;
        thermostats.push({
            id: ngbsId,
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
    const cfg = state["CFG"];
    const config = cfg && {
        name: cfg["NAME"],
        mixingValve: cfg["ICON1"]["STATUS"]["AO"],
    };
    return {
        thermostats,
        controller: {
            waterTemperature: state['WTEMP'],
            outsideTemperature: state['ETEMP'],
            config,
        }
    }
}
