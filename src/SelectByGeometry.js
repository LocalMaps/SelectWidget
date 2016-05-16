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
    'jimu/CustomUtils/MiscUtil',
    'dojo/text!./templates/SelectByGeometry.html'
],
function (declare, lang, array, on, aspect, topic, Deferred, domQuery, domAttr, domStyle, domClass, domConstruct, mouse, all, Draw, Graphic, BaseWidget,DrawBox,Message,_TemplatedMixin, _WidgetsInTemplateMixin, ContentPane,
    Memory, Select, NumberSpinner, MapUtil, MiscUtil,template
    ) {
    return declare([BaseWidget, _WidgetsInTemplateMixin, _TemplatedMixin], {
        templateString: template,
        baseClass: 'jimu-widget-select-by-geom',
        widgetsInTemplate: true,
        _toolbar: null,
        _activeToolConst: null,
        _toolLayerSymbology: {
            "fillColour": "#ff0000",
            "fillTransparency": 100,
            "pointSize": 10
        },
        postCreate: function () {
            this.inherited(arguments);
            this._setTitle();
            //this.drawBox.setMap(this.map);
            this._renderToolbar();
            this._attachHoverHandlers();
            this._attachClickHandlers();
        },
        startup:function(){
            this.inherited(arguments);
            this._attachSourceLayerListChangeHandler();
            this._setValidatorForSourceLayerList();
            this._populateRelationList();
            this._populateBufferUnits();
        },
        _setTitle:function(){
            this.title = this.nls.selectByGeometry;
        },
        _renderToolbar:function(){
            this._toolbar = new Draw(this.map);
            this._toolbar.on("draw-end",lang.hitch(this, function (evt) {
                this.addToolGraphic([evt]);
            }));
        },
        addToolGraphic:function(evtArray){
            var results = [];
            array.forEach(evtArray, lang.hitch(this, function (e) {
                var feature = new Graphic(e.geometry);
                results.push({
                    features: [feature],
                    geometryType: e.geometry.type
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
        setSourceLayersFS: function (cache) {
            this._cache = cache;
            var layerData = [];
            if (this._cache.length > 0) {
                layerData = array.map(array.filter(this._cache, function (cacheItem) {
                    return !(cacheItem.excludedFromQuery)
                }), function (item) {
                    return { name: item.name, id: item.uniqueId };
                });
                if (layerData.length > 0) {
                    layerData = MiscUtil.alphaNumericSort(layerData, 'name');
                    layerData.unshift({ name: this.nls.allVisibleLayers, id: "all" });
                } else {
                    layerData.push({ name: this.nls.noVisibleLayersFound, id: "*" });
                }
                
            } else {
                layerData.push({ name: this.nls.noVisibleLayersFound, id: "*" });
            }
            var layerStore = new Memory({
                data: layerData
            });
            this.sourceLayerList.set("store", layerStore);
            var selectedCacheItem = array.filter(this._cache, lang.hitch(this, function (cacheItem) {
                if (this.sourceLayerList.item) {
                    return cacheItem.name === this.sourceLayerList.item.name;
                }
            }));
            if (!this.sourceLayerList.get("value") || selectedCacheItem.length == 0 ) {
                if (cache.length > 0) {
                    this.sourceLayerList.set("value", layerData[0].id);
                }
            }
            if (cache.length == 0) {
                this.sourceLayerList.reset();
            }
            
        },
        //for normal dijit select
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
            this.clearToolLayer();
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
        }
        
    });
});