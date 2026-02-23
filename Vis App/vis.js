// Internal page setup dimensions
const margin = {top: 40, right: 40, bottom: 50, left: 120}; 
const width = 600 - margin.left - margin.right;
const height = 300 - margin.top - margin.bottom;

// Initialize data attribute labels, chart/map colors
const attrConfig = {
    "co2": { col: "co2_per_capita", label: "CO2 Emissions (tonnes/capita)", histColor: "#d62728", mapColor: d3.interpolateOrRd },
    "gdp": { col: "GDP per capita", label: "GDP per capita ($)", histColor: "#2ca02c", mapColor: d3.interpolateGreens },
    "rn_energy": { col: "renewables_energy_per_capita", label: "Renewable Energy (kWh/capita)", histColor: "#1f77b4", mapColor: d3.interpolateBlues }
};

// Initialize global data vars for consistent brushing selections
let globalData = [];
let globalGeojson = null;
let globalSelectedCountries = new Set(); 

// Update all charts brushed countries when brushing either scatter or bar
function updateHighlighting() {
    const hasSelection = globalSelectedCountries.size > 0;

    d3.selectAll(".bar").style("opacity", function(d) {
        if (!hasSelection) return 1; // return nothing if none of countries in selection found in the chart
        return globalSelectedCountries.has(d.Entity) ? 1 : 0.2; // If selected country found, make opaque css (1), else make transparent (0.2)
    });

    d3.selectAll(".scatter-circle").style("opacity", function(d) {
        if (!hasSelection) return 0.5;
        return globalSelectedCountries.has(d.Entity) ? 1 : 0.05;
    });

    d3.selectAll(".map-path").style("opacity", function(d) {
        if (!hasSelection) return 1;
        // Name map for consistent naming across datasets that switch between acronyms/domestic naming
        const nameMap = { "USA": "United States", "England": "United Kingdom", "Dem. Rep. Congo": "Democratic Republic of Congo", "Czech Republic": "Czechia", "Ivory Coast": "Cote d'Ivoire", "Swaziland": "Eswatini" };
        const mappedName = nameMap[d.properties.name] || d.properties.name;
        return globalSelectedCountries.has(mappedName) ? 1 : 0.2;
    });
}

// Set up html elements for data, time scale input, output, and chart dashboard
const selectX = document.getElementById('x-data-select');
const selectY = document.getElementById('y-data-select');
const yearInput = document.getElementById('year-input'); 
const outputSpan = document.getElementById('selected-attr');
const dashboardGrid = document.getElementById('dash-grid'); // Target grid for toggling

// Init tool tip
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

// Update displays based on data or filter changes
function updateDisplay() {
    const valX = selectX.value;
    const valY = selectY.value;
    const selectedYear = +yearInput.value; 

    const yearData = globalData.filter(d => d.year === selectedYear);

    // Reset all charts at the beginning
    d3.select("#chart-x").selectAll("*").remove();
    d3.select("#chart-y").selectAll("*").remove();
    d3.select("#scatter-plot").selectAll("*").remove();
    d3.select("#map-container").selectAll("*").remove();

    globalSelectedCountries.clear();
    
    // If input year not within range, tell user
    if (yearData.length === 0) {
        outputSpan.textContent = `No data available for the year ${selectedYear}.`;
        return;
    }

    // If primary attribute and secondary attribute selected from drop downs, show all visualizations
    if (valX && valY && valX !== valY) {
        outputSpan.textContent = `Comparing ${attrConfig[valX].label} vs ${attrConfig[valY].label} in ${selectedYear}`;
        dashboardGrid.classList.remove("single-mode"); // Enable 2x2 Grid
        
        drawBarChart("#chart-x", yearData, attrConfig[valX]);
        drawBarChart("#chart-y", yearData, attrConfig[valY]);
        drawScatterPlot("#scatter-plot", yearData, attrConfig[valX], attrConfig[valY]);
        drawWorldMap(globalGeojson, yearData, attrConfig[valX], attrConfig[valY]);

    } else if (valX) { // If only primary attribute selected from drop downs, show bar chart and map
        outputSpan.textContent = `Viewing single attribute: ${attrConfig[valX].label} in ${selectedYear}`;
        dashboardGrid.classList.add("single-mode"); // Squash to 1x2 Grid
        
        drawBarChart("#chart-x", yearData, attrConfig[valX]);
        drawWorldMap(globalGeojson, yearData, attrConfig[valX]);
    } else { // If none or only Y attr selected
        outputSpan.textContent = "Please select at least an X-axis attribute.";
    }
}

