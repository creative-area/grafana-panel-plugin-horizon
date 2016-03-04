define([
    'angular',
    'jquery',
    'app/app',
    'lodash',
], function(angular, jquery, app) {
    'use strict';

    var module = angular.module('grafana.panels.horizon', []);
    app.useModule(module);

});
