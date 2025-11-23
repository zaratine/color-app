// Rotas da API
const express = require('express');
const router = express.Router();
const { getDrawings, createDrawing } = require('../controllers/drawingsController');
const { extractKeyFromUrl, getObjectFromS3, getThumbnailUrl, isS3Available } = require('../services/s3Service');
const { generateThumbnailFromUrl, thumbnailExistsInS3, getThumbnailKey } = require('../services/thumbnailService');

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

// GET /api/thumbnail - Gera thumbnail sob demanda se não existir
router.get('/thumbnail', async (req, res) => {
    try {
        const imageUrl = req.query.url;
        
        if (!imageUrl) {
            return res.status(400).json({ error: 'Parâmetro "url" é obrigatório' });
        }

        // Extrair chave do S3 da URL original
        const originalKey = extractKeyFromUrl(imageUrl);
        
        if (!originalKey) {
            return res.status(400).json({ error: 'URL inválida do S3' });
        }

        // Verificar se S3 está disponível
        if (!isS3Available()) {
            return res.status(503).json({ error: 'S3 não está configurado' });
        }

        // Obter chave do thumbnail
        const thumbnailKey = getThumbnailKey(originalKey);
        
        // Verificar se thumbnail já existe
        const exists = await thumbnailExistsInS3(thumbnailKey);
        
        let thumbnailBuffer;
        
        if (exists) {
            // Thumbnail existe, buscar do S3
            console.log('    [GET /api/thumbnail] Thumbnail encontrado no S3, buscando...');
            const { Body } = await getObjectFromS3(thumbnailKey);
            thumbnailBuffer = Body;
        } else {
            // Thumbnail não existe, gerar sob demanda
            console.log('    [GET /api/thumbnail] Thumbnail não encontrado, gerando sob demanda...');
            thumbnailBuffer = await generateThumbnailFromUrl(imageUrl);
        }

        // Configurar headers CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache por 1 ano

        // Enviar thumbnail
        res.send(thumbnailBuffer);
    } catch (error) {
        console.error('Erro ao gerar/buscar thumbnail:', error);
        res.status(500).json({ error: 'Erro ao gerar/buscar thumbnail', message: error.message });
    }
});

module.exports = router;

