// Chloropleth Variables
var mapMargin = {top: 20, bottom: 10, left: 10, right:10}
    , mapWidth = 600
    , mapWidth = mapWidth - mapMargin.left - mapMargin.right
    , mapRatio = 0.5
    , mapHeight = mapWidth * mapRatio
    , active = d3.select(null);

var errorCount = 0;

var mapSVG, mapColor, mapG, countyMap, stateMap;
var countyAgg, stateAgg, dictCounties, dictState;
var currStateSel, currCountySel, selStateID, selState, selStateFeature, stateView;

// Bar Variables
var barMargin = {top: 10, right: 10, bottom: 30, left: 225}
    , barMargin2 = {top: 10, right: 10, bottom: 30, left: 10}
    , barWidth = 550 - barMargin.left - barMargin.right
    , barHeight = 400 - barMargin.top - barMargin.bottom
    , barWidth2 = 100 - barMargin2.left - barMargin2.right;

var barSVG,focus,context,
    textScale,xScale,x2Scale,yScale,y2Scale,
    xAxis,yAxis,yAxis2,
    brushExtent, pollData;

//Common Variables
var selRisk = "totrisk";

// Chloropleth Elements
mapSVG = d3.select('.map').append('svg')
  .attr('class', 'center-container')
  .attr('height', mapHeight + mapMargin.top + mapMargin.bottom)
  .attr('width', mapWidth + mapMargin.left + mapMargin.right);

mapColor = d3.scaleSequential(d3.interpolateBlues);

mapSVG.append('rect')
.attr('class', 'background center-container')
.attr('height', mapHeight + mapMargin.top + mapMargin.bottom)
.attr('width', mapWidth + mapMargin.left + mapMargin.right);

mapG = mapSVG.append("g")
  .attr('class', 'center-container center-items us-state')
  .attr('transform', 'translate('+mapMargin.left+','+mapMargin.top+')')
  .attr('width', mapWidth + mapMargin.left + mapMargin.right)
  .attr('height', mapHeight + mapMargin.top + mapMargin.bottom);

var projection = d3.geoAlbersUsa()
    .translate([mapWidth /2 , mapHeight / 2])
    .scale(mapWidth);

var path = d3.geoPath()
    .projection(projection);

//Common Elements
var tooltip = d3.select("body").append("div")
	.attr("class", "tooltip")
	.style("opacity", 0);

//Dropdown selection
var riskDropdown = d3.select("#risk_options");
// populate drop-down
riskDropdown.on("change", updateRisk)
            .selectAll("option")
            .data(risks)
            .enter()
            .append("option")
            .attr("value", function(option) { return option.value; })
            .text(function(option) { return option.text; });

showStates();

function showStates() {
  stateView = true;
  var stateFile = "../data/StateData/" + selRisk + ".csv";
  console.log("in state: ", stateFile);
  d3.json("../data/us-counties.topojson", function(us) {
      d3.csv(stateFile, function(error, data) {
        if (error) throw error;
        console.log(data);
        console.log(us);

        stateAgg = d3.nest()
                      .key(function(d) { return d.id ; })
                      .rollup(function(v) { return {
                        state: d3.max(v, function(d){ return d.state; }),
                        val: d3.mean(v, function(d) { return parseFloat(d.val); })
                      }; })
                      .entries(data);
        // console.log(JSON.stringify(stateAgg));

        //create objects with state id and data as key-value pairs
        dictStates = {};
        stateAgg.forEach(function(d) {
            dictStates[d.key] = d;
        });
        console.log(dictStates);

        stateMap = mapG.append("g");

        stateMap.attr("id", "states")
                .selectAll("path")
                .data(topojson.feature(us, us.objects.states).features)
                .enter()
                .append("path")
                .attr("d", path)
                .attr("class", "state")
                .attr("fill", "#b3b3b3")
                .call(updateStateFill)
                .on("click", function(d){
                  selStateID = d.id;
                  selState = dictStates[d.id].value.state;
                  selStateFeature = d;
                  d3.select("#states").remove();
                  hideTip();
                  showCounty(selStateID);
                  countyZoom();
                })
                .on("mouseover", function(d){
                  selStateID = d.id;
                  stateDataFil = data.filter(function (d){return d.id==selStateID});
                  d3.select(".bar_chart").select("svg").remove();
                  getPollData(stateDataFil);
                  createBar(pollData, data);
                  stateHover(d);
                })
                .on("mouseout", function(d) {
                  d3.select(".bar_chart").select("svg").remove();
                  getPollData(data);
                  createBar(pollData, data);
                  hideTip();
                });

        d3.select(".bar_chart").select("svg").remove();
        getPollData(data);
        createBar(pollData, data);
    })
  });
}

