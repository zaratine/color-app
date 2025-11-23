// Rotas estáticas (HTML pages)
const express = require('express');
const path = require('path');
const { PUBLIC_DIR } = require('../config');
const { getDrawingsDatabase } = require('../services/drawingsService');

const router = express.Router();

// Função auxiliar para verificar se é um arquivo estático
function isStaticFile(pathname) {
    const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.json', '.woff', '.woff2', '.ttf', '.eot'];
    const isStatic = staticExtensions.some(ext => pathname.endsWith(ext));
    
    // Permitir apenas arquivos HTML de verificação (ex: Google Search Console)
    // Outros HTMLs devem ser processados pelas rotas do Express
    const isVerificationFile = pathname.endsWith('.html') && pathname.startsWith('/google');
    
    return isStatic || isVerificationFile;
}

// Função para gerar sitemap.xml
async function generateSitemap(req) {
    try {
        // Obter URL base da requisição
        // No Vercel, usar X-Forwarded-Proto; caso contrário, usar req.protocol
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:8000';
        const baseUrl = `${protocol}://${host}`;
        
        // Obter todas as categorias e desenhos
        const database = await getDrawingsDatabase();
        
        // Iniciar XML do sitemap
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        // Adicionar página inicial
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/</loc>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += '    <priority>1.0</priority>\n';
        xml += '  </url>\n';
        
        // Adicionar página de pintura
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}/paint</loc>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.8</priority>\n';
        xml += '  </url>\n';
        
        // Adicionar categorias e desenhos
        for (const [category, categoryData] of Object.entries(database)) {
            if (!categoryData || !categoryData.drawings || categoryData.drawings.length === 0) {
                continue;
            }
            
            // URL da categoria (codificar para URL)
            const categoryEncoded = encodeURIComponent(category);
            const categoryUrl = `${baseUrl}/en/${categoryEncoded}`;
            
            // Adicionar URL da categoria
            xml += '  <url>\n';
            xml += `    <loc>${categoryUrl}</loc>\n`;
            xml += '    <changefreq>weekly</changefreq>\n';
            xml += '    <priority>0.7</priority>\n';
            xml += '  </url>\n';
            
            // Adicionar URLs dos desenhos individuais
            for (const drawing of categoryData.drawings) {
                // Lidar com dois formatos: string (filesystem) ou objeto {filename, url} (S3)
                let drawingFilename;
                if (typeof drawing === 'string') {
                    drawingFilename = drawing;
                } else if (drawing && typeof drawing === 'object' && drawing.filename) {
                    drawingFilename = drawing.filename;
                } else {
                    // Pular se não for um formato reconhecido
                    continue;
                }
                
                // Remover extensão do nome do arquivo para a URL
                const drawingName = drawingFilename.replace(/\.(svg|png|jpg|jpeg)$/i, '');
                const drawingEncoded = encodeURIComponent(drawingName);
                const drawingUrl = `${baseUrl}/en/${categoryEncoded}/${drawingEncoded}`;
                
                xml += '  <url>\n';
                xml += `    <loc>${drawingUrl}</loc>\n`;
                xml += '    <changefreq>monthly</changefreq>\n';
                xml += '    <priority>0.6</priority>\n';
                xml += '  </url>\n';
            }
        }
        
        // Fechar XML
        xml += '</urlset>';
        
        return xml;
    } catch (error) {
        console.error('Erro ao gerar sitemap:', error);
        throw error;
    }
}

// Rota sitemap.xml
router.get('/sitemap.xml', async (req, res) => {
    try {
        const sitemap = await generateSitemap(req);
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
        res.send(sitemap);
    } catch (error) {
        console.error('Erro ao gerar sitemap.xml:', error);
        res.status(500).send('Erro ao gerar sitemap');
    }
});

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

