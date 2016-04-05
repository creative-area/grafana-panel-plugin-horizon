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

        var __extends = (this && this.__extends) || function (d, b) {
            for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
            function __() { this.constructor = d; }
            d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
        };

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
            __extends(HorizonCtrl, _super);
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
                // _.defaults(this.panel.annotate, panelDefaults.annotate);
                _.defaults(this.panel.grid, panelDefaults.grid);
                _.defaults(this.panel.legend, panelDefaults.legend);
                _.defaults(this.panel.horizon, panelDefaults.horizon);

                this.events.on('data-received', this.onDataReceived.bind(this));
                this.events.on('data-error', this.onDataError.bind(this));
                this.events.on('data-snapshot-load', this.onDataSnapshotLoad.bind(this));
                this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
                this.events.on('init-panel-actions', this.onInitPanelActions.bind(this));
            };

            HorizonCtrl.templateUrl = 'public/plugins/horizon/module.html';

            HorizonCtrl.prototype.onInitEditMode = function() {
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

            HorizonCtrl.prototype.onInitPanelActions = function(actions) {
                actions.push({text: 'Export CSV (series as rows)', click: 'ctrl.exportCsv()'});
                actions.push({text: 'Export CSV (series as columns)', click: 'ctrl.exportCsvColumns()'});
            }

            HorizonCtrl.prototype.setUnitFormat = function(axis, subItem) {
                this.panel.y_formats[axis] = subItem.value;
                // this.panel.format = subItem.value;
                this.render();
            };

            HorizonCtrl.prototype.issueQueries = function(datasource) {
                this.annotationsPromise = this.annotationsSrv.getAnnotations(this.dashboard);
                return _super.prototype.issueQueries.call(this, datasource);
            }

            HorizonCtrl.prototype.zoomOut = function(evt) {
                this.publishAppEvent('zoom-out', evt);
            };

            HorizonCtrl.prototype.onDataSnapshotLoad = function(snapshotData) {
                this.annotationsPromise = this.annotationsSrv.getAnnotations(this.dashboard);
                this.onDataReceived(snapshotData);
            };

            HorizonCtrl.prototype.onDataError = function(err) {
                this.seriesList = [];
                this.render([]);
            };

            HorizonCtrl.prototype.onDataReceived = function(dataList) {
                var _this = this;
                // png renderer returns just a url
                if (_.isString(dataList)) {
                    this.render(dataList);
                    return;
                }

                this.datapointsWarning = false;
                this.datapointsCount = 0;
                this.datapointsOutside = false;
                this.seriesList = dataList.map(this.seriesHandler.bind(this));
                this.datapointsWarning = this.datapointsCount === 0 || this.datapointsOutside;

                this.annotationsPromise.then(function(annotations) {
                    _this.loading = false;
                    _this.seriesList.annotations = annotations;
                    _this.render(_this.seriesList);
                }, function() {
                    _this.loading = false;
                    _this.render(_this.seriesList);
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

            HorizonCtrl.prototype.exportCsvColumns = function() {
                fileExport.exportSeriesListToCsvColumns(this.seriesList);
            };

            return HorizonCtrl;

        })(sdk.MetricsPanelCtrl);

        return {
            PanelCtrl: HorizonCtrl
        };

    });
