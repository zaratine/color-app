// Controllers para rotas de desenhos
const { getDrawingsDatabase } = require('../services/drawingsService');
const { generateDrawing } = require('../services/openaiService');

// GET /api/drawings - Lista todos os desenhos por categoria
async function getDrawings(req, res) {
    console.log('  → Endpoint /api/drawings encontrado');
    try {
        const database = await getDrawingsDatabase();
        res.json(database);
    } catch (error) {
        console.error('  ✗ Erro ao obter desenhos:', error);
        res.status(500).json({ error: 'Erro ao obter desenhos' });
    }
}

// POST /api/generate-drawing - Gera um novo desenho via OpenAI
async function createDrawing(req, res) {
    console.log('  → Endpoint /api/generate-drawing encontrado');
    
    try {
        const data = req.body;
        console.log('  → Dados recebidos:', JSON.stringify(data));
        
        if (!data.theme || !data.theme.trim()) {
            console.log('  ✗ Tema não fornecido');
            return res.status(400).json({ error: 'Tema não fornecido' });
        }

        console.log(`  → Tema recebido: "${data.theme.trim()}"`);
        console.log('  → Iniciando geração do desenho...');

        const result = await generateDrawing(data.theme.trim());
        console.log(`  ✅ Desenho gerado com sucesso: ${result.filename}`);
        console.log(`  ✅ Armazenamento: ${result.storage}`);
        if (result.url) {
            console.log(`  ✅ URL: ${result.url}`);
        }
        
        res.json({ 
            success: true, 
            filename: result.filename,
            url: result.url,
            storage: result.storage
        });
    } catch (error) {
        console.error('  ✗ Erro ao gerar desenho:', error);
        console.error('  ✗ Stack trace:', error.stack);
        const statusCode = error.statusCode || 500;
        res.status(statusCode).json({ 
            error: error.message || 'Erro ao gerar desenho' 
        });
    }
}

module.exports = {
    getDrawings,
    createDrawing
};

