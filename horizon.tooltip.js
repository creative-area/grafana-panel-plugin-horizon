define([
        'jquery',
    ],
    function($) {
        'use strict';

        function HorizonTooltip(elem, dashboard, scope, getSeriesFn) {
            var self = this;
            var ctrl = scope.ctrl;
            var panel = ctrl.panel;

            var $tooltip = $('<div id="tooltip" class="graph-tooltip">');

            this.findHoverIndexFromDataPoints = function(posX, series, last) {
                var ps = series.datapoints.pointsize;
                var initial = last * ps;
                var len = series.datapoints.points.length;
                for (var j = initial; j < len; j += ps) {
                    if (series.datapoints.points[j] > posX) {
                        return Math.max(j - ps, 0) / ps;
                    }
                }
                return j / ps - 1;
            };

            this.findHoverIndexFromData = function(posX, series) {
                var len = series.data.length;
                for (var j = 0; j < len; j++) {
                    if (series.data[j][0] > posX) {
                        return Math.max(j - 1, 0);
                    }
                }
                return j - 1;
            };

            this.findSerieIndexFromPos = function(pos, nbSeries) {
                var offset = elem.offset();
                var elemData = elem.data();
                return Math.min(nbSeries - 1, Math.floor((pos.pageY - offset.top) / (elemData.horizonHeight + elemData.marginBottom)));
            };

            this.showTooltip = function(title, innerHtml, pos) {
                var body = '<div class="graph-tooltip-time">' + title + '</div> ';
                body += innerHtml + '</div>';
                $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
            };

            this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
                var value, i, series, hoverIndex;
                var results = [];

                //now we know the current X (j) position for X and Y values
                var last_value = 0; //needed for stacked values

                for (i = 0; i < seriesList.length; i++) {
                    series = seriesList[i];

                    if (!series.data.length || (panel.legend.hideEmpty && series.allIsNull)) {
                        results.push({
                            hidden: true
                        });
                        continue;
                    }

                    hoverIndex = this.findHoverIndexFromData(pos.x, series);
                    results.time = series.data[hoverIndex][0];

                    if (series.stack) {
                        if (panel.tooltip.value_type === 'individual') {
                            value = series.data[hoverIndex][1];
                        } else if (!series.stack) {
                            value = series.data[hoverIndex][1];
                        } else {
                            last_value += series.data[hoverIndex][1];
                            value = last_value;
                        }
                    } else {
                        value = series.data[hoverIndex][1];
                    }

                    // Highlighting multiple Points depending on the plot type
                    if (series.lines.steps || series.stack) {
                        // stacked and steppedLine plots can have series with different length.
                        // Stacked series can increase its length on each new stacked serie if null points found,
                        // to speed the index search we begin always on the last found hoverIndex.
                        var newhoverIndex = this.findHoverIndexFromDataPoints(pos.x, series, hoverIndex);
                        results.push({
                            value: value,
                            hoverIndex: newhoverIndex
                        });
                    } else {
                        results.push({
                            value: value,
                            hoverIndex: hoverIndex
                        });
                    }
                }

                return results;
            };

            elem.mouseleave(function() {
                var $horizonLines = elem.find(".horizon-tooltip");
                $horizonLines.each(function(i, horizonLine) {
                    var dataHorizonLine = $(horizonLine).data();
                    var plot = dataHorizonLine.plot;
                    if (plot) {
                        $tooltip.detach();
                        plot.unhighlight();
                        plot.clearCrosshair();
                    }
                });

                if (dashboard.sharedCrosshair) {
                    ctrl.publishAppEvent('clearCrosshair');
                }
            });

            elem.bind("plothover", function(event, pos, item) {
                var seriesList = getSeriesFn();
                var plot;
                var value, timestamp, series;

                if (dashboard.sharedCrosshair) {
                    ctrl.publishAppEvent('setCrosshair', {
                        pos: pos,
                        scope: scope
                    });
                }

                if (seriesList.length === 0) {
                    return;
                }

                var $horizonLineHover = $(event.target);
                plot = $horizonLineHover.data('plot');
                plot.unhighlight();

                var serieIndex = self.findSerieIndexFromPos(pos, seriesList.length);
                var $horizonLines = elem.find(".horizon-tooltip");
                $horizonLines.each(function(i, horizonLine) {
                    var dataHorizonLine = $(horizonLine).data();
                    if (dataHorizonLine.pos !== serieIndex) {
                        plot = dataHorizonLine.plot;
                        if (plot) {
                            plot.setCrosshair({
                                x: pos.x,
                                y: pos.y
                            });
                        }
                    }
                });
                if (panel.tooltip.shared) {
                    var seriesHtml = '';
                    var nbSeries = seriesList.length;
                    timestamp = null;
                    for (var i = 0; i < nbSeries; i++) {
                        series = seriesList[i];
                        var hoverIndex = self.findHoverIndexFromData(pos.x, series);
                        if (series) {
                            var highlightClass = '';
                            if (serieIndex === i) {
                                highlightClass = 'graph-tooltip-list-item--highlight';
                            }
                            value = series.formatValue(series.data[hoverIndex][1]);
                            timestamp = timestamp || dashboard.formatDate(series.data[hoverIndex][0]);
                            seriesHtml += '<div class="graph-tooltip-list-item ' + highlightClass + '"><div class="graph-tooltip-series-name">';
                            seriesHtml += '<i class="fa fa-minus"></i> ' + series.label + ':</div>';
                            seriesHtml += '<div class="graph-tooltip-value">' + value + '</div></div>';
                        }
                    }
                    self.showTooltip(timestamp, seriesHtml, pos);
                }
                // single series tooltip
                else if (item) {
                    var plotData = plot.getData();
                    var seriesHoverInfo = self.getMultiSeriesPlotHoverInfo(plotData, pos);
                    if (seriesHoverInfo.pointCountMismatch) {
                        self.showTooltip('Shared tooltip error', '<ul>' +
                            '<li>Series point counts are not the same</li>' +
                            '<li>Set null point mode to null or null as zero</li>' +
                            '<li>For influxdb users set fill(0) in your query</li></ul>', pos);
                        return;
                    }

                    timestamp = dashboard.formatDate(seriesHoverInfo.time);
                    series = seriesList[serieIndex];
                    if (series) {
                        var hoverInfo = seriesHoverInfo[0];
                        value = series.formatValue(hoverInfo.value);
                        self.showTooltip(timestamp, series.label + ': <strong>' + value + '</strong>', pos);
                    }
                }
                // no hit
                else {
                    $tooltip.detach();
                }
            });
        }

        return HorizonTooltip;
    });
