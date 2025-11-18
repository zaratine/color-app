// Configurações do projeto
// ATENÇÃO: Não compartilhe este arquivo publicamente se contiver chaves de API!
// 
// Este é um arquivo de exemplo. Para uso local, copie este arquivo para config.js
// e adicione suas configurações reais.
//
// Para produção (Vercel), use variáveis de ambiente no painel do Vercel:
// - OPENAI_API_KEY: sua chave da API da OpenAI
// - AWS_ACCESS_KEY_ID: sua chave de acesso AWS
// - AWS_SECRET_ACCESS_KEY: sua chave secreta AWS
// - AWS_REGION: região do bucket S3 (ex: us-east-1, sa-east-1)
// - AWS_S3_BUCKET_NAME: nome do bucket S3
// - PORT: será definido automaticamente pelo Vercel

module.exports = {
    // Chave da API da OpenAI
    // Obtenha sua chave em: https://platform.openai.com/api-keys
    OPENAI_API_KEY: 'sua-chave-aqui',
    
    // Configurações AWS S3
    // Obtenha suas credenciais em: https://console.aws.amazon.com/iam/
    AWS_ACCESS_KEY_ID: 'sua-access-key-aqui',
    AWS_SECRET_ACCESS_KEY: 'sua-secret-key-aqui',
    AWS_REGION: 'us-east-1', // ou sa-east-1 para São Paulo
    AWS_S3_BUCKET_NAME: 'nome-do-seu-bucket',
    
    // Porta do servidor (usado apenas localmente)
    // No Vercel, a porta é definida automaticamente via process.env.PORT
    PORT: 8000
};

