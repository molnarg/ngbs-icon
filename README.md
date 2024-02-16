# ngbs-icon
NGBS iCON client library and command line tool

# CLI

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

Print the status of the iCON controller (`client.getController()`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 controller get
{"mixingValve":0,"waterTemperature":222,"outsideTemperature":222,"targetWaterTemperature":45}
```

 Print the status of all thermostats and a specific thermostat (`client.getThermostats()`):

```bash
$ ngbs_icon service://123456789@192.168.1.19 thermostat get
[{"id":0,"temperature":23.9,"humidity":44.8,"cooling":false,"eco":false,"target":23.1,"targets":{"heating":23.1,"cooling":27,"ecoHeating":17,"ecoCooling":27},"valve":false},{"id":1,"temperature":23.9,"humidity":44.9,"cooling":false,"eco":false,"target":23,"targets":{"heating":23,"cooling":26,"ecoHeating":17,"ecoCooling":29},"valve":false}]
$ ngbs_icon service://123456789@192.168.1.19 thermostat get 1
{"id":0,"temperature":23.9,"humidity":44.8,"cooling":false,"eco":false,"target":23.1,"targets":{"heating":23.1,"cooling":27,"ecoHeating":17,"ecoCooling":27},"valve":false}
```

Set the eco/non-eco cooling/heating target temperature (`client.setThermostatTarget()`):

```bash
ngbs_icon service://123456789@192.168.1.19 thermostat set 1 eco cooling 24
ngbs_icon service://123456789@192.168.1.19 thermostat set 1 heating 23
```