function updateStateFill(selection) {
  // console.log("Selection: ",selection.data());
  currStateSel = selection;
  mapColor.domain([d3.min(stateAgg, function(d) { return d.value.val; }),
                d3.max(stateAgg, function(d) { return d.value.val; })]);
  selection.transition()
           .duration(700)
           .attr("fill", function(d) {
             if (dictStates[d.id]) {
                var value = dictStates[d.id].value.val;

                if (value) {
                  return mapColor(value);
                } else {
                  return mapColor(0);
                }
            }
           });
}

function showCounty(fips) {
  stateView = false;
	var countyFile = "../data/CountyData/" + selRisk + "/" + selRisk + selState + ".csv";
  console.log("in county: ", countyFile);

  d3.json("../data/us-counties-full.topojson", function(us) {
    d3.csv(countyFile, function(error, data) {
      if (error) throw error;
      console.log(data);

      countyAgg = d3.nest()
                    .key(function(d) { return d.fips; })
                    .rollup(function(v) { return {
                      county: d3.max(v, function(d){ return d.county; }),
                      val: d3.mean(v, function(d) { return d.val; })
                    }; })
                    .entries(data);
      // console.log("County Agg: ", JSON.stringify(countyAgg));

      //create objects with county fip and data as key-value pairs
      dictCounties = {};
      countyAgg.forEach(function(d) {
          dictCounties[d.key] = d;
      });
      console.log(dictCounties);

      countyMap = mapG.append("g");
  //
      countyMap.attr("id", "counties")
              .selectAll("path")
              .data(topojson.feature(us, us.objects.collection).features.filter(function(d) {return d.properties.state_fips == fips;}))
              .enter()
              .append("path")
              .attr("d", path)
              .attr("class", "county")
              .attr("fill", "#b3b3b3")
              .call(updateCountyFill)
              .on("click", function(d){
                d3.select("#counties").remove();
                hideTip();
                showStates();
                reset();
              })
          .on("mouseover", function(d) {
            countyFips = d.properties.fips;
            countyDataFil = data.filter(function (d){return d.fips==countyFips});
            d3.select(".bar_chart").select("svg").remove();
            getPollData(countyDataFil);
            createBar(pollData, data);
            countyHover(d);
          })
          .on("mouseout", function(d) {
            d3.select(".bar_chart").select("svg").remove();
            getPollData(data);
            createBar(pollData, data);
            hideTip();
          });

      d3.select(".bar_chart").select("svg").remove();
      getPollData(data);
      createBar(pollData, data);
    })
  });
}

function updateCountyFill(selection) {
  currCountySel = selection;
  mapColor.domain([d3.min(countyAgg, function(d) { return d.value.val; }),
                d3.max(countyAgg, function(d) { return d.value.val; })]);
  selection.transition()
           .duration(700)
           .attr("fill", function(d) {
             // console.log("county d: ",d, parseInt(d.properties.fips), dictCounties[parseInt(d.properties.fips)]);
             countyObj = dictCounties[parseInt(d.properties.fips)];
             if (countyObj) {
                var value = countyObj.value.val;
                return mapColor(value);
              }
              else {
                return mapColor(0);
              }
           });
}

function countyZoom() {
  var bounds = path.bounds(selStateFeature),
      dx = bounds[1][0] - bounds[0][0],
      dy = bounds[1][1] - bounds[0][1],
      x = (bounds[0][0] + bounds[1][0]) / 2,
      y = (bounds[0][1] + bounds[1][1]) / 2,
      scale = .9 / Math.max(dx / mapWidth, dy / mapHeight),
      translate = [mapWidth / 2 - scale * x, mapHeight / 2 - scale * y];

  mapG.transition()
      .duration(2000)
      .style("stroke-width", 1.5 / scale + "px")
      .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
}

function reset(){
  mapG.transition()
      // .delay(100)
      .duration(950)
      .style("stroke-width", "1.5px")
      .attr('transform', 'translate('+mapMargin.left+','+mapMargin.top+')');
}

