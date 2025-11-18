// Rotas da API
const express = require('express');
const router = express.Router();
const { getDrawings, createDrawing } = require('../controllers/drawingsController');

// GET /api/drawings - Lista todos os desenhos
router.get('/drawings', getDrawings);

// POST /api/generate-drawing - Gera um novo desenho
router.post('/generate-drawing', createDrawing);

module.exports = router;

