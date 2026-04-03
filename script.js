const airlines = [
    'American Airlines', 'Delta Air Lines', 'United Airlines', 'Southwest Airlines',
    'JetBlue Airways', 'Alaska Airlines', 'Spirit Airlines', 'Frontier Airlines',
    'Hawaiian Airlines', 'Allegiant Air'
];

const planes = [
    'Boeing 737', 'Boeing 747', 'Boeing 777', 'Boeing 787',
    'Airbus A320', 'Airbus A330', 'Airbus A350', 'Airbus A380'
];

let currentPage = 0;
const flightsPerPage = 6;
let allFlights = [];
let searchData = {};
let filteredFlights = []; // Tracks currently filtered flights
let controller; // For tool unregistration

// Search flights function
async function searchFlights({ origin, destination, departureDate, returnDate, passengers }) {
    console.log('running searchFlights');
    document.getElementById('origin').value = origin;
    document.getElementById('destination').value = destination;
    document.getElementById('departureDate').value = departureDate;
    document.getElementById('passengers').value = passengers.toString();

    if (returnDate) {
        document.getElementById('oneWay').checked = false;
        document.getElementById('returnDateGroup').classList.remove('hidden');
        document.getElementById('returnDate').value = returnDate;
    } else {
        document.getElementById('oneWay').checked = true;
        document.getElementById('returnDateGroup').classList.add('hidden');
        document.getElementById('returnDate').value = '';
    }

    searchData = {
        origin,
        destination,
        departureDate,
        oneWay: !returnDate,
        returnDate,
        passengers
    };

    allFlights = generateFlights(origin, destination);
    filteredFlights = [...allFlights];
    currentPage = 0;

    const dateOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
    };

    const summaryHtml = `
        <h2>${searchData.origin} → ${searchData.destination}</h2>
        <p>${new Date(searchData.departureDate).toLocaleDateString('en-US', dateOptions)}
        ${searchData.returnDate ? ' - ' + new Date(searchData.returnDate).toLocaleDateString('en-US', dateOptions) : ' (One-way)'}
        • ${searchData.passengers} passenger${searchData.passengers > 1 ? 's' : ''}</p>
    `;
    document.getElementById('searchSummary').innerHTML = summaryHtml;
    document.getElementById('resultsCount').textContent = `${allFlights.length} flights found`;

    document.getElementById('searchPage').classList.add('hidden');
    document.getElementById('resultsPage').classList.remove('hidden');

    renderFlights();
    updateModelContext();

    return JSON.stringify({
        totalFlights: allFlights.length,
        flights: allFlights.map(flight => ({
            flightId: flight.flightId,
            airline: flight.airline,
            price: flight.price,
            departure: { time: flight.departTime, airport: flight.origin },
            arrival: { time: flight.arriveTime, airport: flight.destination },
            duration: flight.duration,
            stops: flight.stops,
            details: {
                aircraft: flight.plane,
                legroom: flight.legroom,
                inFlightEntertainment: flight.entertainment,
                wifi: flight.wifi,
                chargingPoints: flight.charging,
                lieFlatUpgrade: flight.lieFlat
            }
        }))
    });
}

async function getFlights({ scope = "visible" }) {
    console.log('running getFlights');
    let flightsToReturn;
    if (scope === "visible") {
        const start = currentPage * flightsPerPage;
        const end = start + flightsPerPage;
        flightsToReturn = filteredFlights.slice(start, end);
    } else if (scope === "all") {
        flightsToReturn = filteredFlights;
    } else {
        throw new Error("Invalid scope. Use 'visible' or 'all'");
    }

    return JSON.stringify({
        scope: scope,
        totalFlights: filteredFlights.length,
        returnedFlights: flightsToReturn.length,
        flights: flightsToReturn.map(flight => ({
            flightId: flight.flightId,
            airline: flight.airline,
            price: flight.price,
            departure: { time: flight.departTime, airport: flight.origin },
            arrival: { time: flight.arriveTime, airport: flight.destination },
            duration: flight.duration,
            stops: flight.stops,
            details: {
                aircraft: flight.plane,
                legroom: flight.legroom,
                inFlightEntertainment: flight.entertainment,
                wifi: flight.wifi,
                chargingPoints: flight.charging,
                lieFlatUpgrade: flight.lieFlat
            }
        }))
    });
}

async function showFlights({ flightIds }) {
    console.log('running showFlights');
    filteredFlights = allFlights.filter(flight => flightIds.includes(flight.flightId));
    currentPage = 0;
    document.getElementById('resultsCount').textContent = `${filteredFlights.length} flights found`;
    renderFlights();

    return JSON.stringify({
        displayedFlights: filteredFlights.length,
        flightIds: filteredFlights.map(f => f.flightId)
    });
}

async function resetFilters() {
    console.log('running resetFilters');
    filteredFlights = [...allFlights];
    currentPage = 0;
    document.getElementById('resultsCount').textContent = `${allFlights.length} flights found`;
    renderFlights();

    return JSON.stringify({
        totalFlights: allFlights.length,
        message: "All filters reset. Showing all flights."
    });
}

