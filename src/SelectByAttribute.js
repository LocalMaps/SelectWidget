define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/on',
    'dojo/aspect',
    'dojo/topic',
    'dojo/Deferred',
    'dojo/dom-style',
    'dojo/dom-construct',
    "dojo/mouse",
    "dojo/dom-class",
    'dojo/promise/all',
    'jimu/BaseWidget',
    'jimu/dijit/Message',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/layout/ContentPane',
    "dojo/store/Memory",
    'dijit/form/Select',
    './AttributeQueryExpressionBuilder',
    'jimu/CustomUtils/MapUtil',
    'jimu/CustomUtils/MiscUtil',
    'dojo/text!./templates/SelectByAttribute.html'
],
function (declare, lang, array, on, aspect, topic, Deferred, domStyle, domConstruct, mouse, domClass, all, BaseWidget, Message, _TemplatedMixin, _WidgetsInTemplateMixin, ContentPane, Memory, Select,
    AttributeQueryExpressionBuilder,MapUtil,MiscUtil, template
    ) {
    return declare([BaseWidget, _WidgetsInTemplateMixin, _TemplatedMixin], {
        templateString: template,
        baseClass: 'jimu-widget-select-by-attr',
        widgetsInTemplate: true,
        expressionCount: 0,
        expressions: [],
        _subscribers:null,
        _toolLayerSymbology: {
            "fillColour": "#ff0000",
            "fillTransparency": 100
        },
        postCreate: function () {
            this.inherited(arguments);
            this._subscribers = [];
            this._setTitle();
        },
        startup: function () {
            this.inherited(arguments);
            this._attachSourceLayerListChangeHandler();
            this._setValidatorForSourceLayerList();
            this._initialiseExpressionBuilder();
            this._listenToExpressionRemoveEvent();
        },
        _setTitle: function () {
            this.title = this.nls.selectByAttribute;
        },
        _attachSourceLayerListChangeHandler: function () {
            aspect.after(this.sourceLayerList, "onChange", lang.hitch(this, function () {
                var value = this.sourceLayerList.get("value");
                if (value === '*' || !value) {
                    this._showFieldValidationError();
                    this._disableExpressions();
                } else if (value) {
                    this._enableExpressions();
                    this._handleQueryLayerChange(value);
                } 
            }));
        },
        _setValidatorForSourceLayerList: function () {
            this.sourceLayerList.validator = function () {
                if (!this.value || this.value ==='*') {
                    return false;
                }
                return true;
            }
        },
        _showFieldValidationError: function () {
            this.sourceLayerList._hasBeenBlurred = true;
            this.sourceLayerList.validate();
            this.sourceLayerList.focus();
        },
        //for filtering select
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
            if (!this.sourceLayerList.get("value") || selectedCacheItem.length == 0) {
                if (cache.length > 0) {
                    this.sourceLayerList.set("value", layerData[0].id);
                }
            } 
            if (cache.length == 0) {
                this.sourceLayerList.reset();
            }

        },
        //for normal dijit select
        setSourceLayers:function(cache){
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
                layerData.push({ label: this.nls.noVisibleLayersFound, value: "",disabled:true,selected:false });
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
        _listenToExpressionRemoveEvent:function(){
            this._subscribers.push(topic.subscribe("REMOVED_QUERY_EXPRESSION", lang.hitch(this, function (id) {
                this._decrementExpressionCounter(id)
            })));
        },
        _initialiseExpressionBuilder:function(){
            var expressionComponent = new AttributeQueryExpressionBuilder(this.expContainer, false, true);
            this._incrementExpressionCounter(expressionComponent);
        },
        _onAddExpression: function () {
            if (this.expressionCount <= this.config.attributeQueryMaxCount - 1) {
                var renderAsDisabled = this.sourceLayerList.get('value') ? false : true;
                var expressionComponent = new AttributeQueryExpressionBuilder(this.expContainer, true, renderAsDisabled);
                this._incrementExpressionCounter(expressionComponent);
                if (!renderAsDisabled) {
                    var cache = this._getCacheForSelectedLayer(this.sourceLayerList.get("value"));
                    expressionComponent.updateExpressionFieldValues(cache);
                }
            } else {
                this._showMessage(this.nls.maxExpressionsMsg);
                //msgBox.showError("Maximum expression count reached.", "Select Tool");
            }
        },
        _incrementExpressionCounter: function (expressionComponent) {
            this.expressionCount++;
            this.expressions.push(expressionComponent);
        },
        _decrementExpressionCounter:function(id){
            this.expressionCount--;
            var index = null;
            array.forEach(this.expressions, function (expression, i) {
                if (expression.id === id) index = i;
            })
            if (index != null) this.expressions.splice(index, 1);
        },
        _enableExpressions: function () {
            array.forEach(this.expressions, function (expression) {
                expression.enable();
                expression.reset();
            });
        },
        _disableExpressions: function () {
            array.forEach(this.expressions, function (expression) {
                expression.disable();
                expression.reset();
            });
        },
        reset:function(){
            array.forEach(this.expressions, function (expression) {
                expression.reset();
            });
        },
        _getCacheForSelectedLayer:function(value){
            var cacheItem = array.filter(this._cache, function (cache) {
                return cache.uniqueId === parseInt(value);
            })[0];
            if (cacheItem) {
                if (cacheItem.customFields.length == 0) {
                    cacheItem = this._populateCustomFields(cacheItem);
                }
            }
            return cacheItem;
        },
        _handleQueryLayerChange: function (value) {
            var cacheItem = array.filter(this._cache, function (cache) {
                return cache.uniqueId === parseInt(value);
            })[0];
            if (cacheItem) {
                if (cacheItem.customFields.length == 0) {
                    cacheItem = this._populateCustomFields(cacheItem);
                }
                array.forEach(this.expressions, function (expression) {
                    expression.updateExpressionFieldValues(cacheItem);
                });
            }
        },
        _populateCustomFields: function (cache) {
            var fields = cache.fields;
            var excludedFields = this.config.excludedFields;
            var customFields = [];
            var uniqueIDField = cache.uniqueFeatureIdentifier;
            array.forEach(fields, function (field) {
                var hidden = false;
                var regExp = new RegExp(uniqueIDField);
                var validExclusion = false;
                array.some(excludedFields, function (excludedFieldName) {
                    var exp = new RegExp(excludedFieldName, "ig");
                    if (exp.test(field.name) || exp.test(field.alias)) {
                        validExclusion = true;
                        return true
                    }
                });
                if (validExclusion || (regExp.test(field.name))) {
                    hidden = true;
                }
                customFields.push({
                    name: field.alias,
                    field: field.alias,
                    actualField: field.name,
                    id: field.name,
                    fieldType:field.type,
                    hidden: hidden,
                    domain: field.domain ? field.domain : null,
                    length: field.length ? field.length : null
                })
            });
            cache.customFields = customFields;
            return cache;
        },
      
        validateQueryParams: function () {
            var isValidQuery = true;
            if (!this.sourceLayerList.get('value')) {
                isValidQuery = false;
                this._showFieldValidationError();
            }
            var queryDef = this._getQueryDefinitions();
            if (!queryDef) {
                isValidQuery = false;
                this._showMessage(this.nls.invalidQueryExpressions);
            }
            return isValidQuery;
        },
        fetchQueryParams: function () {
            return {
                querySourceLayers: this.sourceLayerList.get("value"),
                queryDefinition: this._getQueryDefinitions()
            }
        },
        _getQueryDefinitions: function () {
            var expressionList = new Array();
            array.forEach(this.expressions, function (expression) {
                var evaluatedExp = expression.getEvaluatedExpression();
                evaluatedExp != null ? expressionList.push(evaluatedExp) : "";
            });
            if (expressionList.length > 0) {
                var defQuery = expressionList.join(" AND ");
                return defQuery;
            }
            return null;
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
        _getOption: function (value) {
            return array.filter(this.sourceLayerList.options, function (option) {
                return option.value === value;
            })[0];
        },
        destroy: function () {
            array.forEach(this.expressions, function (expression) {
                expression.remove(expression.id);
            });
            array.forEach(this._subscribers, function (topicSubscriber) {
                topicSubscriber.remove();
            });
            this.inherited(arguments);

        }
    });
});