function getPollData(data) {
  pollData = d3.nest()
                .key(function(d) { return d.pollutant; })
                .rollup(function(v) { return {
                  val: d3.mean(v, function(d) { return d.val; })
                }; })
                .entries(data);
  // console.log(JSON.stringify(pollData), pollData.length);
}

function createBar(pollData, data){

    barSVG = d3.select(".bar_chart").append("svg")
                .attr("width", barWidth + barMargin.left + barMargin.right + barWidth2 + barMargin2.left + barMargin2.right)
                .attr("height", barHeight + barMargin.top + barMargin.bottom);

    focus = barSVG.append("g")
                  .attr("transform", "translate(" + barMargin.left + "," + barMargin.top + ")")
                  .attr("class","focus");

    context = barSVG.append("g")
                    .attr("class", "context")
                    .attr("transform", "translate(" + (barMargin.left + barWidth + barMargin.right + barMargin2.left) + "," + barMargin2.top + ")");

    textScale = d3.scaleLinear()
                  .domain([8,75])
                  .range([12,6])
                  .clamp(true);

    xScale = d3.scaleLinear().range([0, barWidth]),
    x2Scale = d3.scaleLinear().range([0, barWidth2]),
    yScale = d3.scaleBand().range([0, barHeight]).paddingInner(0.4),
    y2Scale = d3.scaleBand().range([0, barHeight]).paddingInner(0.4);

    //Create x axis object
    xAxis = d3.axisBottom(xScale),
    yAxis = d3.axisLeft(yScale).tickSize(0).tickSizeOuter(0),
    yAxis2 = d3.axisLeft(y2Scale);

    pollData.sort(function(a,b) { return b.value.val - a.value.val; });
    // console.log(pollData);

    xScale.domain([0, d3.max(pollData, function(d) { return d.value.val; })]);
    x2Scale.domain([0, d3.max(pollData, function(d) { return d.value.val; })]);
    yScale.domain(pollData.map(function(d) { return d.key; }));
    y2Scale.domain(pollData.map(function(d) { return d.key; }));

    var brush = d3.brushY()
                  .extent([[0, 0],[barWidth2, barHeight]])
                  .on("brush", brushed);

    var zoom = d3.zoom()
                .scaleExtent([1, Infinity])
                .translateExtent([[0, 0],[barWidth, barHeight]])
                .extent([[0, 0],[barWidth, barHeight]])
                .on("zoom", zoomed);

    // Add the X Axis
    focus.append("g")
          .attr("class", "x axis")
          .attr("transform", "translate(0," + barHeight + ")")
          .call(xAxis);

    focus.append("g")
          .attr("class", "y axis")
          .attr("transform", "translate(-5, 0)")
          .call(yAxis);

    barSVG.append("defs").append("clipPath")
          .attr("id", "clip")
          .append("rect")
          .attr("width", barWidth)
          .attr("height", barHeight);

    var focus_group = focus.append("g").attr("clip-path", "url(#clip)");

    var rects = focus_group.selectAll('rect').data(pollData);

    //********* Bar Chart 1 ****************
    var newRects1 = rects.enter();

    newRects1.append('rect')
              .attr('id', 'mainBars')
              .attr('class', 'bar mainBars')
              .attr('y', function(d, i) {
                return yScale(d.key) + yScale.bandwidth();
              })
              .attr('x', 0)
              .attr('height', 8)
              .attr('width', function(d, i) {
                return xScale(d.value.val);
              })
              .attr('opacity', 0.85)
              .style('fill', '#b3003b')
              .style('stroke', '#80002a')
              .on("mouseover", function(d){
                d3.select(this).style('fill', '#e600ac')
                                .style('stroke', '#e600ac');
                pollHover(d);
                updatePoll(d.key, data);
              })
              .on("mouseout", function(d){
                d3.select(this).style('fill', '#b3003b')
                                .style('stroke', '#80002a');
                hideTip();
                resetPoll(data);
              });

    var focus_group = context.append("g").attr("clip-path", "url(#clip)");

    var brushRects = focus_group.selectAll('rect').data(pollData);

    //********* Brush Bar Chart ****************
    var brushRects1 = brushRects.enter();

    brushRects1.append('rect')
                .attr('class', 'bar miniBars')
                .attr('y', function(d, i) {
                  return y2Scale(d.key);
                })
                .attr('x', 0)
                .attr('width', function(d, i) {
                  return x2Scale(d.value.val);
                })
                .attr('opacity', 0.85)
                .attr('height', 5)
                .style('fill', '#4d0019')
                .style('stroke', '#330011');

    if (pollData.length > 8) { brushExtent = 8;}
    else {brushExtent = pollData.length - 1;}

    context.append("g")
            .attr("class", "brush")
            .call(brush)
            .call(brush.move, ([y2Scale(pollData[0].key), y2Scale(pollData[brushExtent].key)]));

    //create brush function redraw barChart with selection
    function brushed() {
      if (d3.event.sourceEvent && d3.event.sourceEvent.type === "zoom") return; // ignore brush-by-zoom

      // get bounds of selection
      var s = d3.event.selection,
          nD = [];
      y2Scale.domain().forEach((d)=>{
        var pos = y2Scale(d) + y2Scale.bandwidth()/2;
        if (pos > s[0] && pos < s[1]){
          nD.push(d);
        }
      });

      yScale.domain(nD);

      focus.selectAll(".mainBars")
            .style("opacity", function(d){
              return yScale.domain().indexOf(d.key) === -1 ? 0 : 100;
            })
            .attr("y", function(d) {
              // console.log(y.bandwidth(), nD.length);
              return yScale(d.key)+ yScale.bandwidth()/4;
            })
            .attr("x", 0)
            .attr('width', function(d, i) {
              return xScale(d.value.val)
            })
            .attr('opacity', 0.85)
            .attr('height', yScale.bandwidth()/1.1);

      //Update the label size
      d3.selectAll(".y.axis")
        .style("font-size", textScale(nD.length) + "px");

      focus.select(".y.axis").call(yAxis);

      //Find the new max of the bars to update the x scale
      var newMaxXScale = d3.max(pollData, function(d) {
        // console.log(d.key, nD.indexOf(d.key), d.value.val);
        return nD.indexOf(d.key) > -1 ? d.value.val : 0;
      });
      // console.log(nD, newMaxXScale);
      xScale.domain([0, newMaxXScale]);

      //Update the x axis of the big chart
      d3.select(".focus")
        .select(".x.axis")
        .transition()
        .duration(250)
        .call(xAxis);

      barSVG.select(".zoom").call(zoom.transform, d3.zoomIdentity
            .scale(barWidth / (s[1] - s[0]))
            .translate(-s[0], 0));
    }

    function zoomed() {
    }
}

