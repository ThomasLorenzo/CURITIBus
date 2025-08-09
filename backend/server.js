const express = require('express');
const cors = require('cors');

const apiCode = 'f9048';

const app = express();
const port = 3000;

app.use(cors());

let linesCache = null;
let linesCacheLastUpdate = 0;
const linesCacheExpiry = 1000 * 60 * 60 * 24;

app.get('/api/lines', async (req, res) => {
    try {
        if (linesCache && (Date.now() - linesCacheLastUpdate) < linesCacheExpiry) {
            res.json(linesCache);
            return;
        }

        const url = 'https://transporteservico.urbs.curitiba.pr.gov.br/getLinhas.php?c=' + apiCode;
        const response = await fetch(url);
        const data = await response.json();

        linesCache = data;
        linesCacheLastUpdate = Date.now();

        res.json(data);
    } catch (error) {
        console.error('Error fetching lines data', error);
        res.status(500).json({ error: 'Error fetching lines data' });
    }
});

app.get('/api/stops', async (req, res) => {
    try {
        const url = 'https://transporteservico.urbs.curitiba.pr.gov.br/getPontosLinha.php?c=' + apiCode + '&linha=' + req.query.line;
        const response = await fetch(url);
        const data = await response.json();

        res.json(data);
    } catch (error) {
        console.error('Error fetching stops data', error);
        res.status(500).json({ error: 'Error fetching stops data' });
    }
});

app.get('/api/shapes', async (req, res) => {
    try {
        const url = 'https://transporteservico.urbs.curitiba.pr.gov.br/getShapeLinha.php?c=' + apiCode + '&linha=' + req.query.line;
        const response = await fetch(url);
        const data = await response.json();

        res.json(data);
    } catch (error) {
        console.error('Error fetching shapes data', error);
        res.status(500).json({ error: 'Error fetching shapes data' });
    }
});

app.get('/api/shape', async (req, res) => {
    try {
        const url = 'https://transporteservico.urbs.curitiba.pr.gov.br/getShapeName.php?c=' + apiCode + '&shp=' + req.query.shape;
        const response = await fetch(url);
        const data = await response.json();

        res.json(data);
    } catch (error) {
        console.error('Error fetching shape data', error);
        res.status(500).json({ error: 'Error fetching shape data' });
    }
});

app.get('/api/vehicles', async (req, res) => {
    try {
        const lineFilter = req.query.line ? '&linha=' + req.query.line : '';
        const url = 'https://transporteservico.urbs.curitiba.pr.gov.br/getVeiculos.php?c=' + apiCode + lineFilter;
        const response = await fetch(url);
        const data = await response.json();

        res.json(data);
    } catch (error) {
        console.error('Error fetching vehicles data', error);
        res.status(500).json({ error: 'Error fetching vehicles data' });
    }
});

app.listen(port, () => {
  console.log('Server running on port ' + port);
});