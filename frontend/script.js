const vehiclesTypes = {
    1: 'COMUM',
    2: 'SEMI PADRON',
    3: 'PADRON',
    4: 'ARTICULADO',
    5: 'BIARTICULADO',
    6: 'MICRO',
    7: 'MICRO ESPECIAL',
    8: 'BIARTIC. BIO',
    9: 'ARTIC. BIO',
    10: 'HIBRIDO',
    11: 'HIBRIDO BIO',
    12: 'ELÉTRICO'
};
const loading = $('#lines-loading');
const error = $('#lines-error');
const filters = $('.filter');
const results = $('#results');
const resultsCount = $('#results-count');
const lines = $('#lines');
const linesStat = $('#lines-stat');
const vehiclesStat = $('#vehicles-stat');
const searchInput = $('#search-input');
const searchClear = $('#search-clear');

let map;
let currentLineCode = null;
let currentLineName = null;
let currentStopMarkers = [];
let currentVehicleMarkers = [];
let currentShapes = {};
let currentStops = {};
let currentVehicles = {};
let selectedDirection = null;
let vehicleUpdateInterval = null;
let mapLoading = $('#map-loading');
let mapError = $('#map-error');
let mapRetry = mapError.find('.error-retry');
let directionContainer = $('#directions-container');
let shapeTowardMapping = {};

let userLocationMarker = null;
let userLocationInterval = null;

document.addEventListener('DOMContentLoaded', function() {
    loadLines();
    updateVehiclesTotal();
    addEventsListeners();
    initializeMap();
});

async function updateVehiclesTotal() {
    try {
        const response = await fetch('http://localhost:3000/api/vehicles');
        if (!response.ok) {
            throw new Error('Error while fetching vehicles:' + response.status);
        }
        
        const data = await response.json();
        const vehiclesTotal = Object.keys(data).length;

        vehiclesStat.find('.stat-value').text(vehiclesTotal);
        
        if (vehiclesTotal === 1) {
            vehiclesStat.find('.stat-label').text('Veículo');
        } else {
            vehiclesStat.find('.stat-label').text('Veículos');
        }
    } catch (err) {
        console.error('Error while fetching vehicles:', err);
    }
}

async function loadLines() {
    try {
        const response = await fetch('http://localhost:3000/api/lines');
        if (!response.ok) {
            throw new Error('Error while fetching lines: ' + response.status);
        }
        
        const data = await response.json();
        loading.hide();
        createLinesCards(data);
    } catch (err) {
        loading.hide();
        error.show();
        console.error('Error loading lines:', err);
    }
}

function initializeMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoidGhvbWFzbG9yZW56byIsImEiOiJjbWQyYTlwZnEwOWQ1MmtvZ3hvdmhwcHlhIn0.zKyAzc1ToNJCru9u6CiIFA';

    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-49.27, -25.43],
        zoom: 12,
    });

    map.on('load', () => {
        mapLoading.hide();
        setupMarkerCursor();
        updateUserLocation();
        userLocationInterval = setInterval(() => {
            updateUserLocation();
        }, 60000);
    });
}

function setupMarkerCursor() {
    $('#map').on('mouseenter', '.marker', function() {
        map.getCanvas().style.cursor = 'pointer';
    });
    
    $('#map').on('mouseleave', '.marker', function() {
        map.getCanvas().style.cursor = '';
    });
}

function clearMap(deleteVehicleMarkers = true) {
    if (!map) {
        return;
    }

    try {
        currentStopMarkers.forEach(marker => marker.remove());
        currentStopMarkers = [];

        if (deleteVehicleMarkers === true) {
            currentVehicleMarkers.forEach(marker => marker.remove());
            currentVehicleMarkers = [];

            if (vehicleUpdateInterval) {
                clearInterval(vehicleUpdateInterval);
                vehicleUpdateInterval = null;
            }
        }

        const layers = map.getStyle().layers;
        layers.forEach(layer => {
            if (layer.id.startsWith('line-route-')) {
                map.removeLayer(layer.id);
            }
        });

        const sources = map.getStyle().sources;
        Object.keys(sources).forEach(sourceId => {
            if (sourceId.startsWith('route-')) {
                map.removeSource(sourceId);
            }
        });
    } catch (err) {
        console.error('Error cleaning the map:', err);
    }
}

function createStopMarker(stopNumber) {
    const markerElement = $('<div>');

    markerElement.addClass('marker stop-marker');
    markerElement.html(`
        <i class="marker-icon fas fa-bus"></i>
        <span class="marker-title">${stopNumber}</span>
    `);

    return markerElement[0];
}

