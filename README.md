# Horizon Panel Plugin for Grafana

You need the last grafana build to enable plugin support. You can get it here : http://grafana.org/download/builds.html
Unfortunately, the docker image, the package available in the repos don't have plugin support enabled.

## Clone into plugins directory
Either clone this repo into your grafana plugins directory (default /var/lib/grafana/plugins if your installing grafana with package).
Restart grafana-server and the plugin should be automatically detected and used.

```
git clone https://github.com/creative-area/grafana-panel-plugin-horizon.git
sudo service grafana-server restart
```

You can change plugins directory with `GF_PATHS_PLUGINS` environment variable when running Grafana.

```shell
# with service
GF_PATHS_PLUGINS=/path/to/grafana/plugins sudo service grafana-server restart
# in development mode
GF_PATHS_PLUGINS=/path/to/grafana/plugins ./bin/grafana-server
```


## Clone into a directory of your choice

Then edit your grafana.ini config file (Default location is at /etc/grafana/grafana.ini) and add this:

```ini
[plugin.horizon]
path = /home/your/clone/dir/grafana-panel-plugin-horizon
```

Note that if you clone it into the grafana plugins directory you do not need to add the above config option. That is only
if you want to place the plugin in a directory outside the standard plugins directory. Be aware that grafana-server
needs read access to the directory.