// Initialize listeners for year updates, brushing, or tool tips
selectX.addEventListener('change', updateDisplay);
selectY.addEventListener('change', updateDisplay);
yearInput.addEventListener('input', updateDisplay); 

// Chart Drawing
// Bar Chart Drawing - Show top 25 countries distributions
function drawBarChart(selector, data, config) {
    // Init current year available data (most recent at startup) by the country
    const latestDataByCountry = new Map();
    data.forEach(d => {
        const existing = latestDataByCountry.get(d.Entity);
        if (!existing || existing.year < d.year) latestDataByCountry.set(d.Entity, d);
    });

    // Put selected attr data vals in array, put in lowest to highest sort, cut off after 25
    let chartData = Array.from(latestDataByCountry.values());
    chartData.sort((a, b) => b[config.col] - a[config.col]); // if b - a = negative (lower) or b - a = positive (higher)
    chartData = chartData.slice(0, 25); 

    // Set bar chart dimensions
    const barHeight = 20;
    const innerHeight = chartData.length * barHeight;
    const totalHeight = innerHeight + margin.top + margin.bottom;
    const totalWidth = width + margin.left + margin.right;

    // ViewBox implementation enables grid scaling
    // Init svg for chart elements
    const svg = d3.select(selector)
        .append("svg")
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Put x and y raw values into chart
    const y = d3.scaleBand().domain(chartData.map(d => d.Entity)).range([0, innerHeight]).padding(0.1);
    const x = d3.scaleLinear().domain([0, d3.max(chartData, d => d[config.col])]).nice().range([0, width]);

    // Set up brush
    const brush = d3.brushY()
        .extent([[0, 0], [width, innerHeight]])
        .on("start brush end", (event) => {
            if (!event.selection) { // If none selected, display everything clearly
                globalSelectedCountries.clear();
            } else {
                const [y0, y1] = event.selection;
                globalSelectedCountries.clear();
                chartData.forEach(d => { // Add each selected bar into globalSelectedCountries
                    const cy = y(d.Entity) + y.bandwidth() / 2;
                    if (cy >= y0 && cy <= y1) {
                        globalSelectedCountries.add(d.Entity);
                    }
                });
            }
            updateHighlighting(); // Update highlighted countries on all visualizations from updated globalSelectedCountries
        });

    svg.append("g").attr("class", "brush").call(brush); // Display the highlighting effect

    // Display the data on the chart
    svg.selectAll("rect.bar")
        .data(chartData)
        .join("rect")
        .attr("x", 0) 
        .attr("y", d => y(d.Entity)) 
        .attr("width", d => x(d[config.col]))
        .attr("height", y.bandwidth())
        .style("fill", config.histColor)
        .attr("class", "bar")
        .on("mouseover", function(event, d) { // Show tool tip box with hovered country's name, year, and x and/or y data
            d3.select(this).style("stroke", "#000").style("stroke-width", 2);
            tooltip.transition().duration(200).style("opacity", 1); // Fade in tool tip
            tooltip.html(`<strong>Country:</strong> ${d.Entity}<br><strong>Year:</strong> ${d.year}<br><strong>${config.label}:</strong> ${d[config.col].toFixed(2)}`)
                .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); }) // Move tool tip box with mouse in selection
        .on("mouseout", function() { // Tool tip disappear when mouse off
            d3.select(this).style("stroke", "none");
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Draw X axis at bottom and Y axis on left with ticks
    svg.append("g").attr("transform", `translate(0,${innerHeight})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y));

    // Display labels and chart title
    svg.append("text").attr("x", width / 2).attr("y", innerHeight + 40).style("text-anchor", "middle").style("font-weight", "bold").text(config.label);
    svg.append("text").attr("x", width / 2).attr("y", -10).style("text-anchor", "middle").style("font-size", "14px").text(`Top 25 Countries by ${config.label}`);
}

// Draw Scatter Plot
function drawScatterPlot(selector, data, xConf, yConf) {
    // Set up chart dimensions
    const totalWidth = width + margin.left + margin.right;
    const totalHeight = height + margin.top + margin.bottom;
    
    // Set up svg
    const svg = d3.select(selector)
        .append("svg")
        .attr("viewBox", `0 0 ${totalWidth} ${totalHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Put x and y raw data in chart
    const x = d3.scaleLinear().domain(d3.extent(data, d => d[xConf.col])).nice().range([0, width]);
    const y = d3.scaleLinear().domain(d3.extent(data, d => d[yConf.col])).nice().range([height, 0]);

    // Set up brush
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("start brush end", (event) => {
            if (!event.selection) {
                globalSelectedCountries.clear();
            } else {
                const [[x0, y0], [x1, y1]] = event.selection;
                globalSelectedCountries.clear();
                data.forEach(d => {
                    const cx = x(d[xConf.col]);
                    const cy = y(d[yConf.col]);
                    if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) { // Put selection in global selection
                        globalSelectedCountries.add(d.Entity);
                    }
                });
            }
            updateHighlighting(); //show the global selection
        });

    // Display highlight
    svg.append("g").attr("class", "brush").call(brush);

    // Display data on scatter plot
    svg.selectAll("circle.scatter-circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d[xConf.col]))
        .attr("cy", d => y(d[yConf.col]))
        .attr("r", 4)
        .style("fill", xConf.histColor) 
        .style("opacity", 0.6)
        .attr("class", "scatter-circle")
        // Tool tips
        .on("mouseover", function(event, d) { // Show country name, current year, and data value
            d3.select(this).style("stroke", "#000").style("stroke-width", 1.5).attr("r", 7); 
            tooltip.transition().duration(200).style("opacity", 1);
            tooltip.html(`<strong>Country:</strong> ${d.Entity}<br><strong>Year:</strong> ${d.year}<br><strong>${xConf.label}:</strong> ${d[xConf.col].toFixed(2)}<br><strong>${yConf.label}:</strong> ${d[yConf.col].toFixed(2)}`)
                .style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px");
        })
        .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); })
        .on("mouseout", function() {
            d3.select(this).style("stroke", "none").attr("r", 4);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // X and Y axis set up
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y));

    // Put x and y labels
    svg.append("text").attr("x", width / 2).attr("y", height + 40).style("text-anchor", "middle").style("font-weight", "bold").text(xConf.label);
    svg.append("text").attr("transform", "rotate(-90)").attr("y", 0 - margin.left + 20).attr("x", 0 - (height / 2)).style("text-anchor", "middle").style("font-weight", "bold").text(yConf.label);
    svg.append("text").attr("x", width / 2).attr("y", -10).style("text-anchor", "middle").style("font-size", "14px").text(`${xConf.label} vs. ${yConf.label}`);

    // Calculate and display trendline
    const lineData = generateTrendline(data, xConf, yConf);
    const lineGenerator = d3.line().x(d => x(d[0])).y(d => y(d[1]));
    svg.append("path").datum(lineData).attr("d", lineGenerator).attr("stroke", "#333").attr("stroke-width", 2).attr("fill", "none").attr("stroke-dasharray", "5,5");
}

