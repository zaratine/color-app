# Site de Colorir para Crianças

Um site interativo onde crianças podem escolher desenhos para colorir.

## Estrutura

- `public/index.html` - Página inicial com seleção de categorias
- `views/pages/category.ejs` - Template EJS para listagem de desenhos por categoria
- `views/pages/paint.ejs` - Template EJS para interface de pintura
- `views/layouts/main.ejs` - Layout base com head comum
- `public/styles/main.css` - Estilos principais
- `public/js/` - Scripts JavaScript
- `drawings/` - Pasta com desenhos (PNG, JPG ou SVG) organizados por categorias

## Como Adicionar Novos Desenhos

O sistema lê os desenhos diretamente do filesystem em tempo de execução. Basta adicionar os arquivos de imagem nas pastas!

1. **Para uma categoria existente:**
   - Adicione o arquivo de imagem (PNG, JPG ou SVG) na pasta correspondente dentro de `drawings/`
   - Exemplo: `drawings/animais/passaro.png`

2. **Para uma nova categoria:**
   - Crie uma nova pasta dentro de `drawings/` com o nome da categoria
   - Adicione os arquivos de imagem nessa pasta
   - Exemplo: `drawings/veiculos/carro.png`, `drawings/veiculos/aviao.png`

3. **Recarregue a página no navegador** - os novos desenhos aparecerão automaticamente!

**Não é necessário editar nenhum arquivo JavaScript ou reiniciar o servidor!** O sistema detecta automaticamente todas as mudanças.

## Requisitos das Imagens

- As imagens podem ser em formato **PNG**, **JPG** ou **SVG**
- Para melhor resultado com PNG/JPG:
  - Use imagens com fundo branco ou transparente
  - As linhas devem ser pretas ou escuras
  - O algoritmo de preenchimento detecta áreas fechadas automaticamente
- Para SVG: os elementos devem ter `fill` definido para serem pintáveis

## Como Usar

**IMPORTANTE:** Este projeto requer o servidor Node.js customizado para funcionar, pois ele lê os desenhos diretamente do filesystem em tempo de execução.

### Instalação

Primeiro, instale as dependências:

```bash
npm install
```

### Configurar API da OpenAI (Opcional)

Para usar a funcionalidade de geração de desenhos customizados, você precisa configurar a chave da API da OpenAI:

1. **Edite o arquivo `config.js`** e substitua `'sua-chave-aqui'` pela sua chave real:
   ```javascript
   OPENAI_API_KEY: 'sk-sua-chave-real-aqui',
   ```

2. **Obtenha sua chave da API em:** https://platform.openai.com/api-keys

**Nota:** 
- O arquivo `config.js` está no `.gitignore` para não ser versionado acidentalmente
- Se você não configurar a chave da API, o site ainda funcionará normalmente, mas a funcionalidade de gerar desenhos customizados não estará disponível
- **Nunca compartilhe sua chave da API publicamente!**

### Iniciar o Servidor

Use o servidor Node.js incluído no projeto:

```bash
npm start
```

Ou diretamente:

```bash
node src/server.js
```

O servidor irá:
- Escanear automaticamente a pasta `drawings/` em tempo de execução
- Listar todas as categorias e desenhos dinamicamente
- Servir os arquivos estáticos e fornecer uma API para listar desenhos
- Criar automaticamente a pasta `drawings/customizados/` para desenhos gerados

Depois acesse: **http://localhost:8000**

### Adicionar Novos Desenhos

1. **Adicione os arquivos de imagem** (PNG, JPG ou SVG) nas pastas correspondentes dentro de `drawings/`
   - Para uma categoria existente: coloque a imagem na pasta da categoria
   - Para uma nova categoria: crie uma nova pasta dentro de `drawings/` e coloque as imagens lá

2. **Recarregue a página no navegador** - os novos desenhos aparecerão automaticamente!

