#!/usr/bin/env node

// Servidor Express que serve arquivos estáticos e fornece API para listar desenhos
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Carregar configurações
let config;
try {
    config = require('../config.js');
} catch (error) {
    console.error('⚠️  Arquivo config.js não encontrado. Criando arquivo de exemplo...');
    // Criar arquivo de exemplo
    const exampleConfig = `// Configurações do projeto
// ATENÇÃO: Não compartilhe este arquivo publicamente se contiver chaves de API!

module.exports = {
    // Chave da API da OpenAI
    // Obtenha sua chave em: https://platform.openai.com/api-keys
    OPENAI_API_KEY: 'sua-chave-aqui',
    
    // Porta do servidor
    PORT: 8000
};`;
    fs.writeFileSync(path.resolve(__dirname, '..', 'config.js'), exampleConfig);
    console.log('✅ Arquivo config.js criado. Por favor, edite-o e adicione sua chave da OpenAI.');
    process.exit(1);
}

const PORT = config.PORT || 8000;
const DRAWINGS_DIR = path.resolve(__dirname, '..', 'public', 'drawings');
const CUSTOM_DIR = path.resolve(__dirname, '..', 'public', 'drawings', 'customizados');

// Inicializar OpenAI (usa config.js ou variável de ambiente como fallback)
const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const openai = new OpenAI({
    apiKey: apiKey
});

// Garantir que a pasta customizados existe
if (!fs.existsSync(CUSTOM_DIR)) {
    fs.mkdirSync(CUSTOM_DIR, { recursive: true });
    console.log('📁 Pasta customizados criada');
}

// Função para capitalizar primeira letra
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Função para formatar nome de exibição
function formatDisplayName(name) {
    return name
        .split('-')
        .map(word => capitalize(word))
        .join(' ');
}

// Função para listar desenhos de todas as categorias
function getDrawingsDatabase() {
    const database = {};
    
    try {
        if (!fs.existsSync(DRAWINGS_DIR)) {
            return database;
        }

        const categories = fs.readdirSync(DRAWINGS_DIR, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        categories.forEach(category => {
            const categoryPath = path.join(DRAWINGS_DIR, category);
            const files = fs.readdirSync(categoryPath)
                .filter(file => {
                    const lower = file.toLowerCase();
                    return lower.endsWith('.svg') || lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
                })
                .sort();

            if (files.length > 0) {
                database[category] = {
                    displayName: formatDisplayName(category),
                    drawings: files
                };
            }
        });
    } catch (error) {
        console.error('Erro ao ler desenhos:', error);
    }

    return database;
}

// Função para gerar nome de arquivo único
function generateFilename(theme) {
    const sanitized = theme
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 50);
    const timestamp = Date.now();
    return `${sanitized}_${timestamp}.png`;
}

// Prompt para geração de desenho
const DRAWING_PROMPT = `You are an illustration model that generates kids' coloring pages.

TASK
Create a single black-and-white line drawing for children to color.

MAIN SUBJECT
Draw: REPLACE_THEME

STYLE
Cute, friendly, CHILDLIKE style, like a kids' coloring book.
Clear, smooth outlines with consistent stroke width.
Only BLACK outlines on a WHITE background (no gray, no shading, no textures, no color).
Big, simple, closed shapes that are easy for kids to color.
Add a few small, simple decorative elements that match the theme (for example: little clouds, stars, hearts, simple waves, flowers, etc.), but keep the page clean and not crowded.
All elements must have soft, rounded, cute shapes. No realistic or scary style.

COMPOSITION
Landscape orientation (horizontal) like a printable coloring page.
Aspect ratio of 16:9, always LANDSCAPE.
Main characters centered or slightly off-center, large and clearly visible.
Simple background made only of line art (no filled areas, no patterns).

VERY IMPORTANT – OBJECTS AND BORDERS

1) Ground / Water / Base Area (for flood fill)
The ground / floor / water / base of the scene must form a continuous band that touches the left and right edges of the canvas (and can also touch the bottom edge).
This base area is the only element that is allowed to touch or be cut by the canvas border.
The outline of this base must still create a closed region so that a flood-fill/bucket tool can fill it correctly (no gaps or open shapes, even near the borders).

2) All Other Elements
Do not crop or cut any other object at the edges of the image.
No other element (characters, boat, hats, hair, hands, telescope, oars, clouds, stars, hearts, waves, flowers, etc.) may touch or intersect the border of the canvas.
Leave a clean white margin around all these elements (at least 5–10% of the canvas on all sides), so they are fully inside the scene and not cropped.
If any object would be partially outside the frame, move or resize it so that it is completely inside the canvas.

3) Frame
The frame should not have any border or background.

OUTPUT FORMAT
Return a single raster image in PNG format.
Aspect ratio of 16:9, always LANDSCAPE.
Do NOT return SVG, code, XML, or text art.
The result must look like a printable kids' coloring page.

NEGATIVE CONSTRAINTS
No colors other than black outlines on white background.
No border around the image.
No gradients, no shading, no sketchy or messy lines.
No cropped elements at the edges, except for the ground/water/base band described above.
No text, letters, numbers, logos, watermarks, or signatures.
No realistic gore, fear, weapons, or adult themes.`;

