define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/topic',
    'dojo/aspect',
    'dojo/query',
    'dojo/dom-style',
    'dojo/dom-attr',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/_TemplatedMixin',
    'jimu/BaseWidget',
    'dojo/dom-construct',
    'dojo/dom-style',
     'dijit/form/CheckBox',
    'jimu/WidgetManager',
    'jimu/PanelManager',
    'jimu/dijit/LoadingShelter',
    'jimu/dijit/Message',
    'dijit/layout/TabContainer',
    'jimu/CustomUtils/MapUtil',
    "./SelectUtil",
    './SelectByGeometry',
    './SelectByAttribute',
    './SelectByFeature'
],
function (declare, lang, array, on, topic,aspect, domQuery, domStyle, domAttr, _WidgetsInTemplateMixin, _TemplatedMixin, BaseWidget, domConstruct,domStyle, CheckBox,WidgetManager, PanelManager, LoadingShelter, Message, TabContainer, MapUtil, SelectUtil,
    SelectByGeometry, SelectByAttribute, SelectByFeature
    ) {
    return declare([BaseWidget, _WidgetsInTemplateMixin, _TemplatedMixin], {
        baseClass: 'jimu-widget-select',
        _showNoResultsWidgetWarning: true,
        _resultsPanelConfigured: false,
        _resultsWidgetName: null,
        _subscribers: null,
        postCreate: function () {
            this.inherited(arguments);
            this._subscribers = [];
            this._setSelectionModes();
            this._renderSelectByGeometry();
            this._renderSelectByFeature();
            this._renderSelectByAttribute();
            this._listenToTabChangeEvent();
            this._checkResultsWidgetExists();
            this._createLoadingShelter();
            this._listenToBufferCreationEvent();
            this._listenToResultsPanelClear();

            //resizing the width of this widget
            var pm = PanelManager.getInstance().getPanelById(this.id + '_panel');
            //  pm.resize({ w: 550 });
            domStyle.set(pm.domNode, "min-width", "550px");
           
        },
        _setSelectionModes: function () {
            if (this.config.selectionModesEnabled) {
                var selModes = array.map(this.config.selectionModes, function (mode) {
                    return { label: mode.name, value: mode.id }
                });
                this.selectionModeList.addOption(selModes);
                this.selectionModeList.set("value", selModes[0].value);
            } else {
                domStyle.set(this.selectionModeCntr,"display","none");
            }
        },
        startup: function () {
            this.inherited(arguments);
            this._startupWidgetContainer();
            var config = {
                excludableLayers: this.config.excludableLayers
            };
            this._showLoading();
            this.selectUtil = new SelectUtil(this.map, config);
            this.selectUtil.initialise().then(lang.hitch(this, function (cache) {
                this._hideLoading();
                this._listenToLayerCacheEvents();
                if (this.selectByGeometry) {
                    this.selectByGeometry.setSourceLayers(cache);
                }
                if (this.selectByAttribute) {
                    this.selectByAttribute.setSourceLayers(cache);
                }
                if (this.selectByFeature) {
                    this.selectByFeature.setSourceLayers(cache);
                    this.selectByFeature.setTargetLayers(cache);
                }
                this._refreshTab();
            }));
            this._setVersionTitle();
        },
        _renderSelectByGeometry: function () {
            if (this.config.queryTypes.spatialQueryUsingGeometry) {
                this.selectByGeometry = new SelectByGeometry({ nls: this.nls, config: this.config, map: this.map });
                this.sectionContainer.addChild(this.selectByGeometry);
            }
        },
        _renderSelectByAttribute: function () {
            if (this.config.queryTypes.attributeQuery) {
                this.selectByAttribute = new SelectByAttribute({ nls: this.nls, config: this.config, map: this.map });
                this.sectionContainer.addChild(this.selectByAttribute);
            }
        },
        _renderSelectByFeature: function () {
            if (this.config.queryTypes.spatialQueryUsingFeature) {
                this.selectByFeature = new SelectByFeature({ nls: this.nls, config: this.config, map: this.map });
                this.sectionContainer.addChild(this.selectByFeature);
            }
        },
        _checkResultsWidgetExists: function () {
            var resultsWidgetName;
            var allWidgets = []
            if (this.appConfig.widgetOnScreen) {
                allWidgets = [].concat(this.appConfig.widgetOnScreen.widgets);
            }
            if (this.appConfig.widgetPool) {
                allWidgets = allWidgets.concat(this.appConfig.widgetPool.widgets);
            }
            array.some(allWidgets, lang.hitch(this, function (widget) {
                var isResultsWidgetConfigured = widget.manifest ? (widget.manifest.hasOwnProperty("properties") ? (widget.manifest.properties.isResultsWidget ? true : false) : false) : false;
                if (isResultsWidgetConfigured) {
                    this._resultsPanelConfigured = true;
                    this._resultsWidgetName = widget.name;
                }
            }));
        },
        _startupWidgetContainer: function () {
            this.sectionContainer.startup();
            this._refreshTab();
        },
        _refreshTab: function () {
            this.sectionContainer.resize(true);
        },
        _createLoadingShelter: function () {
            this.shelter = new LoadingShelter({
                hidden: true
            });
            this.shelter.placeAt(this.domNode);
            this.shelter.startup();
        },
        _listenToTabChangeEvent:function(){
            this._subscribers.push(aspect.after(this.sectionContainer, "selectChild",lang.hitch(this,function () {
                this._onTabChange();
            })));
        },
        _listenToLayerCacheEvents:function(){
            this._subscribers.push(topic.subscribe("FETCH_UPDATED_LAYERCACHE", lang.hitch(this, function () {
                var cache = this.selectUtil.fetchCache();
                if (this.selectByGeometry) {
                    this.selectByGeometry.setSourceLayers(cache);
                }
                if (this.selectByAttribute) {
                    this.selectByAttribute.setSourceLayers(cache);
                }
                if (this.selectByFeature) {
                    this.selectByFeature.setSourceLayers(cache);
                    this.selectByFeature.setTargetLayers(cache);
                }
            })));
        },
        _listenToBufferCreationEvent:function(){
            this._subscribers.push(topic.subscribe("SELECT_BUFFER_CREATED", lang.hitch(this, function (bufferedGeoms, symbol) {
                var eventArray = [];
                array.forEach(bufferedGeoms, function (geom) {
                    eventArray.push({ geometry: geom, symbol: symbol });
                });
                //how to distinguish  whether the buffer is created from selectByGeom or selectByFeature//so following line needs to be changed
                //and needs to use a different logic to identify which sub section is required
                this.selectByGeometry.addToolGraphic(eventArray);
            })));
        },
        _listenToResultsPanelClear:function(){
            this._subscribers.push(topic.subscribe("RESULTS_PANEL_CLEARED", lang.hitch(this, function () {
                if(this.selectUtil) this.selectUtil.clearResults();
            })));
        },
        _showLoading: function () {
            if (this.shelter) {
                this.shelter.show();
            }
        },
        _hideLoading: function () {
            if (this.shelter) {
                this.shelter.hide();
            }
        },
        _onTabChange:function(){
            this._resetSelectModules(true, false, true);
        },
        onClose: function () {
            this._resetSelectModules(true, true, true);
            MapUtil.enableDefaultClickHandler(this.map);
        },
        onOpen: function () {
            var map = this.map;
            window.setTimeout(function () {
                MapUtil.disableDefaultClickHandler(map);//the delay is to make sure all other possible enabling default click handlers are overriden;
            }, 100);
        },
        _onClear:function(){
            this._resetSelectModules(true,true,true);
            MapUtil.clearResultsFromMap(this.map);
            MapUtil.clearSelectToolLayerFromMap(this.map);
            this.selectUtil.clearResults();
            if (this.resultsWidget) {
                this.resultsWidget.clearResults();
            }
        },
        _resetSelectModules: function (selectByGeometry, selectByAttribute, selectByFeature) {
            if (selectByGeometry && this.selectByGeometry) {
                this.selectByGeometry.resetTools();
            }
            if (selectByAttribute && this.selectByAttribute) {
                this.selectByAttribute.reset();
            }
            if (selectByFeature && this.selectByFeature) {
                this.selectByFeature.resetTools();
            }
        },
        _onApply: function () {
            var selectedWidget = this.sectionContainer.selectedChildWidget;
            var isValidQuery = selectedWidget.validateQueryParams();
            if (isValidQuery) {
                this._showLoading();
                var queryParams = selectedWidget.fetchQueryParams();
                var selectionMode = {
                    _isSelect: true,
                    _isAdd: false,
                    _isReselect: false,
                    _isDeselect: false
                };
                var selectMode = this.selectionModeList.get("value");
                if (selectMode) {
                    lang.mixin(selectionMode, {
                        _isSelect: selectMode === 'select' ? true : false,
                        _isAdd: selectMode === 'add' ? true : false,
                        _isReselect: selectMode === 'reselect' ? true : false,
                        _isDeselect: selectMode === 'deselect' ? true : false
                    });
                }
                queryParams.selectionMode = selectionMode;
                this.selectUtil.doSelect(queryParams).then(lang.hitch(this, function () {
                    this._displayResultsPanel();
                    this._hideLoading();
                    this._hideWidgetPanel(this.id + '_panel');
                }));
            }
        },
        _displayResultsPanel: function () {
            var results = this.selectUtil.fetchResults();
            var resultsWidgetName = this._resultsWidgetName; 
            if (this._resultsPanelConfigured) {
                var widgetManager = WidgetManager.getInstance();
                var resultsWidget = widgetManager.getWidgetsByName(resultsWidgetName);
                var resultsWidgetLoaded = resultsWidget.length > 0;
                if (resultsWidgetLoaded) {
                    this.resultsWidget = resultsWidget[0];
                    if (resultsWidget[0].state !== 'closed') {
                        // publish data
                        var mapUtil = resultsWidget[0].hasMapUtil()? null :MapUtil;
                        this.publishData({
                            interogate: true,
                            results: results,
                            zoomToResults: this.config.zoomToResults,
                            mapUtil: mapUtil,
                            symbology:this.config.symbology
                        }, false);
                    } else {
                        widgetManager.openWidget(resultsWidget[0]);
                        PanelManager.getInstance().showPanel(resultsWidget[0]);
                        // publish data
                        var mapUtil = resultsWidget[0].hasMapUtil() ? null : MapUtil;
                        this.publishData({
                            interogate: true,
                            results: results,
                            zoomToResults: this.config.zoomToResults,
                            mapUtil: mapUtil,
                            symbology: this.config.symbology
                        }, false);
                    }
                } else {
                    var resultsWidget = this.appConfig.getConfigElementsByName(resultsWidgetName)[0];
                    if (resultsWidget) {
                        this.openWidgetById(resultsWidget.id).then(lang.hitch(this, function (widget) {
                            //publish data
                            this.resultsWidget = widget;
                            var mapUtil = widget.hasMapUtil() ? null : MapUtil;
                            this.publishData({
                                interogate: true,
                                results: results,
                                zoomToResults: this.config.zoomToResults,
                                mapUtil: mapUtil,
                                symbology: this.config.symbology
                            }, false);
                        }));
                    } else {
                        this._popNoResultsWidgetWarning();
                        MapUtil.addResultsToMap(this.map, results, this.config.symbology, true, this.config.zoomToResults);
                    }
                }
            } else {
                this._popNoResultsWidgetWarning();
                MapUtil.addResultsToMap(this.map, results, this.config.symbology, true, this.config.zoomToResults);
            }
        },
        _toggleNoResultsWidgetWarning: function (val) {
            this._showNoResultsWidgetWarning =!val;
        },
        _popNoResultsWidgetWarning: function () {
            if (this._showNoResultsWidgetWarning) {
                var content = domConstruct.create("div", { style: "position:relative;height:auto;" });
                var msg = domConstruct.create("div", { innerHTML: this.nls.noResultsWidgetWarning, style: "position:relative;height:auto;" });
                var donotShow = new CheckBox({
                    style:"position:relative;float:left;margin-top:10px;",
                    onChange: lang.hitch(this, function () {
                        this._toggleNoResultsWidgetWarning(donotShow.get("checked"));
                    })
                });
                var label = domConstruct.create("div", { innerHTML: "Do not show this message again.", style: "margin-left:5px;position:relative;float:left;margin-top:10px;" });
                domConstruct.place(msg, content);
                domConstruct.place(donotShow.domNode, content);
                domConstruct.place(label, content);
                this._showMessage(content);
            }
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
        resize: function () {
            this._refreshTab();
        },
        destroy: function () {
            this.selectUtil.destroy();
            delete this.selectUtil;
            if (this.shelter) {
                this.shelter.destroy();
            }
            MapUtil.clearResultsFromMap(this.map);
            MapUtil.clearSelectToolLayerFromMap(this.map);
            array.forEach(this._subscribers, function (topicSubscriber) {
                topicSubscriber.remove();
            });
            this.inherited(arguments);
        },
        _setVersionTitle: function () {
            var labelNode = this._getLabelNode(this);

            var manifestInfo = this.manifest;
            var devVersion = manifestInfo.devVersion;
            var devWabVersion = manifestInfo.developedAgainst || manifestInfo.wabVersion;
            var codeSourcedFrom = manifestInfo.codeSourcedFrom;
            var client = manifestInfo.client;

            var title = "Dev version: " + devVersion + "\n";
            title += "Developed/Modified against: WAB" + devWabVersion + "\n";
            title += "Client: " + client + "\n";
            if (codeSourcedFrom) {
                title += "Code sourced from: " + codeSourcedFrom + "\n";
            }
            if (labelNode) {
                domAttr.set(labelNode, 'title', title);
            }
        },
        _getLabelNode: function (widget) {
            var labelNode;
            if (!(widget.labelNode) && !(widget.titleLabelNode)) {
                if (widget.getParent()) {
                    labelNode = this._getLabelNode(widget.getParent());
                }
            } else {
                labelNode = widget.labelNode || widget.titleLabelNode;
            }
            return labelNode;

        },
        _hideWidgetPanel: function (panelId) {

            if (panelId === null || panelId === '') return;

            PanelManager.getInstance().closePanel(panelId);
        }
    });
});