Não é necessário rodar nenhum script ou reiniciar o servidor. O sistema lê diretamente do filesystem em tempo de execução.

### Usar o Site

1. Inicie o servidor com `npm start` ou `node src/server.js`
2. Abra `http://localhost:8000` no navegador
3. **Gerar desenho customizado (novo!):**
   - Digite o que você quer pintar no campo de texto (ex: "um gato", "uma princesa", "um carro")
   - Clique em "Gerar Desenho"
   - Aguarde alguns segundos enquanto a IA gera seu desenho personalizado
   - O desenho será salvo automaticamente e você será redirecionado para colorir
4. **Ou escolha uma categoria existente:**
   - Escolha uma categoria
   - Selecione um desenho
5. Clique nas cores da paleta para selecionar
6. Clique nas áreas do desenho para colorir

### Desenhos Customizados

Os desenhos gerados pela IA são salvos automaticamente na pasta `drawings/customizados/` e podem ser acessados novamente através da categoria "Customizados" (se ela aparecer na listagem).

## Deploy no Vercel

Este projeto está configurado para deploy automático no Vercel com integração ao GitHub.

### Pré-requisitos

1. Conta no [Vercel](https://vercel.com) (pode usar sua conta GitHub)
2. Repositório no GitHub com o código do projeto

### Passo a Passo

#### 1. Conectar Repositório ao Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **"Add New Project"** ou **"Import Project"**
3. Selecione o repositório do GitHub que contém este projeto
4. O Vercel detectará automaticamente as configurações do `vercel.json`

#### 2. Configurar Variáveis de Ambiente

No painel do Vercel, vá em **Settings > Environment Variables** e adicione:

- **`OPENAI_API_KEY`**: Sua chave da API da OpenAI
  - Obtenha em: https://platform.openai.com/api-keys
  - **Importante**: Esta variável é necessária para a funcionalidade de gerar desenhos customizados

**Nota**: A variável `PORT` não precisa ser configurada - o Vercel define automaticamente.

#### 3. Deploy

1. Após configurar as variáveis de ambiente, clique em **"Deploy"**
2. O Vercel fará o build e deploy automaticamente
3. Você receberá uma URL do tipo: `https://seu-projeto.vercel.app`

#### 4. Deploy Automático

Após a primeira configuração:
- **Cada push para a branch `main`** (ou a branch configurada) fará deploy automático
- **Pull Requests** geram previews de deploy automaticamente
- Você pode ver o status dos deploys no painel do Vercel

### Configuração Local vs Produção

- **Local**: Use o arquivo `config.js` (copie de `config.example.js` e adicione suas chaves)
- **Produção (Vercel)**: Use variáveis de ambiente no painel do Vercel (mais seguro)

O código está configurado para priorizar variáveis de ambiente sobre o arquivo `config.js`, então funcionará corretamente em ambos os ambientes.

### Limitações no Vercel

⚠️ **Desenhos Customizados**: No Vercel (ambiente serverless), o sistema de arquivos é read-only. Isso significa que:
- Os desenhos customizados gerados pela IA **não serão salvos permanentemente**
- A funcionalidade de gerar desenhos funcionará, mas eles não estarão disponíveis após a requisição
- Para salvar desenhos permanentemente no Vercel, seria necessário usar um serviço de armazenamento externo (como AWS S3, Cloudinary, etc.)

Os desenhos estáticos na pasta `public/drawings/` funcionam normalmente, pois são parte do código deployado.

### Troubleshooting

- **Erro de build**: Verifique se todas as dependências estão no `package.json`
- **API não funciona**: Verifique se a variável `OPENAI_API_KEY` está configurada no Vercel
- **Arquivos estáticos não carregam**: Verifique se a pasta `public/` está sendo servida corretamente
- **Erro EROFS (read-only file system)**: Este erro foi corrigido - o código agora detecta ambientes serverless e não tenta escrever no sistema de arquivos