// Expose to window for debugging
window.searchFlights = searchFlights;
window.getFlights = getFlights;
window.showFlights = showFlights;
window.resetFilters = resetFilters;
window.is_declarative_tool = window.is_declarative_tool === undefined ? false : window.is_declarative_tool;

// Update model context based on current page
function updateModelContext() {
    const supportMessage = document.getElementById('webmcp-support-message');
    if (!window.navigator.modelContext) {
      supportMessage.innerHTML = 'WebMCP is not enabled in this browser.<br>For Chrome, enable chrome://flags/#enable-experimental-web-platform-features.';
      return;
    } else {
      supportMessage.innerHTML = '';
    }

    // 1. UNREGISTER EXISTING TOOLS
    if (controller) controller.abort()

    const isResultsPage = !document.getElementById('resultsPage').classList.contains('hidden');

    const searchTool = {
        execute: searchFlights,
        name: "search_flights",
        description: "Search for available flights between cities. Returns detailed flight information including airline, price, times, stops, duration, aircraft type, amenities, and seat details.",
        inputSchema: {
            type: "object",
            properties: {
                origin: { type: "string", description: "The origin city for the flight" },
                destination: { type: "string", description: "The destination city for the flight" },
                departureDate: { type: "string", description: "The departure date in YYYY-MM-DD format" },
                returnDate: { type: "string", description: "The return date in YYYY-MM-DD format. Omit for one-way trips." },
                passengers: { type: "number", description: "The number of passengers (1-8)" }
            },
            required: ["origin", "destination", "departureDate", "passengers"]
        }
    };

    let toolsToRegister = [];

    if (isResultsPage) {
        toolsToRegister = [
            {
                execute: getFlights,
                name: "get_flights",
                description: "Get the list of flights. Can return either currently visible flights on the page or all search results.",
                inputSchema: {
                    type: "object",
                    properties: {
                        scope: {
                            type: "string",
                            enum: ["visible", "all"],
                            description: "Scope of flights to return.",
                            default: "visible"
                        }
                    }
                }
            },
            {
                execute: showFlights,
                name: "show_flights",
                description: "Filter and display only specific flights by their IDs.",
                inputSchema: {
                    type: "object",
                    properties: {
                        flightIds: {
                            type: "array",
                            items: { type: "string" },
                            description: "Array of flight IDs to display"
                        }
                    },
                    required: ["flightIds"]
                }
            },
            {
                execute: resetFilters,
                name: "reset_filters",
                description: "Remove all filters and show all flights from the original search results.",
                inputSchema: { type: "object", properties: {} }
            }
        ];

        if (!window.is_declarative_tool) {
            toolsToRegister.push(searchTool);
        }
    } else if (!window.is_declarative_tool) {
        toolsToRegister = [searchTool];
    }

    // 2. REGISTER NEW TOOLS
    controller = new AbortController();
    toolsToRegister.forEach(tool => {
        window.navigator.modelContext.registerTool(tool, { signal: controller.signal });
    });
}

// Initialize
updateModelContext();

// Set minimum date to today
const today = new Date().toISOString().split('T')[0];
document.getElementById('departureDate').setAttribute('min', today);
document.getElementById('returnDate').setAttribute('min', today);

document.getElementById('departureDate').addEventListener('change', function() {
    document.getElementById('returnDate').setAttribute('min', this.value);
});

document.getElementById('oneWay').addEventListener('change', function() {
    const returnDateGroup = document.getElementById('returnDateGroup');
    const returnDateInput = document.getElementById('returnDate');

    if (this.checked) {
        returnDateGroup.classList.add('hidden');
        returnDateInput.value = '';
    } else {
        returnDateGroup.classList.remove('hidden');
    }
});

function generateFlights(origin, destination) {
    const flights = [];
    for (let i = 0; i < 24; i++) {
        const airline = airlines[Math.floor(Math.random() * airlines.length)];
        const stops = Math.random() < 0.4 ? 0 : Math.random() < 0.7 ? 1 : 2;
        
        let baseDuration;
        if (stops === 0) baseDuration = 120 + Math.floor(Math.random() * 120);
        else if (stops === 1) baseDuration = 240 + Math.floor(Math.random() * 120);
        else baseDuration = 360 + Math.floor(Math.random() * 180);
        
        const departHour = 6 + Math.floor(Math.random() * 16);
        const departMinute = Math.floor(Math.random() * 4) * 15;
        const arriveTime = new Date();
        arriveTime.setHours(departHour);
        arriveTime.setMinutes(departMinute + baseDuration);
        
        const price = 150 + Math.floor(Math.random() * 450);
        const hours = Math.floor(baseDuration / 60);
        const minutes = baseDuration % 60;
        const flightId = `FL${Date.now()}-${i}-${Math.random().toString(36).substr(2, 9)}`;
        
        flights.push({
            id: i,
            flightId: flightId,
            airline: airline,
            origin: origin,
            destination: destination,
            departTime: `${departHour.toString().padStart(2, '0')}:${departMinute.toString().padStart(2, '0')}`,
            arriveTime: `${arriveTime.getHours().toString().padStart(2, '0')}:${arriveTime.getMinutes().toString().padStart(2, '0')}`,
            duration: hours + 'h ' + minutes + 'm',
            stops: stops,
            price: price,
            plane: planes[Math.floor(Math.random() * planes.length)],
            legroom: (28 + Math.floor(Math.random() * 8)) + ' inches',
            entertainment: true,
            wifi: true,
            charging: true,
            lieFlat: true
        });
    }
    return flights.sort((a, b) => a.price - b.price);
}

