export interface NgbsIconThermostat {
    id: string;
    name: string;
    live: boolean;
    parentalLock: boolean;
    valve: boolean;
    eco: boolean;
    ecoFollowsMaster: boolean;
    cooling: boolean;
    temperature: number;
    humidity: number;
    // Dew point, the temperature at which humidity would be 100%
    dewPoint: number;
    dewProtection: boolean;
    frost: boolean;
    target: number;
    targets: {
        heating: number;
        cooling: number;
        ecoHeating: number;
        ecoCooling: number;
    };
    // Turn on/off floor and ceiling heating at a different temperature point
    floorHeatingOffset: number;
    floorCoolingOffset: number;
    // Limits of adjusting the thermostat in degrees +/- 20C (e.g. 5 => 15-25)
    // TODO: is it always 20C or relative to the global XAH/XAC?
    limit: number;
}

export interface NgbsIconController {
    waterTemperature: number;
    outsideTemperature: number;
    config?: NgbsIconControllerConfig;
}

export interface NgbsIconControllerConfig {
    name: string;
    mixingValve: number;
}

export interface NgbsIconState {
    url: string;
    controller: NgbsIconController;
    thermostats: NgbsIconThermostat[];
}

export interface NgbsIconClient {
    getState(config?: boolean): Promise<NgbsIconState>;
    setThermostatTarget(id: string, cooling: boolean, eco: boolean, target: number): Promise<NgbsIconState>;
    setThermostatLimit(id: string, limit: number): Promise<NgbsIconState>;
}