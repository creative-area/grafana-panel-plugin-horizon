# Horizon Panel Plugin for Grafana

This Grafana plugin allows to compact the area chart by slicing it horizontally, and then then shifting the slices to baseline zero. It's like a combo area chart and heatmap.

## Installation

### Using Docker

```shell
docker run \
  -d \
  -p 3000:3000 \
  --name=grafana \
  -e "GF_INSTALL_PLUGINS=https://github.com/creative-area/grafana-panel-plugin-horizon/archive/master.zip;creative-area-horizon-panel" \
  grafana/grafana
```

### Using grafana-cli

From Grafana 4.1, you can use `grafana-cli` to install additional plugins. Grafana service needs to be restarted after the installation.

```shell
grafana-cli --pluginUrl https://github.com/creative-area/grafana-panel-plugin-horizon/archive/master.zip plugins install creative-area-horizon-panel
sudo service grafana-server restart
```

### Using Git

#### Clone into plugins directory
Clone this repo into your grafana plugins directory (default `/var/lib/grafana/plugins` if your installing grafana with package). Restart `grafana-server` and the plugin should be automatically detected and used.

```shell
git clone https://github.com/creative-area/grafana-panel-plugin-horizon.git creative-area-horizon-panel
sudo service grafana-server restart
```

#### Clone into a directory of your choice

You can change plugins directory with `GF_PATHS_PLUGINS` environment variable when running Grafana.

```shell
# with service
GF_PATHS_PLUGINS=/path/to/grafana/plugins sudo service grafana-server restart
# in development mode
GF_PATHS_PLUGINS=/path/to/grafana/plugins ./bin/grafana-server
```

Or you can edit your `grafana.ini` config file (default location is at `/etc/grafana/grafana.ini`) and add this:

```ini
[plugin.horizon]
path = /home/your/clone/dir/grafana-panel-plugin-horizon
```

Note that if you clone it into the grafana plugins directory you do not need to add the above config option. That is only
if you want to place the plugin in a directory outside the standard plugins directory. Be aware that `grafana-server`
needs read access to the directory.