function createVehicleMarker(status) {
    const markerElement = $('<div>');

    const normalizedStatus = status.toLowerCase().replace(' ', '-').trim();
    
    markerElement.addClass('marker vehicle-marker');
    markerElement.html(`
        <i class="marker-icon fas fa-bus"></i>
        <div class="status-indicator" data-status="${normalizedStatus}"></div>
    `);

    return markerElement[0];
}

function createUserLocationMarker() {
    const markerElement = $('<div>');
    
    markerElement.addClass('marker user-marker');
    markerElement.html(`
        <i class="marker-icon fas fa-location-dot"></i>
    `);

    return markerElement[0];
}

function updateUserLocation() {
    if (!navigator.geolocation) {
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { longitude, latitude } = position.coords;
            
            if (userLocationMarker) {
                userLocationMarker.setLngLat([longitude, latitude]);
            } else {
                const markerElement = createUserLocationMarker();
                
                const popup = new mapboxgl.Popup({ 
                    closeButton: false,
                    offset: 22,
                }).setHTML(`
                    <div class="marker-popup">
                        <div class="marker-popup-title">
                            <i class="marker-popup-title-icon fas fa-location-dot"></i>
                            <span>Sua localização</span>
                        </div>
                    </div>
                `);

                userLocationMarker = new mapboxgl.Marker(markerElement)
                    .setLngLat([longitude, latitude])
                    .setPopup(popup)
                    .addTo(map);
            }
        },
        (error) => {
            console.error('Error getting user location:', error);
        }
    );
}

async function loadVehicles(lineCode) {
    try {
        const response = await fetch('http://localhost:3000/api/vehicles?line=' + lineCode);
        if (!response.ok) {
            throw new Error('Error while fetching vehicles:' + response.status);
        }
        
        const vehiclesData = await response.json();

        currentVehicleMarkers.forEach(marker => marker.remove());
        currentVehicleMarkers = [];

        Object.values(vehiclesData).forEach(vehicle => {
            // Means that the vehicle is not in service.
            if (vehicle.SENTIDO == "sem tabela") {
                return;
            }

            const longitude = vehicle.LON.replace(',', '.');
            const latitude = vehicle.LAT.replace(',', '.');
            const status = vehicle.SITUACAO;

            const markerElement = createVehicleMarker(status);
        
            const popup = new mapboxgl.Popup({ 
                closeButton: false,
                offset: 22,
            }).setHTML(`
                <div class="marker-popup">
                    <div class="marker-popup-title">
                        <i class="marker-popup-title-icon fas fa-bus"></i>
                        <span>Veículo ${vehicle.COD}</span>
                    </div>
                    <div class="marker-popup-body">
                        <ul>
                            <li><strong>Sentido:</strong> ${vehicle.SENTIDO}</li>
                            <li><strong>Situação:</strong> ${status} - ${vehicle.SITUACAO2}</li>
                            <li><strong>Tipo:</strong> ${vehiclesTypes[vehicle.TIPO_VEIC]}</li>
                            <li><strong>Adaptado cadeirante:</strong> ${vehicle.ADAPT === '1' ? 'Sim' : 'Não'}</li>
                        </ul>
                    </div>
                    <div class="marker-popup-footer">
                        <span>Última atualização: ${vehicle.REFRESH}</span>
                    </div>
                </div>
            `);

            const marker = new mapboxgl.Marker(markerElement)
                .setLngLat([longitude, latitude])
                .setPopup(popup)
                .addTo(map);

            currentVehicleMarkers.push(marker);
        });
        
    } catch (err) {
        console.error('Error while loading vehicles:', err);
    }
}

