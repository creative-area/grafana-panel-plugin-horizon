define([
        'angular',
        'lodash',
        'app/core/utils/kbn',
        'jquery',
        'jquery.flot',
        'jquery.flot.time',
    ],
    function(angular, _, kbn, $) {
        'use strict';

        var module = angular.module('grafana.directives');

        module.directive('horizonLegend', function() {
            return {
                link: function(scope, elem) {
                    var $container = $('<section>', {
                        'class': 'horizon-legend',
                    });
                    var firstRender = true;
                    var ctrl = scope.ctrl;
                    var panel = ctrl.panel;
                    var data;
                    var seriesList;
                    var i;

                    scope.$on('render', function() {
                        data = ctrl.seriesList;
                        if (data) {
                            setTimeout(function() {
                                render();
                            }, 50);
                        }
                    });

                    function render() {
                        var nbSeries = 0;
                        if (firstRender) {
                            elem.append($container);
                            firstRender = false;
                        }

                        seriesList = data;

                        $container.empty();

                        for (i = 0; i < seriesList.length; i++) {
                            var series = seriesList[i];

                            // ignore empty series
                            if (panel.legend.hideEmpty && series.allIsNull) {
                                continue;
                            }
                            // ignore series excluded via override
                            if (!series.legend) {
                                continue;
                            }

                            var $legend = $('<div>', {
                                'css': {
                                    'left': (panel.legend.rightSide) ? 'none' : '4px',
                                    'right': (panel.legend.rightSide) ? '4px' : 'none',
                                    'text-align': (panel.legend.rightSide) ? 'right' : 'left',
                                    'position': 'absolute',
                                    'top': nbSeries * (panel.horizon.horizonHeight + panel.horizon.marginBottom) + 'px',
                                    'color': panel.horizon.labelColor
                                }
                            });
                            $legend.append($('<div>', {
                                'class': 'graph-legend-alias small'
                            }).html(series.label));
                            if (panel.legend.values) {
                                var avg = series.formatValue(series.stats.avg);
                                var min = series.formatValue(series.stats.min);
                                var max = series.formatValue(series.stats.max);
                                var current = series.formatValue(series.stats.current);
                                var total = series.formatValue(series.stats.total);

                                if (panel.legend.min) {
                                    $legend.append('<div class="graph-legend-value min small">' + min + '</div>');
                                }
                                if (panel.legend.max) {
                                    $legend.append('<div class="graph-legend-value max small">' + max + '</div>');
                                }
                                if (panel.legend.avg) {
                                    $legend.append('<div class="graph-legend-value avg small">' + avg + '</div>');
                                }
                                if (panel.legend.current) {
                                    $legend.append('<div class="graph-legend-value current small">' + current + '</div>');
                                }
                                if (panel.legend.total) {
                                    $legend.append('<div class="graph-legend-value total small">' + total + '</div>');
                                }
                            }
                            nbSeries++;
                            $container.append($legend);
                        }
                    }
                }
            };
        });

    });
