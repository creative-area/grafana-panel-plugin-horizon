/* global jQuery */
(function($) {
  "use strict";

  function init(plot) {

    function processOptions(plot) {//, options
      plot.hooks.processRawData.unshift(processRawData);
    }

    function colorProgress(start, finish, steps) {
      var progressions;
      if (steps === 1) {
        progressions = [finish];
      } else {
        var round = Math.round;
        var performSteps = Math.max(steps + 1, 3);
        progressions = [];
        for(var i = 0; i < steps - 1; i++) {
          var ratio = (i + performSteps - steps) / (performSteps - 1);
          progressions.push([
            round((finish[0] - start[0]) * ratio + start[0]),
            round((finish[1] - start[1]) * ratio + start[1]),
            round((finish[2] - start[2]) * ratio + start[2])
        ]);
        }
        progressions.push(finish);
      }
      return progressions.slice().map(function(components) {
        return "rgb(" + components + ")";
      });
    }

    function cachedColorProgress(start, finish) {
      var cache = {};
      return function(steps) {
        if (!cache[steps]) {
          cache[steps ] = colorProgress(start, finish, steps);
        }
        return cache[steps ];
      };
    }

    var negativeColorProgress = cachedColorProgress([189, 215, 231], [8, 81, 156]);
    var positiveColorProgress = cachedColorProgress([186, 228, 179], [0, 109, 44]);

    function processRawData(plot, series, data) {//, datapoints
      if (series.horizon && series.horizon.bands) {
        var absolute = Math.abs;
        var maximum = Math.max;
        var floor = Math.floor;
        var bands = 1 * series.horizon.bands;
        if (isNaN(bands) || bands < 1) {
          throw "Invalid value for bands: " + JSON.stringify(series.horizon.bands);
        }
        var max = data.reduce(function(a, b) {
            return [null, maximum(absolute(a[1]), absolute(b[1]))];
          })[1];
        var positiveSeries = [];
        var negativeSeries = [];
        var negativeColors = negativeColorProgress(bands);
        var positiveColors = positiveColorProgress(bands);
        for(var i = 0; i < bands; i++) {
          positiveSeries[i] = {
            data: [],
            horizon: false,
            color: positiveColors[i],
            yaxis: 2,
            lines: {
              show: true,
              lineWidth: 0,
              fill: true,
              fillColor: positiveColors[i]
            }
          };
          negativeSeries[i] = {
            data: [],
            horizon: false,
            color: negativeColors[i],
            yaxis: 2,
            lines: {
              show: true,
              lineWidth: 0,
              fill: true,
              fillColor: negativeColors[i]
            }
          };
        }
        var sliceHeight = max / bands;
        data.forEach(function(point) {
          var time = point[0];
          var value = point[1];
          var nullPoint = [time, 0];
          var maxPoint = [time, sliceHeight];
          var filledBands = value > 0 ? positiveSeries : negativeSeries;
          var emptyBands = value > 0 ? negativeSeries : positiveSeries;
          value = absolute(value);
          var prevBand = floor(value / sliceHeight) - 1;
          var band;
          for(band = 0; band <= prevBand; band++) {
            filledBands[band].data.push(maxPoint);
            emptyBands[band].data.push(nullPoint);
          }
          if (band < bands) {
            filledBands[band].data.push([time, value - band * sliceHeight]);
            emptyBands[band].data.push(nullPoint);
          }
          band++;
          for (; band < bands; band++) {
            filledBands[band].data.push(nullPoint);
            emptyBands[band].data.push(nullPoint);
          }
        });
        plot.setData([{
          data: data,
          yaxis: 1,
          horizon: false,
          lines: {
            show: false
          }
        }].concat(positiveSeries, negativeSeries));
      }
    }

    plot.hooks.processOptions.push(processOptions);
  }

  var options = {
    series: {
      horizon: false
    }
  };

  $.plot.plugins.push({
    init: init,
    options: options,
    name: "florizon",
    version: "0.1"
  });

})(jQuery);