function stateHover(d) {
  var value = dictStates[d.id].value.val;
  if (value) {
     tooltip.transition()
             .duration(250)
             .style("opacity", 1);
             tooltip.html(
             "<p><strong>" + dictStates[d.id].value.state + "</strong></p>" +
             "<table><tbody>" +
             "<tr><td>Risk:</td><td>" + value + "</td></tr></tbody></table>"
             )
             .style("left", (d3.event.pageX + 15) + "px")
             .style("top", (d3.event.pageY - 28) + "px");
  }
      // console.log(d.id, value, dictStates[d.id].value.state);
}

function countyHover(d) {
  var countyObj = dictCounties[parseInt(d.properties.fips)];
  if (countyObj) {
   tooltip.transition()
           .duration(250)
           .style("opacity", 1);
           tooltip.html(
           "<p><strong>" + countyObj.value.county + ", " + selState + "</strong></p>" +
           "<table><tbody>" +
           "<tr><td>Risk:</td><td>" + countyObj.value.val + "</td></tr></tbody></table>"
           )
           .style("left", (d3.event.pageX + 15) + "px")
           .style("top", (d3.event.pageY - 28) + "px");
  }
}

function hideTip() {
  tooltip.transition()
          .duration(250)
          .style("opacity", 0);
}

function pollHover(d) {
  console.log("pollhover: ", d);
    tooltip.transition()
            .duration(550)
            .style("opacity", 1);
    tooltip.html(
                "<p><strong>" + d.key + "</strong></p>" +
                "<table><tbody>" +
                "<tr><td>Risk:</td><td>" + d.value.val + "</td></tr></tbody></table>"
            )
            .style("left", (d3.event.pageX + 15) + "px")
            .style("top", (d3.event.pageY - 28) + "px");
}

