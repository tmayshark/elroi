var testSeries = [[{value: 35, name: 'Cooling', color: '#1087C9'},
    {value: 19, name: 'Heating', color: '#AB3E2C'},
    {value: 15, name: 'Hot Water', color: '#663366'},
    {value: 15, name: 'Appliances', color: '#C2B59B'},
    {value: 10, name: 'Lighting', color: '#65D9C5'},
    {value: 5, name:'Other', color: '#8FC740'}]];

var testSeries2 = [[{value: 15, name: 'Cooling', color: '#1087C9'},
    {value: 15, name: 'Heating', color: '#AB3E2C'},
    {value: 15, name: 'Hot Water', color: '#663366'},
    {value: 15, name: 'Appliances', color: '#C2B59B'},
    {value: 15, name: 'Lighting', color: '#65D9C5'},
    {value: 15, name:'Other', color: '#8FC740'}]];


var astroSpinningPie = (function($){
    var ns = {};

    /* Mode enumeration*/
    var Mode = {
        INITIAL: 'initial',
        SURVEY: 'survey',
        COMPLETE: 'complete',
        SELECTED: 'selected'
    };

    ns.Mode = Mode;

    /* Member variables */
    /* Workflow */
    var sectionsCompleted = 0, //Used to keep track of progress during survey section
        mode = Mode.INITIAL;//,
        //selectedWedge = null;

    /* From elroi */
    var graph = null, //Graph generated by calling elroi
        wedges = null, //All of the pie wedges alias for graph.wedges
        pie = null; //Additional pie only functions associated with this pie provided by elroi, alias for graph.context

    /*Center circle */
    var circle = null,
        passthroughWedge = null, //wedge under the circle at the point of the mouse.  Needed for event passthrough.
        transformedWedgePaths = []; //the actual path of the wedge w/ rotation taken into account. Needed for event passthrough.

    /* Configurable variables */
    var BUMP_OUT_RADIUS = 210,
        STANDARD_RADIUS = 200,
        BASE_COLORS = ['#1087C9','#AB3E2C','#663366','#C2B59B','#65D9C5','#8FC740'],
        BASE_FONT = {'font-family':'proxima','font-weight':'bold','fill': 'black'};

    /* Message methods
     * Generates message text for a specific wedge based on Mode.
     * @param paper {object} Raphael paper that our graph is drawn on
     * @param centerX {number} Center x coordinate of our Raphael graph
     * @param centerY {number} Center y coordinate of our Raphael graph
     * @param wedgeIndex {number} Index of the wedge in wedges used for the message
     * @param wedgeData {object} Data tied to this wedge, can be set through the series data
     */
    /* Mode.COMPLETE text generator */
    function completeMessage (paper,centerX,centerY,wedgeIndex,wedgeData) {
        return [];
        return [
            paper.text(centerX,centerY-20,wedgeData.value+'%')
                .attr(BASE_FONT).attr({'font-size':55}),
            paper.text(centerX,centerY+20,wedgeData.name)
                .attr(BASE_FONT).attr({'font-size':25,'fill': wedges[wedgeIndex].attrs.fill})
        ];

    }

    /* Mode.INITIAL text generator */
    function initialMessage(paper,centerX,centerY,wedgeIndex,wedgeData) {
        return [];
        return [
            paper.text(centerX,centerY-20,wedgeData.name)
                .attr(BASE_FONT).attr({'font-size':25}),
            paper.text(centerX,centerY+15,wedgeData.value+'% is the average used\n by utility customers.')
                .attr(BASE_FONT).attr({'font-size':14})
        ];
    }

    /* Mode.SURVEY text generator */
    function surveyMessage(paper,centerX,centerY,wedgeIndex,wedgeData) {
        return [];

        if(wedgeIndex < sectionsCompleted) {
            return completeMessage(paper,centerX,centerY,wedgeIndex,wedgeData);
        }
        else {
            return[
                paper.text(centerX,centerY-20,wedgeData.name)
                    .attr(BASE_FONT).attr({'font-size':25})
                    .attr((wedgeIndex===sectionsCompleted) ? {fill: wedgeData.color } : {}),
                paper.text(centerX,centerY+15, (wedgeIndex===sectionsCompleted) ? 'In progress' : 'Not started')
                    .attr(BASE_FONT)
                    .attr({'font-size':14})
            ];
        }
    }

    /* Message helper methods */



    /**
     * Helper function to show or hide the message circle.
     * @param show {boolean} indicates whether or not to display the message circle.
     */
    function showMessageSet(show){
        if(!show) {
            passthroughWedge = null;
        }
        pie.showMessageSet(show);
        //circle.attr({opacity: show ? 1 : 0});
    }

    /* Section initialization methods */

    /* Mode.SURVEY specific initialization, called by changeMode */
    function surveyInitialize(){
        var i;
        for(i = sectionsCompleted-1; i >= 0; i--){
            wedges[i].attr({fill: BASE_COLORS[i]});
        }

        for(i = sectionsCompleted+1; i < wedges.length; i++){
            wedges[i].attr({fill: '#dddddd'});
        }

        wedges[sectionsCompleted].attr(descriptors[Mode.SURVEY].highlightAttr);
    }

    /* Mode.COMPLETE specific initialization, called by changeMode */
    function completeInitialize(){
        //selectedWedge = null;
        pie.resetSelectedWedge();
        pie.updateColors(BASE_COLORS);
    }

    /**
     * Event generated by the wedgeClick event alerting that the selected wedge has changed.  Depending on mode,
     * there may be specific logic to handle this event.
     * @param previousSelectedWedge {object} the old wedge selection
     * @param selectedWedge {object} the new wedge selection
     */
    function selectedWedgeChanged (previousSelectedWedge, selectedWedge){

        if((mode !== Mode.COMPLETE && mode !== Mode.SELECTED) || previousSelectedWedge === selectedWedge) {
            return;
        }
        /**
         * Highlight the newly selected wedge by changing its opacity to 1 and lowering the opacity of
         * nonselected wedges.
         */
        function highlightSelected(){
            var i, //index of wedge for traversal
                wedgesLength = wedges.length; //length of wedges for traversal

            for(i = 0; i < wedgesLength; i+=1) {
                if(selectedWedge !== null && wedges[i] !== selectedWedge){
                    wedges[i].animate({opacity:0.5}, 25);
                }
                else {
                    wedges[i].animate({opacity: 1}, 25);
                }
            }
            regenerateTransformedWedgePaths();
        }

        mode = Mode.SELECTED;
        if(previousSelectedWedge !== null) {
            previousSelectedWedge.attr(descriptors[mode].attr);
        }

        pie.rotateToWedge(selectedWedge, highlightSelected);
    }

    /* Workflow descriptors that correspond to each mode */
    var descriptors = {
        initial:
        {
            hover: {handles: true, attr: {fill: '#888888', radius: BUMP_OUT_RADIUS}},
            attr: {fill: '#dddddd', radius: STANDARD_RADIUS, opacity: 1},
            text: initialMessage
        },
        survey:
        {
            hover: {handles: true, attr: {radius: BUMP_OUT_RADIUS}},
            attr: {radius: STANDARD_RADIUS, opacity: 1},
            highlightAttr: {fill: '#888888', radius: BUMP_OUT_RADIUS},
            init: surveyInitialize,
            text: surveyMessage
        },
        complete:
        {
            hover: {handles: true, attr: {radius: BUMP_OUT_RADIUS}},
            click: {handles: true},
            selected: {selectionChanged: selectedWedgeChanged},
            attr: {radius: STANDARD_RADIUS, opacity: 1},
            init: completeInitialize,
            text: completeMessage
        },
        selected:
        {
            hover: {handles: true, attr: {radius: BUMP_OUT_RADIUS}},
            click: {handles: true},
            selected: {selectionChanged: selectedWedgeChanged, showTextAsDefault: true},
            highlighAttr: {radius: BUMP_OUT_RADIUS},
            attr: {radius: STANDARD_RADIUS, opacity:0.5},
            text: completeMessage
        }
    };

    /* Elroi event callbacks */

    /**
     * Click hook to provide to pie elroi graph.  Calls a handler determined by the provided
     * descriptors for the current mode.
     * @param wedge {object} the wedge that is the target of the event, provided by elroi
     */
    var wedgeClick = function(wedge){

        if(!descriptors[mode].click) {
            return;
        }

        if(!pie.isSelectedWedge(wedge)){
            pie.showMessageTextSet(false);
            pie.showMessageSet(false);
        }
    };

    var wedgeSelectionChanged = function(previouslySelectedWedge, selectedWedge){
        if(descriptors[mode].selected && descriptors[mode].selected.selectionChanged){
            descriptors[mode].selected.selectionChanged(previouslySelectedWedge, selectedWedge);
        }
    };


    var hoverWedge;
    /**
     * Hover enter hook to provide to pie elroi graph.  Calls a handler determined by the provided
     * descriptors for the current mode.
     * @param wedge {object} the wedge that is the target of the event, provided by elroi
     */
    function wedgeHoverIn(wedge){

        console.log("wedge hover in");
        var fromInsideCircle = (hoverWedge) ? true : false;
        deemph(hoverWedge);
        hoverWedge = wedge;

        /* RESET TEXT */
        var wedgeIndex = pie.getWedgeIndex(wedge);
        pie.resetMessageTextSet(
            descriptors[mode].text(graph.paper,
                graph.options.pie.center.x,
                graph.options.pie.center.y,
                wedgeIndex,
                wedge.data
            )
        );

        /* Show Message Box if we Aren't Already */
        if(!fromInsideCircle)
            showMessageSet(true); //We don't need to do this if we are already showing it!

        /* Emphasize wedge if it's not already by virtue of being selected in a selectable mode*/
        if(pie.isSelectedWedge(wedge) && mode === Mode.SELECTED){
            return;
        }  else {
            wedge.animate(descriptors[mode].hover.attr, 150, 'bounce');
        }

    }

    function deemph(wedge){
        if(!wedge) return;

        if(pie.isSelectedWedge(wedge) && mode === Mode.SELECTED) {
            return;
        } else {
            wedge.animate(descriptors[mode].attr,150, 'bounce');
        }
    }

    /**
     * Hover exit hook to provide to pie elroi graph.  Calls a handler determined by the provided
     * descriptors for the current mode.
     * @param wedge {object} the wedge that is the target of the event, provided by elroi
     */
    function wedgeHoverOut(e, wedge) {
        if(c1[0] === e.toElement || c2[0] === e.toElement){
            passthroughWedge = hoverWedge;
            return;
        }

        //if(e.toElement && wedges[0].nodeName === e.toElement.nodeName) return;

        var x;
        for(x = 0; x < wedges.length; x+=1)
            if(wedges[x].node === e.toElement)
                return;

        deemph(wedge);

        showMessageSet(false);
        pie.showMessageTextSet(false);

        hoverWedge = null;

    }

    /* Public workflow and initialization */

    /**
     * Change the mode to Mode.SURVEY and to the selected section.
     * @param section {number} the number of sections to indicate as being completed.
     */
    ns.changeSection = function(section) {
        if(isNaN(section)) {
            throw "Parameter section must be a number.";
        }

        sectionsCompleted = section;
        pie.resetSelectedWedge(wedges[sectionsCompleted]);
        ns.changeMode(Mode.SURVEY);
    };

    /**
     * Change the mode of the workflow to a different descriptor state.  Make mode specific styling changes
     * and trigger mode specific init events.
     * @param newMode {enum} new mode from Mode enum to switch to.
     */
    ns.changeMode = function(newMode){
        mode = newMode;
        wedges.animate(descriptors[mode].attr, 25, function(){
            if(descriptors[mode].init){
                descriptors[mode].init();
            }
        });
    };


    function regenerateTransformedWedgePaths() {
        var i, //index of wedge
            wedgesLength = wedges.length, //length of wedges
            path, //path of wedge, updated path with each transform
            t, //index of transform
            tl; //length of transforms

        for(i=0; i < wedgesLength; i+=1) {
            path = wedges[i].attrs.path.toString();
            tl = wedges[i].attrs.transform.length;
            for(t = 0; t < tl; t+=1){
                path = Raphael.transformPath(path, wedges[i].attrs.transform[t].toString());
            }
            transformedWedgePaths[i] = path.toString();
        }
    }


    /**
     * Creates and initalizes an astroSpinningPie.
     * @param $container {object} jQuery object to place the elroi graph into
     */
    ns.initialize = function($container){

        function circleMouseMove(e){
            //console.log("mouse moved");
            var newWedge, //used to store new wedge if it is detected the passthroughWedge has changed
                i,
                wedgesLength = wedges.length;

            if(transformedWedgePaths.length === 0){
                regenerateTransformedWedgePaths();
            }

            //Detect which wedge the mouse is currently hovering over
            for(i=0; i < wedgesLength; i+=1){
                if(passthroughWedge !== null && newWedge === passthroughWedge) {
                    continue;
                }
                if(graph.isMouseInPath(e,transformedWedgePaths[i])) {
                    newWedge = wedges[i];
                    break;
                }
            }

            //Check if we actually had a change and update the passthroughWedge accordingly and simulate events.
            if(newWedge !== null && newWedge !== passthroughWedge) {

                passthroughWedge = newWedge;
                if(newWedge !== hoverWedge){
                    wedgeHoverIn(newWedge);
                }

            }
        }

        function circleClick(){
            var i;
            if(passthroughWedge){
                for(i=0;i< passthroughWedge.events.length; i+=1){
                    if(passthroughWedge.events[i].name === "click"){
                        passthroughWedge.events[i].f();
                        return;
                    }
                }
            }
        }

        pie = elroi($container, [{series:testSeries, options: {type:'pie'}}],
            {colors: ['#dddddd','#dddddd','#dddddd','#dddddd','#dddddd','#dddddd'],
                //animation: false,
                pie: {
                    wedgeAttributes: {stroke: 'white', 'stroke-width': 3, cursor: 'pointer'},
                    wedgeClick: wedgeClick,
                    wedgeHoverIn: wedgeHoverIn,
                    wedgeHoverOut: wedgeHoverOut,
                    wedgeSelectionChanged: wedgeSelectionChanged,
                    messageSetAttributes: {fill: '#F5F5F5', stroke: 'white', 'stroke-width':3, opacity:0, cursor: 'pointer'},
                    radius: 200}
            });

        graph = pie.graph;
        wedges = pie.graph.wedges;

        c1 =  pie.getMessageSet()[0];
        c2 = pie.getMessageSet()[1];

        circle = (pie.getMessageSet()[1])
            .mousemove(circleMouseMove)
            .click(circleClick)
            .hover(function(){console.log("circle hover in");
            },
            function(e){

                wedgeHoverOut(e, passthroughWedge); //security against skipping out event
                console.log("circle hover out");
            });


    };

    var c1, c2;
    /* CUT THESE HOOKS */

    ns.resetRotation = function(){
        pie.rotate(-90, function(){regenerateTransformedWedgePaths();});
    };

    ns.resizeLive = function (){
        pie.updateLive(testSeries2,0,regenerateTransformedWedgePaths);
    };

    return ns;
})(jQuery);



$(document).ready(function(){
    astroSpinningPie.initialize($('#pie').find('.graph'));

    $('#deselect,#finish').click(function(){astroSpinningPie.changeMode(astroSpinningPie.Mode.COMPLETE);});

    $('#cooling1,#cooling2,#cooling3,#cooling4').click(function(){ astroSpinningPie.resetRotation(); astroSpinningPie.changeSection(0); });
    $('#heating1, #heating2').click(function(){ astroSpinningPie.resetRotation(); astroSpinningPie.changeSection(1); });
    $('#hotwater1').click(function(){ astroSpinningPie.resetRotation(); astroSpinningPie.changeSection(2); });
    $('#appliances1').click(function(){ astroSpinningPie.resetRotation(); astroSpinningPie.changeSection(3); });
    $('#lighting1').click(function(){ astroSpinningPie.resetRotation(); astroSpinningPie.changeSection(4); });
    $('#other1').click(function(){ astroSpinningPie.resetRotation(); astroSpinningPie.changeSection(5); });

    $('#rotateTo0').click(function(){ astroSpinningPie.resetRotation();  });

    $('#resize1').click(function(){ astroSpinningPie.resizeLive();  });
});