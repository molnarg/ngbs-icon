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
    targets: NgbsIconModeTemperatures;
    // Turn on/off floor and ceiling heating at a different temperature point
    floorHeatingOffset: number;
    floorCoolingOffset: number;
    // Limits of adjusting the thermostat in degrees +/- 20C (e.g. 5 => 15-25)
    // TODO: is it always 20C or relative to the global XAH/XAC?
    limit: number;
}

export interface NgbsIconModeTemperatures {
    heating: number;
    cooling: number;
    ecoHeating: number;
    ecoCooling: number;
}

export interface NgbsIconController {
    waterTemperature: number;
    outsideTemperature: number;
    midpoints: NgbsIconModeTemperatures;
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

    // Set target temperature. Cooling and ECO specify the mode. If they are not set, then the current active mode.
    setThermostatTarget(id: string, target: number, cooling?: boolean, eco?: boolean): Promise<NgbsIconState>;

    // How much Celsius above/below the midpoint can the target temperature be set.
    setThermostatLimit(id: string, limit: number): Promise<NgbsIconState>;

    // Set individual thermostat limit midpoints. It is not recommended, because individual thermostats cannot
    // report back their midpoints. Use setThermostatLimitMidpoints() instead to set all of them at once.
    setThermostatLimitMidpoint(id: string, midpoint: number, heatingCoolingDiff: number, ecoDiff: number): Promise<NgbsIconState>;

    // Set the midpoint for all thermostats, in all modes (eco/comfort heating/cooling). The calculation is a bit
    // complex. The starting point is the `midpoint`. To get the comfort heating and cooling midpoint, add/subtract
    // the `heatingCoolingDiff`. The get the corresponding eco midpoint, add/substract `ecoDiff`. In equations:
    ///
    // comfortHeatingMidpoint = midpoint - heatingCoolingDiff
    // ecoHeatingMidpoint = midpoint - heatingCoolingDiff - ecoDiff
    // comfortCoolingMidpoint = midpoint + heatingCoolingDiff
    // ecoCoolingMidpoint = midpoint + heatingCoolingDiff + ecoDiff
    //
    // In addition, midpoints and limits must be set such that no thermostat can be set below 5C or above 45C. If
    // That would be possible, the midpoints are adjusted so that midpoint +/- limit is right at this min/max.
    // E.g. if the limit is 15C, then no midpoint can be lower than 20C.
    setThermostatLimitMidpoints(midpoint: number, heatingCoolingDiff: number, ecoDiff: number): Promise<NgbsIconState>;
}