function renderFlights() {
    const container = document.getElementById('flightResults');
    const start = currentPage * flightsPerPage;
    const end = start + flightsPerPage;
    const pageFlights = filteredFlights.slice(start, end);
    container.innerHTML = pageFlights.map(flight => `
        <div class="flight-card">
            <div class="flight-header">
                <div class="airline-info">
                    <div class="airline-logo">${flight.airline.substring(0, 2).toUpperCase()}</div>
                    <span class="airline-name">${flight.airline}</span>
                </div>
                <div class="price">$${flight.price}</div>
            </div>
            <div class="flight-details">
                <div class="flight-time">
                    <div class="time">${flight.departTime}</div>
                    <div class="airport">${flight.origin}</div>
                </div>
                <div class="flight-path">
                    <div class="duration">${flight.duration}</div>
                    <div>————————</div>
                    <div class="stops">${flight.stops === 0 ? 'Nonstop' : flight.stops + ' stop' + (flight.stops > 1 ? 's' : '')}</div>
                </div>
                <div class="flight-time">
                    <div class="time">${flight.arriveTime}</div>
                    <div class="airport">${flight.destination}</div>
                </div>
            </div>
            <button class="expand-button" onclick="toggleDetails(${flight.id})">
                <span id="expand-text-${flight.id}">View Details</span>
            </button>
            <div class="expanded-details hidden" id="details-${flight.id}">
                <div class="detail-grid">
                    <div class="detail-item"><div><div class="detail-label">Aircraft</div><div class="detail-value">${flight.plane}</div></div></div>
                    <div class="detail-item"><div><div class="detail-label">Legroom</div><div class="detail-value">${flight.legroom}</div></div></div>
                    <div class="detail-item"><div><div class="detail-label">IFE</div><div class="detail-value">${flight.entertainment ? '✓' : '✗'}</div></div></div>
                    <div class="detail-item"><div><div class="detail-label">WiFi</div><div class="detail-value">${flight.wifi ? '✓' : '✗'}</div></div></div>
                    <div class="detail-item"><div><div class="detail-label">Power</div><div class="detail-value">${flight.charging ? '✓' : '✗'}</div></div></div>
                    <div class="detail-item"><div><div class="detail-label">Lie-Flat</div><div class="detail-value">${flight.lieFlat ? '✓' : '✗'}</div></div></div>
                </div>
            </div>
        </div>
    `).join('');
    updatePagination();
}

function toggleDetails(flightId) {
    const details = document.getElementById(`details-${flightId}`);
    const text = document.getElementById(`expand-text-${flightId}`);
    details.classList.toggle('hidden');
    text.textContent = details.classList.contains('hidden') ? 'View Details' : 'Hide Details';
}

function updatePagination() {
    const totalPages = Math.ceil(filteredFlights.length / flightsPerPage);
    document.getElementById('pageInfo').textContent = `Page ${currentPage + 1} of ${totalPages}`;
    document.getElementById('prevButton').disabled = currentPage === 0;
    document.getElementById('nextButton').disabled = currentPage >= totalPages - 1;
}

document.getElementById('prevButton').addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; renderFlights(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

document.getElementById('nextButton').addEventListener('click', () => {
    const totalPages = Math.ceil(filteredFlights.length / flightsPerPage);
    if (currentPage < totalPages - 1) { currentPage++; renderFlights(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
});

document.getElementById('backButton').addEventListener('click', () => history.back());

if (!window.is_declarative_tool) {
    document.getElementById('flightForm').addEventListener('submit', function(e) {
        e.preventDefault();
        throw new Error('Manual form submission detected!');
    });
}

window.addEventListener('popstate', (event) => {
    if (!window.is_declarative_tool) {
        if (event.state && event.state.page === 'results') {
             document.getElementById('searchPage').classList.add('hidden');
             document.getElementById('resultsPage').classList.remove('hidden');
        } else {
             document.getElementById('resultsPage').classList.add('hidden');
             document.getElementById('searchPage').classList.remove('hidden');
        }
        updateModelContext();
    }
});

function handleUrlParams() {
    if (!window.is_declarative_tool) return;
    const params = new URLSearchParams(window.location.search);
    if (!params.has('origin') || !params.has('destination')) return;
    searchFlights({
        origin: params.get('origin'),
        destination: params.get('destination'),
        departureDate: params.get('departureDate'),
        returnDate: params.get('returnDate'),
        passengers: parseInt(params.get('passengers'))
    });
}
handleUrlParams();
