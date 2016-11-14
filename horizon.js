define([
        'angular',
        'jquery',
        'moment',
        'lodash',
        'app/core/utils/kbn',
        './horizon.tooltip',
        'jquery.flot',
        './florizon',
        'app/plugins/panel/graph/jquery.flot.events',
        'jquery.flot.selection',
        'jquery.flot.time',
        'jquery.flot.crosshair'
    ],
    function(angular, $, moment, _, kbn, HorizonTooltip) {
        'use strict';

        var module = angular.module('grafana.directives');

        module.directive('grafanaHorizon', function($rootScope, timeSrv) {
            return {
                restrict: 'A',
                template: '<div> </div>',
                link: function(scope, elem) {
                    var ctrl = scope.ctrl;
                    var dashboard = ctrl.dashboard;
                    var panel = ctrl.panel;
                    var data, annotations;
                    var sortedSeries;
                    var graphHeight;
                    var legendSideLastValue = null;
                    var rootScope = scope.$root;

                    rootScope.onAppEvent('setCrosshair', function(event, info) {
                        // do not need to to this if event is from this panel
                        if (info.scope === scope) {
                            return;
                        }

                        if (dashboard.sharedCrosshair) {
                            var $horizonLines = elem.find(".horizon-tooltip");
                            $horizonLines.each(function(i, horizonLine) {
                                var plot = $(horizonLine).data().plot;
                                if (plot) {
                                    plot.setCrosshair({
                                        x: info.pos.x,
                                        y: info.pos.y
                                    });
                                }
                            });
                        }
                    }, scope);

                    rootScope.onAppEvent('clearCrosshair', function() {
                        var $horizonLines = elem.find(".horizon-tooltip");
                        $horizonLines.each(function(i, horizonLine) {
                            var plot = $(horizonLine).data().plot;
                            if (plot) {
                                plot.clearCrosshair();
                            }
                        });
                    }, scope);

                    // Receive render events
                    ctrl.events.on('render', function(renderData) {
                        data = renderData || data;
                        if (!data) {
                            ctrl.refresh();
                            return;
                        }
                        annotations = data.annotations || annotations;
                        render_panel();
                    });

                    // NOTE: rewrited
                    function setElementHeight() {
                        try {
                            graphHeight = ctrl.height || panel.height || ctrl.row.height;
                            if (_.isString(graphHeight)) {
                                graphHeight = parseInt(graphHeight.replace('px', ''), 10);
                            }
                            if (data) {
                                var seriesHeight = data.length * (panel.horizon.horizonHeight + panel.horizon.marginBottom);
                                if (seriesHeight > graphHeight) {
                                    graphHeight = seriesHeight;
                                }
                            }
                            graphHeight += panel.horizon.axisHeight;
                            elem.css('height', Math.min(graphHeight) + 'px');
                            return true;
                        } catch (e) { // IE throws errors sometimes
                            return false;
                        }
                    }

                    // NOTE: idem (except render_panel_as_graphite_png)
                    function shouldAbortRender() {
                        if (!data) {
                            return true;
                        }

                        if (ctrl.otherPanelInFullscreenMode()) {
                            return true;
                        }

                        if (!setElementHeight()) {
                            return true;
                        }

                        // TODO: test png render (if works with phantomjs, it could works)
                        // if (_.isString(data)) {
                        //   render_panel_as_graphite_png(data);
                        //   return true;
                        // }

                        if (elem.width() === 0) {
                            return;
                        }
                    }

                    function drawHook(plot) {
                        // Update legend values
                        var yaxis = plot.getYAxes();
                        for (var i = 0; i < data.length; i++) {
                            var series = data[i];
                            var axis = yaxis[series.yaxis - 1];
                            var formater = kbn.valueFormats[panel.y_formats[series.yaxis - 1]];

                            // decimal override
                            if (_.isNumber(panel.horizon.decimals)) {
                                series.updateLegendValues(formater, panel.horizon.decimals, null);
                            } else {
                                // auto decimals
                                // legend and tooltip gets one more decimal precision
                                // than graph legend ticks
                                var tickDecimals = (axis.tickDecimals || -1) + 1;
                                series.updateLegendValues(formater, tickDecimals, axis.scaledDecimals + 2);
                            }

                            if (!rootScope.$$phase) {
                                scope.$digest();
                            }
                        }

                        // add left axis labels
                        if (panel.leftYAxisLabel) {
                            var yaxisLabel = $("<div class='axisLabel left-yaxis-label'></div>")
                                .text(panel.leftYAxisLabel)
                                .appendTo(elem);

                            yaxisLabel.css("margin-top", yaxisLabel.width() / 2);
                        }

                        // add right axis labels
                        if (panel.rightYAxisLabel) {
                            var rightLabel = $("<div class='axisLabel right-yaxis-label'></div>")
                                .text(panel.rightYAxisLabel)
                                .appendTo(elem);

                            rightLabel.css("margin-top", rightLabel.width() / 2);
                        }
                    }

                    function processOffsetHook(plot, gridMargin) {
                        if (panel.leftYAxisLabel) {
                            gridMargin.left = 20;
                        }
                        if (panel.rightYAxisLabel) {
                            gridMargin.right = 20;
                        }
                    }

                    // Function for rendering panel
                    function render_panel() {
                        if (shouldAbortRender()) {
                            return;
                        }

                        // Populate element
                        var options = {
                            hooks: {
                                draw: [drawHook],
                                processOffset: [processOffsetHook],
                            },
                            legend: {
                                show: true
                            },
                            series: {
                                horizon: panel.horizon
                            },
                            // yaxes: [{}],
                            yaxes: [{
                                position: 'left',
                                show: false,
                                min: null,
                                max: null,
                                index: 1,
                                logBase: panel.horizon.logBase || 1,
                            }],
                            xaxis: {},
                            grid: {
                                minBorderMargin: 0,
                                markings: [],
                                backgroundColor: '#d1d1d1',
                                borderWidth: 0,
                                hoverable: true,
                                color: '#d1d1d1'
                            },
                            selection: {
                                mode: "x",
                                color: '#666'
                            },
                            crosshair: {
                                mode: panel.tooltip.shared || dashboard.sharedCrosshair ? "x" : null
                            }
                        };

                        for (var i = 0; i < data.length; i++) {
                            var series = data[i];
                            series.applySeriesOverrides(panel.seriesOverrides);
                            series.data = series.getFlotPairs(series.nullPointMode || panel.nullPointMode, panel.y_formats);

                            // if hidden remove points
                            if (ctrl.hiddenSeries[series.alias]) {
                                series.data = [];
                            }
                        }

                        addTimeAxis(options);
                        addAnnotations(options);
                        configureAxisOptions(data, options);

                        options.grid.backgroundColor = panel.horizon.backgroundColor;
                        options.grid.color = panel.horizon.backgroundColor;

                        sortedSeries = _.sortBy(data, function(series) {
                            return series.zindex;
                        });

                        elem.data(options.series.horizon);

                        function callPlot(incrementRenderCounter) {
                            try {
                                var $g;
                                elem.html('');
                                _.each(sortedSeries, function(serie, el) {
                                    if (options.xaxis) {
                                        options.xaxis.show = false;
                                    }
                                    $g = $('<div>').data('pos', el).addClass('horizon-tooltip');
                                    $g.css({
                                        'height': options.series.horizon.horizonHeight + 'px',
                                        'margin-bottom': options.series.horizon.marginBottom + 'px'
                                    });
                                    elem.append($g);
                                    $.plot($g, [serie], options);
                                });
                                // xaxis
                                if (sortedSeries.length) {
                                    options.xaxis.show = true;
                                    $g = $('<div>');
                                    $g.css({
                                        'height': options.series.horizon.axisHeight + 'px',
                                        'margin-bottom': options.series.horizon.marginBottom + 'px'
                                    });
                                    elem.append($g);
                                    $.plot($g, [], {
                                        xaxis: options.xaxis,
                                        series: {
                                            lines: {
                                                show: false
                                            },
                                            points: {
                                                show: false
                                            },
                                            bars: {
                                                show: false
                                            }
                                        },
                                        grid: {
                                            minBorderMargin: 0,
                                            markings: [],
                                            backgroundColor: null,
                                            borderWidth: 0,
                                            hoverable: false,
                                            color: 'white'
                                        }
                                    });
                                }
                            } catch (e) {
                                console.log('florizon error', e);
                            }

                            if (incrementRenderCounter) {
                                ctrl.renderingCompleted();
                                // hack for annotation lines positionnement
                                elem.find('.events_line').css({top: 0});
                            }
                        }

                        if (shouldDelayDraw(panel)) {
                            // temp fix for legends on the side, need to render twice to get dimensions right
                            callPlot(false);
                            setTimeout(function() {
                                callPlot(true);
                            }, 50);
                            legendSideLastValue = panel.legend.rightSide;
                        } else {
                            callPlot(true);
                        }
                    }

                    function shouldDelayDraw(panel) {
                        if (panel.legend.rightSide) {
                            return true;
                        }
                        if (legendSideLastValue !== null && panel.legend.rightSide !== legendSideLastValue) {
                            return true;
                        }
                    }

                    function addTimeAxis(options) {
                        var ticks = elem.width() / 100;
                        var min = _.isUndefined(ctrl.range.from) ? null : ctrl.range.from.valueOf();
                        var max = _.isUndefined(ctrl.range.to) ? null : ctrl.range.to.valueOf();

                        options.xaxis = {
                            timezone: dashboard.timezone,
                            show: false,
                            mode: "time",
                            min: min,
                            max: max,
                            label: "Datetime",
                            ticks: ticks,
                            timeformat: time_format(ticks, min, max),
                        };
                    }

                    function addAnnotations(options) {
                        if (!annotations || annotations.length === 0) {
                            return;
                        }

                        var types = {};

                        _.each(annotations, function(event) {
                            if (!types[event.annotation.name]) {
                                types[event.annotation.name] = {
                                    color: event.annotation.iconColor,
                                    position: 'TOP',
                                    markerSize: 4,
                                };
                            }
                        });

                        options.events = {
                            levels: _.keys(types).length + 1,
                            data: annotations,
                            types: types
                        };
                    }

                    function configureAxisOptions(data, options) {
                        var defaults = {
                            position: 'left',
                            show: false,
                            min: panel.grid.leftMin,
                            index: 1,
                            logBase: panel.grid.leftLogBase || 1,
                            max: panel.grid.leftMax,
                        };
                        options.yaxes.push(defaults);
                        applyLogScale(options.yaxes[0], data);
                        configureAxisMode(options.yaxes[0], panel.y_formats[0]);
                    }

                    function applyLogScale(axis, data) {
                        if (axis.logBase === 1) {
                            return;
                        }

                        var series, i;
                        var max = axis.max;

                        if (max === null) {
                            for (i = 0; i < data.length; i++) {
                                series = data[i];
                                if (series.yaxis === axis.index) {
                                    if (max < series.stats.max) {
                                        max = series.stats.max;
                                    }
                                }
                            }
                            if (max === void 0) {
                                max = Number.MAX_VALUE;
                            }
                        }

                        axis.min = axis.min !== null ? axis.min : 0;
                        axis.ticks = [0, 1];
                        var nextTick = 1;

                        while (true) {
                            nextTick = nextTick * axis.logBase;
                            axis.ticks.push(nextTick);
                            if (nextTick > max) {
                                break;
                            }
                        }

                        if (axis.logBase === 10) {
                            axis.transform = function(v) {
                                return Math.log(v + 0.1);
                            };
                            axis.inverseTransform = function(v) {
                                return Math.pow(10, v);
                            };
                        } else {
                            axis.transform = function(v) {
                                return Math.log(v + 0.1) / Math.log(axis.logBase);
                            };
                            axis.inverseTransform = function(v) {
                                return Math.pow(axis.logBase, v);
                            };
                        }
                    }

                    function configureAxisMode(axis, format) {
                        axis.tickFormatter = function(val, axis) {
                            return kbn.valueFormats[format](val, axis.tickDecimals, axis.scaledDecimals);
                        };
                    }

                    function time_format(ticks, min, max) {
                        if (min && max && ticks) {
                            var range = max - min;
                            var secPerTick = (range / ticks) / 1000;
                            var oneDay = 86400000;
                            var oneYear = 31536000000;

                            if (secPerTick <= 45) {
                                return "%H:%M:%S";
                            }
                            if (secPerTick <= 7200 || range <= oneDay) {
                                return "%H:%M";
                            }
                            if (secPerTick <= 80000) {
                                return "%m/%d %H:%M";
                            }
                            if (secPerTick <= 2419200 || range <= oneYear) {
                                return "%m/%d";
                            }
                            return "%Y-%m";
                        }

                        return "%H:%M";
                    }

                    new HorizonTooltip(elem, dashboard, scope, function() {
                        return sortedSeries;
                    });

                    elem.bind("plotselected", function(event, ranges) {
                        scope.$apply(function() {
                            timeSrv.setTime({
                                from: moment.utc(ranges.xaxis.from),
                                to: moment.utc(ranges.xaxis.to),
                            });
                        });
                    });
                }
            };
        });

    });
