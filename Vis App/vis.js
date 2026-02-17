// Setup dimensions
const margin = {top: 40, right: 40, bottom: 50, left: 80};
const width = 600 - margin.left - margin.right;
const height = 300 - margin.top - margin.bottom;

// 1. Reusable Histogram Function
function drawHistogram(selector, data, color, xLabel, title) {
    // Select the element with '#'
    const svg = d3.select(selector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(data)).nice()
        .range([0, width]);

    const bins = d3.bin()
        .domain(x.domain())
        .thresholds(x.ticks(20))(data);

    const y = d3.scaleLinear()
        .domain([0, d3.max(bins, d => d.length)]).nice()
        .range([height, 0]);

    svg.selectAll("rect")
        .data(bins)
        .join("rect")
        .attr("x", 1)
        .attr("transform", d => `translate(${x(d.x0)}, ${y(d.length)})`)
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("height", d => height - y(d.length))
        .style("fill", color);

    // X Axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Y Axis
    svg.append("g").call(d3.axisLeft(y));

    // X-axis Label
    svg.append("text")
        .attr("x", width/2)
        .attr("y", height + 40)
        .attr("class", "axis-label")
        .style("text-anchor", "middle")
        .text(xLabel);
    
    // Y-Axis Label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 15)
        .attr("x", 0 - (height / 2))
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Frequency (Count)");    

    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .text(title + " Distributions");
}
function generateTrendline(data){
    // --- Manual Linear Regression Calculation ---
    const n = data.length;
    const sumX = d3.sum(data, d => d.temp);
    const sumY = d3.sum(data, d => d.ph);
    const sumXY = d3.sum(data, d => d.temp * d.ph);
    const sumX2 = d3.sum(data, d => d.temp * d.temp);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Generate two points for the line (Start and End of the X-axis)
    const xExtent = d3.extent(data, d => d.temp);
    return [
        [xExtent[0], slope * xExtent[0] + intercept],
        [xExtent[1], slope * xExtent[1] + intercept]
    ];
}
function drawScatterPlot(selector, data) {
    const svg = d3.select(selector)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // X Scale: Temperature
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.temp)).nice()
        .range([0, width]);

    // Y Scale: pH (Zoomed in on the 8.0 - 8.15 range)
    const y = d3.scaleLinear()
        .domain(d3.extent(data, d => d.ph)).nice()
        .range([height, 0]);

    // Add X Axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Add Y Axis
    svg.append("g")
        .call(d3.axisLeft(y).ticks(10, ".3f")); // Show 3 decimal places for pH

    // Draw Data Points
    svg.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.temp))
        .attr("cy", d => y(d.ph))
        .attr("r", 5)
        .style("fill", "#69b3a2")
        .style("opacity", 0.6)
        .style("stroke", "white");

    // X Axis Label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Surface Temperature (°C)");

    // Y Axis Label
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left + 20)
        .attr("x", 0 - (height / 2))
        .style("text-anchor", "middle")
        .style("font-weight", "bold")
        .text("Seawater pH");

    // Title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .style("text-anchor", "middle")
        .style("font-size", "14px")
        .text("Surface Temperature vs. Ocean pH");
        

    const lineData = generateTrendline(data);

    const lineGenerator = d3.line()
        .x(d => x(d[0]))
        .y(d => y(d[1]));

    // Draw the line
    svg.append("path")
        .datum(lineData)
        .attr("d", lineGenerator)
        .attr("stroke", "red")
        .attr("stroke-width", 2)
        .attr("fill", "none")
        .attr("stroke-dasharray", "5,5");
}

// 2. Data Loading and Execution
d3.csv("working_us_ocean_data.csv").then(function(data) {
    // Convert strings to numbers
    data.forEach(d => {
        d.temp = +d.Surface_Temp_C;
        d.ph = +d.Seawater_pH;
    });

    console.log("Data Loaded and Parsed:", data);

    // Extract the specific columns as arrays
    const temperatures = data.map(d => d.temp);
    const phValues = data.map(d => d.ph);

    // CALL the functions inside the .then block
    drawHistogram("#temp-histogram", temperatures, "#ff7f0e", "Surface Temperature (°C)", "US Surface Temperature");
    drawHistogram("#ph-histogram", phValues, "#1f77b4", "Seawater pH", "Hawaii Ocean Acidification");
    drawScatterPlot("#scatter-plot", data);

}).catch(function(error) {
    console.error("Error loading the CSV file. Ensure you are running a local server:", error);
});