define([
    "dojo/_base/declare",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/topic",
    "dojo/on",
    "dojo/Deferred",
    "dojo/promise/all",
    'esri/graphic',
    'esri/geometry/Geometry',
    'esri/geometry/Point',
    'esri/geometry/Polyline',
    'esri/geometry/Polygon',
    "jimu/CustomUtils/LayerUtil",
    "jimu/CustomUtils/QueryUtil",
    "jimu/CustomUtils/MiscUtil"


], function (
    declare, array, lang, topic, on, Deferred, all, Graphic, Geometry,Point,Polyline,Polygon, LayerUtil, QueryUtil, MiscUtil
) {
    var SelectUtil = declare("SelectUtil", [], {
        _excludeLayerConfig: null,
        _isInitialised: false,
        constructor: function (map, config) {
            this.map = map;
            this._excludeLayerConfig = config.excludableLayers;
        },
        isInitialised:function(){
            return this._isInitialised;
        },
        initialise: function () {
            var deferred = new Deferred();
            this.layerUtil = new LayerUtil(this.map);
            this.layerUtil.startup();
            this.layerUtil.createLayerConfigCache().then(lang.hitch(this, function () {
                this._isInitialised = true;
                var cache = this.layerUtil.fetchCustomLayerConfig(true, true, true); //respectScale, respectVisibility, discardDuplicateServices
                var filteredCache = this._applyCustomExclusions(cache);
                deferred.resolve(filteredCache);
            }));
            return deferred.promise;
        },
        destroy:function(){
            if (this.layerUtil) this.layerUtil.reset();
        },
        _applyCustomExclusions: function (cache) {
            var cache = cache || this.customLayerConfigCache;
            var excludeConfig = this._excludeLayerConfig;
            array.forEach(excludeConfig, lang.hitch(this, function (config) {
                var service = config.service;
                var excludedLayerNames = config.layerNames.length > 0 ? config.layerNames.split(",") : [];
                excludedLayerNames = array.map(excludedLayerNames,function(name){
                    return lang.trim(name);
                });
                array.forEach(cache, lang.hitch(this, function (eachCache) {
                    var layerName = eachCache.name;
                    var url = eachCache.serviceUrl;
                    var  parentLayerNames = eachCache.parentLayerNames;
                    var regExp = new RegExp(service);
                    if (regExp.test(url)) {
                        if (excludedLayerNames.length == 0) {
                            this.layerUtil.disableQuery(eachCache);
                        } else {
                            if (array.indexOf(excludedLayerNames, layerName) != -1 ) {
                                this.layerUtil.disableQuery(eachCache);
                            }
                            if (parentLayerNames && parentLayerNames.length > 0) {
                                //to check for exclusion at group level
                                array.forEach(parentLayerNames,lang.hitch(this,function (parentLayerName) {
                                    if (array.indexOf(excludedLayerNames, parentLayerName) != -1) {
                                        this.layerUtil.disableQuery(eachCache);
                                    }
                                }))
                            }
                        }
                    }
                }));

            }));
            return cache;
        },
       
        _doSpatialQuery:function(params){
            var deferred = new Deferred();
            var inputGeometries = [];
            var selectedLayerCacheId = params.querySourceLayers;
            var queryableLayerConfigCache = this._fetchLayerConfigsQueried(selectedLayerCacheId);
            array.forEach(params.inputFeatures, function (feature) {
                if (feature instanceof Geometry) {
                    inputGeometries.push(feature)
                } else if (feature instanceof Graphic) {
                    inputGeometries.push(feature.geometry);
                }
            });
            params.inputGeometries = inputGeometries;
            if (params.bufferValue != 0) {
                params.map = this.map;
                QueryUtil.createBuffer(params).then(lang.hitch(this,function (bufferGeoms) {
                    
                    params.inputGeometries = bufferGeoms;
                    this._executeSpatialQuery(params, queryableLayerConfigCache).then(lang.hitch(this,function (res) {
                        this._processResponses(queryableLayerConfigCache, res);
                        deferred.resolve();
                        // HACK ALERT!!!! the buffer was never shown due to a timing condition that meant the layer got cleared straight away.
                        // Do this chuff so that it gets added after the layer is cleared
                        window.setTimeout(function () { topic.publish("SELECT_BUFFER_CREATED", bufferGeoms, params.bufferSymbol, inputGeometries); }, 1000);                        
                    }));

                }), function (err) {
                    deferred.reject(err);
                });
            } else {
                this._executeSpatialQuery(params, queryableLayerConfigCache).then(lang.hitch(this,function (res) {
                    this._processResponses(queryableLayerConfigCache, res);
                    deferred.resolve()
                }));
            }
            return deferred.promise;
        },
        _executeSpatialQuery: function (inputParams,queryableLayerConfigCache) {
            var deferred = new Deferred();
            var queryDeferreds = [];
            array.forEach(queryableLayerConfigCache, lang.hitch(this, function (cache) {
                var queryParams = {};
                queryParams.serviceUrl = cache.serviceUrl + "/" + cache.serviceLayerIntId;
                queryParams.geometry = (inputParams.inputGeometries)[0];
                queryParams.relationType = inputParams.relationType;
                queryParams.map = this.map;
                queryDeferreds.push(QueryUtil.executeQuery(queryParams));
            }));
            all(queryDeferreds).then(function (res) {
                deferred.resolve(res);
            });
            return deferred.promise;
        },
       
        _doAttributeQuery: function (params) {
            var deferred = new Deferred();
            var selectedLayerCacheId = params.querySourceLayers;
            var queryableLayerConfigCache = this._fetchLayerConfigsQueried(selectedLayerCacheId);
            this._executeAttributeQuery(params, queryableLayerConfigCache).then(lang.hitch(this, function (res) {
                this._processResponses(queryableLayerConfigCache, res);
                deferred.resolve()
            }));
            return deferred.promise;
        },
        _executeAttributeQuery: function (inputParams, queryableLayerConfigCache) {
            var deferred = new Deferred();
            var queryDeferreds = [];
            array.forEach(queryableLayerConfigCache, lang.hitch(this, function (cache) {
                var queryParams = {};
                queryParams.serviceUrl = cache.serviceUrl + "/" + cache.serviceLayerIntId;
                queryParams.queryDefinition = inputParams.queryDefinition;
                queryParams.map = this.map;
                queryDeferreds.push(QueryUtil.executeQuery(queryParams));
            }));
            all(queryDeferreds).then(function (res) {
                deferred.resolve(res);
            });
            return deferred.promise;
        },
        _processResponses: function (queryableLayerConfigCache, responses) {
            array.forEach(responses, lang.hitch(this, function (response, index) {
                var config = queryableLayerConfigCache[index];
                var features = response.features;
                config.geometryType = response.geometryType;
                array.forEach(features, lang.hitch(this, function (feature) {
                    var geometry;
                    if (response.geometryType === 'esriGeometryPolygon') {
                        if (!(feature instanceof Polygon)) {
                            geometry = new Polygon({ "rings": feature.geometry.rings, "spatialReference": response.spatialReference });
                        } else {
                            geometry = lang.clone(feature.geometry);
                        }
                    } else if (response.geometryType === 'esriGeometryPolyline') {
                        if (!(feature instanceof Polyline)) {
                            geometry = new Polyline({ "paths": feature.geometry.paths, "spatialReference": response.spatialReference });
                        } else {
                            geometry = lang.clone(feature.geometry);
                        }
                    } else if (response.geometryType === 'esriGeometryPoint') {
                        if (!(feature instanceof Point)) {
                            geometry = new Point({ "x": feature.geometry.x, "y": feature.geometry.y, "spatialReference": response.spatialReference });
                        } else {
                            geometry = lang.clone(feature.geometry);
                        }
                    }
                    var graphic = new Graphic(geometry, null, lang.clone(feature.attributes));
                    this.layerUtil.addFeature(config, graphic);
                }));
            }));
        },
        _fetchLayerConfigsQueried:function(id){
            var cache = this.fetchCache();
            if (id == 'all') {
                //all layers
                return array.filter(cache, function (item) {
                    return !(item.excludedFromQuery);
                })
            } else {
                return array.filter(cache, function (item) {
                    return item.uniqueId === parseInt(id) && !(item.excludedFromQuery) ;
                })
            }
        },
        clearResults:function(){
            this.layerUtil.flushPreviousResults();
        },
        fetchCache:function(){
            var cache = this.layerUtil.fetchCustomLayerConfig(true, true, true); //respectScale, respectVisibility, discardDuplicateServices
            var filteredCache = this._applyCustomExclusions(cache);
            return filteredCache;
        },
        fetchResults: function () {
            return this.layerUtil.fetchNonEmptyResults();
        },
        doSelect: function (params) {
            var deferred = new Deferred();
            var previousResultsCache = this.fetchResults();
            this.layerUtil.flushPreviousResults();
            if (params.hasOwnProperty("inputFeatures") && params.inputFeatures.length > 0) {
                this._doSpatialQuery(params).then(lang.hitch(this, function (results) {
                    this._refineResultsBasedOnSelectionMode(previousResultsCache,params);
                    deferred.resolve();
                }));
            } else if (params.hasOwnProperty("queryDefinition") && params.queryDefinition.length > 0) {
                if(params.selectionMode._isDeselect || params.selectionMode._isReselect){
                    this._refineResultsBasedOnSelectionMode(previousResultsCache,params);
                    deferred.resolve();
                }else{
                    this._doAttributeQuery(params).then(lang.hitch(this, function (results) {
                        this._refineResultsBasedOnSelectionMode(previousResultsCache,params);
                        deferred.resolve();
                    }));
                }
                
            } else {
                console.log("Invalid query params");
                deferred.cancel();
            }
            return deferred.promise;
        },
        _refineResultsBasedOnSelectionMode: function (previousResultsCache,params) {
            if (params.selectionMode._isAdd) {
                this._updateResultsCacheForAdd(previousResultsCache);
            } else if (params.selectionMode._isReselect) {
                if (params.hasOwnProperty("relationType")) {
                    this._updateResultsCacheForReselect(previousResultsCache);
                } else if (params.hasOwnProperty("queryDefinition")) {
                    this._filterCurrentCache(previousResultsCache,params.queryDefinition, true);
                }
                
            } else if (params.selectionMode._isDeselect) {
                if (params.hasOwnProperty("relationType")) {
                    this._updateResultsCacheForDeselect(previousResultsCache);
                } else if (params.hasOwnProperty("queryDefinition")) {
                    this._filterCurrentCache(previousResultsCache,params.queryDefinition, false);
                }
            }
        },
        _updateResultsCacheForAdd: function (previousResultsCache) {
            var currentResultsCache = this.fetchResults();
            array.forEach(previousResultsCache, lang.hitch(this, function (eachCache) {
                var clonedPreviousFeatures = this._cloneFeatures(eachCache.features);
                var currentLayerCache = this._fetchLayerConfigsQueried(eachCache.uniqueId)[0];
                var currentFeatures = currentLayerCache.features;
                var unionFeatureSet = this._getFeatureSetUnion(clonedPreviousFeatures, currentFeatures);
                currentLayerCache.features = [].concat(unionFeatureSet);
            }));

        },
        _updateResultsCacheForReselect: function (previousResultsCache) {
            var currentResultsCache = this.fetchResults();
            if (previousResultsCache.length > 0) {
                //empty all the new Features in the new cache,if that  cache has no results in the previous query.
                //This is because a Reselect is only applicable to existing features 
                var previousResultsCacheIds = array.map(previousResultsCache, function (cache) {
                    return cache.uniqueId;
                });
                array.forEach(currentResultsCache,lang.hitch(this,function (newCache) {
                    if (array.indexOf(previousResultsCacheIds, newCache.uniqueId) == -1) {
                        var currentLayerCache = this._fetchLayerConfigsQueried(newCache.uniqueId)[0];
                        currentLayerCache.features = [];
                    }
                }));
                array.forEach(previousResultsCache, lang.hitch(this, function (eachCache) {
                    var clonedPreviousFeatures = this._cloneFeatures(eachCache.features);
                    var currentLayerCache = this._fetchLayerConfigsQueried(eachCache.uniqueId)[0];
                    var currentFeatures = currentLayerCache.features;
                    var intersectionFeatureSet = this._getFeatureSetIntersection(clonedPreviousFeatures, currentFeatures);
                    currentLayerCache.features = [].concat(intersectionFeatureSet);
                }));
            } else {
                this.layerUtil.flushPreviousResults();
            }
        },
        _updateResultsCacheForDeselect: function (previousResultsCache) {
            var currentResultsCache = this.fetchResults();
            if (previousResultsCache.length > 0) {
                //empty all the new Features in the new cache,if that  cache has no results in the previous query.
                //This is because a Deselect is only applicable to existing features 
                var previousResultsCacheIds = array.map(previousResultsCache, function (cache) {
                    return cache.uniqueId;
                });
                array.forEach(currentResultsCache, lang.hitch(this, function (newCache) {
                    if (array.indexOf(previousResultsCacheIds, newCache.uniqueId) == -1) {
                        var currentLayerCache = this._fetchLayerConfigsQueried(newCache.uniqueId)[0];
                        currentLayerCache.features = [];
                    }
                }));
                array.forEach(previousResultsCache, lang.hitch(this, function (eachCache) {
                    var clonedPreviousFeatures = this._cloneFeatures(eachCache.features);
                    var currentLayerCache = this._fetchLayerConfigsQueried(eachCache.uniqueId)[0];
                    var currentFeatures = currentLayerCache.features;
                    var subtractedFeatureSet = this._getFeatureSetSubtracted(clonedPreviousFeatures, currentFeatures);
                    currentLayerCache.features = [].concat(subtractedFeatureSet);
                }));
            } else {
                this.layerUtil.flushPreviousResults();
            }
        },
        _getFeatureSetUnion: function (featureSet1, featureSet2) {
            //A ∪ B
            var unionFeatures = featureSet1;
            array.forEach(featureSet2, function (feature2) {
                var duplicate = false;
                array.some(featureSet1, function (feature1) {
                    var attributes1 = lang.clone(feature1.attributes); delete attributes1["APPUNIQUEID"];
                    var attributes2 = lang.clone(feature2.attributes); delete attributes2["APPUNIQUEID"];
                    if (MiscUtil.compareObjects(feature1.geometry, feature2.geometry)  && MiscUtil.compareObjects(attributes1.geometry, attributes2.geometry)) {
                        duplicate = true;
                        return false
                    }
                });
                if (!duplicate) {
                    unionFeatures.push(feature2);
                } 
            });
            return unionFeatures;
        },
        _getFeatureSetIntersection: function (featureSet1, featureSet2) {
            // A ∩ B
            var intersectionFeatures = [];
            array.forEach(featureSet2, function (feature2) {
                var duplicate = false;
                array.some(featureSet1, function (feature1) {
                    var attributes1 = lang.clone(feature1.attributes); delete attributes1["APPUNIQUEID"];
                    var attributes2 = lang.clone(feature2.attributes); delete attributes2["APPUNIQUEID"];
                    if (MiscUtil.compareObjects(feature1.geometry, feature2.geometry) && MiscUtil.compareObjects(attributes1.geometry, attributes2.geometry)) {
                        duplicate = true;
                        return false
                    }
                });
                if (duplicate) {
                    intersectionFeatures.push(feature2);
                } 
            });
            return intersectionFeatures;
        },
        _getFeatureSetSubtracted: function (featureSet1, featureSet2) {
            // A − B
            var subtractedFeatures = [];
            array.forEach(featureSet1, function (feature1) {
                var duplicate = false;
                array.some(featureSet2, function (feature2) {
                    var attributes1 = lang.clone(feature1.attributes); delete attributes1["APPUNIQUEID"];
                    var attributes2 = lang.clone(feature2.attributes); delete attributes2["APPUNIQUEID"];
                    if (MiscUtil.compareObjects(feature1.geometry, feature2.geometry) && MiscUtil.compareObjects(attributes1.geometry, attributes2.geometry)) {
                        duplicate = true;
                        return false
                    }
                });
                if (!duplicate) {
                    subtractedFeatures.push(feature1);
                }
            });
            return subtractedFeatures;
        },
        _filterCurrentCache: function (currentResultsCache,queryDefinition, _isReselect) {
           var definitions = queryDefinition.split("AND");
           var fields = [], operators = [], values = [], _isDeselect = !_isReselect;
           array.forEach(definitions, function (def) {
               def = lang.trim(def);
               var definitionSplits = def.split(" ");
               fields.push(lang.trim(definitionSplits[0]));
               operators.push(lang.trim(definitionSplits[1]));
               values.push(lang.trim(definitionSplits[2]))
           });
           array.forEach(currentResultsCache, lang.hitch(this, function (cache) {
               var clonedFeatures = this._cloneFeatures(cache.features);
               var i = clonedFeatures.length;
               while (i--) {
                   var feature = clonedFeatures[i];
                   var attributes = feature.attributes;
                   var condition = "";
                   for (x = 0; x < fields.length ; x++) {
                       var regExp;
                       field = fields[x];
                       operator = operators[x];
                       value = values[x];
                       if (operator == '=') {
                           condition += '(' + attributes[field].toString() + ' === ' + value + ') && '
                       } else if (operator == 'LIKE') {
                           value = value.replace(/%|'/g, "");
                           regExp = new RegExp(value, "ig");
                           condition += '(' + regExp.test(attributes[field]) + ') && '

                       } else {
                           condition += '(' + attributes[field] + operator + Number(value) + ') && ';
                       }

                   }
                   condition = lang.trim(lang.trim(condition).replace(/\s+&&$/, ""));
                   if (eval(condition)) {
                       if (_isDeselect) {
                           clonedFeatures.splice(i, 1);
                       } 
                       
                   } else {
                       if (_isReselect) {
                           clonedFeatures.splice(i, 1);
                       } 
                   }
               }
               var currentLayerCache = this._fetchLayerConfigsQueried(cache.uniqueId)[0];
               currentLayerCache.features = clonedFeatures;
           }));
        
        },
        _cloneFeatures: function (features) {
            var clonedFeatures = [];
            array.forEach(features, function (feat) {
                var newGeom = lang.clone(feat.geometry);
                if (newGeom.hasOwnProperty("cache")) {
                    delete newGeom.cache;
                }
                clonedFeatures.push(new Graphic(newGeom, "", lang.clone(feat.attributes)));
            });
            return clonedFeatures;
        }
    });
    return SelectUtil;
});