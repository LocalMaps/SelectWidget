///////////////////////////////////////////////////////////////////////////
// Copyright © 2014 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
    'dojo/_base/declare',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/_base/html',
    'dojo/_base/query',
    'dojo/dom-style',
    'dojo/on',
    'dojo/aspect',
    'dijit/popup',
    'dijit/form/DropDownButton',
    'dijit/TooltipDialog',
    'dijit/ColorPalette',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidgetSetting',
    'jimu/dijit/TabContainer',
    'jimu/utils',
    'dijit/form/Select',
    'jimu/dijit/CheckBox',
    'jimu/CustomUtils/SimpleTable'
  ],
  function (declare, lang, array, html, domQuery,domStyle, on, aspect, popup, DropDownButton, TooltipDialog, ColorPalette, _WidgetsInTemplateMixin, BaseWidgetSetting,
    TabContainer, jimuUtils, Select, CheckBox,Table) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
       baseClass: 'jimu-widget-select-setting',
      _disabledClass: "jimu-state-disabled",
      postCreate: function() {
        this.inherited(arguments);
        this._createExcludeLayersTable();
        this._createExcludeFieldsTable();

        on(this.fillColour, "change", lang.hitch(this, function (value) {
            this.fillColourBtn.closeDropDown();
            domStyle.set(this.fillColourBtn.domNode, "backgroundColor", value);
        }));
        on(this.highlightColour, "change", lang.hitch(this, function (value) {
            this.highlightColourBtn.closeDropDown();
            domStyle.set(this.highlightColourBtn.domNode, "backgroundColor", value);
        }));
        this._setTooltipForTransparencySliders([this.fillTransparency, this.highlightTransparency]);

        this.own(on(this.btnAddBuffer, 'click', lang.hitch(this, this._addDistance)));
        this.own(on(this.distanceTable, 'row-delete', lang.hitch(this, function(tr) {
            if (tr.select) {
                this._markAsUnused(tr.select.get("value"));
                tr.select.destroy();
                delete tr.select;
          }
          this._resetDistanceSelectOptions();
          this._checkStatusForBtnAddDistance();
        })));
        this.setConfig(this.config);
     },
     startup: function() {
        this.inherited(arguments);

     },
     setConfig: function(config) {
        this.config = config;
        this._setQueryTypes(this.config.queryTypes);
        this._setFeatureSelectionMode(this.config.selectionModesEnabled);
        this._setDefaultTargetLayerForSelectByFeature(this.config.targetLayerForSelectByFeature);
        this._setDistanceTable(this.config.distanceUnits);
        this._setExcludableLayers(this.config.excludableLayers);
        this._setExcludedFields(this.config.excludedFields);
        this._setAttributeQueryCount(this.config.attributeQueryMaxCount);
        this._setZoomToResults(this.config.zoomToResults);
        this._setSymbology(this.config.symbology);
        this._setGeomServiceUrl(this.config.geometryServiceUrl);
      },
      _markAsUnused:function(val){
          array.filter(this.config.distanceUnits, function (unitInfo) {
              return unitInfo.unit === val;
          })[0].enabled = false;
      },
      _markAsUsed:function(val){
          array.filter(this.config.distanceUnits, function (unitInfo) {
              return unitInfo.unit === val;
          })[0].enabled = true;
      },
      _setQueryTypes:function(){
          var queryTypes = this.config.queryTypes;
          queryTypes.spatialQueryUsingGeometry ? this.spatialQueryUsingGeometry.check() : this.spatialQueryUsingGeometry.uncheck();
          queryTypes.spatialQueryUsingFeature ? this.spatialQueryUsingFeature.check() : this.spatialQueryUsingFeature.uncheck();
          queryTypes.attributeQuery ? this.attributeQuery.check() : this.attributeQuery.uncheck();
          if (!(queryTypes.spatialQueryUsingGeometry) && !(queryTypes.spatialQueryUsingFeature) && !(queryTypes.attributeQuery)) {
              this.spatialQueryUsingGeometry.check();
          }
      },
      _getQueryTypes: function () {
        var config ={
            spatialQueryUsingGeometry: this.spatialQueryUsingGeometry.checked,
            spatialQueryUsingFeature: this.spatialQueryUsingFeature.checked,
            attributeQuery: this.attributeQuery.checked
        }
        if (!(this.spatialQueryUsingGeometry.checked) && !(this.spatialQueryUsingFeature.checked) && !(this.attributeQuery.checked)) {
            config.spatialQueryUsingGeometry = true;

        }
        return config;
      },
      _setFeatureSelectionMode: function (mode) {
          mode ? this.featureSelectionModesEnabled.check() : this.featureSelectionModesEnabled.uncheck();
      },
      _getFeatureSelectionMode:function(){
          return this.featureSelectionModesEnabled.checked;
      },
      _setDefaultTargetLayerForSelectByFeature:function(layer){
          this.targetLayerForSelectByFeature.set("value", layer);
      },
      _getDefaultTargetLayerForSelectByFeature:function(){
          return this.targetLayerForSelectByFeature.get("value");
      },
      _setDistanceTable:function(distanceUnits){
        this.distanceTable.clear();
        array.forEach(distanceUnits, lang.hitch(this, function(item){
          var defaultUnitInfo = this._getDistanceUnitInfo(item.unit);
          if(!defaultUnitInfo || !defaultUnitInfo.enabled){
            return;
          }
          this._addDistanceUnitRow(defaultUnitInfo);
        }));
      },
      getConfig: function() {
        var config = {
            queryTypes: this._getQueryTypes(),
            selectionModesEnabled: this._getFeatureSelectionMode(),
            targetLayerForSelectByFeature:this._getDefaultTargetLayerForSelectByFeature(),
            distanceUnits: this._getDistanceConfig(),
            excludableLayers: this._getExcludableLayers(),
            excludedFields: this._getExcludedFields(),
            attributeQueryMaxCount: this._getAttributeQueryCount(),
            zoomToResults: this._getZoomToResults(),
            symbology: this._getSymbology(),
            geometryServiceUrl: this._getGeomServiceUrl(),
            selectionModes: this.config.selectionModes,//non configurable through UI 
            relationTypes: this.config.relationTypes//non configurable through UI 
        };
        return config;
      },

      _getDistanceConfig:function(){
          return this.config.distanceUnits;
      },

      _getAllDistanceUnitValues:function(){
        var distanceUnitValues = array.map(this.distanceUnits, lang.hitch(this, function(item){
          return item.value;
        }));
        return distanceUnitValues;
      },

      _getUsedDistanceUnitValues:function(){
        var trs = this.distanceTable.getRows();
        var usedDistanceUnitValues = array.map(trs, lang.hitch(this, function(tr){
          return tr.select.get('value');
        }));
        if (usedDistanceUnitValues.length === 0) {
            return this.config.distanceUnits;
        }
      },

      _getNotUsedDistanceUnitValues:function(){
          var notUsedValues = array.map(array.filter(this.config.distanceUnits, lang.hitch(this, function (item) {
          return !item.enabled
          })), function (item) {
              return item.unit ;
          });
        return notUsedValues;
      },

      _getDistanceUnitInfo:function(value){
        var result = null;
        var units = array.filter(this.config.distanceUnits, lang.hitch(this, function(item){
          return item.unit === value;
        }));
        if(units.length > 0){
          result = lang.mixin({}, units[0]);
        }
        return result;
      },

      _addDistance:function(){
        var notUsedValues = this._getNotUsedDistanceUnitValues();
        if(notUsedValues.length === 0){
          return;
        }
        var value = notUsedValues[0];
        var unitInfo = this._getDistanceUnitInfo(value);
        this._addDistanceUnitRow(unitInfo);
      },

      _checkStatusForBtnAddDistance: function(){
        var notUsedValues = this._getNotUsedDistanceUnitValues();
        if(notUsedValues.length === 0){
          html.addClass(this.btnAddBuffer, this._disabledClass);
          html.addClass(this.btnAddDistanceIcon, this._disabledClass);
        }else{
          html.removeClass(this.btnAddBuffer, this._disabledClass);
          html.removeClass(this.btnAddDistanceIcon, this._disabledClass);
        }
      },

      _addDistanceUnitRow:function(unitInfo){
        var rowData = {
            label: unitInfo.label
        };
        var result = this.distanceTable.addRow(rowData);
        if(result.success && result.tr){
          var tr = result.tr;
          var td = domQuery('.simple-table-cell', tr)[0];
          html.setStyle(td, "verticalAlign", "middle");
          var select = new Select({style:"width:100%;height:18px;line-height:18px;"});
          select.placeAt(td);
          select.startup();
          select.addOption({
            value:unitInfo.unit,
            label:unitInfo.label,
            selected:true
          });
          select.watch("value", lang.hitch(this, function (prop,oldValue, newValue) {
              this._markAsUsed(newValue);
              this._markAsUnused(oldValue);
              this._resetDistanceSelectOptions();
          }));
          //this.own(on(select, 'change', lang.hitch(this, this._resetDistanceSelectOptions)));
          tr.select = select;
          this._markAsUsed(unitInfo.unit);
        }
        this._resetDistanceSelectOptions();
        this._checkStatusForBtnAddDistance();
      },

      _showCorrectDistanceInfoBySelectedOption:function(tr){
        var select = tr.select;
        var unitInfo = this._getDistanceUnitInfo(select.value);
        var rowData = {
          label:unitInfo.label,
          unit: unitInfo.unit
        };
        this.distanceTable.editRow(tr, rowData);
      },

      _resetDistanceSelectOptions:function(){
        var trs = this.distanceTable.getRows();
        var selects = array.map(trs, lang.hitch(this, function(tr){
          return tr.select;
        }));
        var notUsedValues = this._getNotUsedDistanceUnitValues();
        var notUsedUnitsInfo = array.map(notUsedValues, lang.hitch(this, function(value){
          return this._getDistanceUnitInfo(value);
        }));
        array.forEach(selects, lang.hitch(this, function(select, index){
          var currentValue = select.get('value');
          var notSelectedOptions = array.filter(select.getOptions(),
            lang.hitch(this, function(option){
            return option.value !== currentValue;
          }));
          select.removeOption(notSelectedOptions);
          array.forEach(notUsedUnitsInfo, lang.hitch(this, function(unitInfo){
            select.addOption({
              value:unitInfo.unit,
              label:unitInfo.label
            });
          }));
          select.set('value', currentValue);
          var tr = trs[index];
          this._showCorrectDistanceInfoBySelectedOption(tr);
        }));
      },
      _createExcludeLayersTable: function () {
          var fields = [{
              name: 'service',
              title: this.nls.service,
              type: 'text',
              unique: false,
              editable: true
          }, {
              name: 'layerNames',
              title: this.nls.layerNames,
              type: 'text',
              unique: false,
              editable: true
          },
          {
              name: 'actions',
              title: this.nls.actions,
              type: 'actions',
              'class': "actions",
              actions: ['edit', 'delete']
          }];
          var args = {
              autoHeight: true,
              fields: fields,
              selectable: true
          };
          this.excludeLayersTable = new Table(args);
          this.excludeLayersTable.placeAt(this.excludeLayersTableCntr);
          this.excludeLayersTable.startup();
          this.own(on(this.excludeLayersTable, 'actions-edit', lang.hitch(this, function (row) {
              this.onTableEditClick(this.excludeLayersTable, row);
          })));
          on(this.addLayerLabel, "click", lang.hitch(this, function () {
              var data = { service: "", layerNames: "" };
              this.onRowAddClick(this.excludeLayersTable, data);
          }));
      },
      _createExcludeFieldsTable: function () {
          var fields = [{
              name: 'field',
              title: this.nls.excludedFields,
              type: 'text',
              unique: false,
              editable: true
          },
         {
             name: 'actions',
             title: this.nls.actions,
             type: 'actions',
             'class': "actions",
             actions: ['edit', 'delete']
         }];
          var args = {
              autoHeight: true,
              fields: fields,
              selectable: true
          };
          this.excludeFieldsTable = new Table(args);
          this.excludeFieldsTable.placeAt(this.excludeFieldsTableCntr);
          this.excludeFieldsTable.startup();
          this.own(on(this.excludeFieldsTable, 'actions-edit', lang.hitch(this, function (row) {
              this.onTableEditClick(this.excludeFieldsTable, row);
          })));
          on(this.addFieldsLabel, "click", lang.hitch(this, function () {
              var data = { field: "" };
              this.onRowAddClick(this.excludeFieldsTable, data);
          }));
      },
      _getExcludableLayers: function () {
          var data = this.excludeLayersTable.getData();
          var filteredData = array.filter(data, function (data) {
              var service = lang.trim(data.service);
              if (service) {
                  return true;
              }
          })
          return filteredData;
      },
      _setExcludableLayers: function (obj) {
          if (obj && obj.length > 0) {
              array.forEach(obj, lang.hitch(this, function (data) {
                  this.excludeLayersTable.addRow(data)
              }));
          }
      },
    
      _getExcludedFields: function () {
          var data = this.excludeFieldsTable.getData();
          var filteredData = array.map(array.filter(data, function (data) {
              var widget = lang.trim(data.field);
              if (widget) {
                  return true;
              }
          }), function (item) {
              return item.field;
          })
          return filteredData;
      },
      _setExcludedFields: function (fields) {
          if (fields && fields.length > 0) {
              array.forEach(fields, lang.hitch(this, function (field) {
                  this.excludeFieldsTable.addRow({ field: field });
              }));
          }
      },
      //-----------------------------------------------//

      _setAttributeQueryCount:function(val){
          this.attributeQueryMaxCount.set("value", val);
      },
      _getAttributeQueryCount:function(){
          return this.attributeQueryMaxCount.get("value");
      },
        //-----------------------------------------------//

      _setSymbology: function (symbology) {
          if (symbology) {
              var fillColour = symbology.fillColour;
              if (fillColour) this.fillColour.set("value", fillColour);

              var fillTransparency = symbology.fillTransparency;
              if (fillTransparency) this.fillTransparency.set("value", fillTransparency);

              var highlightColour = symbology.highlightColour;
              if (highlightColour) this.highlightColour.set("value", highlightColour);

              var highlightTransparency = symbology.highlightTransparency;
              if (highlightTransparency) this.highlightTransparency.set("value", highlightTransparency);
          }
      },
      _getSymbology: function () {
          return {
              fillColour: this.fillColour.get("value"),
              fillTransparency: this.fillTransparency.get("value"),
              highlightColour: this.highlightColour.get("value"),
              highlightTransparency: this.highlightTransparency.get("value")
          }
      },

      _setGeomServiceUrl: function (url) {
          this.geometryServiceUrl.set("value", url);
      },
      _getGeomServiceUrl:function(){
          return this.geometryServiceUrl.get('value');
      },
      _setTooltipForTransparencySliders: function (sliders) {
          array.forEach(sliders, lang.hitch(this, function (slider) {
              var sliderTipNode = domQuery(".dijitSliderImageHandle", slider.domNode)[0];
              var tip = new TooltipDialog({
                  content: slider.get("value") + "%",
                  onMouseLeave: function () {
                      popup.close(tip);
                  }
              });
              on(slider, "change", function (val) {
                  tip.set("content", val + "%");
              });
              on(sliderTipNode, "mouseover", function () {
                  popup.open({
                      popup: tip,
                      around: sliderTipNode,
                      orient: ["above-centered"]
                  });
              });
              on(sliderTipNode, "mouseout", function () {
                  popup.close(tip);
              });
              on(sliderTipNode, "blur", function () {
                  popup.close(tip);
              });

          }));
      },
      _getZoomToResults: function () {
          return this.zoomToResults.checked;
      },
      _setZoomToResults:function(checked){
          checked ? this.zoomToResults.check():this.zoomToResults.uncheck();
      },
        //------------------------------------//
      onRowAddClick: function (table, data) {
          table.finishEditing();
          var rowAddResult = table.addRow(data, false);
          var row = rowAddResult.tr;
          table.editRow(row, data);
      },
      onTableEditClick: function (table, row) {
          table.finishEditing();
          var data = table.getRowData(row);
          table.editRow(row, data);
      }

    });
  });