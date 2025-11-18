# Configuração do AWS S3 para Armazenamento de Desenhos

Este guia explica como configurar um bucket S3 na AWS para armazenar os desenhos gerados por IA.

## Pré-requisitos

1. Conta AWS ativa
2. Acesso ao Console AWS
3. Permissões para criar buckets S3 e políticas IAM

## Passo 1: Criar um Bucket S3

1. Acesse o [Console AWS S3](https://console.aws.amazon.com/s3/)
2. Clique em **"Create bucket"**
3. Configure o bucket:
   - **Bucket name**: Escolha um nome único (ex: `color-app-drawings-2024`)
   - **AWS Region**: Escolha uma região próxima (ex: `us-east-1` ou `sa-east-1` para São Paulo)
   - **Object Ownership**: Selecione **"ACLs enabled"** e **"Bucket owner preferred"**
   - **Block Public Access settings**: **DESMARQUE** todas as opções para permitir acesso público de leitura
     - ⚠️ Você precisará confirmar que entende os riscos
   - **Bucket Versioning**: Opcional (pode deixar desabilitado)
   - **Default encryption**: Recomendado habilitar (SSE-S3 ou SSE-KMS)
   - **Object Lock**: Deixe desabilitado
4. Clique em **"Create bucket"**

## Passo 2: Configurar Política de Bucket (Acesso Público de Leitura)

1. No bucket criado, vá para a aba **"Permissions"**
2. Role até **"Bucket policy"** e clique em **"Edit"**
3. Cole a seguinte política (substitua `SEU-BUCKET-NAME` pelo nome do seu bucket):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::SEU-BUCKET-NAME/*"
        }
    ]
}
```

4. Clique em **"Save changes"**

## Passo 3: Configurar CORS (Opcional - Proxy Recomendado)

> **Nota**: O sistema agora usa um proxy no servidor para servir imagens do S3, o que evita problemas de CORS. A configuração CORS no S3 ainda é recomendada, mas não é estritamente necessária se você usar o proxy.

### Opção 1: Usar Proxy (Recomendado - Já Implementado)

O sistema automaticamente detecta URLs do S3 e as redireciona através de um proxy no servidor (`/api/proxy-image`), que adiciona os headers CORS corretos. Isso significa que você **não precisa** configurar CORS no S3, mas ainda é recomendado para melhor performance.

### Opção 2: Configurar CORS no S3

Se você quiser servir imagens diretamente do S3 (sem proxy), configure CORS:

1. Ainda na aba **"Permissions"**, role até **"Cross-origin resource sharing (CORS)"**
2. Clique em **"Edit"**
3. Cole a seguinte configuração:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "HEAD"
        ],
        "AllowedOrigins": [
            "*"
        ],
        "ExposeHeaders": [
            "ETag"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

4. Clique em **"Save changes"**

> **Importante**: Mesmo com CORS configurado no S3, o sistema ainda usa o proxy por padrão para garantir compatibilidade. Se você quiser desabilitar o proxy e usar URLs diretas do S3, será necessário modificar o código.

## Passo 4: Criar Política IAM

Primeiro, vamos criar a política que define as permissões necessárias:

1. Acesse o [Console IAM](https://console.aws.amazon.com/iam/)
2. No menu lateral, clique em **"Policies"** (Políticas)
3. Clique no botão **"Create policy"** (no canto superior direito)
4. Clique na aba **"JSON"** (no topo da página)
5. Cole o seguinte JSON (substitua `SEU-BUCKET-NAME` pelo nome do seu bucket):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::SEU-BUCKET-NAME/drawings/customizados/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::SEU-BUCKET-NAME",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "drawings/*"
                }
            }
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::SEU-BUCKET-NAME/drawings/*"
        }
    ]
}
```

**Explicação das permissões:**
- `s3:PutObject` e `s3:PutObjectAcl`: Permite fazer upload de novos desenhos
- `s3:ListBucket`: Permite listar objetos no bucket (necessário para descobrir categorias e imagens)
- `s3:GetObject`: Permite ler objetos do bucket (necessário para acessar as imagens)

6. Clique em **"Next"** (no canto inferior direito)
7. Na página seguinte, dê um nome à política:
   - **Policy name**: `ColorAppS3Policy` (ou outro nome de sua preferência)
   - **Description** (opcional): "Permite upload, listagem e leitura de desenhos no S3"
8. Clique em **"Create policy"** (no canto inferior direito)
9. Aguarde a confirmação de que a política foi criada

## Passo 5: Criar Usuário IAM para Acesso Programático

> **Nota**: Se você já criou a política no Passo 4, pode pular direto para este passo.

Agora vamos criar o usuário e anexar a política que você criou:

1. No [Console IAM](https://console.aws.amazon.com/iam/), no menu lateral, clique em **"Users"** (Usuários)
2. Clique no botão **"Create user"** (no canto superior direito)
3. Na página **"Specify user details"**:
   - **User name**: Digite `color-app-s3-user` (ou outro nome de sua preferência)
   - Deixe as outras opções como estão
4. Clique no botão **"Next"** (no canto inferior direito)
5. Na página **"Set permissions"**:
   - Selecione a opção **"Attach policies directly"** (Anexar políticas diretamente)
   - Na caixa de busca, digite o nome da política que você criou (ex: `ColorAppS3Policy`)
   - Marque a checkbox ao lado da política quando ela aparecer
6. Clique no botão **"Next"** (no canto inferior direito)
7. Na página **"Review and create"**, revise as informações e clique em **"Create user"** (no canto inferior direito)
8. Você verá uma mensagem de sucesso confirmando que o usuário foi criado

## Passo 6: Criar Access Keys

1. No usuário criado, vá para a aba **"Security credentials"**
2. Role até **"Access keys"**
3. Clique em **"Create access key"**
4. Selecione **"Application running outside AWS"**
5. Clique em **"Next"** e depois em **"Create access key"**
6. **IMPORTANTE**: Copie e salve em local seguro:
   - **Access key ID**
   - **Secret access key** (só aparece uma vez!)

## Passo 7: Configurar Variáveis de Ambiente

### Para Desenvolvimento Local

1. Copie `config.example.js` para `config.js` (se ainda não tiver)
2. Edite `config.js` e adicione:

```javascript
AWS_ACCESS_KEY_ID: 'sua-access-key-id-aqui',
AWS_SECRET_ACCESS_KEY: 'sua-secret-access-key-aqui',
AWS_REGION: 'us-east-1', // ou a região que você escolheu
AWS_S3_BUCKET_NAME: 'nome-do-seu-bucket',
```

### Para Produção (Vercel)

1. Acesse o [Dashboard do Vercel](https://vercel.com/dashboard)
2. Selecione seu projeto
3. Vá em **"Settings"** → **"Environment Variables"**
4. Adicione as seguintes variáveis:

| Nome | Valor |
|------|-------|
| `AWS_ACCESS_KEY_ID` | Sua Access Key ID |
| `AWS_SECRET_ACCESS_KEY` | Sua Secret Access Key |
| `AWS_REGION` | Região do bucket (ex: `us-east-1`) |
| `AWS_S3_BUCKET_NAME` | Nome do bucket |

5. Certifique-se de que as variáveis estão configuradas para **Production**, **Preview** e **Development** (ou apenas Production, conforme necessário)
6. Clique em **"Save"**
7. Faça um novo deploy para que as variáveis sejam aplicadas

## Passo 8: Testar a Configuração

1. Execute o projeto localmente ou faça deploy no Vercel
2. Gere um novo desenho através da interface
3. Verifique os logs para confirmar que o upload foi feito com sucesso
4. Acesse a URL retornada na resposta da API para verificar se a imagem está acessível

## Estrutura de Arquivos no S3

### ⚠️ Importante: S3 não tem pastas reais!

O S3 não possui uma estrutura de pastas como um sistema de arquivos tradicional. Em vez disso, ele usa **chaves (keys)** que podem conter barras (`/`) para simular uma estrutura hierárquica.

### Como Organizar suas Imagens no S3

Para que o sistema descubra automaticamente suas categorias e imagens, você precisa fazer upload das imagens com chaves que sigam este formato:

```
drawings/{categoria}/{nome-do-arquivo}
```

**Exemplos de chaves corretas:**
- `drawings/animais/Cachorro_Patinando.png`
- `drawings/animais/Coelho_Comendo_Cenoura.png`
- `drawings/natureza/Girassol_Feliz.png`
- `drawings/objetos/Carro_Feliz.png`
- `drawings/personagens/Kurumi.png`
- `drawings/gemeas/Barco_Pirata.png`
- `drawings/customizados/Meu_Desenho_Customizado.png`

### Como Fazer Upload das Imagens

#### Opção 1: Via Console AWS (Interface Web)

1. Acesse o [Console AWS S3](https://console.aws.amazon.com/s3/)
2. Abra seu bucket
3. Clique em **"Upload"**
4. Clique em **"Add files"** ou **"Add folder"**
5. **IMPORTANTE**: Ao fazer upload, você precisa definir o **"Destination"** (destino) manualmente:
   - Se você selecionar um arquivo `Cachorro_Patinando.png` da pasta local `animais/`
   - No campo **"Destination"** ou **"Prefix"**, digite: `drawings/animais/`
   - O arquivo será salvo com a chave: `drawings/animais/Cachorro_Patinando.png`

6. Repita para cada categoria:
   - Para imagens de animais: `drawings/animais/`
   - Para imagens de natureza: `drawings/natureza/`
   - Para imagens de objetos: `drawings/objetos/`
   - E assim por diante...

#### Opção 2: Via AWS CLI

Se você tem o AWS CLI instalado, pode fazer upload assim:

```bash
# Upload de uma imagem para a categoria "animais"
aws s3 cp Cachorro_Patinando.png s3://seu-bucket/drawings/animais/Cachorro_Patinando.png

# Upload de múltiplos arquivos de uma pasta local para uma categoria
aws s3 cp ./pasta-local/animais/ s3://seu-bucket/drawings/animais/ --recursive
```

#### Opção 3: Via Script ou Ferramenta de Terceiros

Ferramentas como:
- [Cyberduck](https://cyberduck.io/)
- [S3 Browser](https://s3browser.com/)
- [FileZilla Pro](https://filezillapro.com/)

Permitem fazer upload mantendo a estrutura de pastas, que será convertida automaticamente em chaves com barras.

### Estrutura Esperada

O sistema procura por objetos com o prefixo `drawings/` e espera o seguinte formato:

```
drawings/
├── animais/
│   ├── Cachorro_Patinando.png
│   └── Coelho_Comendo_Cenoura.png
├── natureza/
│   └── Girassol_Feliz.png
├── objetos/
│   └── Carro_Feliz.png
├── personagens/
│   └── Kurumi.png
├── gemeas/
│   └── Barco_Pirata.png
└── customizados/
    └── (desenhos gerados pela IA)
```

**Nota**: No S3, isso não são pastas reais, mas sim chaves que começam com `drawings/animais/`, `drawings/natureza/`, etc.

### URLs Públicas

As URLs públicas seguirão este formato:
```
https://seu-bucket.s3.regiao.amazonaws.com/drawings/{categoria}/{arquivo}
```

**Exemplo:**
```
https://meu-bucket.s3.us-east-1.amazonaws.com/drawings/animais/Cachorro_Patinando.png
```

### Desenhos Gerados pela IA

Os desenhos gerados automaticamente pela IA serão salvos em:
```
drawings/customizados/{Nome_Do_Desenho}.png
```

E aparecerão automaticamente na categoria "customizados" na interface.

## Segurança

- ⚠️ **Nunca** commite o arquivo `config.js` com credenciais reais no Git
- ⚠️ Mantenha suas Access Keys seguras e rotacione-as periodicamente
- ⚠️ O bucket está configurado para acesso público de leitura - isso é necessário para servir as imagens diretamente
- ✅ A política IAM criada permite apenas:
  - Upload de novos desenhos (PutObject)
  - Listar objetos para descobrir categorias (ListBucket)
  - Ler objetos (GetObject)
  - **NÃO** permite deletar ou modificar objetos existentes

## Troubleshooting

### Erro: "Access Denied" ou "Forbidden"
- Verifique se as credenciais IAM estão corretas
- Confirme que a política IAM permite:
  - `s3:PutObject` e `s3:PutObjectAcl` (para upload)
  - `s3:ListBucket` (para listar objetos - **necessário para descobrir categorias**)
  - `s3:GetObject` (para ler objetos)
- Verifique se o nome do bucket está correto
- Se você criou a política antes desta atualização, você precisa atualizá-la com as novas permissões

### Erro: "Bucket does not exist"
- Confirme que o nome do bucket está correto
- Verifique se a região está correta

### Imagens não aparecem no navegador
- Verifique se a política de bucket permite acesso público
- Confirme que o Block Public Access está desabilitado
- Verifique a configuração CORS (se não estiver usando o proxy)
- O sistema usa um proxy automático para imagens do S3, então problemas de CORS devem ser resolvidos automaticamente

### Erro de CORS ao carregar imagens
- O sistema agora usa um proxy automático (`/api/proxy-image`) que resolve problemas de CORS
- Se você ainda encontrar erros de CORS, verifique se:
  - O servidor está rodando corretamente
  - As credenciais AWS estão configuradas
  - O bucket e região estão corretos no `config.js`

### Erro: "InvalidAccessKeyId"
- Verifique se as credenciais foram copiadas corretamente
- Confirme que as variáveis de ambiente estão configuradas no Vercel

## Custos

O AWS S3 oferece um tier gratuito generoso:
- 5 GB de armazenamento
- 20.000 requisições GET
- 2.000 requisições PUT

Após o tier gratuito, os custos são muito baixos (aproximadamente $0.023 por GB/mês de armazenamento).

Para mais informações sobre preços, consulte: https://aws.amazon.com/s3/pricing/

