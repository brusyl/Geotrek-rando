'use strict';

function mapService($q, $state, $resource, utilsFactory, globalSettings, translationService, settingsFactory, treksService, poisService, servicesService, iconsService, popupService, layersService) {

    var self = this;

    this.loadingMarkers = false;

    // MARKERS AND CLUSTERS  //////////////////////////////
    //
    //
    this.markers = [];

    this.getMarkers = function () {
        return this.markers;
    };

    this.setMarkers = function (markers) {
        this.markers = markers;
    };

    this.addGeoServices = function (element) {
        var deferred = $q.defer();
        var controlClasses = self.servicesControl.getContainer().classList;
        if (element.properties.contentType === 'trek') {
            servicesService.getServicesFromElement(element.id)
                .then(
                    function (services) {
                        var counter = 0;
                        _.forEach(services.features, function (service) {
                            var poiLocation = utilsFactory.getStartPoint(service);
                            self.createLayerFromElement(service, 'service', poiLocation)
                                .then(
                                    function (marker) {
                                        counter++;

                                        popupService.attachPopups(marker);

                                        self._servicesMarkersLayer.addLayer(marker);

                                        if (counter === services.features.length) {
                                            if (controlClasses.contains('hidden')) {
                                                controlClasses.remove('hidden');
                                            }
                                            deferred.resolve();
                                        }
                                    }
                                );
                        });
                        if (services.features.length === 0 && !controlClasses.contains('hidden')) {
                            controlClasses.add('hidden');
                            deferred.resolve();
                        }
                    }
                );

        } else {
            if (!controlClasses.contains('hidden')) {
                controlClasses.add('hidden');
                deferred.resolve();
            }
        }

        return deferred.promise;
    };

    this.createPOISFromElement = function (element) {
        var deferred = $q.defer(),
            promises = [],
            startPoint = utilsFactory.getStartPoint(element);

        if (element.properties.parking_location) {
            var parkingPoint = utilsFactory.getParkingPoint(element);
            promises.push(
                self.createLayerFromElement(element, 'parking', parkingPoint)
                    .then(
                        function (marker) {
                            marker.popupSources.hint = element.properties.advised_parking;

                            popupService.attachPopups(marker);

                            self._infosMarkersLayer.addLayer(marker);
                        }
                    )
            );
        }

        if (element.geometry.type === 'LineString' || element.geometry.type === 'MultiLineString') {
            var endPoint = utilsFactory.getEndPoint(element);
            if (startPoint.lat === endPoint.lat && startPoint.lng === endPoint.lng) {
                promises.push(
                    self.createLayerFromElement(element, 'departureArrival', startPoint)
                        .then(
                            function (marker) {
                                _.merge(marker.popupSources, {
                                    hint: element.properties.departure + '\n' + element.properties.arrival
                                });
                                popupService.attachPopups(marker);
                                self._infosMarkersLayer.addLayer(marker);
                            }
                        )
                );
            } else {
                promises.push(
                    self.createLayerFromElement(element, 'departure', startPoint)
                        .then(
                            function (marker) {
                                _.merge(marker.popupSources, {
                                    hint: element.properties.departure
                                });
                                popupService.attachPopups(marker);
                                self._infosMarkersLayer.addLayer(marker);
                            }
                        )
                );

                promises.push(
                    self.createLayerFromElement(element, 'arrival', endPoint)
                        .then(
                            function (marker) {
                                _.merge(marker.popupSources, {
                                    hint: element.properties.arrival
                                });
                                popupService.attachPopups(marker);
                                self._infosMarkersLayer.addLayer(marker);
                            }
                        )
                );
            }

            if (element.properties.points_reference) {
                var i = 0,
                    tempRefPoint;
                for (i = 0; i < element.properties.points_reference.coordinates.length; i++) {
                    tempRefPoint = {
                        order: i + 1,
                        coordinates: {
                            'lat': element.properties.points_reference.coordinates[i][1],
                            'lng': element.properties.points_reference.coordinates[i][0]
                        }
                    };
                    promises.push(
                        self.createLayerFromElement(tempRefPoint, 'ref-point', tempRefPoint.coordinates)
                            .then(
                                function (marker) {
                                    self._infosMarkersLayer.addLayer(marker);
                                }
                            )
                    );
                }
            }

            promises.push(
                poisService.getPoisFromElement(element.id, true)
                    .then(
                        function (pois) {
                            var counter = 0;
                            _.forEach(pois.features, function (poi) {
                                var poiLocation = utilsFactory.getStartPoint(poi);
                                self.createLayerFromElement(poi, 'poi', poiLocation)
                                    .then(
                                        function (marker) {
                                            var selector = '#poi-' + poi.id.toString();

                                            counter++;

                                            _.merge(marker.popupSources, {
                                                selector: selector,
                                                scroll: {
                                                    event: 'mouseover',
                                                    container: '.detail-aside-group-content',
                                                    target: selector
                                                }
                                            });

                                            popupService.attachPopups(marker);

                                            self._poisMarkersLayer.addLayer(marker);
                                        }
                                    );
                            });
                        }
                    )
            );

        }

        promises.push(this.addGeoServices(element));

        $q.all(promises)
            .then(
                function () {
                    deferred.resolve(true);
                }
            );

        return deferred.promise;
    };

    this.createElementsMarkers = function (elements, type) {
        // console.log(type);
        var startPoint = [];
        elements.forEach(function (element) {
            startPoint = utilsFactory.getStartPoint(element);

            if(type === 'near') {
                self.createLayerFromElement(element, 'near', startPoint)
                    .then(
                        function (marker) {

                            marker.options.icon.options.className += ' ' + type + '-marker';
                            var selector = '#' + type + '-category-' + element.properties.category.id + '-' + element.id;

                            _.merge(marker.popupSources, {
                                selector: '#result-category-' + element.properties.category.id + '-' + element.id
                            });

                            popupService.attachPopups(marker);

                            self._nearMarkersLayer.addLayer(marker);
                        }
                    );
            }
            if (type === 'children') {
                self.createLayerFromElement(element, 'children', startPoint)
                    .then(
                        function (marker) {

                            marker.options.icon.options.className += ' ' + type + '-marker';
                            var selector = '#' + type + '-category-' + element.properties.category.id + '-' + element.id;

                            _.merge(marker.popupSources, {
                                selector: '#result-category-' + element.properties.category.id + '-' + element.id
                            });

                            popupService.attachPopups(marker);
                            self._childMarkersLayer.addLayer(marker);
                        }
                    );
            }
        });
    };

    this.createLayerFromElement = function (element, type, elementLocation) {
        var deferred = $q.defer();
        var popupSources = {};
        if (type === "geojson" && element.geometry.type !== 'MultiPoint') {
            var geoStyle = {
                className:  'layer-category-' + element.properties.category.id + '-' + element.id + ' category-' + element.properties.category.id
            };

            if (element.geometry.type === 'Polygon') {
                geoStyle.className += ' fill';
            }
            var geoJsonLayer = L.geoJson(element, {
                style: geoStyle
            });
            geoJsonLayer.options.result = element;
            deferred.resolve(geoJsonLayer);
        } else {
            var promise,
                param;

            switch (type) {
            case 'geojson':
                promise = iconsService.getElementIcon;
                param = element;
                break;

            case 'category':
                promise = iconsService.getElementIcon;
                param = element;
                popupSources.hint = element.properties.name;
                break;

            case 'near':
                promise = iconsService.getElementIcon;
                param = element;
                popupSources.hint = type;
                break;

            case 'children':
                promise = iconsService.getElementIcon;
                param = element;
                popupSources.hint = type;
                break;

            case 'poi':
                promise = iconsService.getPOIIcon;
                param = element;
                popupSources.hint = element.properties.name;
                break;

            case 'service':
                promise = iconsService.getServiceIcon;
                param = element;
                popupSources.hint = element.properties.type.name;
                break;

            case 'ref-point':
                promise = iconsService.getRefIcon;
                param = element;
                break;

            default:
                promise = iconsService.getIcon;
                param = type;
                break;
            }

            promise(param)
                .then(
                    function (currentIcon) {
                        if (elementLocation) {
                            var marker = L.marker(
                                [elementLocation.lat, elementLocation.lng],
                                {
                                    icon: currentIcon
                                }
                            );
                            marker.options.result = element;
                            marker.popupSources = popupSources;
                            deferred.resolve(marker);
                        } else {
                            deferred.reject('no position provided');
                        }
                    }
                );
        }

        return deferred.promise;
    };


    // UI CONTROLS //////////////////////////////
    //
    //

    this.initMapControls = function () {
        this.setViewPortFilteringControl();
        this.setAttribution();
        this.setZoomControlPosition();
        this.setFullScreenControl();
        this.setMinimap();
        this.setScale();
        this.createServicesToggleControl();
        this.createResetViewButton();
        this.createLayerSwitch();

        return this;
    };

    this.setScale = function () {
        L.control.scale({imperial: false, position: 'bottomright'}).addTo(this.map);
    };

    this.setZoomControlPosition = function () {
        this.map.zoomControl.setPosition('topright');
    };

    this.setFullScreenControl = function () {
        L.control.fullscreen({
            position: 'topright',
            title: 'Fullscreen'
        }).addTo(this.map);
    };

    /**
     * Create and attach the map control button allowing to reset pan/zoom to the main loaded content
     * @return {Oject} Map object
     */
    this.createResetViewButton = function () {
        function getLayersToFit () {
            var layers = [self._clustersLayer];
            if (self._treksgeoJsonLayer) {
                layers.push(self._treksgeoJsonLayer);
            }
            return layers;
        }

        function resetViewButtonClick () {
            return self.updateBounds(getLayersToFit());
        }

        function resetViewButtonOnAdd () {
            var container = L.DomUtil.create('div', 'leaflet-control-resetview leaflet-bar');
            var button    = L.DomUtil.create('a',   'leaflet-control-resetview-button', container);
            button.title  = 'Reset view';

            L.DomEvent.disableClickPropagation(button);
            L.DomEvent.on(button, 'click', resetViewButtonClick, self);

            return container;
        }

        L.Control.Resetview = L.Control.extend({
            options: {
                position: 'topright'
            },
            onAdd: resetViewButtonOnAdd
        });

        return this.map.addControl(new L.Control.Resetview());
    };

    this.createLayerSwitch = function () {
        var permanentTileLayersName   = globalSettings.PERMANENT_TILELAYERS_NAME  || 'Default';
        var orthophotoTileLayersName  = globalSettings.ORTHOPHOTO_TILELAYERS_NAME || 'Satellite';
        var permanentTileLayersParam  = {};

        permanentTileLayersParam[permanentTileLayersName]  = this._baseLayers.main;
        permanentTileLayersParam[orthophotoTileLayersName] = this._baseLayers.satellite;

        var layersControl = L.control.layers(
            permanentTileLayersParam,
            this._optionalLayers,
            { position: 'bottomleft' }
        );

        return layersControl.addTo(this.map);
    }

    this.setViewPortFilteringControl = function () {
        L.Control.ViewportFilter = L.Control.extend({
            options: {
                position: 'bottomleft'
            },
            onAdd: function () {
                var controlContainer = L.DomUtil.create('div', 'leaflet-control-viewportfilter');
                var controlInput = L.DomUtil.create('input', 'leaflet-control-viewportfilter-button', controlContainer);
                controlInput.type = 'checkbox';
                controlInput.value = 'viewport-filtering';
                controlInput.checked = globalSettings.FILTER_BY_VIEWPORT_DEFAULT;
                var controlCaption = L.DomUtil.create('span', 'leaflet-control-viewportfilter-caption', controlContainer);
                controlCaption.innerHTML = 'Filter when I move the map';

                L.DomEvent.on(controlInput, 'change', function () {
                    self.filterByViewport = document.querySelector('.leaflet-control-viewportfilter-button').checked;
                    self.resultsVisibility();
                }, this);
                return controlContainer;
            }
        });

        this.ViewportFilterControl = new L.Control.ViewportFilter();
        this.map.addControl(this.ViewportFilterControl);
    };

    this.setMinimap = function () {
        if (globalSettings.ACTIVE_MINIMAP) {
            var miniMapOptions = {
                    toggleDisplay: true,
                    zoomLevelOffset: globalSettings.MINIMAP_OFFSET
                };

            this._miniMap = new L.Control.MiniMap(layersService.getMainLayersGroup(), miniMapOptions).addTo(this.map);
        }
    };

    this.setAttribution = function () {
        this.map.attributionControl.setPrefix(globalSettings.LEAFLET_CONF.ATTRIBUTION);
    };

    this.setPositionMarker = function () {

        // Pulsing marker inspired by
        // http://blog.thematicmapping.org/2014/06/real-time-tracking-with-spot-and-leafet.html
        return {
            radius: 7,
            color: 'black',
            fillColor: '#981d97',
            fillOpacity: 1,
            type: 'circleMarker',
            className: 'leaflet-live-user',
            weight: 2
        };
    };

    this.createServicesToggleControl = function () {

        L.Control.ServicesToggle = L.Control.extend({
            options: {
                position: 'bottomleft',
            },

            onAdd: function (map) {

                this.map = map;

                this._container = L.DomUtil.create('div', 'simple-services-toggle');

                var className = 'toggle-layer services active';

                this.button = L.DomUtil.create('a', className, this._container);
                this.button.title = 'Toggle Services';

                L.DomEvent.disableClickPropagation(this.button);
                L.DomEvent.on(this.button, 'click', function () {
                    this.toggleLayer();
                }, this);

                return this._container;
            },

            toggleLayer: function () {

                if (this.map.hasLayer(self._servicesMarkersLayer)) {
                    this.map.removeLayer(self._servicesMarkersLayer);
                    this.button.classList.remove('active');
                } else {
                    this.map.addLayer(self._servicesMarkersLayer);
                    this.button.classList.add('active');
                }
            }

        });
        self.servicesControl = new L.Control.ServicesToggle();
        self.servicesControl.addTo(this.map);
    };


    // CUSTOM MIXINS //////////////////////////////
    //
    //
    this.initCustomsMixins = function () {
        this.addMapLayersMixin();
        this.topPadding();
    };

    this.addMapLayersMixin = function () {
        var LayerSwitcherMixin = {

            isShowingLayer: function (name) {
                if (this.hasLayer(self._baseLayers[name])) {
                    return true;
                }
                return false;
            },

            switchLayer: function (destLayer) {
                var base;
                for (base in self._baseLayers) {
                    if (this.hasLayer(self._baseLayers[base]) && self._baseLayers[base] !== self._baseLayers[destLayer]) {
                        this.removeLayer(self._baseLayers[base]);
                    }
                }
                this.addLayer(self._baseLayers[destLayer]);
            }
        };

        L.Map.include(LayerSwitcherMixin);
    };

    this.topPadding = function () {
        L.LatLngBounds.prototype.padTop = function (bufferRatio) {
            var sw = this._southWest,
                ne = this._northEast,
                heightBuffer = Math.abs(sw.lat - ne.lat) * bufferRatio;

            return new L.LatLngBounds(
                new L.LatLng(sw.lat, sw.lng),
                new L.LatLng(ne.lat + heightBuffer, ne.lng)
            );

        };
    };



    // MAIN FUNCTIONS AND INIT
    //
    //

    this.invalidateSize = function () {
        self.map.invalidateSize();
    };

    this.createLayer = function () {

        var layer = new L.LayerGroup();

        return layer;

    };

    this.createClusterLayer = function () {

        var clusterLayer = new L.MarkerClusterGroup({
            showCoverageOnHover: false,
            spiderfyDistanceMultiplier: 2,
            iconCreateFunction: function (cluster) {
                return iconsService.getClusterIcon(cluster);
            }
        });

        return clusterLayer;

    };

    this.createPOIsLayer = function () {

        var clusterLayer = new L.MarkerClusterGroup({
            showCoverageOnHover: false,
            disableClusteringAtZoom: globalSettings.LEAFLET_CONF.DEFAULT_MAX_ZOOM,
            iconCreateFunction: function (cluster) {
                return iconsService.getPOIClusterIcon(cluster);
            }
        });

        return clusterLayer;

    };

    this.createNearLayer = function () {

        var clusterLayer = new L.MarkerClusterGroup({
            showCoverageOnHover: false,
            disableClusteringAtZoom: globalSettings.LEAFLET_CONF.DEFAULT_MAX_ZOOM,
            iconCreateFunction: function (cluster) {
                return iconsService.getNearClusterIcon(cluster);
            }
        });

        return clusterLayer;

    };

    this.createChildLayer = function () {

        var clusterLayer = new L.MarkerClusterGroup({
            showCoverageOnHover: false,
            disableClusteringAtZoom: globalSettings.LEAFLET_CONF.DEFAULT_MAX_ZOOM,
            iconCreateFunction: function (cluster) {
                return iconsService.getChildClusterIcon(cluster);
            }
        });

        return clusterLayer;

    };

    this.createGeoJSONLayer = function () {

        var layer = new L.geoJson();

        return layer;
    };

    this.clearAllLayers = function () {
        // Remove all markers so the displayed markers can fit the search results
        self._clustersLayer.clearLayers();
        self._poisMarkersLayer.clearLayers();
        self._nearMarkersLayer.clearLayers();
        self._infosMarkersLayer.clearLayers();
        self._servicesMarkersLayer.clearLayers();

        if (globalSettings.ENABLE_TREKS) {
            self._treksMarkersLayer.clearLayers();
            self._treksgeoJsonLayer.clearLayers();
        }

        if (globalSettings.ENABLE_TOURISTIC_CONTENT || globalSettings.ENABLE_TOURISTIC_EVENTS) {
            self._touristicsMarkersLayer.clearLayers();
        }

    };

    /**
     * Fit bounds of self.map to object on <layers>
     * @param  {Array}  layers
     * @param  {Number} padding
     * @return {Object} Map object
     */
    this.updateBounds = function (layers, padding, fitBounds) {
        if (fitBounds === false) {
            return self.map;
        }

        if (!(layers instanceof Array)) {
            layers = [layers];
        }

        var bounds;

        layers.forEach(function (layer) {
            var currentBounds = layer.getBounds();
            if (bounds && bounds.extend) {
                bounds.extend(currentBounds);
            } else {
                bounds = currentBounds;
            }
        });

        var fitBoundsOptions = {
            padding: !isFinite(padding) ? 0 : Math.abs(padding),
            maxZoom: self.maxZoomFitting,
            animate: false
        };

        if (bounds.isValid()) {
            return self.map.fitBounds(bounds, fitBoundsOptions);
        } else {
            return self.map;
        }
    };

    this.centerOn = function (result) {
        var coords = utilsFactory.getStartPoint(result);
        self.setCenter(coords);
        return self.map;
    };

    this.setCenter = function (coords) {
        self.map.panTo(coords);
        return self.map;
    };


    this.highlightPath = function (element, permanent, detailView) {
        var hoverStyle = {
            className:  'layer-highlight'
        },
        geoElement = {};

        if (!self.treksIconified || detailView) {
            geoElement = L.geoJson(element, {
                style: hoverStyle
            });
            if (!permanent) {
                if (self.geoHover) {
                    self._infosMarkersLayer.removeLayer(self.geoHover);
                }

                self.geoHover = geoElement;
            }

            geoElement.addTo(self._infosMarkersLayer);
            geoElement.bringToBack();
        }

    };

    this.testMarkersVisibility = function (layer) {
        // Construct an empty list to fill with onscreen markers.
        var inBounds = [],
        // Get the map bounds - the top-left and bottom-right locations.
            bounds = self.map.getBounds();

        // For each layer, consider whether it is currently visible by comparing
        // with the current map bounds.
        layer.eachLayer(function (layer) {
            if (layer.options.result) {
                if (layer.options.result.geometry.type !== 'Point' && layer.options.result.geometry.type !== 'MultiPoint' && !self.treksIconified) {
                    if (layer.getBounds && bounds.intersects(layer.getBounds())) {
                        inBounds.push(layer.options.result);
                    }
                } else {
                    if (layer.getLatLng && bounds.contains(layer.getLatLng())) {
                        inBounds.push(layer.options.result);
                    }
                }
            }
        });

        return inBounds;
    };

    this.resultsVisibility = function () {
        var visibleMarkers = self.testMarkersVisibility(self._clustersLayer),
            visibleGeoJson = self.testMarkersVisibility(self._treksgeoJsonLayer);

        var visbleResults = _.union(visibleMarkers, visibleGeoJson);

        _.forEach(self.currentResults, function (currentResult) {
            var selector = '#result-category-' + currentResult.properties.category.id.toString() + '-' + currentResult.id.toString();
            var listResult = document.querySelector(selector);
            if (listResult) {
                if (!self.filterByViewport) {
                    if (listResult.classList.contains('not-in-viewport')) {
                        listResult.classList.remove('not-in-viewport');
                    }
                } else {
                    var isVisibe = false;

                    _.forEach(visbleResults, function (currentActiveResult) {
                        if (currentResult.properties.category.id.toString() === currentActiveResult.properties.category.id.toString() && currentResult.id.toString() === currentActiveResult.id.toString()) {
                            isVisibe = true;
                        }
                    });
                    if (isVisibe) {
                        if (listResult.classList.contains('not-in-viewport')) {
                            listResult.classList.remove('not-in-viewport');
                        }
                    } else {
                        if (!listResult.classList.contains('not-in-viewport')) {
                            listResult.classList.add('not-in-viewport');
                        }
                    }
                }
            }
        });

    };

    this.createElevation = function (result) {
        /*
         * Load altimetric profile from JSON
         */
        var currentLang = translationService.getCurrentLang();
        if (currentLang.code) {
            currentLang = currentLang.code;
        }
        var url = settingsFactory.trekUrl.replace(/\$lang/, currentLang) + result.id + '/' + globalSettings.PROFILE_FILE;
        var requests = $resource(url, {}, {
            query: {
                method: 'GET'
            }
        }, {stripTrailingSlashes: false});

        requests.query().$promise
            .then(function (data) {
                var primaryColor = 'rgba(200, 200, 200, 1)';
                var transparentizedColor = primaryColor.replace(/^(rgb)\((\d{1,3},\s*\d{1,3},\s*\d{1,3})\)$/gm, '$1a($2, 0.8)');

                function updateSparkline() {
                    jQuery('#elevation .detail-content-elevation-canvas').sparkline(data.profile,
                        L.Util.extend(
                            {
                                tooltipSuffix: ' m',
                                numberDigitGroupSep: '',
                                width: '100%',
                                height: 150
                            },
                            {
                                type: 'line',
                                chartRangeMin: data.limits.floor,
                                chartRangeMax: data.limits.ceil,
                                lineWidth: 3,
                                spotColor: 'transparent',
                                minSpotColor: 'transparent',
                                maxSpotColor: 'transparent',
                                fillColor: transparentizedColor,
                                lineColor: primaryColor,
                                highlightSpotColor: 'rgba(0, 0, 0, 0.5)',
                                highlightLineColor: primaryColor
                            }
                        ));
                }

                updateSparkline();

                self.currentElevationPoint = L.marker([0, 0], {
                    icon: L.divIcon({
                        iconSize: [16, 16],
                        iconAnchor: [8, 8],
                        className: 'elevationMarker'
                    })
                });
                self.currentElevationPoint.addTo(self.map);

                jQuery(window).on('resize', function () {
                    updateSparkline();
                });

                jQuery('#elevation').on('sparklineRegionChange', function (ev) {
                    var sparkline = ev.sparklines[0],
                        region = sparkline.getCurrentRegionFields();
                    var currentPoint = data.profile.filter(function testLength(element) {
                        if (element[0] === region.x ) {
                            return element;
                        }
                    });
                    self.currentElevationPoint.setLatLng([currentPoint[0][2][1], currentPoint[0][2][0]]);
                    //value = region.y;
                    var distance = (region.x < 10000) ? Math.round(region.x) + " m" : Math.round(region.x/100)/10 + " km";
                    jQuery('#mouseoverprofil').text(distance);
                    // Trigger global event
                    jQuery('#elevation').trigger('hover:distance', region.x);
                }).on('mouseover', function () {
                    jQuery('.elevationMarker').addClass('active');
                }).on('mouseleave', function () {
                    jQuery('.elevationMarker').removeClass('active');
                    jQuery('#mouseoverprofil').text('');
                    jQuery('#elevation').trigger('hover:distance', null);
                });
            });
    };

    // Add treks geojson to the map
    this.displayResults = function (results, fitBounds) {
        var deferred = $q.defer();
        var counter  = 0;

        this.maxZoomFitting = globalSettings.TREKS_TO_GEOJSON_ZOOM_LEVEL - 1;

        if (!self.loadingMarkers) {
            self.loadingMarkers = true;
            self.currentResults = results;

            this.treksIconified = this.map.getZoom() < globalSettings.TREKS_TO_GEOJSON_ZOOM_LEVEL;
            this.clearAllLayers();

            var promiseArray = [];

            _.forEach(results, function (result) {
                counter++;

                var currentLayer,
                    elementLocation,
                    currentCount = counter,
                    type = '';

                if (result.geometry.type !== "Point" && result.geometry.type !== 'MultiPoint' && !self.treksIconified) {
                    promiseArray.push(
                        self.createLayerFromElement(result, 'geojson', [])
                            .then(
                                function (layer) {
                                    var selector = '#result-category-' + result.properties.category.id + '-' + result.id;
                                    var itself = '.layer-category-' + result.properties.category.id + '-' + result.id;

                                    if (globalSettings.ALWAYS_HIGHLIGHT_TREKS) {
                                        self.highlightPath(result, true);
                                    }

                                    layer.on({
                                        mouseover: function () {
                                            var listeEquivalent = document.querySelector(selector);
                                            var markerEquivalent = document.querySelectorAll(itself);
                                            if (listeEquivalent && !listeEquivalent.classList.contains('hovered')) {
                                                listeEquivalent.classList.add('hovered');
                                            }
                                            _.each(markerEquivalent, function (currentMarker) {
                                                if (currentMarker && !currentMarker.classList.contains('hovered')) {
                                                    currentMarker.classList.add('hovered');
                                                }
                                            });

                                            self.highlightPath(result);
                                        },
                                        mouseout: function () {
                                            var listeEquivalent = document.querySelector(selector);
                                            var markerEquivalent = document.querySelectorAll(itself);
                                            if (listeEquivalent && listeEquivalent.classList.contains('hovered')) {
                                                listeEquivalent.classList.remove('hovered');
                                            }
                                            _.each(markerEquivalent, function (currentMarker) {
                                                if (currentMarker && currentMarker.classList.contains('hovered')) {
                                                    currentMarker.classList.remove('hovered');
                                                }
                                            });
                                            if (self.geoHover) {
                                                self._nearMarkersLayer.removeLayer(self.geoHover);
                                            }
                                        },
                                        remove: function () {
                                            var listeEquivalent = document.querySelector(selector);
                                            var markerEquivalent = document.querySelectorAll(itself);
                                            if (listeEquivalent && listeEquivalent.classList.contains('hovered')) {
                                                listeEquivalent.classList.remove('hovered');
                                            }
                                            _.each(markerEquivalent, function (currentMarker) {
                                                if (currentMarker && currentMarker.classList.contains('hovered')) {
                                                    currentMarker.classList.remove('hovered');
                                                }
                                            });

                                        },
                                        click: function () {
                                            $state.go("layout.detail", { catSlug: result.properties.category.slug, slug: result.properties.slug });
                                        }
                                    });
                                    jQuery(selector).on('mouseenter', function () {
                                        self.highlightPath(result);
                                    });
                                    jQuery(selector).on('mouseleave', function () {
                                        if (self.geoHover) {
                                            self._nearMarkersLayer.removeLayer(self.geoHover);
                                        }
                                    });
                                    self._treksgeoJsonLayer.addLayer(layer);
                                    self._clustersLayer.addLayer(self._treksgeoJsonLayer);
                                }
                            )
                    );
                }

                currentLayer = (result.properties.contentType === 'trek' ? self._treksMarkersLayer : self._touristicsMarkersLayer);
                type = 'category';
                elementLocation = utilsFactory.getStartPoint(result);

                promiseArray.push(
                    self.createLayerFromElement(result, type, elementLocation)
                        .then(
                            function (layer) {
                                var selector = '#result-category-' + result.properties.category.id.toString() + '-' + result.id.toString();

                                _.merge(layer.popupSources, {
                                    selector: '#result-category-' + result.uid
                                });

                                popupService.attachPopups(layer);

                                if (result.geometry.type !== "Point" && result.geometry.type !== "MultiPoint") {
                                    jQuery(selector).on('mouseenter', function () {
                                        self.highlightPath(result);
                                    });
                                    jQuery(selector).on('mouseleave', function () {
                                        if (self.geoHover) {
                                            self._nearMarkersLayer.removeLayer(self.geoHover);
                                        }
                                    });
                                }
                                currentLayer.addLayer(layer);
                                self._clustersLayer.addLayer(currentLayer);

                                if (currentCount === _.size(results)) {
                                    self.map.invalidateSize();

                                    if (fitBounds === true) {
                                        self.updateBounds([self._clustersLayer]);
                                    }

                                    self.resultsVisibility();
                                    self.map.on('moveend', self.resultsVisibility);
                                    self.loadingMarkers = false;
                                }
                            }
                        )
                );

            });

            $q.all(promiseArray).finally(function () {
                deferred.resolve(true);
            });

        } else {
            deferred.resolve(false);
        }

        return deferred.promise;
    };

    this.displayDetail = function (result, fitBounds) {

        var type = '',
            elementLocation,
            currentLayer;

        this.maxZoomFitting = globalSettings.DEFAULT_MAX_ZOOM;

        if (!self.loadingMarkers) {

            self.map.off('moveend', self.resultsVisibility);

            self.loadingMarkers = true;

            this.clearAllLayers();

            this.createElevation(result);

            if (result.geometry.type !== "Point" && result.geometry.type !== "MultiPoint") {
                currentLayer = self._treksgeoJsonLayer;
                type = 'geojson';
                elementLocation = [];
            } else {
                currentLayer = (result.properties.contentType === 'trek' ? self._treksMarkersLayer : self._touristicsMarkersLayer);
                type = 'category';
                elementLocation = utilsFactory.getStartPoint(result);
            }

            self.createLayerFromElement(result, type, elementLocation)
                .then(
                    function (layer) {
                        currentLayer.addLayer(layer);
                        self._clustersLayer.addLayer(currentLayer);
                        if (result.geometry.type !== "Point" && result.geometry.type !== "MultiPoint") {
                            if (globalSettings.ALWAYS_HIGHLIGHT_TREKS) {
                                self.highlightPath(result, true, true);
                            }
                            if (fitBounds !== false) {
                                self.updateBounds(currentLayer);
                            }
                        } else {
                            if (fitBounds !== false) {
                                self.updateBounds(self._clustersLayer);
                            }
                        }
                    }
                );

            self.createPOISFromElement(result)
                .then(
                    function () {
                        self.map.invalidateSize();
                        //self.updateBounds(self._poisMarkersLayer, 0.5);
                        self.loadingMarkers = false;
                    }
                );
        }

    };

    this.initMap = function (mapSelector) {

        var permanentTileLayers = layersService.getMainLayersGroup();

        // Set background Layers
        this._baseLayers = {
            main: permanentTileLayers,
            satellite: L.tileLayer(
                globalSettings.SATELLITE_LEAFLET_BACKGROUND.LAYER_URL,
                globalSettings.SATELLITE_LEAFLET_BACKGROUND.OPTIONS
            )
        };

        this._optionalLayers = layersService.getOptionalLayers();

        var mapParameters = {
            center: [globalSettings.LEAFLET_CONF.CENTER_LATITUDE, globalSettings.LEAFLET_CONF.CENTER_LONGITUDE],
            zoom: globalSettings.LEAFLET_CONF.DEFAULT_ZOOM,
            minZoom: globalSettings.LEAFLET_CONF.DEFAULT_MIN_ZOOM,
            maxZoom: globalSettings.LEAFLET_CONF.DEFAULT_MAX_ZOOM,
            scrollWheelZoom: true,
            layers: permanentTileLayers
        };

        if (globalSettings.MAP_BOUNDS_CONSTRAINTS) {
            mapParameters.maxBounds = new L.latLngBounds(globalSettings.MAP_BOUNDS_CONSTRAINTS);
        }

        this.maxZoomFitting = globalSettings.TREKS_TO_GEOJSON_ZOOM_LEVEL - 1;

        //Mixins for map
        this.initCustomsMixins();
        self.filterByViewport = globalSettings.FILTER_BY_VIEWPORT_DEFAULT;

        this.map = L.map(mapSelector, mapParameters);

        this.map.setActiveArea({
            position: 'absolute',
            top: '68px',
            right: '0',
            bottom: '0',
            left: '0'
        });

        // Set-up maps controls (needs _map to be defined);
        this.initMapControls();

        //Set-up Layers
        this._nearMarkersLayer = self.createNearLayer();
        this._childMarkersLayer = self.createChildLayer();
        this._clustersLayer = self.createClusterLayer();


        if (globalSettings.ENABLE_TREKS) {
            this._treksMarkersLayer = self.createLayer();
            this._treksgeoJsonLayer = self.createGeoJSONLayer();
        }

        if (globalSettings.ENABLE_TOURISTIC_CONTENT || globalSettings.ENABLE_TOURISTIC_EVENTS) {
            this._touristicsMarkersLayer = self.createLayer();
        }

        this._poisMarkersLayer = self.createPOIsLayer();
        this._infosMarkersLayer = self.createLayer();
        this._servicesMarkersLayer = self.createLayer();

        this.map.addLayer(this._clustersLayer);
        this.map.addLayer(this._poisMarkersLayer);
        this.map.addLayer(this._nearMarkersLayer);
        this.map.addLayer(this._childMarkersLayer);
        this.map.addLayer(this._infosMarkersLayer);
        this.map.addLayer(this._servicesMarkersLayer);

        popupService.setMap(this.map);

        return this.map;

    };

}

