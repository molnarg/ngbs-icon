# ngbs-icon

NGBS iCON client library and command line tool

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
{"waterTemperature":222,"outsideTemperature":222,"config":{"name":"Test Controller","mixingValve":0}}
```

 Print the status of all thermostats and a specific thermostat (`client.getState().thermostats`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 thermostat get
[{"id":"1.1","name":"Room 1","valve":false,"eco":false,"cooling":false,"temperature":24.4,"humidity":38.2,"target":23.5,"targets":{"heating":23.5,"cooling":27,"ecoHeating":18,"ecoCooling":27},"limit":5},{"id":"1.2","name":"Room 2","valve":false,"eco":false,"cooling":false,"temperature":24.6,"humidity":38.6,"target":23,"targets":{"heating":23,"cooling":26,"ecoHeating":17,"ecoCooling":29},"limit":5}]
$ ngbs_icon service://123456789@192.168.1.19 thermostat get 1.1
{"id":"1.1","name":"Room 1","valve":false,"eco":false,"cooling":false,"temperature":24.4,"humidity":38.2,"target":23.5,"targets":{"heating":23.5,"cooling":27,"ecoHeating":18,"ecoCooling":27},"limit":5}
```

Set the eco/non-eco cooling/heating target temperature (`client.setThermostatTarget()`):

```bash
ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 eco cooling 24
ngbs_icon service://123456789@192.168.1.19 thermostat set 1.1 heating 23
```
