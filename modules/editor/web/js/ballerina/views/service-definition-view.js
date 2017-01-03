/**
 * Copyright (c) 2016, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
define(['lodash', 'log', 'd3', 'd3utils', 'jquery', './canvas', './point', './../ast/service-definition',
        './client-life-line', './resource-definition-view', 'ballerina/ast/ballerina-ast-factory', './axis',
        './connector-declaration-view', './../ast/variable-declaration', './variables-view'],
    function (_, log, d3, D3utils, $, Canvas, Point, ServiceDefinition,
              ClientLifeLine, ResourceDefinitionView, BallerinaASTFactory, Axis,
              ConnectorDeclarationView, VariableDeclaration, VariablesView) {

        /**
         * The view to represent a service definition which is an AST visitor.
         * @param {Object} args - Arguments for creating the view.
         * @param {ServiceDefinition} args.model - The service definition model.
         * @param {Object} args.container - The HTML container to which the view should be added to.
         * @param {Object} [args.viewOptions={}] - Configuration values for the view.
         * @constructor
         */
        var ServiceDefinitionView = function (args) {
            Canvas.call(this, args);

            this._connectorViewList =  _.get(args, "connectorViewList", []);
            this._viewOptions.LifeLineCenterGap = 180;
            this._resourceViewList = _.get(args, "resourceViewList", []);
            this._parentView = _.get(args, "parentView");
            this._viewOptions.offsetTop = _.get(args, "viewOptionsOffsetTop", 50);
            this._viewOptions.topBottomTotalGap = _.get(args, "viewOptionsTopBottomTotalGap", 100);
            //set initial height for the service container svg
            this._totalHeight = 170;
            //set initial connector margin for the service
            this._lifelineMargin = new Axis(210, false);

            if (_.isNil(this._model) || !(this._model instanceof ServiceDefinition)) {
                log.error("Service definition is undefined or is of different type." + this._model);
                throw "Service definition is undefined or is of different type." + this._model;
            }

            if (_.isNil(this._container)) {
                log.error("Container for service definition is undefined." + this._container);
                throw "Container for service definition is undefined." + this._container;
            }
            this.init();
        };

        ServiceDefinitionView.prototype = Object.create(Canvas.prototype);
        ServiceDefinitionView.prototype.constructor = ServiceDefinitionView;

        ServiceDefinitionView.prototype.init = function(){
            //Registering event listeners
            this.listenTo(this._model, 'childVisitedEvent', this.childVisitedCallback);
            this.listenTo(this._parentView, 'childViewAddedEvent', this.childViewAddedCallback);
            this.listenTo(this._model, 'childRemovedEvent', this.childViewRemovedCallback);
        };

        ServiceDefinitionView.prototype.childVisitedCallback = function (child) {

        };

        ServiceDefinitionView.prototype.childViewAddedCallback = function (child) {
            if (BallerinaASTFactory.isServiceDefinition(child)) {
                if (child !== this._model) {
                    log.info("[Eventing] Service view added : ");
                }
            }
        };

        ServiceDefinitionView.prototype.setModel = function (model) {
            if (!_.isNil(model) && model instanceof ServiceDefinition) {
                this._model = model;
            } else {
                log.error("Service definition is undefined or is of different type." + model);
                throw "Service definition is undefined or is of different type." + model;
            }
        };

        ServiceDefinitionView.prototype.setContainer = function (container) {
            if (!_.isNil(container)) {
                this._container = container;
            } else {
                log.error("Container for service definition is undefined." + container);
                throw "Container for service definition is undefined." + container;
            }
        };

        ServiceDefinitionView.prototype.addToResourceViewList = function (view) {
            if (!_.isNil(view)) {
                //stop listening to current last resource view - if any
                if(!_.isEmpty(this._resourceViewList)){
                    this.stopListening(_.last(this._resourceViewList).getBoundingBox(), 'bottom-edge-moved');

                    // make new view adjust y on last view's bottom edge move
                    _.last(this._resourceViewList).getBoundingBox().on('bottom-edge-moved', function(dy){
                        view.getBoundingBox().move(0, dy);
                    })
                }
                this._resourceViewList.push(view);

                // listen to new last resource view
                this.listenTo(_.last(this._resourceViewList).getBoundingBox(), 'bottom-edge-moved',
                    this.onLastResourceBottomEdgeMoved);
            }
        };

        ServiceDefinitionView.prototype.onLastResourceBottomEdgeMoved = function (dy) {
            this._totalHeight = this._totalHeight + dy;
            this.setServiceContainerHeight(this._totalHeight);
        };

         ServiceDefinitionView.prototype.setChildContainer = function (svg) {
            if (!_.isNil(svg)) {
                this._childContainer = svg;
            }
         };

        ServiceDefinitionView.prototype.setViewOptions = function (viewOptions) {
            this._viewOptions = viewOptions;
        };

        ServiceDefinitionView.prototype.getModel = function () {
            return this._model;
        };

        ServiceDefinitionView.prototype.getContainer = function () {
            return this._container;
        };

        ServiceDefinitionView.prototype.getResourceViewList = function () {
            return this._resourceViewList;
        };

        ServiceDefinitionView.prototype.getChildContainer = function () {
            return this._rootGroup;
        };

        ServiceDefinitionView.prototype.getViewOptions = function () {
            return this._viewOptions;
        };

        /**
         * Rendering the view of the service definition.
         * @returns {Object} - The svg group which the service definition view resides in.
         */
        ServiceDefinitionView.prototype.render = function (diagramRenderingContext) {
            this.diagramRenderingContext = diagramRenderingContext;
            this.drawAccordionCanvas(this._container, this._viewOptions, this._model.id, this._model.type.toLowerCase(), this._model._serviceName);
            var divId = this._model.id;
            var currentContainer = $('#' + divId);
            this._container = currentContainer;

            this.getModel().accept(this);
            var self = this;

            // Listen to the service name changing event and dynamically update the service name
            $("#title-" + this._model.id).on("change paste keyup", function () {
                self._model.setServiceName($(this).text());
            });

            this._model.on('child-added', function (child) {
                self.visit(child);
                self._model.trigger("childVisitedEvent", child);
            });

            var variableButton = VariablesView.createVariableButton(this.getChildContainer().node(), 4, 7);
            var annotationButton = this._createAnnotationButton(this.getChildContainer().node());

            var variableProperties = {
                model: this._model,
                activatorElement: variableButton,
                paneAppendElement: this.getChildContainer().node().ownerSVGElement.parentElement,
                viewOptions: {
                    position: {
                        x: parseInt(this.getChildContainer().attr("x")) + 17,
                        y: parseInt(this.getChildContainer().attr("y")) + 6
                    },
                    width: parseInt(this.getChildContainer().node().parentElement.getBoundingClientRect().width) - 36
                }
            };

            VariablesView.createVariablePane(variableProperties);
            this._createAnnotationButtonPane(annotationButton);
        };

        ServiceDefinitionView.prototype.canVisitServiceDefinition = function (serviceDefinition) {
            return true;
        };

        ServiceDefinitionView.prototype.visitServiceDefinition = function (serviceDefinition) {

        };

        ServiceDefinitionView.prototype.canVisitResourceDefinition = function (resourceDefinition) {
            return false;
        };

        /**
         * Calls the render method for a resource definition.
         * @param {ResourceDefinition} resourceDefinition - The resource definition model.
         */
        ServiceDefinitionView.prototype.visitResourceDefinition = function (resourceDefinition) {
            log.info("Visiting resource definition");
            var resourceContainer = this.getChildContainer();
            // If more than 1 resource
            if (this.getResourceViewList().length > 0) {
                var prevView = _.last(this._resourceViewList);
                var prevResourceHeight = prevView.getBoundingBox().h();
                var prevResourceY = prevView.getBoundingBox().y();
                var newY = prevResourceHeight + prevResourceY + prevView.getGapBetweenResources();
                var viewOpts = { topLeft: new Point( 50, newY)};
                var resourceDefinitionView = new ResourceDefinitionView({model: resourceDefinition,container: resourceContainer,
                    toolPalette: this.toolPalette, messageManager: this.messageManager, viewOptions: viewOpts, parentView: this});
            }
            else{
                var resourceDefinitionView = new ResourceDefinitionView({model: resourceDefinition, container: resourceContainer,
                    toolPalette: this.toolPalette,messageManager: this.messageManager, parentView: this});
            }
            this.diagramRenderingContext.getViewModelMap()[resourceDefinition.id] = resourceDefinitionView;

            this.addToResourceViewList(resourceDefinitionView);

            this.listenTo(resourceDefinitionView, 'childConnectorViewAddedEvent', this.childConnectorViewAddedCallback);
            this.listenTo(resourceDefinitionView, 'defaultWorkerViewAddedEvent',this.defaultWorkerViewAddedCallback);
            resourceDefinitionView.render(this.diagramRenderingContext);

            //setting height of the service view
            var childView = this.diagramRenderingContext.getViewModelMap()[resourceDefinition.id];
            var staticHeights = childView.getGapBetweenResources();
            this._totalHeight = this._totalHeight + childView.getBoundingBox().h() + staticHeights;
            this.setServiceContainerHeight(this._totalHeight);

            //setting client lifeline's height. Value is calculated by reducing required amount of height from the total height of the service.
            // this.setClientLifelineHeight(this._totalHeight);

            this.trigger("childViewAddedEvent", resourceDefinition);
        };

        /**
         * callback function for connector view added event
         * @param connectorView
         */
        ServiceDefinitionView.prototype.childConnectorViewAddedCallback = function (connectorView) {
            this.updateLifelineMargin(connectorView);
        };

        /**
         * callback function for default worker view added event
         * @param defaultWorkerView
         */
        ServiceDefinitionView.prototype.defaultWorkerViewAddedCallback = function (defaultWorkerView) {
            this.updateLifelineMargin(defaultWorkerView);
        };

        /**
         * updates lifeline margin of this service
         * @param lifeLineView
         */
        ServiceDefinitionView.prototype.updateLifelineMargin = function (lifeLineView) {
            var centerX = lifeLineView.getBoundingBox().getTopCenterX();
            if (centerX > this.getLifelineMargin().getPosition()) {
                this.getLifelineMargin().setPosition(centerX);
            }
        };


        ServiceDefinitionView.prototype.canVisitConnectorDeclaration = function (connectorDeclaration) {
            return true;
        };

        /**
         * Calls the render method for a connector declaration.
         * @param connectorDeclaration
         */
        ServiceDefinitionView.prototype.visitConnectorDeclaration = function (connectorDeclaration) {
            var connectorContainer = this.getChildContainer().node(),
                connectorOpts = {
                    model: connectorDeclaration,
                    container: connectorContainer,
                    parentView: this,
                    lineHeight: this.getBoundingBox().h() - this._viewOptions.topBottomTotalGap
                },
                connectorDeclarationView,
                center;

            center = new Point(this.getLifelineMargin().getPosition(), this._viewOptions.offsetTop).move(this._viewOptions.LifeLineCenterGap, 0);
            _.set(connectorOpts, 'centerPoint', center);
            connectorDeclarationView = new ConnectorDeclarationView(connectorOpts);
            this.diagramRenderingContext.getViewModelMap()[connectorDeclaration.id] = connectorDeclarationView;
            this._connectorViewList.push(connectorDeclarationView);

            connectorDeclarationView.render();
            connectorDeclarationView.setParent(this);
            connectorDeclarationView.listenTo(this.getLifelineMargin(), 'moved', this.updateConnectorPositionCallback);
        };

        /**
         * updates connector position
         * @param dx
         */
        ServiceDefinitionView.prototype.updateConnectorPositionCallback = function (dx) {
            // "this" will be a connector instance
            this.position(dx, 0);
            this.getBoundingBox().move(dx, 0);
        };

        /**
         * Creates the annotation button pane.
         * @param annotationButton - The annotation button, which is an SVG element(circle).
         * @private
         */
        ServiceDefinitionView.prototype._createAnnotationButtonPane = function (annotationButton) {
            var paneWidth = 400;
            var paneHeadingHeight = annotationButton.attr("r") * 2;
            var mainActionWrapper = "main-action-wrapper service-annotation-main-action-wrapper";
            var actionContentWrapper = "svg-action-content-wrapper";
            var actionContentWrapperHeading = "action-content-wrapper-heading service-annotation-wrapper-heading";
            var actionContentDropdownWrapper = "action-content-dropdown-wrapper input-group-btn";
            var actionIconWrapper = "action-icon-wrapper";
            var actionContentWrapperBody = "svg-action-content-wrapper-body service-annotation-details-wrapper";
            var annotationDetailWrapper = "service-annotation-detail-wrapper";
            var annotationDetailCellWrapper = "service-annotation-detail-cell-wrapper";

            // Annotation data of the service.
            var data = [
                {
                    annotationType: "BasePath",
                    annotationValue: this._model.getBasePath(),
                    setterMethod: this._model.setBasePath
                },
                {
                    annotationType: "ServiceName",
                    annotationValue: this._model.getServiceName(),
                    setterMethod: this._model.setServiceName
                },
                {
                    annotationType: "Source:interface",
                    annotationValue: ""/*this._model.getSource().interface*/,
                    setterMethod: this._model.setSource
                }
            ];

            // Showing annotation pane when annotation button is clicked.
            $(annotationButton.node()).click({model: this._model}, function (event) {

                // Show the annotation pane only if annotation pane is closed.
                if (_.isNil($(annotationButton.node()).data("showing"))
                    || $(annotationButton.node()).data("showing") == "false") {
                    $(annotationButton.node()).data("showing", true);
                } else {
                    return;
                }

                var model = event.data.model;

                // Stopping event propagation to element behind.
                event.stopPropagation();

                // Adding darkness to the annotation button.
                var annotationButtonClass = $(annotationButton.node()).attr("class");
                $(annotationButton.node()).removeAttr("class");

                var divSvgWrapper = annotationButton.node().ownerSVGElement.parentElement;

                // Getting the start location for drawing the background.
                var paneStartingX = annotationButton.attr("cx") - paneWidth;
                var paneStartingY = annotationButton.attr("cy") - annotationButton.attr("r");

                // Heading background.
                var headingBackground = d3.select(annotationButton.node().parentElement).insert("rect", ":first-child")
                    .attr("x", paneStartingX)
                    .attr("y", paneStartingY)
                    .attr("width", paneWidth)
                    .attr("height", paneHeadingHeight)
                    .classed("svg-action-content-wrapper-heading", true);

                // Padding value needs to be taken into considering as that starting point of the SVG and its wrapper is
                // not the same. Difference is the padding.
                var paddingOfDivSvgWrapper = parseInt($(divSvgWrapper).css("padding"), 10);

                var annotationEditorWrapper = $("<div/>", {
                    class: mainActionWrapper
                }).width(paneWidth)
                    .offset({top: paneStartingY + paddingOfDivSvgWrapper, left: paneStartingX + paddingOfDivSvgWrapper})
                    .appendTo(divSvgWrapper);

                var annotationActionContentWrapper = $("<div/>", {
                    class: actionContentWrapper
                }).appendTo(annotationEditorWrapper);

                // Creating header content.
                var headerWrapper = $("<div/>", {
                    class: actionContentWrapperHeading
                }).appendTo(annotationActionContentWrapper);

                // Creating a wrapper for the annotation type dropwdown.
                var annotationTypeDropDownWrapper = $("<div/>", {
                    class: actionContentDropdownWrapper
                }).appendTo(headerWrapper);

                // Creating dropdown button element.
                var dropdownClickable = $("<button/>", {
                    class: "btn btn-default dropdown-toggle",
                    text : "Annotation Type"
                }).appendTo(annotationTypeDropDownWrapper);

                // Adding bootstrap attributes to the above button element.
                dropdownClickable.attr("data-toggle", "dropdown")
                    .attr("aria-haspopup", true)
                    .attr("aria-expanded", false);

                var dropdownClickableIcon = $("<i class='icon-caret fw fw-down icon-caret'></i>");

                dropdownClickableIcon.appendTo(dropdownClickable);

                // Creating <ul> tag to add dropdown elements.
                var dropdownElementsWrapper = $("<ul/>", {
                    class: "dropdown-menu"
                }).appendTo(annotationTypeDropDownWrapper);

                // Text input for editing the value of an annotation.
                var annotationValueInput = $("<input/>", {
                    type: "text"
                }).appendTo(headerWrapper);

                // Wrapper for the add and check icon.
                var addIconWrapper = $("<div/>", {
                    class: actionIconWrapper
                }).appendTo(headerWrapper);

                var addButton = $("<span class='fw-stack fw-lg'>" +
                    "<i class='fw fw-square fw-stack-2x'></i>" +
                    "<i class='fw fw-add fw-stack-1x fw-inverse'></i>" +
                    "</span>").appendTo(addIconWrapper);

                // Adding a value to a new annotation.
                $(addButton).click(function() {
                    var annotationValue = annotationValueInput.val();
                    var annotationType = dropdownClickable.text();
                    var annotation = _.first(_.filter(data, function(annotation){
                        return annotation.annotationType == annotationType;
                    }));

                    annotation.annotationValue = annotationValue;

                    //Sets the annotation values in the model
                    setAnnotationValues(annotationType,annotationValue);

                    //Clear the text box and drop down value
                    annotationValueInput.val("");

                    // Recreating the annotation details view.
                    createCurrentAnnotationView(data, annotationsContentWrapper);

                    // Re-add elements to dropdown.
                    addAnnotationsToDropdown();
                });

                // Add elements to dropdown.
                addAnnotationsToDropdown();

                // Creating the content editing div.
                var annotationsContentWrapper = $("<div/>", {
                    class: actionContentWrapperBody
                }).appendTo(annotationActionContentWrapper);

                // Creating the annotation details view.
                createCurrentAnnotationView(data, annotationsContentWrapper);

                // If an item in the dropdown(the button and the li elements) is clicked, we nee to allow propagation as
                // the dropdown effect is handle through bootstrap.
                annotationEditorWrapper.click({
                    dropDown: dropdownClickable,
                    dropDownList: dropdownElementsWrapper
                }, function (event) {
                    if (!(event.target == event.data.dropDown.get(0) ||
                        (!_.isNil(event.target.parentElement) &&
                        event.data.dropDownList.get(0) == event.target.parentElement.parentElement))) {
                        event.stopPropagation();
                    }
                });

                // Closing the pop-up. But we should not close the pop-up when clicked on an dropdown element(the button
                // and the li elements) as it is handled through bootstrap.
                $(window).click({dropDownList: dropdownElementsWrapper}, function (event) {
                    if (!(!_.isNil(event.target.parentElement) &&
                        event.data.dropDownList.get(0) == event.target.parentElement.parentElement)) {
                        $(headingBackground.node().remove());
                        annotationEditorWrapper.remove();
                        $(annotationButton.node()).data("showing", "false");
                        $(annotationButton.node()).attr("class", annotationButtonClass);

                        $(event.currentTarget).unbind("click");
                    }
                });

                /**
                 * Adds annotation with values to the dropdown.
                 */
                function addAnnotationsToDropdown() {
                    dropdownElementsWrapper.empty();

                    // Adding dropdown elements.
                    _.forEach(data, function (annotation) {
                        if (_.isEmpty(annotation.annotationValue)) {
                            var dropDownItem = $("<li><a href='#'>" + annotation.annotationType + "</a></li>")
                                .appendTo(dropdownElementsWrapper);

                            // Creating click event when an dropdown value is select.
                            $(dropDownItem).click(function () {
                                var selectedAnnotationType = $(this).text();

                                // Setting the select text value to the dropdown clickable.
                                dropdownClickable.text(selectedAnnotationType);
                                // Appending the dropdown arrow to the button.
                                dropdownClickableIcon.appendTo(dropdownClickable);

                                // Showing the annotation value.
                                var selectedAnnotation = _.filter(data, function (annotation) {
                                    return annotation.annotationType == selectedAnnotationType;
                                });
                                annotationValueInput.val(_.first(selectedAnnotation).annotationValue);
                            });
                        }
                    });
                }

                /**
                 * Sets the annotation values in the model
                 * @param annonationType
                 * @param annotationValue
                 */
                function setAnnotationValues(annotationType, annotationValue){
                    if(annotationType == 'ServiceName'){
                        model.setServiceName(annotationValue);
                    }else if(annotationType == 'BasePath'){
                        model.setBasePath(annotationValue)
                    }
                }

                /**
                 * Creates the annotation detail wrapper and its events.
                 * @param annotationData - The annotation data.
                 * @param wrapper - The wrapper element which these details should be appended to.
                 */
                function createCurrentAnnotationView(annotationData, wrapper) {
                    wrapper.empty();

                    // Creating annotation info
                    _.forEach(annotationData, function (annotation) {
                        if (!_.isEmpty(annotation.annotationValue)) {

                            var annotationWrapper = $("<div/>", {
                                class: annotationDetailWrapper
                            }).appendTo(wrapper);

                            // Creating a wrapper for the annotation type.
                            var annotationTypeWrapper = $("<div/>", {
                                text: annotation.annotationType,
                                class: annotationDetailCellWrapper
                            }).appendTo(annotationWrapper);

                            // Creating a wrapper for the annotation value.
                            var annotationValueWrapper = $("<div/>", {
                                text: ": " + annotation.annotationValue,
                                class: annotationDetailCellWrapper
                            }).appendTo(annotationWrapper);

                            var deleteIcon = $("<i class='fw fw-cancel service-annotation-detail-cell-delete-icon'></i>");

                            deleteIcon.appendTo(annotationValueWrapper);

                            // When an annotation detail is clicked.
                            annotationWrapper.click({
                                clickedAnnotationValueWrapper: annotationValueWrapper,
                                clickedAnnotationTypeWrapper :annotationTypeWrapper,
                                annotation: annotation
                            }, function (event) {
                                var clickedAnnotationValueWrapper = event.data.clickedAnnotationValueWrapper;
                                var clickedAnnotationTypeWrapper = event.data.clickedAnnotationTypeWrapper;
                                var annotation = event.data.annotation;
                                // Empty the content inside the annotation value and type wrapper.
                                clickedAnnotationValueWrapper.empty();
                                clickedAnnotationTypeWrapper.empty();

                                // Changing the background
                                annotationWrapper.css("background-color", "#f5f5f5");

                                // Creating the text area for the value of the annotation.
                                var annotationValueTextArea = $("<textarea/>", {
                                    text: annotation.annotationValue,
                                    class: "form-control"
                                }).appendTo(clickedAnnotationValueWrapper);

                                // Creating the area for the type of the annotation.
                                var annotationTypeTextArea = $("<div/>", {
                                    text: annotation.annotationType,
                                    class: annotationDetailCellWrapper
                                }).appendTo(clickedAnnotationTypeWrapper);

                                //Gets the user input and set it as the annotation value
                                annotationValueTextArea.on('input', function (e){
                                    annotation.annotationValue = e.target.value;
                                });

                                //Gets the annotation type of the edited annotation value
                                annotationTypeTextArea.on('input', function (e){
                                    annotation.annotationType = e.target.value;
                                });

                                //Sets the annotation values in the model
                                setAnnotationValues(annotation.annotationType, annotation.annotationValue);

                                var newDeleteIcon = deleteIcon.clone();

                                // Fixing the delete icon.
                                newDeleteIcon.appendTo(clickedAnnotationValueWrapper);

                                // Adding in-line display block to override the hovering css.
                                newDeleteIcon.css("display", "block");

                                //Removes the annotation when clicking on the delete icon
                                newDeleteIcon.on('click', function (e){
                                    annotation.annotationValue = "";
                                    setAnnotationValues(annotation.annotationType, annotation.annotationValue);
                                    $(annotationWrapper).remove();
                                    addAnnotationsToDropdown();
                                });

                                // Resetting of other annotations wrapper which has been used for editing.
                                annotationWrapper.siblings().each(function () {

                                    // Removing the textareas of other annotations and use simple text.
                                    var annotationValueDiv = $(this).children().eq(1);
                                    if (annotationValueDiv.find("textarea").length > 0) {
                                        // Reverting the background color of other annotation editors.
                                        $(this).removeAttr("style");

                                        var annotationVal = ": " + annotationValueDiv.find("textarea").val();
                                        annotationValueDiv.empty().text(annotationVal);


                                        var delIcon = deleteIcon.clone();

                                        delIcon.appendTo(annotationValueDiv);
                                        delIcon.removeAttr("style");
                                    }
                                });
                            });
                        }

                    });
                }
            });
        };

        ServiceDefinitionView.prototype._createAnnotationButton = function (serviceContentSvg) {
            var svgDefinitions = d3.select(serviceContentSvg).append("defs");

            var annotationButtonPattern = svgDefinitions.append("pattern")
                .attr("id", "annotationIcon")
                .attr("width", "100%")
                .attr("height", "100%");

            annotationButtonPattern.append("image")
                .attr("xlink:href", "images/annotation.svg")
                .attr("x", 0)
                .attr("y", 0)
                .attr("width", 18.67)
                .attr("height", 18.67);

            var outerBoxPadding = parseInt($(serviceContentSvg.parentElement).css("padding"), 10);
            // xPosition = Width of the outer div - padding of outer box - radius of the annotation button - 20(additional value).
            var xPosition = $(serviceContentSvg.parentElement.parentElement.parentElement).prev().width() - outerBoxPadding - 18.675 - 40;
            // yPosition = (2 X radius of annotation button) + additional distance.
            var yPosition = 75;

            var annotationIconGroup = D3utils.group(d3.select(serviceContentSvg));

            var annotationIconBackgroundCircle = D3utils.circle(xPosition, yPosition, 18.675, annotationIconGroup)
                .classed("annotation-icon-background-circle", true);

            var annotationIconRect = D3utils.centeredRect(new Point(xPosition, yPosition), 18.67, 18.67, 0, 0, annotationIconGroup)
                .classed("annotation-icon-rect", true);

            // Positioning the icon when window is zoomed out or in.
            $(window).resize(function () {
                var outerBoxPadding = parseInt($(serviceContentSvg.parentElement).css("padding"), 10);

                // xPosition = Width of the outer div - padding of outer box - radius of the annotation button - 20(additional value).
                var xPosition = $(serviceContentSvg.parentElement.parentElement.parentElement).prev().width() - outerBoxPadding - 18.675 - 40;

                $(annotationIconBackgroundCircle.node()).remove();
                $(annotationIconRect.node()).remove();

                annotationIconBackgroundCircle = D3utils.circle(xPosition, yPosition, 18.675, annotationIconGroup)
                    .classed("annotation-icon-background-circle", true);

                annotationIconRect = D3utils.centeredRect(new Point(xPosition, yPosition), 18.67, 18.67, 0, 0, annotationIconGroup)
                    .classed("annotation-icon-rect", true);
            });

            // Get the hover effect of the circle on the icon hover.
            $(annotationIconRect.node()).hover(
                function () {
                    annotationIconBackgroundCircle.style("opacity", 1);
                },
                function () {
                    $(annotationIconBackgroundCircle.node()).removeAttr("style");
                }
            );

            $(annotationIconRect.node()).click(function (event) {
                $(annotationIconBackgroundCircle.node()).trigger("click");
                event.stopPropagation();
            });

            return annotationIconBackgroundCircle;
        };

        /**
         * set the lifeline margin
         * @param position
         */
        ServiceDefinitionView.prototype.setLifelineMargin = function (position) {
            this._lifelineMargin.setPosition(position);
        };

        /**
         * get the lifeline margin
         * @returns {Axis|*}
         */
        ServiceDefinitionView.prototype.getLifelineMargin = function () {
            return this._lifelineMargin;
        };

        return ServiceDefinitionView;
    });