// Função para baixar imagem de uma URL
function downloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
        console.log('      [downloadImage] Iniciando download de:', imageUrl);
        const urlObj = new URL(imageUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        protocol.get(imageUrl, (response) => {
            console.log('      [downloadImage] Status code:', response.statusCode);
            if (response.statusCode !== 200) {
                reject(new Error(`Erro ao baixar imagem: ${response.statusCode}`));
                return;
            }
            
            const chunks = [];
            let totalSize = 0;
            response.on('data', (chunk) => {
                chunks.push(chunk);
                totalSize += chunk.length;
            });
            
            response.on('end', () => {
                console.log('      [downloadImage] Download completo. Tamanho total:', totalSize, 'bytes');
                resolve(Buffer.concat(chunks));
            });
            
            response.on('error', (error) => {
                console.error('      [downloadImage] Erro no stream:', error);
                reject(error);
            });
        }).on('error', (error) => {
            console.error('      [downloadImage] Erro na requisição:', error);
            reject(error);
        });
    });
}

// Função para gerar desenho usando OpenAI
async function generateDrawing(theme) {
    try {
        console.log('    [generateDrawing] Iniciando geração...');
        const prompt = DRAWING_PROMPT.replace('REPLACE_THEME', theme);
        console.log('    [generateDrawing] Prompt criado (tamanho:', prompt.length, 'caracteres)');
        
        console.log('    [generateDrawing] Chamando OpenAI API...');
        const response = await openai.images.generate({
            model: 'gpt-image-1',
            prompt: prompt,
            output_format: 'png'
            //size: '1792x1024', // Aspect ratio 16:9 (aproximado)
            //quality: 'standard',
            //response_format: 'url' // Não suportado pelo modelo gpt-image-1-mini
        });

        console.log('    [generateDrawing] Resposta da OpenAI recebida');
        const imageUrl = response.data[0].url;
        console.log('    [generateDrawing] URL da imagem:', imageUrl);
        
        // Baixar a imagem usando https nativo
        console.log('    [generateDrawing] Baixando imagem...');
        const imageBuffer = await downloadImage(imageUrl);
        console.log('    [generateDrawing] Imagem baixada (tamanho:', imageBuffer.length, 'bytes)');
        
        // Gerar nome do arquivo e salvar
        const filename = generateFilename(theme);
        const filePath = path.join(CUSTOM_DIR, filename);
        console.log('    [generateDrawing] Salvando em:', filePath);
        
        fs.writeFileSync(filePath, imageBuffer);
        console.log('    [generateDrawing] Arquivo salvo com sucesso');
        
        return filename;
    } catch (error) {
        console.error('    [generateDrawing] Erro:', error.message);
        console.error('    [generateDrawing] Stack:', error.stack);
        throw error;
    }
}

// Inicializar Express
const app = express();

// Middleware para parsing JSON
app.use(express.json());

// Middleware para log de requisições
app.use((req, res, next) => {
    console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// Rotas de API (antes do static para ter prioridade)
app.get('/api/drawings', (req, res) => {
    console.log('  → Endpoint /api/drawings encontrado');
    const database = getDrawingsDatabase();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(database);
});

app.post('/api/generate-drawing', async (req, res) => {
    console.log('  → Endpoint /api/generate-drawing encontrado');
    
    try {
        const data = req.body;
        console.log('  → Dados recebidos:', JSON.stringify(data));
        
        if (!data.theme || !data.theme.trim()) {
            console.log('  ✗ Tema não fornecido');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(400).json({ error: 'Tema não fornecido' });
        }

        console.log(`  → Tema recebido: "${data.theme.trim()}"`);

        const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === 'sua-chave-aqui') {
            console.log('  ✗ OPENAI_API_KEY não configurada');
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(500).json({ 
                error: 'OPENAI_API_KEY não configurada. Por favor, edite o arquivo config.js e adicione sua chave da API.' 
            });
        }

        console.log('  → API Key encontrada (primeiros 10 caracteres):', apiKey.substring(0, 10) + '...');
        console.log('  → Iniciando geração do desenho...');

        const filename = await generateDrawing(data.theme.trim());
        console.log(`  ✅ Desenho gerado com sucesso: ${filename}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json({ 
            success: true, 
            filename: filename 
        });
    } catch (error) {
        console.error('  ✗ Erro ao gerar desenho:', error);
        console.error('  ✗ Stack trace:', error.stack);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(500).json({ 
            error: error.message || 'Erro ao gerar desenho' 
        });
    }
});

// Rotas limpas (sem extensões)
const publicDir = path.resolve(__dirname, '..', 'public');

app.get('/', (req, res) => {
    res.sendFile(path.resolve(publicDir, 'index.html'));
});

app.get('/paint', (req, res) => {
    res.sendFile(path.resolve(publicDir, 'paint.html'));
});

app.get('/category', (req, res) => {
    res.sendFile(path.resolve(publicDir, 'category.html'));
});

// Servir arquivos estáticos da pasta public (seguro - apenas arquivos públicos)
app.use(express.static(publicDir));

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Desenhos sendo lidos de: ${DRAWINGS_DIR}`);
    
    const apiKey = config.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'sua-chave-aqui') {
        console.log(`⚠️  AVISO: OPENAI_API_KEY não configurada.`);
        console.log(`   Por favor, edite o arquivo config.js e adicione sua chave da API.`);
        console.log(`   Obtenha sua chave em: https://platform.openai.com/api-keys`);
    } else {
        console.log(`✅ OpenAI API configurada`);
    }
    
    console.log(`\n✨ Acesse http://localhost:${PORT} no navegador\n`);
});

