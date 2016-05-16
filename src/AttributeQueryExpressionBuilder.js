define(
[
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/_base/array",
    "dojo/data/ObjectStore",
    "dojo/store/Memory",
    "dojo/dom-construct",
    "dojo/dom-style",
    "dojo/on",
    "dojo/topic",
    "dojo/aspect",
    "dijit/layout/ContentPane",
    "dijit/form/TextBox",
    "dijit/form/Select",
    "dijit/form/Button"
    

], function (
    declare,
    lang,
    array,
    ObjectStore,
    Memory,
    domConstruct,
    domStyle,
    on,
    topic,aspect,
    ContentPane,
    TextBox,
    Select,
    Button

) {
    var AttributeQueryExpressionBuilder = declare("AttributeQueryExpressionBuilder", null, {
        box: null,
        constructor: function (panel, closable,renderAsDisabled) {
            this.parentPanel = panel;
            this.renderAsDisabled = renderAsDisabled;
            this.id = new Date().getTime();
            var wrapperPane = new ContentPane({
                'class': 'exp-wrapper-panel'
            });
            this.renderFieldList(wrapperPane);
            this.renderOperatorList(wrapperPane);
            this.renderValueFields(wrapperPane);
            closable ? this.renderCloseButton(wrapperPane) : "";
            this.parentPanel.addChild(wrapperPane);
            this.box = wrapperPane;
           
        },
        renderFieldList: function (pane) {
            var me = this;
            //container
            var fieldListContainer = domConstruct.create('div', {
                'class': "exp-fieldList-cntr"
            });

           
            var fieldList = new Select({
                options:[this.emptyStoreData('field')],
                style: "margin-left:10px;float:left;",
                disabled: this.renderAsDisabled,
                'class': "exp-builder-fieldlist jimu-list",
                placeHolder: "Select a field",
                onChange: lang.hitch(this, function (value) {
                    if (value) {
                        var item = this._getSelectedFieldInfo(value);
                        if (item) {
                            this.updateOperatorList(item);
                            this.updateFieldValue(item);
                        }
                    }
                })
            });
            domConstruct.place(fieldList.domNode, fieldListContainer);
            domConstruct.place(fieldListContainer, pane.domNode)
            this.fieldList = fieldList;
        },
        renderOperatorList:function(pane){
            var me = this;
            //container
            var opContainer = domConstruct.create('div', {
                'class': "exp-operatorList-cntr"
            })
            var operatorList = new Select({
                options: [this.emptyStoreData()],
                'class': "exp-builder-oplist jimu-list",
                disabled: this.renderAsDisabled,
                placeHolder: "Select"
            })
            domConstruct.place(operatorList.domNode, opContainer);
            domConstruct.place(opContainer, pane.domNode)
            this.operatorList = operatorList;
        },
        renderValueFields:function(pane){
            var me = this;
            //container
            var fieldValCntr = domConstruct.create('div', {
                'class': "exp-fieldValue-cntr"
            })

            var valueList = new Select({
                options: [this.emptyStoreData('value')],
                disabled: this.renderAsDisabled,
                style: "display:none;",
                'class': "exp-builder-valuelist jimu-list",
                placeHolder: "Select a value"
            })
            domConstruct.place(valueList.domNode, fieldValCntr);
            domConstruct.place(fieldValCntr, pane.domNode)
            this.valueList = valueList;

            //text field
            var valueTextField = new TextBox({
                placeHolder: "Input search value",
                style: "width:100%;",
                'class':"jimu-text-box",
                disabled: this.renderAsDisabled
            })
            domConstruct.place(valueTextField.domNode, fieldValCntr);
            domConstruct.place(fieldValCntr, pane.domNode)
            this.valueTextField = valueTextField;


        },
        renderCloseButton: function (pane) {
            var me = this;
            var removeBtn = new Button({
                showLabel: false,
                title: "Remove expression",
                'class': 'exp-builder-button',
                iconClass: "remove-query-exp",
                onClick: function () {
                    me.remove(me.id);
                }
            });
            pane.addChild(removeBtn);
        },
        getEvaluatedExpression: function () {
            var fieldName = this.fieldList.get('value');
            var fieldValue = this.valueList.get('visible') ? this.valueList.get('value') : this.valueTextField.get('value');
            var field = this._getSelectedFieldInfo(fieldName);
            var oper = this.operatorList.get('value');

            fieldName === 'undefined' ? fieldName = false : "";
            fieldValue === 'undefined' ? fieldValue = false : "";
            oper === 'undefined' ? oper = false : "";
            if (!fieldName || !fieldValue || !oper) {
                return null;
            }


            switch (field.fieldType) {
                case "esriFieldTypeSmallInteger":
                case "esriFieldTypeInteger":
                case "esriFieldTypeSingle":
                case "esriFieldTypeDouble":

                    break;
                case "esriFieldTypeString":
                case "esriFieldTypeDate":

                    if (oper === "LIKE") {
                        fieldValue = "'%" + fieldValue + "%'";
                    } else {
                        fieldValue = "'" + fieldValue + "'";
                    }
                    break;

                default:
                    break;
            }

            var expression = fieldName + " " + oper + " " + fieldValue;
            return expression;
        },
        remove: function (moduleId) {
            this.box.removeChild(this.fieldList);
            this.box.removeChild(this.operatorList);
            this.box.removeChild(this.valueList);
            this.box.removeChild(this.valueTextField);
            this.box.removeChild(this.closeButton);
            this.box.destroy();
            topic.publish("REMOVED_QUERY_EXPRESSION", moduleId);
        },
        enable:function(){
            this.fieldList.set('disabled', false);
            this.operatorList.set('disabled', false);
            this.valueList.set('disabled', false);
            this.valueTextField.set('disabled', false);
        },
        disable:function(){
            this.fieldList.set('disabled', true);
            this.operatorList.set('disabled', true);
            this.valueList.set('disabled', true);
            this.valueTextField.set('disabled', true);
        },
        reset:function(){
            this.fieldList.reset();

            this.operatorList.reset();
            this.operatorList.set("options",[this.emptyStoreData()]);


            this.valueList.reset();
            this.valueList.set("options", [this.emptyStoreData('value')]);


            this.valueTextField.reset();
        },
        emptyStoreData: function (list) {
            var emptyLabel = list ? 'Select' + " " + list : "Select";
            return { label: emptyLabel, value: "undefined", selected: true, disabled: true };
        },
        getOperatorData :function (fieldItem) {
            var opers = [];
            if (fieldItem) {
                opers.push({
                   // value: "EQUALS",
                    label: " = ",
                    value: "="
                });

                if (fieldItem.domain !== null) {
                    return opers;
                }
                switch (fieldItem.fieldType) {
                    case "esriFieldTypeSmallInteger":
                    case "esriFieldTypeInteger":
                    case "esriFieldTypeSingle":
                    case "esriFieldTypeDouble":
                    case "esriFieldTypeDate":
                        opers.push({
                           // id: "GREATERTHAN",
                            label: " > ",
                            value: ">"
                        });
                        opers.push({
                           // id: "LESSTHAN",
                            label: " < ",
                            value: "<"
                        });
                        opers.push({
                           // id: "GREATERTHANEQUALTO",
                            label: " >= ",
                            value: ">="
                        });
                        opers.push({
                           // id: "LESSTHANEQUALTO",
                            label: " <= ",
                            value: "<="
                        });
                        break;
                    case "esriFieldTypeString":
                        opers.push({
                            value: "LIKE",
                            label: "LIKE",
                           // expression: "LIKE"
                        });
                        break;

                    default:
                        break;
                }
            } 
            return opers;

        },
        updateExpressionFieldValues: function (item) {
            this.updateFieldNameList(item);
        },
        updateFieldNameList: function (item) {
            var clonedFields = dojo.clone(item.customFields);
            var tailoredFields = array.filter(clonedFields, function (field) {
                if (!field.hidden) {
                    field.label = field.name;//to accomodate the change from FilteringSelect to Select
                    field.value = field.id;
                    return field;
                }
            });
            tailoredFields.sort(function (a, b) {
                var bool = a.label > b.label;
                return (bool ? 1 : -1);
            });
            this.fieldList.reset();
            tailoredFields.unshift(this.emptyStoreData('field'));
            this.fieldList.set("options", tailoredFields);
        },
        updateOperatorList: function (item) {
            var operators = this.getOperatorData(item);
            operators.unshift(this.emptyStoreData());
            this.operatorList.set("options", operators)
        },
        updateFieldValue: function (item) {
            if (item.domain != null) {
                //value list show
                this.valueList.reset();
                this.valueList.set('visible', true);
                domStyle.set(this.valueList.domNode, "display", "block");

                //value textfield hide
                this.valueTextField.reset();
                this.valueTextField.set('visible', false);
                domStyle.set(this.valueTextField.domNode, "display", "none");

                //update value list
                this.updateFieldValueList(item);
            } else {
                //value list hide
                this.valueList.reset();
                this.valueList.set('visible', false);
                domStyle.set(this.valueList.domNode, "display", "none");

                //value textfield show
                this.valueTextField.reset();
                this.valueTextField.set('visible', true);
                domStyle.set(this.valueTextField.domNode, "display", "block");
            }
        },
        updateFieldValueList: function (item) {
            var codedValues = item.domain.codedValues;
            var valueArray = new Array();
            array.forEach(codedValues, function (value, index) {
                valueArray.push({
                    value: value.code,
                    label: value.name
                })
            });
            valueArray.unshift(this.emptyStoreData('value'));
            this.valueList.set("options",valueArray);
        },
        _getSelectedFieldInfo: function (value) {
            return array.filter(this.fieldList.options, function (option) {
                return option.value === value;
            })[0];
        }
    });
    return AttributeQueryExpressionBuilder;
});

