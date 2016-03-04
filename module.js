define([
        'lodash',
        'app/plugins/sdk',
        'app/core/utils/kbn',
        'moment',
        'app/core/time_series',
        // 'app/core/time_series2',
        'app/core/utils/file_export',
        // './seriesOverridesCtrl',
        './horizon',
        './legend',
    ],
    function(_, sdk, kbn, moment, TimeSeries, fileExport) {
        'use strict';

        var panelDefaults = {
            // datasource name, null = default datasource
            datasource: null,
            // sets client side (flot) or native graphite png renderer (png)
            renderer: 'flot',
            // Show/hide the x-axis
            'x-axis': true,
            // Show/hide y-axis
            'y-axis': false,
            // format (only one axis)
            y_formats : ['short', 'short'],
            // y_formats : ['none', 'none'],
            // format: 'short',
            // grid options
            grid: {
                leftLogBase: 1,
                leftMax: null,
                rightMax: null,
                leftMin: null,
                rightMin: null,
                rightLogBase: 1,
                threshold1: null,
                threshold2: null,
                threshold1Color: 'rgba(216, 200, 27, 0.27)',
                threshold2Color: 'rgba(234, 112, 112, 0.22)'
            },
            // legend options
            legend: {
                show: true, // disable/enable legend
                values: false, // disable/enable legend values
                min: false,
                max: false,
                current: false,
                total: false,
                avg: false
            },
            // horizon
            horizon: {
                bands: 6,
                horizonHeight: 32,
                axisHeight: 25,
                marginBottom: 2,
                backgroundColor: '#d1d1d1',
                labelColor: '#000000',
                logBase: 1,
                decimals: ''
            },
            // how null points should be handled
            nullPointMode: 'connected',
            // tooltip options
            tooltip: {
                value_type: 'cumulative',
                shared: true,
            },
            // time overrides
            timeFrom: null,
            timeShift: null,
            // metric queries
            targets: [{}],
            // other style overrides
            seriesOverrides: [],
        };

        var HorizonCtrl = (function(_super) {

            function HorizonCtrl($scope, $injector, annotationsSrv) {
                _super.call(this, $scope, $injector);
                this.annotationsSrv = annotationsSrv;

                this.hiddenSeries = {};
                this.seriesList = [];
                this.logScales = null;
                this.unitFormats = null;
                this.annotationsPromise = null;
                this.datapointsCount = null;
                this.datapointsOutside = null;
                this.datapointsWarning = null;

                _.defaults(this.panel, panelDefaults);
                _.defaults(this.panel.tooltip, panelDefaults.tooltip);
                _.defaults(this.panel.annotate, panelDefaults.annotate);
                _.defaults(this.panel.grid, panelDefaults.grid);
                _.defaults(this.panel.legend, panelDefaults.legend);
                _.defaults(this.panel.horizon, panelDefaults.horizon);
            };

            HorizonCtrl.prototype = Object.create(_super.prototype);
            HorizonCtrl.prototype.constructor = HorizonCtrl;

            HorizonCtrl.templateUrl = 'public/plugins/horizon/module.html';

            HorizonCtrl.prototype.initEditMode = function() {
                _super.prototype.initEditMode.call(this);

                this.icon =  "fa fa-align-justify";
                this.addEditorTab('Configuration', 'public/plugins/horizon/configEditor.html', 2);

                this.logScales = {
                    'linear': 1,
                    'log (base 2)': 2,
                    'log (base 10)': 10,
                    'log (base 32)': 32,
                    'log (base 1024)': 1024
                };
                this.unitFormats = kbn.getUnitFormats();
            };

            HorizonCtrl.prototype.getExtendedMenu = function() {
                var menu = _super.prototype.getExtendedMenu.call(this);
                menu.push({text: 'Export CSV', click: 'ctrl.exportCsv()'});
                return menu;
            };

            HorizonCtrl.prototype.setUnitFormat = function(axis, subItem) {
                this.panel.y_formats[axis] = subItem.value;
                // this.panel.format = subItem.value;
                this.render();
            };

            HorizonCtrl.prototype.refreshData = function(datasource) {
                this.annotationsPromise = this.annotationsSrv.getAnnotations(this.dashboard);
                return this.issueQueries(datasource)
                    .then(this.dataHandler.bind(this))
                    .catch(function(err) {
                        this.hiddenSeries = {};
                        this.seriesList = [];
                        this.render([]);
                        throw err;
                    }.bind(this));
            };

            HorizonCtrl.prototype.zoomOut = function(evt) {
                this.publishAppEvent('zoom-out', evt);
            };

            HorizonCtrl.prototype.loadSnapshot = function(snapshotData) {
                this.annotationsPromise = this.annotationsSrv.getAnnotations(this.dashboard);
                this.dataHandler(snapshotData);
            };

            HorizonCtrl.prototype.dataHandler = function(results) {
                // png renderer returns just a url
                if (_.isString(results)) {
                    this.render(results);
                    return;
                }

                this.datapointsWarning = false;
                this.datapointsCount = 0;
                this.datapointsOutside = false;
                this.seriesList = _.map(results.data, this.seriesHandler.bind(this));
                this.datapointsWarning = this.datapointsCount === 0 || this.datapointsOutside;

                var _horizon = this;
                this.annotationsPromise.then(function(annotations) {
                    _horizon.loading = false;
                    _horizon.seriesList.annotations = annotations;
                    _horizon.render(_horizon.seriesList);
                }, function() {
                    _horizon.loading = false;
                    _horizon.render(_horizon.seriesList);
                });
            };

            HorizonCtrl.prototype.seriesHandler = function(seriesData, index) {
                var datapoints = seriesData.datapoints;
                var alias = seriesData.target;
                var series = new TimeSeries({
                    datapoints: datapoints,
                    alias: alias,
                    index: index,
                });

                if (datapoints && datapoints.length > 0) {
                    var last = moment.utc(datapoints[datapoints.length - 1][1]);
                    var from = moment.utc(this.range.from);
                    if (last - from < -10000) {
                        this.datapointsOutside = true;
                    }

                    this.datapointsCount += datapoints.length;
                }

                return series;
            };

            HorizonCtrl.prototype.render = function(data) {
                this.broadcastRender(data);
            };

            HorizonCtrl.prototype.addSeriesOverride = function(override) {
                this.panel.seriesOverrides.push(override || {});
            };

            HorizonCtrl.prototype.removeSeriesOverride = function(override) {
                this.panel.seriesOverrides = _.without(this.panel.seriesOverrides, override);
                this.render();
            };

            HorizonCtrl.prototype.legendValuesOptionChanged = function() {
                var legend = this.panel.legend;
                legend.values = legend.min || legend.max || legend.avg || legend.current || legend.total;
                this.render();
            };

            HorizonCtrl.prototype.exportCsv = function() {
                fileExport.exportSeriesListToCsv(this.seriesList);
            };

            return HorizonCtrl;

        })(sdk.MetricsPanelCtrl);

        return {
            PanelCtrl: HorizonCtrl
        };

    });