async function loadMap(lineCode, lineName) {
    mapLoading.show();
    mapError.hide();
    directionContainer.hide();

    if (!map) {
        mapLoading.hide();
        mapError.show();
        console.error('Map not initialized');
        return;
    }

    clearMap();

    try {
        const [shapesData, stopsData] = await Promise.all([
            fetch('http://localhost:3000/api/shapes?line=' + lineCode)
                .then(res => {
                    if (!res.ok) {
                        throw new Error('Erro while fetching shapes:' + res.status);
                    }

                    return res.json();
                }),
            fetch('http://localhost:3000/api/stops?line=' + lineCode)
                .then(res => {
                    if (!res.ok) {
                        throw new Error('Erro while fetching stops:' + res.status);
                    }
                    
                    return res.json();
                })
        ]);

        let coordinates = {};
        let routeBounds = new mapboxgl.LngLatBounds();

        shapesData.forEach(point => {
            const longitude = point.LON.replace(',', '.');
            const latitude = point.LAT.replace(',', '.');
            const shapeCode = point.SHP;

            if (!coordinates[shapeCode]) {
                coordinates[shapeCode] = [];
            }

            coordinates[shapeCode].push([longitude, latitude]);
            routeBounds.extend([longitude, latitude]);
        });

        currentShapes = coordinates;

        let stopsByDirection = {};
        
        stopsData.forEach(stop => {
            const direction = stop.SENTIDO.trim();
            
            if (!stopsByDirection[direction]) {
                stopsByDirection[direction] = [];
            }
            
            stopsByDirection[direction].push(stop);
        });

        currentStops = stopsByDirection;

        await loadShapeTowardMapping();

        const directions = Object.keys(stopsByDirection);
        createDirectionSelect(directions);

        selectedDirection = directions[0];
        loadStopsForDirection(selectedDirection);
        loadShapeForDirection(selectedDirection);

        await loadVehicles(lineCode);

        vehicleUpdateInterval = setInterval(() => {
            loadVehicles(lineCode);
        }, 60000);

        if (!routeBounds.isEmpty()) {
            map.fitBounds(routeBounds, {
                padding: 50,
                maxZoom: 15
            });
        }

        mapLoading.hide();

        if (directions.length === 1) {
            directionContainer.hide();
        } else if (directions.length > 1) {
            directionContainer.show();
        }
    } catch (err) {
        mapLoading.hide();
        mapError.show();
        console.error('Error while loading the map:', err);
    }
}

async function loadShapeTowardMapping() {
    const shapePromises = Object.keys(currentShapes).map(async (shapeCode) => {
        try {
            const res = await fetch('http://localhost:3000/api/shape?shape=' + shapeCode);
            if (!res.ok) {
                throw new Error('Erro while fetching shape name:', res.status);
            }
            
            let data = await res.text();
            data = data.replace(/\\/g, '');

            // Get the direction of the shape from the shape name.
            // E.g. "536 - ZOOLOGICO (Terminal Boqueirão)" => "Terminal Boqueirão"
            const match = data.match(/\(([^()]*(\([^()]*\)[^()]*)*)\)"$/);

            if (match) {
                const shapeToward = match[1].trim();
                shapeTowardMapping[shapeToward] = shapeCode;
            }
        } catch (err) {
            console.error('Error while fetching shape name for shape code ' + shapeCode, err);
            throw err;
        }
    });

    await Promise.all(shapePromises);
}

function createDirectionSelect(directions) {
    const selector = $('<select>').addClass('direction-select');
    
    directions.forEach(direction => {
        const option = $('<option>').val(direction).text('Sentido: ' + direction);
        selector.append(option);
    });

    selector.on('change', function() {
        const newDirection = $(this).val();
        if (newDirection !== selectedDirection) {
            selectedDirection = newDirection;
            clearMap(false);
            loadStopsForDirection(selectedDirection);
            loadShapeForDirection(selectedDirection);
        }
    });

    directionContainer.empty().append(selector);
}

function loadStopsForDirection(direction) {
    if (!currentStops[direction]) {
        return;
    }

    currentStops[direction].forEach(stop => {
        const longitude = stop.LON.replace(',', '.');
        const latitude = stop.LAT.replace(',', '.');
        
        const markerElement = createStopMarker(stop.SEQ);
        
        const popup = new mapboxgl.Popup({ 
            closeButton: false,
            offset: 22,
        }).setHTML(`
            <div class="marker-popup">
                <div class="marker-popup-title">
                    <i class="marker-popup-title-icon fas fa-bus"></i>
                    <span>Ponto ${stop.SEQ}</span>
                </div>
                <div class="marker-popup-body">
                    <ul>
                        <li><strong>Nome:</strong> ${stop.NOME}</li>
                        <li><strong>Tipo:</strong> ${stop.TIPO}</li>
                    </ul>
                </div>
            </div>
        `);

        const marker = new mapboxgl.Marker(markerElement)
            .setLngLat([longitude, latitude])
            .setPopup(popup)
            .addTo(map);

        currentStopMarkers.push(marker);
    });
}

function loadShapeForDirection(direction) {
    const shapeCode = shapeTowardMapping[direction];
    
    if (!shapeCode || !currentShapes[shapeCode]) {
        console.error('Shape not found for direction:', direction);
        return;
    }

    map.addSource('route-' + shapeCode, {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: currentShapes[shapeCode],
            }
        }
    });

    map.addLayer({
        id: 'line-route-' + shapeCode,
        source: 'route-' + shapeCode,
        type: 'line',
        paint: {
            'line-color': '#3b82f6',
            'line-width': 4,
        }
    });
}

