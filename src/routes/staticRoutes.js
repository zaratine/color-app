// Rotas estáticas (HTML pages)
const express = require('express');
const path = require('path');
const { PUBLIC_DIR } = require('../config');

const router = express.Router();

// Rota raiz
router.get('/', (req, res) => {
    res.sendFile(path.resolve(PUBLIC_DIR, 'index.html'));
});

// Rota paint
router.get('/paint', (req, res) => {
    res.sendFile(path.resolve(PUBLIC_DIR, 'paint.html'));
});

// Rota category
router.get('/category', (req, res) => {
    res.sendFile(path.resolve(PUBLIC_DIR, 'category.html'));
});

module.exports = router;

