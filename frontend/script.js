const loading = $('#loading');
const error = $('#error');
const filters = $('.filter');
const results = $('#results');
const resultsCount = $('#results-count');
const lines = $('#lines');
const linesStat = $('#lines-stat');

document.addEventListener('DOMContentLoaded', function() {
    try {
        fetch('http://localhost:3000/api/lines')
            .then(res => res.json())
            .then(data => {
                loading.hide();
                createLinesCards(data);
            })
            .catch(err => {
                loading.hide();
                error.show();
                console.error(err);
            });
    } catch (err) {
        loading.hide();
        error.show();
        console.error(err);
    }

    addEventsListeners();
});

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
        });
    });
}

function createLinesCards(data) {
    results.show();

    // const stopsIcon = $('<i>').addClass('fas fa-map-marker-alt');
    const detailsIcon = $('<i>').addClass('fas fa-info-circle');
    const mapIcon = $('<i>').addClass('fas fa-map');
    const dolarIcon = $('<i>').addClass('fas fa-dollar');

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
        // const stops = $('<span>').addClass('line-info');

        // stops.append(stopsIcon.clone());
        // stops.append(' ' + 0 + ' paradas');
        // infos.append(stops);

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

        const map = $('<button>').addClass('line-map button button-secondary');

        map.append(mapIcon.clone());
        map.append(' Mapa');
        actions.append(map);

        card.append(actions);

        lines.append(card);
    });
}