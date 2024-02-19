import {NgbsIconClient, NgbsIconState} from './client'
import {Socket} from 'net'
import { setTimeout } from "timers/promises";

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
                let response = '';
                socket.on('data', (buf) => response += buf.toString());
                socket.once('end', () => {
                    socket.destroySoon();
                    try {
                        const data = (response === '') ? {} : JSON.parse(response);
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
            response = await this.request({ 'RELOAD': 6 });            
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
        return this.parseState(await this.request({ 'SYSID': this.sysId, 'RELOAD': config ? 3 : undefined }));
    }

    private async setThemostatField(id: string, field: string, value: any): Promise<any> {
        return this.setGlobalField('DP', { [id]: { [field]: value } });
    }

    private async setGlobalField(field: string, value: any): Promise<any> {
        return this.request({ 'SYSID': this.sysId, [field]: value });
    }

    async setThermostatTarget(id: string, target: number, cooling?: boolean, eco?: boolean): Promise<NgbsIconState> {
        let field;
        if ((cooling === undefined) && (eco === undefined)) {
            field = 'SP';  // Set point
        } else if ((cooling !== undefined) && (eco !== undefined)) {
            field = cooling ? (eco ? 'ECOC' : 'XAC') : (eco ? 'ECOH' : 'XAH');
        } else {
            throw new Error('Must either set both of cooling and eco, or none of them.');
        }
        let raw = await this.setThemostatField(id, field, target);
        // Wait for state to stabilize to avoid flickering. It takes at least 200ms, then we check periodically for 2s.
        for (let i = 0; i < 10; i++) {
            await setTimeout(200);
            raw = await this.request({ 'SYSID': this.sysId });
            const th = raw['DP'][id];
            if (th[field === 'SP' ? getTargetField(th) : field] === target) break;
        }
        return this.parseState(raw);
    }

    async setThermostatLimitMidpoint(id: string, midpoint: number, heatingCoolingDiff: number, ecoDiff: number): Promise<NgbsIconState> {
        return this.parseState(await this.request({
            'SYSID': this.sysId,
            'DP': { [id]: { 'DXA': midpoint, 'ZEB': heatingCoolingDiff, 'ECO': ecoDiff } },
        }));
    }

    async setThermostatLimitMidpoints(midpoint: number, heatingCoolingDiff: number, ecoDiff: number): Promise<NgbsIconState> {
        let state = await this.getState();
        for (let th of state.thermostats) {
            state = await this.setThermostatLimitMidpoint(th.id, midpoint, heatingCoolingDiff, ecoDiff);
        }
        return state;
    }

    async setThermostatLimit(id: string, limit: number) {
        return this.parseState(await this.setThemostatField(id, 'LIM', limit));
    }

    async setThermostatParentalLock(id: string, parentalLock: boolean) {
        return this.parseState(await this.setThemostatField(id, 'PL', parentalLock ? 1 : 0));
    }

    async setEco(eco: boolean) {
        return this.parseState(await this.setGlobalField('CE', eco ? 1 : 0));
    }

    async setThermostatEco(id: string, eco: boolean) {
        return this.parseState(await this.setThemostatField(id, 'CE', eco ? 1 : 0));
    }

    async setCooling(cooling: boolean) {
        return this.parseState(await this.setGlobalField('HC', cooling ? 1 : 0));
    }

    async setThermostatCooling(id: string, cooling: boolean) {
        // TODO: wait for it to take effect
        return this.parseState(await this.setThemostatField(id, 'HC', cooling ? 1 : 0));
    }

    async softwareUpdate() {
        await this.request({ 'SYSID': this.sysId, 'RELOAD': 7 });
    }

    async restart() {
        await this.request({ 'SYSID': this.sysId, 'RELOAD': 8 });
    }

    parseState(state: any): NgbsIconState {
        const thermostats = [];
        for (let ngbsId in state['DP']) {
            // Individual thermostat
            const th = state['DP'][ngbsId];
            if (!th['ON']) continue;
            thermostats.push({
                id: ngbsId,
                name: th['NAME'],
                live: th['LIVE'] === 1,
                parentalLock: th['PL'] === 1,
                timeProgramActive: th['TPR'] === 1,
                valve: th['OUT'] === 1,
                eco: th['CE'] === 1,
                ecoFollowsMaster: th['CEF'] === 1,
                cooling: th['HC'] === 1,
                temperature: th['TEMP'],
                humidity: th['RH'],
                dewPoint: th['DEW'],
                dewProtection: th['DWP'] === 1,
                frost: th['FROST'] === 1,
                target: th[getTargetField(th)],
                targets: {
                    heating: th['XAH'],
                    cooling: th['XAC'],
                    ecoHeating: th['ECOH'],
                    ecoCooling: th['ECOC'],
                },
                floorHeatingOffset: th['DXH'],
                floorCoolingOffset: th['DXC'],
                limit: th['LIM'],
                midpoint: th['CE'] ? (th['HC'] ? state['ECOC'] : state['ECOH']) : (th['HC'] ? state['XAC'] : state['XAH']),
                // Unknown fields: IHC, CEC (C/E Comfort?), MV
                // WP, DI: Window sensor maybe
                // TPR: time program active
            })
        }
        const cfg = state['CFG'];
        const config = cfg && {
            name: cfg['NAME'],
            mixingValve: cfg['ICON1']['STATUS']['AO'],
            thermostatHysteresis: cfg['THH'],
        };
        return {
            url: this.url,
            thermostats,
            controller: {
                eco: state['CE'] === 1,
                cooling: state['HC'] === 1,
                waterTemperature: state['WTEMP'] / 10,
                outsideTemperature: state['ETEMP'] / 10,
                midpoints: {
                    heating: state['XAH'],
                    cooling: state['XAC'],
                    ecoHeating: state['ECOH'],
                    ecoCooling: state['ECOC'],
                },
                firmwareVersion: state['INFO']['FIRMWARE'],
                configVersion: state['VER'],
                timezone: state['TZ'],
                uptime: state['INFO']['UPTIME'],
                config,
            }
        }
    }
}

function getTargetField(th: any) {
    return th['CE'] ? (th['HC'] ? 'ECOC' : 'ECOH') : (th['HC'] ? 'XAC' : 'XAH')
}