function iconsService($resource, $q, $http, globalSettings, categoriesService, poisService, servicesService, utilsFactory) {

    var self = this;

    this.icons_liste = {
        default_icon: {},

        departure: _.merge({
            iconUrl: '/images/map/departure.svg',
            iconSize: [46, 52],
            iconAnchor: [23, 52],
            popupAnchor: [0, -52],
            className: 'departure-marker'
        }, globalSettings.DEPARTURE_ICON),
        arrival: _.merge({
            iconUrl: '/images/map/arrival.svg',
            iconSize: [46, 52],
            iconAnchor: [23, 52],
            popupAnchor: [0, -52],
            className: 'arrival-marker'
        }, globalSettings.ARRIVAL_ICON),
        departureArrival: _.merge({
            iconUrl: '/images/map/departure-arrival.svg',
            iconSize: [46, 52],
            iconAnchor: [23, 52],
            popupAnchor: [0, -52],
            className: 'departure-arrival-marker'
        }, globalSettings.DEPARTURE_ARRIVAL_ICON),

        parking: _.merge({
            iconUrl: '/images/map/parking.svg',
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10],
            labelAnchor: [10, 10],
            className: 'parking-marker'
        }, globalSettings.PARKING_ICON),
        information: _.merge({
            iconUrl: '/images/map/info.svg',
            iconSize: [],
            iconAnchor: [],
            popupAnchor: [],
            labelAnchor: [],
            className: ''
        }, globalSettings.INFO_ICON),
        ref_point: {
            iconUrl: '',
            iconSize: [26 ,26],
            iconAnchor: [13, 26],
            popupAnchor: [0, -26],
            labelAnchor: [13, 13],
            className: 'ref-point'
        },
        poi: {
            iconUrl: '',
            iconSize: [],
            iconAnchor: [],
            popupAnchor: [],
            labelAnchor: [],
            className: ''
        },
        service: {
            iconUrl: '',
            iconSize: [],
            iconAnchor: [],
            popupAnchor: [],
            labelAnchor: [],
            className: ''
        },

        category_base: _.merge({
            iconUrl: '/images/map/category_base.svg',
            iconSize: [40, 60],
            iconAnchor: [20, 60],
            popupAnchor: [0, -60],
            labelAnchor: [20, 20]
        }, globalSettings.MARKER_BASE_ICON),
        poi_base: _.merge({
            iconUrl: '/images/map/category_base.svg',
            iconSize: [40, 60],
            iconAnchor: [20, 60],
            popupAnchor: [0, -60],
            labelAnchor: [20, 20]
        }, globalSettings.POI_BASE_ICON),
        service_base: _.merge({
            iconUrl: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15],
            popupAnchor: [0, -15],
            labelAnchor: [15, 15]
        }, globalSettings.SERVICE_BASE_ICON)

    };

    this.getCategoriesIcons = function () {

        var deferred = $q.defer();

        if (self.categoriesIcons) {
            deferred.resolve(self.categoriesIcons);
        } else {

            categoriesService.getCategories()
                .then(
                    function (categories) {
                        var counter = 0;
                        _.forEach(categories, function (category) {
                            if (!self.categoriesIcons) {
                                self.categoriesIcons = {};
                            }
                            counter++;
                            var currentCounter = counter;

                            if (utilsFactory.isSVG(category.pictogram)) {
                                var requests = $resource(category.pictogram, {}, {
                                    query: {
                                        method: 'GET',
                                        cache: true
                                    }
                                });

                                requests.query().$promise
                                    .then(function (icon) {
                                        var finalIcon = '';
                                        _.each(icon, function(el, index) {
                                            if (!isNaN(parseInt(index, 10))) {
                                                finalIcon += el;
                                            }
                                        });
                                        self.categoriesIcons[category.id] = finalIcon;
                                            if (currentCounter === _.size(categories)) {
                                                deferred.resolve(self.categoriesIcons);
                                            }
                                    });
                            } else {
                                self.categoriesIcons[category.id] = '<img src="' + category.pictogram + '" />';
                                if (currentCounter === _.size(categories)) {
                                    deferred.resolve(self.categoriesIcons);
                                }
                            }

                        });
                    }
                );
        }

        return deferred.promise;
    };

    this.getCategoryIcon = function (categoryId) {

        var deferred = $q.defer();

        if (self.categoriesIcons) {
            deferred.resolve(self.categoriesIcons[categoryId]);
        } else {
            self.getCategoriesIcons()
                .then(
                    function (icons) {
                        deferred.resolve(icons[categoryId]);
                    }
                );
        }

        return deferred.promise;
    };

    this.getPoiTypesIcons = function (forceRefresh) {
        var deferred = $q.defer();

        if (self.poisTypesIcons && !forceRefresh) {
            deferred.resolve(self.poisTypesIcons);
        } else {

            poisService.getPois(forceRefresh)
                .then(
                    function (pois) {
                        var counter = 0;
                        _.forEach(pois.features, function (poi) {
                            if (!self.poisTypesIcons) {
                                self.poisTypesIcons = {};
                            }
                            counter++;
                            var currentCounter = counter;
                            if (!utilsFactory.isSVG(poi.properties.type.pictogram)) {
                                self.poisTypesIcons[poi.properties.type.id] = {
                                    markup: poi.properties.type.pictogram,
                                    isSVG: false
                                };
                                if (currentCounter === _.size(pois.features)) {
                                    deferred.resolve(self.poisTypesIcons);
                                }
                            } else {
                                $http.get(poi.properties.type.pictogram)
                                    .success(
                                        function (icon) {
                                            self.poisTypesIcons[poi.properties.type.id] = {
                                                markup: icon.toString(),
                                                isSVG: true
                                            };
                                            if (currentCounter === _.size(pois.features)) {
                                                deferred.resolve(self.poisTypesIcons);
                                            }
                                        }
                                    ).error(
                                        function () {
                                            self.poisTypesIcons[poi.properties.type.id] = {
                                                markup: '',
                                                isSVG: true
                                            };
                                            if (currentCounter === _.size(pois)) {
                                                deferred.resolve(self.poisTypesIcons);
                                            }
                                        }
                                    );
                            }
                        });
                    }
                );
        }

        return deferred.promise;
    };

    this.getAPoiTypeIcon = function (poiTypeId, forceRefresh) {
        var deferred = $q.defer();
        if (self.poisTypesIcons && !forceRefresh) {
            deferred.resolve(self.poisTypesIcons[poiTypeId]);
        } else {
            self.getPoiTypesIcons(forceRefresh)
                .then(
                    function (icons) {
                        deferred.resolve(icons[poiTypeId]);
                    }
                );
        }

        return deferred.promise;
    };

    this.getServiceTypesIcons = function (forceRefresh) {
        var deferred = $q.defer();

        if (self.servicesTypesIcons && !forceRefresh) {
            deferred.resolve(self.servicesTypesIcons);
        } else {

            servicesService.getServices(forceRefresh)
                .then(
                    function (services) {
                        var counter = 0;
                        _.forEach(services.features, function (service) {
                            if (!self.servicesTypesIcons) {
                                self.servicesTypesIcons = {};
                            }
                            counter++;
                            var currentCounter = counter;
                            if (!utilsFactory.isSVG(service.properties.type.pictogram)) {
                                self.servicesTypesIcons[service.properties.type.id] = {
                                    markup: service.properties.type.pictogram,
                                    isSVG: false
                                };
                                if (currentCounter === _.size(services.features)) {
                                    deferred.resolve(self.servicesTypesIcons);
                                }
                            } else {
                                $http.get(service.properties.type.pictogram)
                                    .success(
                                        function (icon) {
                                            self.servicesTypesIcons[service.properties.type.id] = {
                                                markup: icon.toString(),
                                                isSVG: true
                                            };
                                            if (currentCounter === _.size(services.features)) {
                                                deferred.resolve(self.servicesTypesIcons);
                                            }
                                        }
                                    ).error(
                                        function () {
                                            self.servicesTypesIcons[service.properties.type.id] = {
                                                markup: '',
                                                isSVG: true
                                            };
                                            if (currentCounter === _.size(services)) {
                                                deferred.resolve(self.servicesTypesIcons);
                                            }
                                        }
                                    );
                            }
                        });
                    }
                );
        }

        return deferred.promise;
    };

    this.getAServiceTypeIcon = function (serviceTypeId, forceRefresh) {
        var deferred = $q.defer();
        if (self.servicesTypesIcons && !forceRefresh) {
            deferred.resolve(self.servicesTypesIcons[serviceTypeId]);
        } else {
            self.getServiceTypesIcons(forceRefresh)
                .then(
                    function (icons) {
                        deferred.resolve(icons[serviceTypeId]);
                    }
                );
        }

        return deferred.promise;
    };

    this.getMarkerIcon = function () {
        var deferred = $q.defer();

        if (self.markerIcon) {
            deferred.resolve(self.markerIcon);
        } else {
            self.getSVGIcon(self.icons_liste.category_base.iconUrl)
                .then(
                    function (iconMarkup) {
                        self.markerIcon = iconMarkup;
                        deferred.resolve(iconMarkup);
                    }
                );
        }

        return deferred.promise;
    };

    this.getSVGIcon = function (url, iconName) {
        var deferred = $q.defer();

        if (self.icons_liste[iconName].markup) {
            deferred.resolve(self.icons_liste[iconName].markup);
        } else {
            var requests = $resource(url, {}, {
                query: {
                    method: 'GET',
                    cache: true
                }
            });

            requests.query().$promise
                .then(function (icon) {
                    var finalIcon = '';
                    _.each(icon, function(el, index) {
                        if (!isNaN(parseInt(index, 10))) {
                            finalIcon += el;
                        }
                    });
                    self.icons_liste[iconName].markup = finalIcon;
                    deferred.resolve(finalIcon);
                });
        }

        return deferred.promise;
    };

    this.getClusterIcon = function (cluster) {
        return new L.DivIcon({
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -40],
            className: 'element-cluster',
            html: '<div class="marker"><span class="count">' + cluster.getChildCount() + '</span></div>'
        });
    };

    this.getNearClusterIcon = function (cluster) {
        return new L.DivIcon({
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -40],
            className: 'near-cluster',
            html: '<div class="marker"><span class="count">' + cluster.getChildCount() + '</span></div>'
        });
    };

    this.getChildClusterIcon = function (cluster) {
        return new L.DivIcon({
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            popupAnchor: [0, -40],
            className: 'children-cluster',
            html: '<div class="marker"><span class="count">' + cluster.getChildCount() + '</span></div>'
        });
    };

    this.getPOIClusterIcon = function (cluster) {
        var children = cluster.getAllChildMarkers(),
            iconsMarkup = '',
            i = 0,
            icons = {ICON0: '', ICON1: '', ICON2: '', ICON3: ''},
            template = '' +
                '<div class="icon-group">' +
                    '<div class="icon">{ICON0}</div>' +
                    '<div class="icon">{ICON1}</div>' +
                    '<div class="icon">{ICON2}</div>' +
                    '<div class="icon">{ICON3}</div>' +
                '</div>';

        for (i = 0; i < Math.min(children.length, 4); i++) {
            if (children[i].options.result && children[i].options.result.properties.type) {
                icons['ICON'+i] = '<img src="' + children[i].options.result.properties.type.pictogram + '"/>';
            }
        }
        iconsMarkup = L.Util.template(template, icons);

        return new L.DivIcon({
            iconSize: [40, 40],
            iconAnchor: [20, 40],
            popupAnchor: [0, -40],
            className: 'poi-cluster',
            html: iconsMarkup
        });
    };

    this.getRefIcon = function (refElement) {
        var deferred = $q.defer();

        var markup = '<span>' + refElement.order + '</span>';

        var newIcon = new L.divIcon(_.merge({}, self.icons_liste.ref_point, {
            html: markup,
            className: self.icons_liste.ref_point.className + ' ' + self.icons_liste.ref_point.className + '-' + refElement.order
        }));
        deferred.resolve(newIcon);

        return deferred.promise;
    };

    this.getIcon = function (iconName) {
        var deferred = $q.defer();

        if (!iconName || !self.icons_liste[iconName]) {
            deferred.reject('icon doesn\'t exist');
        } else {
            if (self[iconName]) {
                deferred.resolve(self[iconName]);
            } else {
                if (!utilsFactory.isSVG(self.icons_liste[iconName].iconUrl)) {
                    self[iconName] = new L.divIcon(_.merge({}, self.icons_liste[iconName], {
                        html: self.icons_liste[iconName].iconUrl
                    }));
                    deferred.resolve(self[iconName]);
                } else {
                    self.getSVGIcon(self.icons_liste[iconName].iconUrl, iconName)
                        .then(
                            function (iconMarkup) {

                                self[iconName] = new L.divIcon(_.merge({}, self.icons_liste[iconName], {
                                    html: iconMarkup
                                }));
                                deferred.resolve(self[iconName]);
                            }
                        );
                }
            }
        }

        return deferred.promise;
    };

    this.getPOIIcon = function (poi) {
        var deferred = $q.defer(),
            baseIcon = null,
            poiIcon = null,
            promises = [];

        if (self.icons_liste.poi_base.iconUrl) {
            promises.push(
                self.getSVGIcon(self.icons_liste.poi_base.iconUrl, 'poi_base')
                    .then(
                        function (icon) {
                            baseIcon = icon;
                        }
                    )
            );
        }

        promises.push(
            self.getAPoiTypeIcon(poi.properties.type.id, false)
                .then(
                    function (icon) {
                        if (icon.isSVG) {
                            poiIcon = icon.markup;
                        } else {
                            poiIcon = '<img src="' + icon.markup + '" alt=""';
                        }
                    }
                )
        );

        $q.all(promises)
            .then(
                function () {
                    var markup;

                    if (baseIcon) {
                        markup = '' +
                            '<div class="marker" data-popup="' + poi.properties.name + '">' +
                                baseIcon +
                            '</div>' +
                            '<div class="icon">' + poiIcon + '</div>';
                    } else {
                       markup = '' +
                            '<div class="marker" data-popup="' + poi.properties.name + '">' +
                                '<div class="icon">' + poiIcon + '</div>' +
                            '</div>';
                    }

                    var newIcon = new L.divIcon(_.merge({}, self.icons_liste.poi_base, {
                        html: markup,
                        className: 'double-marker popup poi layer-' + poi.properties.type.id + '-' + poi.id + ' category-' + poi.properties.type.id
                    }));
                    deferred.resolve(newIcon);
                }
            );

        return deferred.promise;

    };

    this.getServiceIcon = function (service) {
        var deferred = $q.defer(),
            baseIcon = null,
            serviceIcon = null,
            promises = [];

        if (self.icons_liste.service_base.iconUrl) {
            promises.push(
                self.getSVGIcon(self.icons_liste.service_base.iconUrl, 'service_base')
                    .then(
                        function (icon) {
                            baseIcon = icon;
                        }
                    )
            );
        }

        promises.push(
            self.getAServiceTypeIcon(service.properties.type.id, false)
                .then(
                    function (icon) {
                        if (icon.isSVG) {
                            serviceIcon = icon.markup;
                        } else {
                            serviceIcon = '<img src="' + icon.markup + '" alt=""';
                        }
                    }
                )
        );

        $q.all(promises)
            .then(
                function () {
                    var markup;

                    if (baseIcon) {
                        markup = '' +
                            '<div class="marker" data-popup="' + service.properties.type.name + '">' +
                                baseIcon +
                            '</div>' +
                            '<div class="icon">' + serviceIcon + '</div>';
                    } else {
                       markup = '' +
                            '<div class="marker" data-popup="' + service.properties.type.name + '">' +
                                '<div class="icon">' + serviceIcon + '</div>' +
                            '</div>';
                    }

                    var newIcon = new L.divIcon(_.merge({}, self.icons_liste.service_base, {
                        html: markup,
                        className: 'double-marker popup service layer-' + service.properties.type.id + '-' + service.id
                    }));
                    deferred.resolve(newIcon);
                }
            );

        return deferred.promise;

    };

    this.getWarningIcon = function () {
        var deferred = $q.defer();

        self.getSVGIcon(self.icons_liste.poi_base.iconUrl, 'category_base')
            .then(function (icon) {
                var markup = '' +
                    '<div class="marker">' +
                        icon +
                    '</div>' +
                    '<div class="icon"><i class="fa fa-exclamation-circle"></i></div>';

                var warningIcon = new L.DivIcon(_.merge({}, self.icons_liste.poi_base, {
                    html: markup,
                    className: 'double-marker warning-marker'
                }));

                deferred.resolve(warningIcon);
            });

        return deferred.promise;
    };

    this.getElementIcon = function (element) {

        var deferred = $q.defer(),
            markerIcon,
            categoryIcon,
            promises = [];

        if (utilsFactory.isSVG(self.icons_liste.category_base.iconUrl)) {
            promises.push(
                self.getSVGIcon(self.icons_liste.category_base.iconUrl, 'category_base')
                    .then(
                        function (icon) {
                            markerIcon = icon;
                        }
                    )
            );
        } else {
            markerIcon = '<img src="' + self.icons_liste.category_base.iconUrl + '"/>';
        }

        promises.push(
            self.getCategoryIcon(element.properties.category.id)
                .then(
                    function (icon) {
                        categoryIcon = icon;
                    }
                )
        );

        $q.all(promises).then(
            function () {

                var markup = '' +
                    '<div class="marker" data-popup="' + element.properties.name + '">' +
                        markerIcon +
                    '</div>' +
                    '<div class="icon">' + categoryIcon + '</div>';

                var newIcon = new L.divIcon(_.merge({}, self.icons_liste.category_base, {
                    html: markup,
                    className: 'double-marker popup layer-category-' + element.properties.category.id + '-' + element.id + ' category-' + element.properties.category.id
                }));
                deferred.resolve(newIcon);
            }
        );

        return deferred.promise;

    };

}

