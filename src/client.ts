export interface NgbsIconThermostat {
    id: string;
    name: string;
    valve: boolean;
    eco: boolean;
    cooling: boolean;
    temperature: number;
    humidity: number;
    target: number;
    targets: {
        heating: number;
        cooling: number;
        ecoHeating: number;
        ecoCooling: number;
    };
    // Limits of adjusting the thermostat in degrees +/- 20C (e.g. 5 => 15-25)
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