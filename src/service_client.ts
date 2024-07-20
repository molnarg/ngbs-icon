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

    async export(): Promise<string> {
        return await this.request({ 'SYSID': this.sysId, 'RELOAD': 3 });
    }

    // Wait for state to stabilize to avoid flickering. Exact timing and condition depends on the caller context.
    // Required condition must be met. If optional condition is met as well, return immediately - otherwise keep
    // retrying until the optional condition is met as well, or we reach the retry limit.
    private async waitForState(
        n: number,
        timeout: number,
        requiredCondition?: (raw: any) => boolean,
        optionalCondition?: (raw: any) => boolean
    ) {
        for (let i = 0; i < n; i++) {
            await setTimeout(timeout);
            // Include config, since checks might need e.g. hysteresis config value
            const raw = await this.request({ 'SYSID': this.sysId, 'RELOAD': 3 });
            if (!requiredCondition || requiredCondition(raw)) {
                if (i == n - 1 || (optionalCondition && optionalCondition(raw))) return raw;
            }
        }
        throw new Error('Could not change state');
    }

    private async setThemostatField(id: string, field: string, value: any): Promise<any> {
        return this.setGlobalField('DP', { [id]: { [field]: value } });
    }

    private async setGlobalField(field: string, value: any): Promise<any> {
        return this.request({ 'SYSID': this.sysId, [field]: value });
    }

    async setThermostatTarget(id: string, target: number, cooling?: boolean, eco?: boolean): Promise<NgbsIconState> {
        let field: string;
        if ((cooling === undefined) && (eco === undefined)) {
            field = 'SP';  // Set point
        } else if ((cooling !== undefined) && (eco !== undefined)) {
            field = cooling ? (eco ? 'ECOC' : 'XAC') : (eco ? 'ECOH' : 'XAH');
        } else {
            throw new Error('Must either set both of cooling and eco, or none of them.');
        }
        await this.setThemostatField(id, field, target);
        const raw = await this.waitForState(10, 200, raw => {
            const th = raw.DP[id];
            return (th[field === 'SP' ? getTargetField(th) : field] === target);
        }, valvesSettled);
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
        await this.setGlobalField('CE', Number(eco));
        return this.parseState(await this.waitForState(20, 500, raw => raw.CE === Number(eco), valvesSettled));
    }

    async setThermostatEco(id: string, eco: boolean) {
        await this.setThemostatField(id, 'CE', Number(eco));
        return this.parseState(await this.waitForState(20, 500, raw => raw.DP[id].CE === Number(eco), valvesSettled));
    }

    async setCooling(cooling: boolean) {
        await this.setGlobalField('HC', Number(cooling))
        // Split waiting into two phases, so that the first part can fail early without waiting for the second.
        await this.waitForState(2, 1000, raw => raw.HC === Number(cooling));
        const raw = await this.waitForState(20, 500, undefined, valvesSettled);
        return this.parseState(raw);
    }

    async setThermostatCooling(id: string, cooling: boolean) {
        await this.setThemostatField(id, 'HC', Number(cooling));
        await this.waitForState(2, 1000, raw => raw.DP[id].HC === Number(cooling));
        const raw = await this.waitForState(20, 500, undefined, valvesSettled);
        return this.parseState(raw);
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
                waterTemperature: state['WTEMP'],
                outsideTemperature: state['ETEMP'],
                midpoints: {
                    heating: state['XAH'],
                    cooling: state['XAC'],
                    ecoHeating: state['ECOH'],
                    ecoCooling: state['ECOC'],
                },
                firmwareVersion: state['INFO'] && state['INFO']['FIRMWARE'],
                configVersion: state['VER'],
                timezone: state['TZ'],
                uptime: state['INFO'] && state['INFO']['UPTIME'],
                config,
            }
        }
    }
}

function valvesSettled(state: any) {
    const hysteresis = state.CFG.THH;
    for (let id of Object.keys(state.DP)) {
        const th = state.DP[id];
        if (!th.ON || !th.LIVE) continue;
        const target = th[getTargetField(th)];
        const t = th.TEMP;
        const cooling = (th.HC === 1);
        const [iconId, thId] = id.split('.');
        const relayCfg = state.CFG["ICON" + iconId].RELAY["R" + thId];
        // Due to hysteresis, there are cases when it's not clear whether the valve should be open.
        // Treating those cases as OK, and only assuming a pending status if it's certain.
        // In the relay config, heating/cooling can be disabled - moving on if disabled.
        if (cooling) {
            if (relayCfg.COOL && (th.OUT ? (t < target - hysteresis) : (t > target))) return false;
        } else {
            if (relayCfg.HEAT && (th.OUT ? (t > target + hysteresis) : (t < target))) return false;
        }
    }
    return true;
}

function getTargetField(th: any) {
    return th['CE'] ? (th['HC'] ? 'ECOC' : 'ECOH') : (th['HC'] ? 'XAC' : 'XAH')
}