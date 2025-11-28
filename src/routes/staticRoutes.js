// Rotas estáticas (HTML pages)
const express = require('express');
const path = require('path');
const { PUBLIC_DIR } = require('../config');
const { getDrawingsDatabase } = require('../services/drawingsService');
const { 
    getCategoryPageData, 
    getDrawingPageData, 
    generateCategoryMetaTags, 
    generateDrawingMetaTags,
    generateMetaTags,
    generateCategoryJsonLd,
    generateDrawingJsonLd,
    generateHomeJsonLd
} = require('../utils/pageData');
const { filenameToSlug, normalizeCategory, hasOldSlugFormat, normalizeOldSlug } = require('../utils/urlMapping');

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
        
        // Adicionar categorias e desenhos
        for (const [category, categoryData] of Object.entries(database)) {
            if (!categoryData || !categoryData.drawings || categoryData.drawings.length === 0) {
                continue;
            }
            
            const normalizedCategorySlug = normalizeCategory(category);
            const categorySlug = normalizedCategorySlug || (typeof category === 'string' ? category.trim() : '');
            if (!categorySlug) {
                continue;
            }
            // URL da categoria (codificada para o slug usado na rota)
            const categoryUrl = `${baseUrl}/en/${encodeURIComponent(categorySlug)}`;
            
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
                
                const drawingSlug = filenameToSlug(drawingFilename);
                if (!drawingSlug) {
                    continue;
                }
                const drawingUrl = `${baseUrl}/en/${encodeURIComponent(categorySlug)}/${encodeURIComponent(drawingSlug)}`;
                
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

// Nova rota amigável: /en/:category/:drawing (deve vir antes de /en/:category para evitar conflitos)
router.get('/en/:category/:drawing', async (req, res, next) => {
    if (isStaticFile(req.path)) {
        return next();
    }
    
    try {
        const categorySlug = decodeURIComponent(req.params.category);
        let drawingSlug = decodeURIComponent(req.params.drawing);

        // Verificar se o slug tem formato antigo (com timestamp) e fazer redirect 301
        if (hasOldSlugFormat(drawingSlug)) {
            const normalizedSlug = normalizeOldSlug(drawingSlug);
            const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
            const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:8000';
            const baseUrl = `${protocol}://${host}`;
            
            // Construir URL corrigida
            const correctedUrl = `${baseUrl}/en/${encodeURIComponent(categorySlug)}/${encodeURIComponent(normalizedSlug)}`;
            
            // Preservar query strings se houver
            const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
            const redirectUrl = correctedUrl + queryString;
            
            console.log(`Redirect 301: ${req.url} -> ${redirectUrl}`);
            return res.redirect(301, redirectUrl);
        }

        // Buscar dados do desenho
        const drawingData = await getDrawingPageData(categorySlug, drawingSlug);
        
        // Se não encontrar o desenho, renderizar página genérica
        if (!drawingData) {
            console.warn(`Desenho não encontrado: ${categorySlug}/${drawingSlug}`);
            const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
            const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:8000';
            const baseUrl = `${protocol}://${host}`;
            return res.render('layouts/main', {
                page: 'pages/paint',
                bodyClass: 'paint-page',
            scripts: ['/js/ui/custom-drawing.js', '/js/ui/painter.js', '/js/app.js'],
                drawingData: { friendlyName: 'Drawing', category: { friendlyName: 'Category', slug: categorySlug }, slug: drawingSlug },
                meta: generateMetaTags({
                    title: 'Free Coloring Pages for Kids – Print or Color Online',
                    description: 'Free coloring pages for kids! Print or Color Online.',
                    url: `${baseUrl}/en/${encodeURIComponent(categorySlug)}/${encodeURIComponent(drawingSlug)}`
                }),
                structuredData: []
            });
        }
        
        // Gerar URL base
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:8000';
        const baseUrl = `${protocol}://${host}`;
        
        // Gerar meta tags
        const meta = generateDrawingMetaTags(drawingData, baseUrl);
        
        // Gerar JSON-LD structured data
        const structuredData = generateDrawingJsonLd(drawingData, baseUrl);
        
        // Renderizar template EJS
        res.render('layouts/main', {
            page: 'pages/paint',
            bodyClass: 'paint-page',
            scripts: ['/js/ui/custom-drawing.js', '/js/ui/painter.js', '/js/app.js'],
            drawingData,
            meta,
            structuredData
        });
    } catch (error) {
        console.error('Erro ao renderizar página de desenho:', error);
        // Renderizar página genérica em caso de erro
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:8000';
        const baseUrl = `${protocol}://${host}`;
        res.render('layouts/main', {
            page: 'pages/paint',
            bodyClass: 'paint-page',
            scripts: ['/js/ui/custom-drawing.js', '/js/ui/painter.js', '/js/app.js'],
            drawingData: { friendlyName: 'Drawing', category: { friendlyName: 'Category', slug: '' }, slug: '' },
            meta: generateMetaTags({
                title: 'Free Coloring Pages for Kids – Print or Color Online',
                description: 'Free coloring pages for kids! Print or Color Online.',
                url: `${baseUrl}/paint`
            }),
            structuredData: []
        });
    }
});

// Nova rota amigável: /en/:category (categoria direta, sem "category" no path)
router.get('/en/:category', async (req, res, next) => {
    if (isStaticFile(req.path)) {
        return next();
    }
    
    try {
        const categorySlug = decodeURIComponent(req.params.category);
        
        // Buscar database e dados da categoria
        const database = await getDrawingsDatabase();
        const categoryData = await getCategoryPageData(categorySlug);
        
        // Gerar URL base
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:8000';
        const baseUrl = `${protocol}://${host}`;
        
        // Se não encontrar a categoria, renderizar página genérica
        if (!categoryData) {
            console.warn(`Categoria não encontrada: ${categorySlug}`);
            return res.render('layouts/main', {
                page: 'pages/category',
                scripts: ['/js/ui/drawings.js', '/js/app.js'],
                categoryData: null,
                meta: generateMetaTags({
                    title: 'Free Coloring Pages for Kids – Print or Color Online',
                    description: 'Free coloring pages for kids! Print or Color Online.',
                    url: `${baseUrl}/en/${encodeURIComponent(categorySlug)}`
                }),
                structuredData: []
            });
        }
        
        // Gerar meta tags (passando database para buscar primeira imagem)
        const meta = await generateCategoryMetaTags(categoryData, baseUrl, database);
        
        // Gerar JSON-LD structured data
        const structuredData = generateCategoryJsonLd(categoryData, baseUrl, database);
        
        // Renderizar template EJS
        res.render('layouts/main', {
            page: 'pages/category',
            scripts: ['/js/ui/drawings.js', '/js/app.js'],
            categoryData,
            meta,
            structuredData
        });
    } catch (error) {
        console.error('Erro ao renderizar página de categoria:', error);
        // Renderizar página genérica em caso de erro
        const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
        const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:8000';
        const baseUrl = `${protocol}://${host}`;
        res.render('layouts/main', {
            page: 'pages/category',
            scripts: ['/js/ui/drawings.js', '/js/app.js'],
            categoryData: null,
            meta: generateMetaTags({
                title: 'Free Coloring Pages for Kids – Print or Color Online',
                description: 'Free coloring pages for kids! Print or Color Online.',
                url: `${baseUrl}/category`
            }),
            structuredData: []
        });
    }
});

module.exports = router;