function addEventsListeners() {
    filters.each(function() {
        const filter = $(this);
        filter.on('click', function() {
            if (filter.hasClass('active')) {
                filter.removeClass('active');
            } else {
                filters.removeClass('active');
                filter.addClass('active');
            }

            filterLines();
        });
    });

    searchInput.on('input', function() {
        filterLines();
    });

    searchClear.on('click', function() {
        searchInput.val('');
        searchInput.trigger('input');
    });

    mapRetry.on('click', function() {
        loadMap(currentLineCode, currentLineName);
    });
}

function filterLines() {
    const activeFilter = $('.filter.active');
    const filterType = activeFilter.data('type');

    lines.find('.line').show();
    
    if (filterType) {
        lines.find('.line').each(function() {
            const line = $(this);
            const lineType = line.data('type');
            
            if (lineType !== filterType) {
                line.hide();
            }
        });
    }

    lines.find('.line').each(function() {
        const line = $(this);

        const searchValue = searchInput.val().toLowerCase();

        if (searchValue.length > 0) {
            const lineName = line.find('.line-name').text().toLowerCase();
            const lineNumber = line.find('.line-number').text().toLowerCase();

            if (!lineName.includes(searchValue) && !lineNumber.includes(searchValue)) {
                line.hide();
            }
        }
    });

    const filteredLines = lines.find('.line:visible');

    if (filteredLines.length === 0) {
        resultsCount.text('Nenhuma linha encontrada');
    } else if (filteredLines.length === 1) {
        resultsCount.text('1 linha encontrada');
    } else if (filteredLines.length > 1) {
        resultsCount.text(filteredLines.length + ' linhas encontradas');
    }
}

function createLinesCards(data) {
    results.show();

    const detailsIcon = $('<i>').addClass('fas fa-info-circle');
    const mapIcon = $('<i>').addClass('fas fa-map');
    const dolarIcon = $('<i>').addClass('fas fa-dollar-sign');

    if (data.length === 0) {
        resultsCount.text('Nenhuma linha encontrada');
        return;
    }

    if (data.length === 1) {
        resultsCount.text('1 linha encontrada');
        linesStat.find('.stat-label').text('Linha');
        linesStat.find('.stat-value').text(1);
    } else {
        resultsCount.text(data.length + ' linhas encontradas');
        linesStat.find('.stat-label').text('Linhas');
        linesStat.find('.stat-value').text(data.length);
    }

    Object.entries(data).forEach(([key, line]) => {
        let category = line.CATEGORIA_SERVICO;

        if (category === 'TRONCAL') {
            category = 'CONVENCIONAL';
        } else if (category === 'LINHA DIRETA') {
            category = 'LIGEIRINHO';
        } else if (category === 'JARDINEIRA') {
            category = 'TURISMO';
        }

        const lowercaseCategory = category.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "")

        const card = $('<div>').addClass('line');
        card.attr('data-type', lowercaseCategory);
        card.attr('data-line-code', line.COD);

        const header = $('<div>').addClass('line-header');
        const number = $('<span>').addClass('line-number').text(line.COD);
        const badges = $('<div>').addClass('line-badges');
        const badge = $('<span>').addClass('badge');
        
        badge.text(category)
        header.append(number);
        badges.append(badge);
        header.append(badges);
        card.append(header);

        const name = $('<span>').addClass('line-name').text(line.NOME.toUpperCase());
        card.append(name);

        const infos = $('<div>').addClass('line-infos');

        const payment = $('<div>').addClass('line-info');
        payment.append(dolarIcon.clone());
        payment.append(line.SOMENTE_CARTAO === 'S' ? ' Somente cartão' : ' Cartão e dinheiro');
        infos.append(payment);

        card.append(infos);

        const actions = $('<div>').addClass('line-actions');
        const details = $('<button>').addClass('line-details button button-primary');

        details.append(detailsIcon.clone());
        details.append(' Detalhes');
        actions.append(details);

        const mapButton = $('<button>').addClass('line-map button button-secondary');
        mapButton.append(mapIcon.clone());
        mapButton.append(' Mapa');
        
        mapButton.on('click', function(e) {
            e.stopPropagation();

            currentLineCode = line.COD;
            currentLineName = line.NOME;
            
            loadMap(currentLineCode, currentLineName);
            
            $('html, body').scrollTop(0);
        });

        actions.append(mapButton);
        card.append(actions);

        lines.append(card);
    });
}