function boundsService() {
    this.bounds = {};

    this.setBounds = function (latLngBounds, context) {
        this.bounds[context] = latLngBounds;
        return this.getBounds(context);
    };

    this.getBounds = function (context) {
        if (context) {
            return this.bounds[context];
        } else {
            return this.bounds;
        }
    };

}

function popupService() {

    var _map;

    var _setMap = function _setMap (map) {
        _map = map;

        _map.on('unload', _unlockPopup);
        return this;
    }

    this.setMap = _setMap;

    var _infoOpen = false; // Lock to allow only one popup opened at a time

    var _lockPopup = function _lockPopup () {
        _infoOpen = true;
    }

    var _unlockPopup = function _unlockPopup () {
        _infoOpen = false;
    }

    var _isPopupLocked = function _isPopupLocked () {
        return _infoOpen;
    }

    var _getInfoContent = function _getInfoContent () {
        /**
         * Get info content from marker object
         */
        if (this.popupSources) {
            if (this.popupSources.info) {
                return this.popupSources.info;
            }
            if (this.popupSources.selector) {
                return document.querySelector(this.popupSources.selector).outerHTML;
            }
        }

        return null;
    }

    var _getHintContent = function _getHintContent () {
        /**
         * New way : get hint content from marker object
         */
        if (this.popupSources && this.popupSources.hint) {
            return this.popupSources.hint;
        }

        /**
         * Fallback (old way) : get hint content form .marker[data-popup]
         */
        var m;
        var dataPopup;
        var markerDom = this._icon;

        if (markerDom instanceof HTMLElement) {
            m = markerDom.querySelector('.marker')
            if (m) {
                return m.getAttribute('data-popup');
            }
        }

        return null;
    };

    var _getContentMethod = {
        hint: _getHintContent,
        info: _getInfoContent
    };

    var _getPopup = function _getPopup (type) {
        if (!this.popupStore) return false;

        var popup = this.popupStore[type];
        if (!popup) return false;

        var content = popup.getContent();
        if (content) return popup; // If popupContent exists: popup is already defined

        content = _getContentMethod[type].call(this);

        if (content) {
            this.popupStore[type].setContent(content);
        }

        return content ? this.popupStore[type] : false;
    }

    var _buildPopupStore = function _buildPopupStore () {
        return _.merge({}, {
            info: L.popup({
                className: 'geotrek-info-popup',
                closeButton: true,
                autoPan: true
            }),
            hint: L.popup({
                className: 'geotrek-hint-popup',
                closeButton: false,
                autoPan: false
            })
        });
    }

    var _doScroll = function _doScroll (eventType) {
        var $ = jQuery;

        if (!$ || !this.popupSources || !this.popupSources.scroll) { // Test if all needed params exist
            return false;
        }

        if (this.popupSources.scroll.event !== eventType) { // Do we need to scroll for current eventType
            return false;
        }

        var $target = $(this.popupSources.scroll.target);

        if (!$target.length) { // Does scroll target exists
            return false;
        }

        var $container = $target.closest(this.popupSources.scroll.container);

        if (!$container.length) { // If there is no container found, use direct parent element
            $container = $target.parent();
        }

        $container.scrollTo($target, 200);

        return true;
    };

    var _attachPopups = function _attachPopups (marker) {

        marker.popupStore = _buildPopupStore();

        marker.on({
            click: function (e) {
                _doScroll.call(this, e.type);

                var popup = _getPopup.call(this, 'info');

                if (!popup) return this;

                this.unbindPopup().bindPopup(popup);
                this.openPopup();

                _lockPopup(); // Disallow opening hintPopup while an infoPopup is open

                return this;
            },

            mouseover: function (e) {
                if (_isPopupLocked()) {
                    return this;
                }

                _doScroll.call(this, e.type);

                var currentPopup = this.getPopup();
                if (currentPopup && currentPopup._isOpen) {
                    return this;
                }

                var popup = _getPopup.call(this, 'hint');

                if (popup && !popup._isOpen) {
                    this.unbindPopup().bindPopup(popup);
                    this.openPopup();
                }

                return this;
            },

            mouseout: function () {
                var popup = this.getPopup();

                if (popup && popup.options && !popup.options.closeButton) {
                    this.closePopup();
                }

                return this;
            },

            popupclose: function () {
                if (_isPopupLocked()) {
                    _unlockPopup(); // Re-allow opening hintPopup
                }

                return this;
            }
        });

        return marker;

    }

    this.attachPopups = _attachPopups; // Publish method
}

