export interface NgbsIconThermostat {
    id: number;
    name?: string;
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

export interface NgbsIconController {
    name?: string;
    mixingValve: number;
    waterTemperature: number;
    outsideTemperature: number;
    targetWaterTemperature?: number;
}

export interface NgbsIconClient {
    getThermostats(): Promise<NgbsIconThermostat[]>;
    setThermostatTarget(id: number, cooling: boolean, eco: boolean, target: number): Promise<void>;
    getController(): Promise<NgbsIconController>;
    disconnect(): void;
}