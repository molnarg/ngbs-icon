export interface Thermostat {
    id: number;
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
}

export interface Controller {
    mixingValve: number;
    waterTemperature: number;
    outsideTemperature: number;
    targetWaterTemperature: number;
}

export interface NgbsIconClient {
    getThermostats(): Promise<Thermostat[]>;
    setThermostatTarget(id: number, cooling: boolean, eco: boolean, target: number): Promise<void>;
    getController(): Promise<Controller>;
    disconnect(): void;
}