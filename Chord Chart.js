var chordChart = {
  'initialize': function() {
    // Don't do anything if the query is invalid
      var query = DA.query.getQuery();
      if (Object.keys(query.fields).length === 0) {
        d3.select('#__da-app-content')
        .html('<h1>Just add data!</h1><p style="line-height: normal">Add data in your widget settings to start making magic happen.</p>');
        javascriptAbort(); // Garbage meaningless function to get the widget to stop processing
      }
      else if (Object.keys(query.fields.dimension).length !== 2 ||
               Object.keys(query.fields.metric).length !== 1) {
        d3.select('#__da-app-content')
        .html('<h1>Invalid data selection.</h1><p style="line-height: normal">Select two dimensions and one measurement.</p>');
        javascriptAbort(); // Garbage meaningless function to get the widget to stop processing
      }
    
    // Create prefs and functions if they haven't been set
      if (typeof prefs === 'undefined') {
        prefs = {
          'colorScheme': 'Sinebow',
          'summable': false
        };
      }
      
      var colorScale;
      if (eval('typeof d3.interpolate' + prefs.colorScheme) !== 'undefined') {
        colorScale = eval('d3.interpolate' + prefs.colorScheme);
      }
      else {
        colorScale = d3.interpolateSinebow;
      }
    
    // Store the query result
      var queryResult = DA.query.getQueryResult();
    
    // Create a wrapper function for formatting metrics
      function formatMetric(value) {
        return new Promise((resolve, reject) => {
          DA.query.getFormattedValue({
            systemName: queryResult.fields[2].systemName,
            value: value,
            cb: (err, data) => resolve(data)
          });
        });
      }
    
    // Create data for left and right node groups
      var leftDims = d3.rollups(queryResult.rows, v => d3.sum(v, d => d[2].value), d => d[0].formattedValue).sort((a, b) => d3.descending(a[1], b[1]));
      var leftValues = leftDims.map(x => x[1]);
      
      var rightDims = d3.rollups(queryResult.rows, v => d3.sum(v, d => d[2].value), d => d[1].formattedValue).sort((a, b) => d3.ascending(a[1], b[1]));
      var rightValues = rightDims.map(x => x[1]);
      
      var valueTotal = d3.sum(queryResult.rows, d => d[2].value);
    
    // Create the document structure
      var svg = d3.select('#__da-app-content').append('svg')
        .attr('viewBox', '-0.4 0 1.8 1')
        .attr('preserveAspectRatio', 'xMidYMid meet');
      
      var tooltip = d3.select('#__da-app-content').append('div')
        .attr('id', 'tooltip')
        .style('opacity', 0);
      var tooltipLines = tooltip.selectAll('div')
      .data([['tooltipLine1', queryResult.fields[0].name], ['tooltipLine2', queryResult.fields[1].name], ['tooltipNumber', queryResult.fields[2].name]])
      .join('div')
        .attr('id', d => d[0]);
      tooltipLines.append('span')
        .attr('class', 'tooltip-label')
        .text(d => d[1] + ': ');
      tooltipLines.append('span')
        .attr('class', 'tooltip-value');
      var tooltipDim1 = tooltipLines.filter((d, i) => i === 0).select('.tooltip-value');
      var tooltipDim2 = tooltipLines.filter((d, i) => i === 1).select('.tooltip-value');
      var tooltipMetric = tooltipLines.filter((d, i) => i === 2).select('.tooltip-value');
    
    // Create useful functions
      var arcScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0.2, 0.8]);
      
      function circleXY(radius, extraAngle, data, index, rotate){
        var angle = (180 * arcScale((extraAngle + d3.sum(data.slice(0, index))) / valueTotal) + rotate) * (Math.PI / 180);
        return [
          0.5 + radius * Math.cos(angle),
          0.5 + radius * Math.sin(angle)
        ].join(' ');
      }
      
      var lowerOpacity = 0.15;
      function mouseEnter(focus, mouseSide) {
        switch(mouseSide) {
          case 'left':
            links.filter(d => d[0].formattedValue != focus).transition().style('opacity', lowerOpacity);
            break;
          case 'right':
            links.filter(d => d[1].formattedValue != focus).transition().style('opacity', lowerOpacity);
        }
      }
      
      var baseOpacity = 0.6;
      function mouseLeave() {
        links.transition().style('opacity', baseOpacity);
      }
    
    // Build the visual
      var nodeSize = 0.05;
      var nodeLinkGap = 0.005;
      
      // Create the left node elements
        var leftNodes = svg.append('g').attr('id', 'left-nodes')
          .selectAll('path')
          .data(leftDims)
          .join('path')
            .attr('id', d => '0-' + d[0])
            .style('fill', (d, i) => colorScale(i / (leftDims.length + rightDims.length)))
            .on('mouseenter', (event, d) => mouseEnter(d[0], 'left'))
            .on('mouseleave', mouseLeave)
            .attr('d', (d, i) => {
              var path = [];
              path.push(['M', circleXY(0.5, 0, leftValues, i, -270)].join(' '));
              path.push(['A', 0.5, 0.5, 0, 0, 1, circleXY(0.5, d[1], leftValues, i, -270)].join(' '));
              path.push(['L', circleXY(0.5 - nodeSize, d[1], leftValues, i, -270)].join(' '));
              path.push(['A', 0.5, 0.5, 0, 0, 0, circleXY(0.5 - nodeSize, 0, leftValues, i, -270)].join(' '));
              return path.join(' ') + 'z';
            });
      
      // Create the right node elements
        var rightNodes = svg.append('g').attr('id', 'right-nodes')
          .selectAll('path')
          .data(rightDims)
          .join('path')
            .attr('id', d => '1-' + d[0])
            .style('fill', (d, i) => colorScale((i + leftDims.length) / (leftDims.length + rightDims.length)))
            .on('mouseenter', (event, d) => mouseEnter(d[0], 'right'))
            .on('mouseleave', mouseLeave)
            .attr('d', (d, i) => {
              var path = [];
              path.push(['M', circleXY(0.5, 0, rightDims.map(x => x[1]), i, -90)].join(' '));
              path.push(['A', 0.5, 0.5, 0, 0, 1, circleXY(0.5, d[1], rightDims.map(x => x[1]), i, -90)].join(' '));
              path.push(['L', circleXY(0.5 - nodeSize, d[1], rightDims.map(x => x[1]), i, -90)].join(' '));
              path.push(['A', 0.5, 0.5, 0, 0, 0, circleXY(0.5 - nodeSize, 0, rightDims.map(x => x[1]), i, -90)].join(' '));
              return path.join(' ') + 'z';
            });
      
      // Define the link gradients
        var gradients = svg.append('defs')
          .selectAll('linearGradient')
          .data(queryResult.rows)
          .join('linearGradient')
            .attr('id', d => d[0].formattedValue.replace(/\s/g, '_') + '-' + d[1].formattedValue.replace(/\s/g, '_'));
        
        var gradientLeftStops = gradients.append('stop')
          .attr('offset', '0%')
          .attr('stop-color', d => leftNodes.filter(x => x[0] == d[0].formattedValue).style('fill'));
        var gradientRightStops = gradients.append('stop')
          .attr('offset', '100%')
          .attr('stop-color', d => rightNodes.filter(x => x[0] == d[1].formattedValue).style('fill'));
      
      // Create the links
        var links = svg.append('g').attr('id', 'links')
          .selectAll('path.link')
          .data(queryResult.rows)
          .join('path')
            .attr('class', 'link')
            .style('fill', d => 'url(#' + d[0].formattedValue.replace(/\s/g, '_') + '-' + d[1].formattedValue.replace(/\s/g, '_') + ')')
            .style('opacity', baseOpacity)
            .on('mouseenter', (event, d, i) => {
              tooltipDim1.text(d[0].formattedValue);
              tooltipDim2.text(d[1].formattedValue);
              tooltipMetric.text(d[2].formattedValue);
              tooltip.transition().style('opacity', 0.9);
              links.filter(x => x != d).transition().style('opacity', lowerOpacity);
            })
            .on('mousemove', event => {
              tooltip
              .style('left', event.x + 12 + 'px')
              .style('top', event.y + 'px');
            })
            .on('mouseleave', () => {
              tooltip.transition().style('opacity', 0);
              mouseLeave();
            })
            .attr('d', (d, i) => {
              var leftAdv = d3.sum(leftDims.slice(0, leftDims.map(x => x[0]).indexOf(d[0].formattedValue)), x => x[1]);
              var thisLeft = queryResult.rows.filter(x => x[0].formattedValue == d[0].formattedValue).sort((a, b) => d3.descending(a[2].value, b[2].value));
              var thisLeftValues = thisLeft.map(x => x[2].value);
              var thisLeftIndex = thisLeft.map(x => x[1].formattedValue).indexOf(d[1].formattedValue);
              
              var rightAdv = d3.sum(rightDims.slice(0, rightDims.map(x => x[0]).indexOf(d[1].formattedValue)), x => x[1]);
              var thisRight = queryResult.rows.filter(x => x[1].formattedValue == d[1].formattedValue).sort((a, b) => d3.ascending(a[2].value, b[2].value));
              var thisRightValues = thisRight.map(x => x[2].value);
              var thisRightIndex = thisRight.map(x => x[0].formattedValue).indexOf(d[0].formattedValue);
              
              var path = [];
              path.push(['M', circleXY(0.5 - nodeSize - nodeLinkGap, leftAdv, thisLeftValues, thisLeftIndex, -270)].join(' '));
              path.push(['A', 0.5, 0.5, 0, 0, 1, circleXY(0.5 - nodeSize - nodeLinkGap, leftAdv + d[2].value, thisLeftValues, thisLeftIndex, -270)].join(' '));
              path.push(['Q', 0.5, 0.5, circleXY(0.5 - nodeSize - nodeLinkGap, rightAdv, thisRightValues, thisRightIndex, -90)].join(' '));
              path.push(['A', 0.5, 0.5, 0, 0, 1, circleXY(0.5 - nodeSize - nodeLinkGap, rightAdv + d[2].value, thisRightValues, thisRightIndex, -90)].join(' '));
              path.push(['Q', 0.5, 0.5, circleXY(0.5 - nodeSize - nodeLinkGap, leftAdv, thisLeftValues, thisLeftIndex, -270)].join(' '));
              return path.join(' ') + 'z';
            });
      
      // Create the gradient slider
        var gradSlider = svg.append('g').attr('id', 'slider');
        var sliderY = 0.5 + (0.5 - nodeSize) * Math.sin((180 * arcScale(0) - 270) * (Math.PI / 180));
        var sliderLineX = 0.5 + (0.5 - nodeSize) * Math.cos((180 * arcScale(1) - 270) * Math.PI / 180) + nodeSize * (1 + 1/3);
        var sliderLineLength = (0.5 - sliderLineX) * 2;
        var circleSize = 0.0125;
        var sliderScale = d3.scaleLinear()
          .domain([sliderLineX, sliderLineX + sliderLineLength])
          .range([-0.75, 0.75]);
        
        var gradSliderRect = gradSlider.append('line')
          .attr('x1', sliderLineX)
          .attr('y1', sliderY)
          .attr('x2', sliderLineX + sliderLineLength)
          .attr('y2', sliderY);
        
        var gradSliderMid = gradSlider.append('line')
          .attr('x1', 0.5)
          .attr('y1', sliderY - 0.015)
          .attr('x2', 0.5)
          .attr('y2', sliderY + 0.015);
        
        var gradSliderCircle = gradSlider.append('circle')
          .attr('cx', 0.5)
          .attr('cy', sliderY)
          .attr('r', circleSize)
          .call(d3.drag().on('drag', event => {
            var sliderValue;
            if (event.x < 0.5 - circleSize / 2) {
              sliderValue = d3.max([sliderLineX, event.x]);
            }
            else if (event.x > 0.5 + circleSize / 2) {
              sliderValue = d3.min([sliderLineX + sliderLineLength, event.x]);
            }
            else {
              sliderValue = 0.5;
            }
            
            gradSliderCircle.attr('cx', sliderValue);
            gradientLeftStops.attr('offset', sliderScale(sliderValue) * 100 + '%');
            gradientRightStops.attr('offset', (sliderScale(sliderValue) + 1) * 100 + '%');
          }));
      
      // Create the total text
        var totalContainer = svg.append('svg').attr('id', 'total')
          .attr('x', sliderLineX)
          .attr('y', nodeSize)
          .attr('width', sliderLineLength)
          .attr('height', 1)
          .attr('preserveAspectRatio', 'xMidYMin meet')
          .style('opacity', 0);
        var total = totalContainer.append('text')
          .style('text-anchor', 'middle');
        var totalValue = total.append('tspan')
          .attr('x', 0)
          .style('font-size', '0.2px')
          .text(queryResult.totals[0].data[0][0]);
        var totalName = total.append('tspan')
          .attr('x', 0)
          .attr('dy', '0.2px')
          .style('font-size', '0.15px')
          .text(queryResult.fields[2].name);
        
        (async () => {
          await new Promise(r => setTimeout(r, 100)); // Wait 100ms for layout to complete
          totalContainer
          .attr('viewBox', () => {
            var topLeftPoint = totalContainer.append('circle').attr('cx', 0).attr('cy', 0);
            var topLeft = topLeftPoint.node().getBoundingClientRect();
            topLeftPoint.remove();
            var totalBox = total.node().getBoundingClientRect();
            var sizeAdjust = sliderLineLength / gradSlider.node().getBoundingClientRect().width;
            return [(totalBox.x - topLeft.x) * sizeAdjust, (totalBox.y - topLeft.y) * sizeAdjust, totalBox.width * sizeAdjust, totalBox.height * sizeAdjust].join(' ');
          })
          .transition().style('opacity', 1);
        })();
      
      // Create label elements
        var leftDim = d3.select('#__da-app-content').append('div').attr('id', 'left-dim')
          .attr('title', queryResult.fields[0].name)
          .text(queryResult.fields[0].name);
        var rightDim = d3.select('#__da-app-content').append('div').attr('id', 'right-dim')
          .attr('title', queryResult.fields[1].name)
          .text(queryResult.fields[1].name);
        
        var leftLabels = d3.select('#__da-app-content').append('div').attr('id', 'left-labels')
          .selectAll('div')
          .data(leftDims)
          .join('div');
        leftLabels.append('div')
          .attr('class', 'label-name')
          .attr('title', d => d[0])
          .text(d => d[0]);
        if (prefs.summable === true) {
          leftLabels.append('div')
            .attr('class', 'label-value')
            .each((d, i, nodes) => formatMetric(d[1]).then(result => d3.select(nodes[i]).attr('title', result).text(result)));
        }
        
        var rightLabels = d3.select('#__da-app-content').append('div').attr('id', 'right-labels')
          .selectAll('div')
          .data(rightDims)
          .join('div');
        rightLabels.append('div')
          .attr('class', 'label-name')
          .attr('title', d => d[0])
          .text(d => d[0]);
        if (prefs.summable === true) {
          rightLabels.append('div')
            .attr('class', 'label-value')
            .each((d, i, nodes) => formatMetric(d[1]).then(result => d3.select(nodes[i]).attr('title', result).text(result)));
        }
    
    // Create the label positioning helper function
      function labelPos(node, mode, data) {
        var box = node.getBoundingClientRect();
        switch(mode) {
          case 'left-dim':
            leftDim
            .style('top', box.top + 'px')
            .style('left', box.right + 'px');
            break;
          case 'right-dim':
            rightDim
            .style('top', box.top + 'px')
            .style('left', box.left + 'px');
            break;
          case 'left':
            leftLabels.filter(d => d == data)
            .style('top', box.top + box.height / 2 + 'px')
            .style('left', box.left + 'px');
            break;
          case 'right':
            rightLabels.filter(d => d == data)
            .style('top', box.top + box.height / 2 + 'px')
            .style('left', box.right + 'px');
            break;
        }
      }
    
    // Position the labels
      function positionLabels() {
        labelPos(d3.select('#left-nodes').node(), 'left-dim');
        labelPos(d3.select('#right-nodes').node(), 'right-dim');
        leftNodes.each((d, i, nodes) => labelPos(nodes[i], 'left', d));
        rightNodes.each((d, i, nodes) => labelPos(nodes[i], 'right', d));
      }
      
      positionLabels();
      window.addEventListener('resize', () => {
        positionLabels();
      });
  }
};