// Draw Choropleth Map
function drawWorldMap(geojson, data, configX, configY = null) {
    // Map dimensions
    const mapWidth = 960;
    const mapHeight = 550;

    // Set up svg
    const svg = d3.select("#map-container")
        .append("svg")
        .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "transparent");

    // Show country data by selected year (2024 by default)
    const latestDataByCountry = new Map();
    data.forEach(d => { // Get all data-available countries in map
        const existing = latestDataByCountry.get(d.Entity);
        if (!existing || existing.year < d.year) latestDataByCountry.set(d.Entity, d);
    });

    // Set up color scale, maximum value from data, associates color shade to that max value
    const maxVal = d3.max(Array.from(latestDataByCountry.values()), d => d[configX.col]) || 1;
    const colorDomainMax = configX.col === "GDP per capita" ? maxVal * 0.7 : maxVal / 2; 
    const colorScale = d3.scaleSequential(configX.mapColor).domain([0, colorDomainMax]); 

    // Map projection 3D coordinates to 2D setup
    const projection = d3.geoNaturalEarth1().fitExtent([[0, 60], [mapWidth, mapHeight - 100]], geojson);
    const path = d3.geoPath().projection(projection); // Translate global coordinates to screen

    // Name map for dataset discrepancies
    const nameMap = { "USA": "United States", "England": "United Kingdom", "Dem. Rep. Congo": "Democratic Republic of Congo", "Czech Republic": "Czechia", "Ivory Coast": "Cote d'Ivoire", "Swaziland": "Eswatini" };

    // Map Title
    const displayYear = data.length > 0 ? data[0].year : "";
    svg.append("text").attr("x", mapWidth / 2).attr("y", 25).style("text-anchor", "middle").style("font-size", "24px").style("font-weight", "bold").text(`Map: ${configX.label} (${displayYear})`);

    // Display data on map
    svg.append("g")
        .selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path)
        .attr("class", "map-path") 
        .attr("fill", d => {
            const mappedName = nameMap[d.properties.name] || d.properties.name;
            const countryData = latestDataByCountry.get(mappedName);
            return countryData ? colorScale(countryData[configX.col]) : "#ccc"; 
        })
        .attr("stroke", "#333")
        .attr("stroke-width", 0.5)
        // Tool tips
        .on("mouseover", function(event, d) {
            d3.select(this).attr("stroke", "#000").attr("stroke-width", 1.5).raise(); 
            
            // Get hovered country name and data
            const mappedName = nameMap[d.properties.name] || d.properties.name;
            const cData = latestDataByCountry.get(mappedName);
            
            tooltip.transition().duration(200).style("opacity", 1); // Fade in tool tip
            
            // Show country and data according to whether user has one to two attributes selected
            let tooltipHTML = `<strong>Country:</strong> ${mappedName}<br>`;
            if (cData && configY != null) { // display info for both attributes
                tooltipHTML += `<strong>Year:</strong> ${cData.year}<br><strong>${configX.label}:</strong> ${cData[configX.col].toFixed(2)}<br><strong>${configY.label}:</strong> ${cData[configY.col].toFixed(2)}`;
            } else if (cData) { // display info for single attribute
                tooltipHTML += `<strong>Year:</strong> ${cData.year}<br><strong>${configX.label}:</strong> ${cData[configX.col].toFixed(2)}`;
            } else { // no data
                tooltipHTML += `<em>No data available</em>`;
            }

            tooltip.html(tooltipHTML).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); // set tool tip pop up location
        })
        .on("mousemove", function(event) { tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 28) + "px"); }) // move tool tip with mouse
        .on("mouseout", function() {
            d3.select(this).attr("stroke", "#333").attr("stroke-width", 0.5);
            tooltip.transition().duration(500).style("opacity", 0);
        });

    // Legend set up
    const legendWidth = 300;
    const legendHeight = 15;
    const legendX = 20; 
    const legendY = mapHeight - 80;

    // Set up container and gradient for color legend
    const legendGroup = svg.append("g").attr("transform", `translate(${legendX}, ${legendY})`);
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient").attr("id", "map-gradient").attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");

    // Create color scale gradient
    linearGradient.selectAll("stop").data(d3.range(0, 1.05, 0.05)).enter().append("stop").attr("offset", d => `${d * 100}%`).attr("stop-color", d => configX.mapColor(d));
    
    // Draw visual bar with gradient scale
    legendGroup.append("rect").attr("width", legendWidth).attr("height", legendHeight).style("fill", "url(#map-gradient)").style("stroke", "#000"); 

    // Link colors to data via colorDomainMax
    const legendScale = d3.scaleLinear().domain([0, colorDomainMax]).range([0, legendWidth]);
    const formatSuffix = d3.format(".2s");
    const legendAxis = d3.axisBottom(legendScale).ticks(5).tickFormat(d => d === colorDomainMax ? formatSuffix(d) + "+" : formatSuffix(d));

    // Init legend axis and labels
    legendGroup.append("g").attr("transform", `translate(0, ${legendHeight})`).attr("color", "black").call(legendAxis).selectAll("text").style("fill", "black").style("font-size", "12px").style("font-family", "sans-serif");
    legendGroup.append("text").attr("x", 0).attr("y", -8).style("font-size", "13px").style("font-weight", "bold").style("fill", "black").style("font-family", "sans-serif").text(configX.label);

    // Add grey block for no data legend
    const noDataX = legendWidth + 40;
    legendGroup.append("rect").attr("x", noDataX).attr("y", 0).attr("width", 15).attr("height", 15).style("fill", "#ccc").style("stroke", "#333");
    legendGroup.append("text").attr("x", noDataX + 22).attr("y", 12).style("font-size", "12px").style("fill", "black").style("font-family", "sans-serif").text("No Data");
}