function updateRisk() {
  console.log("In Update");
  selRisk = this.value
  if (stateView) {
  	var riskFile = "../data/StateData/" + selRisk + ".csv";
    console.log(riskFile);
    d3.csv(riskFile, function(error, data) {
      if (error) throw error;
      console.log(data);
      stateAgg = d3.nest()
                    .key(function(d) { return d.id ; })
                    .rollup(function(v) { return {
                    state: d3.max(v, function(d){ return d.state; }),
                    val: d3.mean(v, function(d) { return parseFloat(d.val); })
                    }; })
                    .entries(data);
      // console.log(JSON.stringify(stateAgg));
      //
      //create objects with state id and data as key-value pairs
      dictStates = {};
      stateAgg.forEach(function(d) {
        dictStates[d.key] = d;
      });
      // console.log(dictStates);
      d3.select(".bar_chart").select("svg").remove();
      getPollData(data);
      createBar(pollData, data);
      stateMap.call(updateStateFill(currStateSel));
    });
  } else {
  	var riskFile = "../data/CountyData/"  + selRisk + "/" + selRisk + selState + ".csv";
    console.log(riskFile);
    d3.csv(riskFile, function(error, data) {
      if (error) throw error;
      console.log(data);
      countyAgg = d3.nest()
                    .key(function(d) { return d.fips; })
                    .rollup(function(v) { return {
                      county: d3.max(v, function(d){ return d.county; }),
                      val: d3.mean(v, function(d) { return d.val; })
                    }; })
                    .entries(data);
      // console.log(JSON.stringify(countyAgg));
      //
      //create objects with state id and data as key-value pairs
      dictCounties = {};
      countyAgg.forEach(function(d) {
          dictCounties[d.key] = d;
      });
      // console.log(dictCounties);
      d3.select(".bar_chart").select("svg").remove();
      getPollData(data);
      createBar(pollData, data);
      countyMap.call(updateCountyFill(currCountySel));
    });
  }
}

function updatePoll(pollName, data) {
  console.log("In Poll Update: ", pollName);
	console.log(data);
  pollDataFil = data.filter(function (d){return d.pollutant==pollName});
  if (stateView) {
    stateAgg = d3.nest()
                  .key(function(d) { return d.id ; })
                  .rollup(function(v) { return {
                  state: d3.max(v, function(d){ return d.state; }),
                  val: d3.mean(v, function(d) { return parseFloat(d.val); })
                  }; })
                  .entries(pollDataFil);
    // console.log(JSON.stringify(stateAgg));
    //
    //create objects with state id and data as key-value pairs
    dictStates = {};
    stateAgg.forEach(function(d) {
      dictStates[d.key] = d;
    });
    // console.log(dictStates);
    stateMap.call(updateStateFill(currStateSel));
  } else {
    countyAgg = d3.nest()
                  .key(function(d) { return d.fips; })
                  .rollup(function(v) { return {
                    county: d3.max(v, function(d){ return d.county; }),
                    val: d3.mean(v, function(d) { return d.val; })
                  }; })
                  .entries(pollDataFil);
    // console.log(JSON.stringify(countyAgg));
    //
    //create objects with state id and data as key-value pairs
    dictCounties = {};
    countyAgg.forEach(function(d) {
        dictCounties[d.key] = d;
    });
    // console.log(dictCounties);
    countyMap.call(updateCountyFill(currCountySel));
  }
}

function resetPoll(data) {
  console.log("In Poll Reset: ");
	console.log(data);
  if (stateView) {
    stateAgg = d3.nest()
                  .key(function(d) { return d.id ; })
                  .rollup(function(v) { return {
                  state: d3.max(v, function(d){ return d.state; }),
                  val: d3.mean(v, function(d) { return parseFloat(d.val); })
                  }; })
                  .entries(data);
    // console.log(JSON.stringify(stateAgg));
    //
    //create objects with state id and data as key-value pairs
    dictStates = {};
    stateAgg.forEach(function(d) {
      dictStates[d.key] = d;
    });
    // console.log(dictStates);
    stateMap.call(updateStateFill(currStateSel));
  } else {
    countyAgg = d3.nest()
                  .key(function(d) { return d.fips; })
                  .rollup(function(v) { return {
                    county: d3.max(v, function(d){ return d.county; }),
                    val: d3.mean(v, function(d) { return d.val; })
                  }; })
                  .entries(data);
    // console.log(JSON.stringify(countyAgg));
    //
    //create objects with state id and data as key-value pairs
    dictCounties = {};
    countyAgg.forEach(function(d) {
        dictCounties[d.key] = d;
    });
    // console.log(dictCounties);
    countyMap.call(updateCountyFill(currCountySel));
  }
}
