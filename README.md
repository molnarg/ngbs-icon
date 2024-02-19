# ngbs-icon

NGBS iCON client library and command line tool

## Client library

See [client.ts](blob/main/src/client.ts) for the API documentation.

## CLI

The tool is more of a proof of concept, and is used mainly to test/try the library.

Get the SYSID of a controller (`getSysId()`):

```bash
$ ngbs_icon 192.168.1.19 sysid
123456789
```

Scan a network for NGBS controllers. It takes a comma separated list of hosts, or an IP range. The result ID
might be empty for controllers that are running an old version of the controller software (pre-2023).

```bash
$ ngbs_icon 192.168.1.1-192.168.1.255 scan
{"192.168.1.19":"123456789"}
```

Print the status of the iCON controller (`client.getState(config=true).controller`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 controller get
{"eco":false,"cooling":false,"waterTemperature":222,"outsideTemperature":222,"midpoints":{"heating":23,"cooling":23,"ecoHeating":20,"ecoCooling":26},"firmwareVersion":1079,"configVersion":"20230110173134","timezone":"UTC","uptime":21,"config":{"name":"Test Controller","mixingValve":0,"thermostatHysteresis":0.5}}
```

 Print the status of a specific thermostat or all without thermostat ID (`client.getState().thermostats`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 thermostat get 1.1
{"id":"1.1","name":"Room 1","live":true,"valve":false,"parentalLock":false,"eco":false,"ecoFollowsMaster":true,"cooling":false,"temperature":24.4,"humidity":38.2,"dew":10.2,"dewProtection":false,"frost":false,"target":23.5,"targets":{"heating":23.5,"cooling":27,"ecoHeating":18,"ecoCooling":27},"floorHeatingOffset":1,"floorCoolingOffset":0,"limit":5}
```

Set the eco/non-eco cooling/heating target temperature (`client.setThermostatTarget()`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 eco cooling 24 # ECO heating
{"id":"1.1", ...}
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 heating 23 # Comfort heating
{"id":"1.1", ...}
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 22 # Current mode
{"id":"1.1", ...}
```

Set parental lock (`client.setThermostatParentalLock()`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 lock 1
{"id":"1.1", ...}
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 lock 0
{"id":"1.1", ...}
```

Set ECO mode (`client.setEco()` and `client.setThermostatEco()`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 mode eco
{"id":"1.1", ...}
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 mode comfort
{"id":"1.1", ...}
$ ngbs_icon service://123456789@192.168.1.19 controller set mode eco
{...}
$ ngbs_icon service://123456789@192.168.1.19 controller set mode comfort
{...}
```

Set heating/cooling mode (`client.setCooling()` and `client.setThermostatCooling()`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 mode heating
{"id":"1.1", ...}
$ ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 mode cooling
{"id":"1.1", ...}
$ ngbs_icon service://123456789@192.168.1.19 controller set mode heating
{...}
$ ngbs_icon service://123456789@192.168.1.19 controller set mode cooling
{...}
```

Updating and restarting the controller (`client.softwareUpdate()` and `client.restart()`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 controller update
$ ngbs_icon service://123456789@192.168.1.19 controller restart
```