// Manually calculate trendline for scatter plot
function generateTrendline(data, xConf, yConf){
    const n = data.length;
    const sumX = d3.sum(data, d => d[xConf.col]);
    const sumY = d3.sum(data, d => d[yConf.col]);
    const sumXY = d3.sum(data, d => d[xConf.col] * d[yConf.col]);
    const sumX2 = d3.sum(data, d => d[xConf.col] * d[xConf.col]);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const xExtent = d3.extent(data, d => d[xConf.col]);
    return [ [xExtent[0], slope * xExtent[0] + intercept], [xExtent[1], slope * xExtent[1] + intercept] ];
}

// Get the csv and world map data
Promise.all([
    d3.csv("merged_all_indicators.csv"), // contains data from all three attributes
    d3.json("world.json") // geojson of globe map
]).then(function([csvData, geojson]) {
    csvData.forEach(d => { // Organize data by the attribute
        d.year = +d.Year;
        d['GDP per capita'] = +d['GDP per capita'];
        d.co2_per_capita = +d.co2_per_capita;
        d.renewables_energy_per_capita = +d.renewables_energy_per_capita;
    });

    // Get all non-null values from data for global data, and country has data for all three attributes
    globalData = csvData.filter(d => !isNaN(d['GDP per capita']) && !isNaN(d.co2_per_capita) && !isNaN(d.renewables_energy_per_capita));
    globalGeojson = geojson; // Load geojson data

    // Get minimum and maximum year that has all three data points for the countries
    const minYear = d3.min(globalData, d => d.year);
    const maxYear = d3.max(globalData, d => d.year);
    
    yearInput.min = minYear;
    yearInput.max = maxYear;
    yearInput.value = maxYear; // start with 2024 data by default

    updateDisplay(); // Show page already populated with 2024 data

}).catch(function(error) { // If no data loads, throw error
    console.error("Error loading the files. Ensure you are running a local server:", error);
});
