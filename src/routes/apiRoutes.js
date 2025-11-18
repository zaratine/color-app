// Rotas da API
const express = require('express');
const router = express.Router();
const { getDrawings, createDrawing } = require('../controllers/drawingsController');
const { extractKeyFromUrl, getObjectFromS3 } = require('../services/s3Service');

// GET /api/drawings - Lista todos os desenhos
router.get('/drawings', getDrawings);

// POST /api/generate-drawing - Gera um novo desenho
router.post('/generate-drawing', createDrawing);

// GET /api/proxy-image - Proxy para servir imagens do S3 com CORS
router.get('/proxy-image', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Parâmetro "url" é obrigatório' });
        }

        // Extrair chave do S3 da URL
        const key = extractKeyFromUrl(imageUrl);
        
        if (!key) {
            return res.status(400).json({ error: 'URL inválida do S3' });
        }

        // Buscar objeto do S3
        const { Body, ContentType } = await getObjectFromS3(key);

        // Configurar headers CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', ContentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 ano

        // Enviar imagem
        res.send(Body);
    } catch (error) {
        console.error('Erro no proxy de imagem:', error);
        res.status(500).json({ error: 'Erro ao buscar imagem do S3', message: error.message });
    }
});

module.exports = router;

