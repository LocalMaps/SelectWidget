define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/aspect',
    'dojo/topic',
    'dojo/Deferred',
    "dojo/query",
    "dojo/dom-attr",
    "dojo/dom-style",
    "dojo/dom-class",
    'dojo/dom-construct',
    "dojo/mouse",
    'dojo/promise/all',
    "esri/toolbars/draw",
    'esri/graphic',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/geometry/Polygon',
    'jimu/BaseWidget',
    'jimu/dijit/DrawBox',
    'jimu/dijit/Message',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/layout/ContentPane',
    "dojo/store/Memory",
    'dijit/form/Select',
    'dijit/form/NumberSpinner',
    'jimu/CustomUtils/MapUtil',
     "jimu/CustomUtils/QueryUtil",
     'jimu/CustomUtils/MiscUtil',
    'dojo/text!./templates/SelectByFeature.html'
],
function (declare, lang, array, on, aspect, topic, Deferred, domQuery, domAttr, domStyle, domClass, domConstruct, mouse, all, Draw, Graphic,Point,Polyline,Polygon, BaseWidget,DrawBox,Message,_TemplatedMixin, _WidgetsInTemplateMixin, ContentPane,
    Memory, Select, NumberSpinner, MapUtil, QueryUtil, MiscUtil,template
    ) {
    return declare([BaseWidget, _WidgetsInTemplateMixin, _TemplatedMixin], {
        templateString: template,
        baseClass: 'jimu-widget-select-by-feat',
        widgetsInTemplate: true,
        _toolbar: null,
        _activeToolConst: null,
        _toolLayerSymbology: {
            "fillColour": "#ff0000",
            "fillTransparency": 100,
            "pointSize":10
        },
        postCreate: function () {
            this.inherited(arguments);
            this._setTitle();
            ////this.drawBox.setMap(this.map);
            this._renderToolbar();
            this._attachHoverHandlers();
            this._attachClickHandlers();
        },
        startup:function(){
            this.inherited(arguments);
            this._attachSourceLayerListChangeHandler();
            this._setValidatorForSourceLayerList();
            this._setValidatorForTargetLayerList();
            this._populateRelationList();
            this._populateBufferUnits();
        },
        _setTitle:function(){
            this.title = this.nls.selectByFeature;
        },
        _renderToolbar:function(){
            this._toolbar = new Draw(this.map);
            this._toolbar._setTooltipMessage = function () { };//disable automatic reset to default tooltip after drawing
            this._toolbar.on("draw-end", lang.hitch(this, function (evt) {
                this._selectAndRetrieveFeature(evt).then(lang.hitch(this, (function (response) {
                    if (response.features.length > 0) {
                        var evt = {
                            geometry: response.features[0].geometry,
                            geometryType: response.geometryType,
                            spatialReference:response.spatialReference
                        }
                        this.addToolGraphic([evt]);
                    }
                    this.resetTools();
                })));
            }));
        },
        addToolGraphic:function(evtArray){
            var results = [];
            array.forEach(evtArray, lang.hitch(this, function (e) {
                var geometry;
                if (e.geometryType) {
                    if (e.geometryType === 'esriGeometryPolygon') {
                        if (!(e.geometry instanceof Polygon)) {
                            geometry = new Polygon({ "rings": e.geometry.rings, "spatialReference": e.spatialReference });
                        } else {
                            geometry = lang.clone(e.geometry);
                        }
                    } else if (e.geometryType === 'esriGeometryPolyline') {
                        if (!(e.geometry instanceof Polyline)) {
                            geometry = new Polyline({ "paths": e.geometry.paths, "spatialReference": e.spatialReference });
                        } else {
                            geometry = lang.clone(e.geometry);
                        }
                    } else if (e.geometryType === 'esriGeometryPoint') {
                        if (!(e.geometry instanceof Point)) {
                            geometry = new Point({ "x": e.geometry.x, "y": e.geometry.y, "spatialReference": e.spatialReference });
                        } else {
                            geometry = lang.clone(e.geometry);
                        }
                    }
                } else {
                    geometry = e.geometry;
                } 
                var feature = new Graphic(geometry);
                results.push({
                    features: [feature],
                    geometryType: geometry.type
                })
            }));
            MapUtil.addSelectToolFeaturesToMap(this.map, results, this._toolLayerSymbology, true);
        },
        clearToolLayer:function(){
            MapUtil.clearSelectToolLayerFromMap(this.map);
        },
        _attachHoverHandlers:function(){
            var tools = domQuery("div.geom-tool", this.geometryContainer.domNode);
            array.forEach(tools, function (tool) {
                on(tool, mouse.enter, function () {
                    if (domClass.contains(tool, "inactive")) {
                        domClass.add(tool, "hover");
                    }
                });
                on(tool, mouse.leave, function () {
                    if (domClass.contains(tool, "hover")) {
                        domClass.remove(tool, "hover");
                    }
                });
            });
        },
        _attachClickHandlers:function(){
            var tools = domQuery("div.geom-tool", this.geometryContainer.domNode);
            array.forEach(tools,lang.hitch(this,function (tool) {
                on(tool, 'click',lang.hitch(this,function () {
                    this._toggleTool(tool);
                }));
            }));
        },
        _attachSourceLayerListChangeHandler: function () {
            aspect.after(this.sourceLayerList, "onChange", lang.hitch(this, function () {
                var value = this.sourceLayerList.get("value");
                if (value === '*' || !value) {
                    this._showFieldValidationError();
                }
            }));
        },
        _setValidatorForSourceLayerList: function () {
            this.sourceLayerList.validator = function () {
                if (!this.value) {
                    return false;
                }
                return true;
            }
        },
        _setValidatorForTargetLayerList: function () {
            this.targetLayerList.validator = function () {
                if (!this.value) {
                    return false;
                }
                return true;
            }
        },
        setSourceLayers: function (cache) {
            this._cache = cache;
            var layerData = [];
            if (this._cache.length > 0) {
                layerData = array.map(array.filter(this._cache, function (cacheItem) {
                    return !(cacheItem.excludedFromQuery)
                }), function (item) {
                    return { label: item.name, value: item.uniqueId };
                });
                if (layerData.length > 0) {
                    layerData = MiscUtil.alphaNumericSort(layerData, 'label');
                    layerData.unshift({ label: this.nls.allVisibleLayers, value: "all" });
                } else {
                    layerData.push({ label: this.nls.noVisibleLayersFound, value: "", disabled: true, selected: false });
                }
                
            } else {
                layerData.push({ label: this.nls.noVisibleLayersFound, value: "", disabled: true, selected: false });
            }
            var selectedCacheItem = array.filter(this._cache, lang.hitch(this, function (cacheItem) {
                var value = this.sourceLayerList.get("value");
                if (value) {
                    var option = this._getOption(value)
                    return cacheItem.name === option.label;
                }
            }));
            this.sourceLayerList.set("options", []);
            this.sourceLayerList.addOption(layerData);

            if (selectedCacheItem.length == 0) {
                this.sourceLayerList.set("value", layerData[0].value);
            } else {
                this.sourceLayerList.set("value", selectedCacheItem[0].uniqueId);
            }
            this.sourceLayerList.onChange();

        },
        setTargetLayers: function (cache) {
            this._cache = cache;
            var layerData = [];
            if (this._cache.length > 0) {
                layerData = array.map(array.filter(this._cache, function (cacheItem) {
                    return !(cacheItem.excludedFromQuery)
                }), function (item) {
                    return { label: item.name, value: item.uniqueId };
                });
                if (layerData.length > 0) {
                    layerData = MiscUtil.alphaNumericSort(layerData, 'label');
                } else {
                    layerData.push({ label: this.nls.noVisibleLayersFound, value: "", disabled: true, selected: false });
                }
            } else {
                layerData.push({ label: this.nls.noVisibleLayersFound, value: "", disabled: true, selected: false });
            }
            var selectedCacheItem = array.filter(this._cache, lang.hitch(this, function (cacheItem) {
                var value = this.targetLayerList.get("value");
                if (value) {
                    var option = this._getOption(value)
                    return cacheItem.name === option.label;
                }
            }));
            this.targetLayerList.set("options", []);
            this.targetLayerList.addOption(layerData);

            if (selectedCacheItem.length == 0) {
                var defaultTargetLayerData = this._getDefaultTargetLayer(layerData);
                this.targetLayerList.set("value", defaultTargetLayerData.value);
            } else {
                this.targetLayerList.set("value", selectedCacheItem[0].uniqueId);
            }
            this.targetLayerList.onChange();

        },
        _getDefaultTargetLayer:function(layerData){
            var defaultTargetLayer = this.config.targetLayerForSelectByFeature ? lang.trim(this.config.targetLayerForSelectByFeature) : "";
            var defaultTarget = layerData[0];
            var defaultLayerCache;
            if (defaultTargetLayer) {
                if (new RegExp("http").test(defaultTargetLayer)) {
                    //this is a service url
                    defaultLayerCache = array.filter(this._cache, function (cache) {
                        return (cache.serviceUrl + "/" + cache.serviceLayerIntId) === defaultTargetLayer;
                    })[0];
                    
                } else {
                    //layer name
                    defaultLayerCache = array.filter(this._cache, function (cache) {
                        return cache.name === defaultTargetLayer;
                    })[0];
                }
                if (defaultLayerCache) {
                    var uniqueId = defaultLayerCache.uniqueId;
                    var targetLayerData = array.filter(layerData, function (data) {
                        return uniqueId === data.value;
                    })[0];
                    if (targetLayerData) defaultTarget = targetLayerData;
                }
            } 
            return defaultTarget;
        },
        _populateRelationList: function () {
            var relTypes = array.map(this.config.relationTypes, function (rel) {
                return { label: rel.name, value: rel.id }
            });
            this.relationList.addOption(relTypes);
            this.relationList.set("value", relTypes[0].value);
           
        },
        _populateBufferUnits:function(){
            var options = array.map(array.filter(this.config.distanceUnits, function (unit) {
                return unit.enabled;
            }), function (item,index) {
                return { label: item.label, value: item.unit };
            });
            this.bufferUnitSelect.set("options", options);
            this.bufferUnitSelect.set("value", options[0].value);
        },
        _toggleTool: function (tool) {
            if (domClass.contains(tool,"active")) {
                this._deactivateTool(tool);
            } else if (domClass.contains(tool, "inactive")) {
                var tools = domQuery("div.geom-tool", this.geometryContainer.domNode);
                array.forEach(tools, lang.hitch(this, function (tl) {
                    if (domClass.contains(tl, "active")) {
                        this._deactivateTool(tl);
                    }
                }));
                this._activateTool(tool);
            }
        },
        resetTools: function () {
            var tools = domQuery("div.geom-tool", this.geometryContainer.domNode);
            array.forEach(tools, lang.hitch(this, function (tool) {
                this._deactivateTool(tool);
            }));
        },
        _setActiveToolConst:function(esriConst){
            this._activeToolConst = esriConst;
        },
        _resetActiveToolConst: function () {
            this._activeToolConst = null;
        },
        _activateTool:function(tool){
            if (domClass.contains(tool,"inactive")) {
                domClass.remove(tool,"inactive");
            }
            if (domClass.contains(tool,"hover")) {
                domClass.remove(tool,"hover");
            }
            domClass.add(tool, "active");
            var esriConst = domAttr.get(tool, "data-geotype");
            this._setActiveToolConst(esriConst);
            this._toolbar.activate(eval("Draw." + esriConst));
            this.map.setMapCursor("crosshair");
            this._toolbar._tooltip.innerHTML = this.nls.selectByFeatureToolTip;
            
        },
        _deactivateTool:function(tool){
            if (domClass.contains(tool,"active")) {
                domClass.remove(tool,"active");
            }
            if (domClass.contains(tool,"hover")) {
                domClass.remove(tool,"hover");
            }
            domClass.add(tool, "inactive");
            var esriConst = domAttr.get(tool, "data-geotype");
            if (esriConst === this._activeToolConst) {
                this._resetActiveToolConst();
            }
            this._toolbar.deactivate();
            //this.clearToolLayer();
            this.map.setMapCursor("default");
        },
        _showMessage: function (msg) {
            var popup = new Message({
                message: msg,
                buttons: [{
                    label: "OK",
                    onClick: lang.hitch(this, function () {
                        popup.close();
                    })
                }]
            });
        },
        _showFieldValidationError:function(){
            this.sourceLayerList._hasBeenBlurred = true;
            this.sourceLayerList.validate();
            this.sourceLayerList.focus();
        },
        validateQueryParams:function(){
            var isValidQuery = true;
            if (!this.sourceLayerList.get('value')) {
                isValidQuery = false;
                this._showFieldValidationError();
            }
            var queryGraphics = MapUtil.fetchToolLayerFeatures(this.map);
            if (!queryGraphics || (queryGraphics && queryGraphics.length == 0)) {
                isValidQuery = false;
                this._showMessage(this.nls.createGeometryMsg);
            }
            if(!this.config.geometryServiceUrl){
                this._showMessage(this.nls.noGeomServiceMsg);
            }
            return isValidQuery;
        },
        fetchQueryParams:function(){
            return {
                querySourceLayers: this.sourceLayerList.get("value"),
                inputFeatures: MapUtil.fetchToolLayerFeatures(this.map),
                relationType: this.relationList.get("value"),
                bufferValue: this.bufferDistanceSelect.get("value"),
                bufferUnit: this.bufferUnitSelect.get("value"),
                geometryService: this.config.geometryServiceUrl
            }
        },
        destroy: function () {
            this.resetTools(this.map);
            this.inherited(arguments);
        },
        _getOption: function (value) {
            return array.filter(this.sourceLayerList.options, function (option) {
                return option.value === value;
            })[0];
        },
        _selectAndRetrieveFeature: function (evt) {
            var deferred = new Deferred();
            var targetLayerUniqueId = this.targetLayerList.get("value");
            var selectedCacheItem = array.filter(this._cache, lang.hitch(this, function (cacheItem) {
                return cacheItem.uniqueId === targetLayerUniqueId;
            }))[0];
            var pointGeom = evt.geometry;
            var extentGeom = MapUtil.pointToExtent(pointGeom,this.map);
            if (selectedCacheItem) {
                QueryUtil.executeQuery({
                    serviceUrl: selectedCacheItem.serviceUrl + "/" + selectedCacheItem.serviceLayerIntId,
                    geometry: extentGeom,
                    map: this.map
                }).then(function (res) {
                    deferred.resolve(res);
                });
            }
            return deferred.promise;
            
        }
    });
});