import {NgbsIconClient, NgbsIconState} from './client'
import {Socket} from 'net'

export class NgbsIconServiceClient implements NgbsIconClient {
    url: string;

    constructor(private host: string, private sysId: string, private port = 7992) {
        this.url = 'service://' + sysId + '@' + host + ':' + port;
    }

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
                        const data = JSON.parse(response);
                        if (data['ERR'] === 1) {
                            reject(new Error('NGBS error (incorrect SYSID?)'));
                        }
                        resolve(data);
                    } catch(e) {
                        reject(new Error('Could not parse NGBS response: ' + response));
                    }
                });
            });
        });
    }

    async getSysId(): Promise<string> {
        let response;
        try {
            response = await this.request({"RELOAD": 6});            
        } catch(e: any) {
            // Versions prior to 1079 (from Jan 2023) require you to provide the SYSID in
            // every request, including this.
            if (e.message === 'NGBS error (incorrect SYSID?)') {
                return '';
            } else {
                throw e;
            }
        }
        if (response['SYSID']) {
            return response['SYSID'];
        } else {
            throw new Error('Uknown response format: ' + JSON.stringify(response));
        }
    }

    async getState(config = false): Promise<NgbsIconState> {
        return this.parseState(await this.request({ "SYSID": this.sysId, "RELOAD": config ? 1 : undefined }));
    }
    
    async setThermostatTarget(id: string, cooling: boolean, eco: boolean, target: number): Promise<NgbsIconState> {
        return this.parseState(await this.request({
            "SYSID": this.sysId,
            "DP": {
                [id]: {
                    [cooling ? (eco ? "ECOC" : "XAC") : (eco ? "ECOH" : "XAH")]: target
                }
            },
        }));
    }

    async setThermostatLimit(id: string, limit: number) {
        return this.parseState(await this.request({
            "SYSID": this.sysId,
            "DP": { [id]: { "LIM": limit } },
        }));
    }

    parseState(state: any): NgbsIconState {
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
                limit: th["LIM"],
            })
        }
        const cfg = state["CFG"];
        const config = cfg && {
            name: cfg["NAME"],
            mixingValve: cfg["ICON1"]["STATUS"]["AO"],
        };
        return {
            url: this.url,
            thermostats,
            controller: {
                waterTemperature: state['WTEMP'],
                outsideTemperature: state['ETEMP'],
                config,
            }
        }
    }
}
