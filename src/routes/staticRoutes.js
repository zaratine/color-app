// Rotas estáticas (HTML pages)
const express = require('express');
const path = require('path');
const { PUBLIC_DIR } = require('../config');

const router = express.Router();

// Função auxiliar para verificar se é um arquivo estático
function isStaticFile(pathname) {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.json', '.woff', '.woff2', '.ttf', '.eot'];
    return staticExtensions.some(ext => pathname.endsWith(ext));
}

// Rota raiz
router.get('/', (req, res, next) => {
    // Se for um arquivo estático, passar para o próximo middleware (express.static)
    if (isStaticFile(req.path)) {
        return next();
    }
    res.sendFile(path.resolve(PUBLIC_DIR, 'index.html'));
});

// Rota paint
router.get('/paint', (req, res, next) => {
    if (isStaticFile(req.path)) {
        return next();
    }
    res.sendFile(path.resolve(PUBLIC_DIR, 'paint.html'));
});

// Rota category
router.get('/category', (req, res, next) => {
    if (isStaticFile(req.path)) {
        return next();
    }
    res.sendFile(path.resolve(PUBLIC_DIR, 'category.html'));
});

// Nova rota amigável: /en/:category/:drawing (deve vir antes de /en/:category para evitar conflitos)
router.get('/en/:category/:drawing', (req, res, next) => {
    if (isStaticFile(req.path)) {
        return next();
    }
    res.sendFile(path.resolve(PUBLIC_DIR, 'paint.html'));
});

// Nova rota amigável: /en/:category (categoria direta, sem "category" no path)
router.get('/en/:category', (req, res, next) => {
    if (isStaticFile(req.path)) {
        return next();
    }
    res.sendFile(path.resolve(PUBLIC_DIR, 'category.html'));
});

module.exports = router;

