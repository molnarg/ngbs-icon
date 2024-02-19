export interface NgbsIconThermostat {
    id: string;
    name: string;
    live: boolean;
    parentalLock: boolean;
    timeProgramActive: boolean;
    valve: boolean;
    eco: boolean;
    // Whether the thermostat follows the master ECO setting
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
    // Limits of adjusting the thermostat in celsius +/- compared to the midpoint (e.g. 20 +/- 5 => 15-25)
    limit: number;
    // Likely midpoint - only reliable if all thermostats have the same midpoint (see setThermostatLimitMidpoints())
    midpoint: number;
}

export interface NgbsIconModeTemperatures {
    heating: number;
    cooling: number;
    ecoHeating: number;
    ecoCooling: number;
}

export interface NgbsIconController {
    eco: boolean;
    cooling: boolean;
    // Water and outside temperature - if sensors are not installed, the default value is 22.2
    waterTemperature: number;
    outsideTemperature: number;
    // Midpoint temperatures, around which the target temperatures can be set withint the thermostat specific limit
    midpoints: NgbsIconModeTemperatures;
    firmwareVersion: string;
    // Timestamp of the last config update
    configVersion: string;
    timezone: string;
    // Uptime in hours
    uptime: number;
    config?: NgbsIconControllerConfig;
}

export interface NgbsIconControllerConfig {
    name: string;
    mixingValve: number;
    thermostatHysteresis: number;
}

export interface NgbsIconState {
    url: string;
    controller: NgbsIconController;
    thermostats: NgbsIconThermostat[];
}

export interface NgbsIconClient {
    getState(config?: boolean): Promise<NgbsIconState>;

    // Set target temperature. Cooling and ECO specify the mode. It waits for state to stabilize (the target to be
    // applied and valves to be actuated) before returning it.
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

    // Turn on/off parental lock.
    setThermostatParentalLock(id: string, parentalLock: boolean): Promise<NgbsIconState>;

    // Turn on/off master ECO mode. It waits for valves to be actuated before returning the state.
    setEco(eco: boolean): Promise<NgbsIconState>;

    // Turn on/off ECO mode on individual thermostat (it might have no effect, or migh affect other thermostats
    // depending on settings; e.g. ecoFollowsMaster setting of other thermostats, and if this is a master thermostat).
    // It waits for valves to be actuated before returning the state.
    setThermostatEco(id: string, eco: boolean): Promise<NgbsIconState>;

    // Set the master cooling/heating mode. It waits for state to stabilize (the targets to be applied and valves to
    // be actuated) before returning it. The whole process takes ~7s.
    setCooling(cooling: boolean): Promise<NgbsIconState>;

    // Set the heating/cooling mode on individual thermostat. It might be rejected if not allowed, or migh affect
    // other thermostats depending on settings (e.g. if this is the master thermostat, then it acts like setCooling()).
    // It waits for state to stabilize (the targets to be applied and valves to be actuated) before returning it.
    setThermostatCooling(id: string, cooling: boolean): Promise<NgbsIconState>;

    // Initiate a software update.
    softwareUpdate(): Promise<void>;

    // Initiate a restart (reloading the controller software, not reboot).
    restart(): Promise<void>;
}