function layersService (globalSettings) {

    /**
     * Return PERMANENT_TILELAYERS
     *     or MAIN_LEAFLET_BACKGROUND
     *     or OPTIONAL_LEAFLET_BACKGROUNDS
     *     or MAIN_LEAFLET_BACKGROUND + OPTIONAL_LEAFLET_BACKGROUNDS
     */
    var _getMainLayersConf = function _getMainLayersConf () {
        if (globalSettings.OPTIONAL_LEAFLET_BACKGROUNDS instanceof Array) {
            if (typeof globalSettings.MAIN_LEAFLET_BACKGROUND === 'object') {
                return [globalSettings.MAIN_LEAFLET_BACKGROUND].concat(globalSettings.OPTIONAL_LEAFLET_BACKGROUNDS);
            } else {
                return globalSettings.OPTIONAL_LEAFLET_BACKGROUNDS;
            }
        } else if (typeof globalSettings.MAIN_LEAFLET_BACKGROUND === 'object') {
            return [globalSettings.MAIN_LEAFLET_BACKGROUND];
        }

        if (globalSettings.PERMANENT_TILELAYERS) {
            return globalSettings.PERMANENT_TILELAYERS;
        }

        return false;
    };

    var _getOptionalLayersConf = function _getOptionalLayersConf () {
        if (globalSettings.OPTIONAL_TILELAYERS) {
            return globalSettings.OPTIONAL_TILELAYERS;
        }

        return false;
    };

    var _getMainLayersGroup = function _getMainLayersGroup () {
        var layersConf = _getMainLayersConf();

        if (!layersConf) return false;

        var LGroup = L.layerGroup();
        layersConf.forEach(function (layerConf) {
            var layer, layerOptions;
            if (typeof layerConf === 'string') {
                layer = L.tileLayer(layerConf);
            } else if (layerConf.LAYER_URL) {
                layerOptions = layerConf.OPTIONS || {};
                layer        = L.tileLayer(layerConf.LAYER_URL, layerOptions);
            }

            LGroup.addLayer(layer);
        });

        return LGroup;
    };

    var _getOptionalLayers = function _getOptionalLayers () {
        var layersConf  = _getOptionalLayersConf();
        var defaultName = globalSettings.OPTIONAL_TILELAYERS_NAME || 'Layer';

        if (!layersConf) return false;

        var layers = {};

        layersConf.forEach(function (layerConf, index) {
            var layerName, layerOptions;

            if (typeof layerConf === 'string') {
                layers[[defaultName, index + 1].join(' ')] = L.tileLayer(layerConf);
            } else if (layerConf.LAYER_URL) {
                layerName         = layerConf.LAYER_NAME || [defaultName, index + 1].join(' ');
                layerOptions      = layerConf.OPTIONS || {};
                layers[layerName] = L.tileLayer(layerConf.LAYER_URL, layerOptions);
            }
        });

        return layers;
    }

    this.getMainLayersGroup = _getMainLayersGroup;
    this.getOptionalLayers  = _getOptionalLayers;
}

module.exports = {
    mapService: mapService,
    iconsService: iconsService,
    boundsService: boundsService,
    popupService: popupService,
    layersService: layersService
};
