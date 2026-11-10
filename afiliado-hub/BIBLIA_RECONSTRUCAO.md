# Bíblia de Reconstrução — Afiliado Hub

Este documento registra a arquitetura, decisões técnicas, contratos entre módulos, fluxo de dados, premissas operacionais e roteiro de reconstrução do projeto. A intenção é permitir que outro desenvolvedor recrie ou evolua o sistema sem depender de suposições escondidas no código.

## 1. Objetivo e escopo

Unificar dois projetos independentes fornecidos pelo usuário:

1. **ML-Collector / extrator:** pesquisa produtos no Mercado Livre e coleta título, preço e URL.
2. **link2affiliate / conversor:** recebe URL, marketplace e dado de afiliado; originalmente montava uma URL e oferecia integração com WhatsApp.

O produto integrado deve oferecer uma sequência clara:

```text
Pesquisar no Mercado Livre
        ↓
Abrir navegador persistente e autenticar manualmente quando solicitado
        ↓
Capturar título, preço e URL dos produtos visíveis
        ↓
Selecionar produto e etiqueta de afiliado
        ↓
Abrir o Gerador de Links oficial do Mercado Livre
        ↓
Usuário gera e confirma o link oficial
        ↓
Salvar associação URL original ↔ link de afiliado
        ↓
Montar e enviar oferta a um grupo do WhatsApp
```

**Escopo atual:** Mercado Livre Brasil. Os demais marketplaces que apareciam no conversor antigo não foram migrados para esta versão.

## 2. Auditoria dos projetos de origem

### 2.1. `Scallowra-ML-Links-Colector`

**Arquivos recebidos:** `mercado_livre_busca.py` e `readme.md`.

**Stack original:** Python, Playwright síncrono e Chrome do sistema.

**Comportamento identificado:**

- Recebia termo de busca e quantidade pelo terminal.
- Criava um contexto persistente em `ml_session_cache`.
- Abria a página de busca do Mercado Livre.
- Aguardava o usuário resolver login/verificação e pressionar Enter no terminal.
- Extraía título, preço e link usando seletores CSS.
- Exibia os resultados apenas no terminal.

**Pontos aproveitados:** perfil de navegador persistente, login humano e coleta de atributos básicos do produto.

**Pontos substituídos:** prompts de terminal, fluxo de saída somente textual e seletores concentrados no script.

**Ponto de segurança removido:** o original tentava suprimir identificadores de automação (`navigator.webdriver`, argumento `--enable-automation`) com o objetivo declarado de ocultar automação. A versão integrada não implementa fingerprint spoofing, stealth plugins, proxies rotativos, resolução automatizada de CAPTCHA ou outras técnicas de evasão. A autenticação e eventuais verificações são feitas pelo usuário no navegador visível.

### 2.2. `link-2-affiliate-converter`

**Estrutura recebida:** aplicação Node/Express dentro de `robo_afiliados_completo/robo_afiliados_completo`.

**Stack original:** Node.js, Express, NeDB, Axios, `whatsapp-web.js` e `qrcode-terminal`.

**Comportamento identificado:**

- Servia um painel HTML no Express.
- Tinha um parser com branches para Shopee, Amazon, Mercado Livre e Magalu.
- No Mercado Livre, removia a query original e acrescentava `?allocatorId=${affiliateId}`.
- Criava um cliente WhatsApp com `LocalAuth`.
- Guardava o texto do QR Code, mas o HTML mostrava a string como texto e instruía o usuário a ler o QR no terminal.
- O campo de imagem não era enviado como mídia; o código acabava enviando somente texto.
- O envio era feito a partir de `chatId` informado manualmente.

**Problemas relevantes identificados:**

1. Acrescentar `allocatorId` não comprova a criação de um link rastreável. A documentação pública do Mercado Livre orienta usar o Gerador de Links ou a Barra de Afiliados, colar o endereço de um produto, selecionar uma etiqueta e gerar o link.
2. O QR do WhatsApp não era renderizado graficamente na tela.
3. A mídia de oferta era declarada no formulário, mas não era realmente enviada.
4. O código não verificava se o URL de afiliado correspondia à conversão que o usuário pretendia publicar.

**Decisão:** preservar a experiência de painel, o envio opcional via WhatsApp e o banco local, mas trocar o algoritmo que inventava parâmetros por um fluxo assistido através do gerador oficial.

## 3. Decisão de arquitetura

O extrator Python foi migrado para Playwright no Node para unificar a sessão do navegador e facilitar a comunicação interna com o conversor.

```text
Browser (painel local)
      │ HTTP/JSON
      ▼
Express — src/server.js
      │
      ├── modules/extractor
      │      └── Playwright Persistent Context
      │             ├── página de resultados
      │             └── página do Gerador oficial
      │
      ├── modules/converter
      │      └── validação + persistência de links confirmados
      │
      ├── modules/whatsapp
      │      └── whatsapp-web.js + QR Code PNG/Data URL
      │
      └── modules/offers
             └── validação de conversão + envio + histórico
                    │
                    ▼
               data/*.db e perfis locais
```

### 3.1. Por que um único servidor Node

- O painel, o conversor e o ciclo de sessão do navegador passam a usar o mesmo runtime.
- O Playwright e o Express compartilham referências a um único `MercadoLivreExtractor`.
- O conversor pode abrir o portal oficial no mesmo contexto que mantém a autenticação já realizada.
- Reduz processos separados, comandos de terminal e problemas de sincronização entre Node e Python.

### 3.2. Modularização por domínio

- `extractor`: busca, navegador, sessão, captura e estado.
- `converter`: preparação, confirmação e histórico de links afiliados.
- `whatsapp`: pareamento, QR Code, status, lista de grupos e envio.
- `offers`: regra de envio e registro histórico.
- `storage`: inicialização do armazenamento persistente.

Rotas apenas adaptam HTTP; regras e operações de domínio ficam nos serviços.

## 4. Sessão persistente e interação com o Mercado Livre

### 4.1. Perfil do navegador

O serviço usa `chromium.launchPersistentContext()` com diretório:

```text
data/mercado-livre-profile/
```

O diretório armazena cookies, local storage e dados de sessão do perfil. Ele não deve ser versionado, enviado em logs ou compartilhado.

### 4.2. Fluxo de autenticação

1. O painel pede uma pesquisa.
2. O servidor abre a pesquisa no Chromium visível.
3. O usuário realiza login manual quando necessário.
4. Se houver CAPTCHA ou outra verificação, o usuário a trata diretamente na página original.
5. O usuário volta ao painel e aciona a captura.
6. As próximas inicializações reutilizam o perfil enquanto a sessão permanecer válida.

Não existe tentativa de burlar controle anti-bot. O projeto não injeta código para alterar `navigator.webdriver`, não remove flags padrão do navegador, não usa proxies para mascarar tráfego, nem automatiza a resolução de CAPTCHA. Se o site bloquear ou pedir verificação, o fluxo deve parar e aguardar a ação legítima do usuário.

### 4.3. Política operacional

- Capturar somente o conteúdo que a página oficial efetivamente apresentou.
- Não implementar paginação agressiva ou scraping em massa.
- Não repetir tentativas automaticamente quando aparecer bloqueio.
- Preferir intervalos e volumes moderados; observar termos e instruções da plataforma.
- Não registrar cookies, tokens ou conteúdo da sessão em logs.

## 5. Extração de produtos

### 5.1. Entrada

```json
{
  "query": "monitor 27",
  "quantity": 10
}
```

Restrições: consulta com pelo menos dois caracteres; quantidade inteira de 1 a 50.

### 5.2. Seletores

O código centraliza seletores compatíveis com variantes comuns de resultados:

- `.poly-card`
- `li.ui-search-layout__item`
- `.ui-search-result`

Título e link priorizam:

- `.poly-component__title`
- `.ui-search-item__title`
- `a.poly-component__title`
- `a.ui-search-link`
- links com `/p/` ou `MLB-` no caminho

Preço é obtido de `.andes-money-amount__fraction`, `.andes-money-amount__decimal` e `.andes-money-amount__currency-symbol`, com fallback textual.

Os seletores são heurísticos e podem exigir manutenção se o Mercado Livre alterar o HTML. O extrator limita a leitura aos elementos renderizados no DOM atual.

### 5.3. Modelo de produto

```json
{
  "title": "Título do anúncio",
  "price": "R$ 1.234,56",
  "url": "https://www.mercadolivre.com.br/..."
}
```

## 6. Conversão de afiliado do Mercado Livre

### 6.1. Princípio funcional

O conversor anterior considerava que qualquer `affiliateId` poderia ser inserido na URL como `allocatorId`. Isso não era fundamentado pelo fluxo oficial descrito pelo Mercado Livre.

A versão atual considera a etiqueta (tag) escolhida no portal como metadado de campanha, mas **não a injeta na URL**. O usuário gera o link efetivo pelo Gerador de Links oficial e traz o resultado para o painel.

Fluxo oficial documentado em páginas públicas do Mercado Livre:

1. Entrar na Central/Portal de Afiliados.
2. Abrir o Gerador de Links.
3. Colar a URL da página específica do produto.
4. Escolher uma etiqueta.
5. Gerar e copiar o link resultante.

### 6.2. Preparação

`POST /api/converter/prepare`

```json
{
  "originalUrl": "https://www.mercadolivre.com.br/.../p/MLB...",
  "title": "Produto X",
  "label": "campanha2026"
}
```

A API:

- valida URL HTTPS, domínio Mercado Livre Brasil e caminho de produto;
- valida a etiqueta (até 30 caracteres, letras minúsculas e números);
- grava um registro `PENDING`;
- solicita ao extrator que abra o Gerador oficial em uma nova página do mesmo contexto persistente.

O painel exibe instruções para copiar a URL original, completar o fluxo oficial e colar o link gerado.

### 6.3. Confirmação

`POST /api/converter/confirm`

```json
{
  "pendingId": "uuid",
  "originalUrl": "https://...",
  "affiliateUrl": "https://meli.la/...",
  "label": "campanha2026"
}
```

Validações:

- existe conversão pendente para a URL original;
- etiqueta corresponde à etiqueta informada na preparação;
- link final usa um domínio aceito do Mercado Livre ou `meli.la`;
- URL final é diferente da URL original.

O status passa a `CONFIRMED_BY_USER`. Esse status indica que o usuário informou ter copiado o link do gerador oficial; o sistema não tem acesso a uma API pública que confirme comissão ou atribuição para uma venda.

### 6.4. Limite explícito

Não alegar que o sistema verificou rastreamento, comissão ou atribuição. A validade comercial do link deve ser conferida no próprio painel de afiliados, especialmente depois de alterações no programa.

## 7. WhatsApp

### 7.1. Cliente e persistência

Usa `whatsapp-web.js` com `LocalAuth` em:

```text
data/whatsapp-auth/
```

A sessão é reutilizada enquanto válida. O usuário deve parear a conta pelo QR oficial do WhatsApp Web quando solicitado.

### 7.2. QR Code na interface

O evento `qr` fornece uma string de pareamento. `qrcode` converte essa string em Data URL PNG; a rota `/api/whatsapp/status` a entrega à interface como `qrCode`. A página exibe o Data URL em um elemento `<img>`. `qrcode-terminal` foi removido.

### 7.3. Grupos

`GET /api/whatsapp/groups` retorna chats nos quais `isGroup === true`, como `{ id, name }`. A interface permite selecionar pelo nome e preenche o ID interno automaticamente.

### 7.4. Envio

O serviço exige cliente conectado, destino que pareça ID de conversa, título e link afiliado. Se houver imagem, exige URL HTTPS pública e usa `MessageMedia.fromUrl`; caso contrário envia texto simples.

O endpoint de ofertas confere se a URL afiliada corresponde a uma conversão confirmada para a URL original antes de permitir o envio.

Esta integração depende da compatibilidade da biblioteca com o WhatsApp Web, não é uma integração oficial da WhatsApp Business Platform e pode exigir manutenção em mudanças futuras do WhatsApp.

## 8. Persistência de dados

O projeto usa NeDB (arquivos locais) para simplificar uso desktop sem exigir servidor de banco adicional.

| Arquivo | Responsabilidade |
|---|---|
| `data/settings.db` | Configurações futuras |
| `data/affiliate-links.db` | URL original, etiqueta, status e link afiliado confirmado |
| `data/history.db` | Registro de ofertas enviadas |
| `data/mercado-livre-profile/` | Perfil do Chromium/Playwright |
| `data/whatsapp-auth/` | Sessão local WhatsApp Web |

A pasta `data/` está excluída do controle de versão. Um backup seguro deve ser criptografado e feito somente em ambiente privado.

## 9. Rotas HTTP

| Método | Caminho | Função |
|---|---|---|
| GET | `/api/health` | Saúde do servidor |
| GET | `/api/extractor/status` | Estado e produtos extraídos |
| POST | `/api/extractor/start` | Abre pesquisa e navegador persistente |
| POST | `/api/extractor/capture` | Captura resultados visíveis |
| POST | `/api/extractor/stop` | Fecha o contexto e preserva perfil |
| POST | `/api/converter/prepare` | Registra conversão pendente e abre gerador oficial |
| POST | `/api/converter/confirm` | Salva link de afiliado informado pelo usuário |
| GET | `/api/converter/history` | Histórico de conversões |
| GET | `/api/whatsapp/status` | Estado e QR Data URL |
| POST | `/api/whatsapp/connect` | Inicializa cliente |
| POST | `/api/whatsapp/disconnect` | Desconecta, preservando credenciais locais |
| GET | `/api/whatsapp/groups` | Lista grupos disponíveis |
| POST | `/api/offers/send` | Valida conversão e envia oferta |
| GET | `/api/offers/history` | Histórico de envios |

Todas as rotas são locais; Express escuta em `127.0.0.1` por padrão.

## 10. Estrutura de arquivos

```text
afiliado-hub/
├── public/index.html
├── data/
├── scripts/check.js
├── src/
│   ├── config.js
│   ├── server.js
│   ├── storage/database.js
│   └── modules/
│       ├── extractor/{service.js,routes.js,search.js}
│       ├── converter/{service.js,routes.js,validation.js}
│       ├── whatsapp/{service.js,routes.js}
│       └── offers/routes.js
├── .gitignore
├── package.json
├── README.md
└── BIBLIA_RECONSTRUCAO.md
```

## 11. Reconstruir do zero

1. Instalar Node.js 20+.
2. Criar `package.json` com `express`, `nedb-promises`, `playwright`, `qrcode` e `whatsapp-web.js`.
3. Criar diretório `data/` e inicializar bancos NeDB.
4. Implementar o serviço Playwright com `launchPersistentContext()` usando `data/mercado-livre-profile`.
5. Criar a rota de pesquisa, captura e estado do extrator.
6. Implementar o conversor como fluxo assistido pelo site oficial, sem inventar query params de afiliado.
7. Criar o serviço WhatsApp com `LocalAuth`; converter o evento `qr` com `qrcode.toDataURL()`.
8. Criar a rota de ofertas com verificação de associação da conversão.
9. Criar a interface que consome rotas por `fetch` e exibe os estados e QR.
10. Documentar configuração, sessão, recuperação e limitações.

Comandos para o projeto atual:

```bash
npm install
npm run setup:browser
npm start
npm run check
```

## 12. Testes e critérios de aceite

### Instalação e inicialização

- `npm install` finaliza sem erro.
- `npm run setup:browser` instala Chromium.
- `npm start` inicia em `http://localhost:3000`.
- `GET /api/health` retorna `ok: true`.

### Extrator

- Uma busca válida abre a página no navegador visível.
- O navegador reutiliza o perfil depois que o servidor é reiniciado.
- A captura retorna objetos com `title`, `price` e `url`.
- Não existe tentativa automatizada de CAPTCHA ou evasão de bloqueios.

### Conversor

- URL de busca ou domínio não permitido é rejeitado.
- URL de produto aceita gera pendência e abre o Gerador oficial no contexto logado.
- Etiqueta com maiúsculas, espaços, símbolos ou mais de 30 caracteres é rejeitada.
- Link final igual ao link original é rejeitado.
- Link de outro domínio é rejeitado.
- Uma conversão confirmada fica disponível para o envio.

### WhatsApp e oferta

- QR Code é exibido como imagem na página, sem terminal QR.
- `CONECTADO` habilita o carregamento de grupos.
- Uma oferta com URL original não confirmada é rejeitada.
- Oferta com conversão confirmada pode ser enviada a um destino escolhido.
- A sessão sobrevive ao reinício enquanto válida.

## 13. Manutenção e extensões futuras

- **Novos marketplaces:** criar provedores separados em `modules/converter/providers/`, cada um com sua própria validação e fluxo comprovado. Não compartilhar regras de um marketplace com outro.
- **API oficial:** caso o Mercado Livre publique API compatível para afiliados, substituir a etapa manual por adaptador oficial com autenticação apropriada, sem quebrar contrato da interface.
- **Mais campos de extração:** adicionar seletores de imagem, vendedor e condição, sempre tratar campos como opcionais.
- **Testes automatizados:** incluir testes unitários para validação de URL/etiqueta e mocks dos serviços externos; testes E2E devem usar conta de teste autorizada.
- **Banco:** migrar NeDB para SQLite se houver necessidade de transações, filtros complexos ou maior volume.
- **Interface:** separar `index.html` em módulos frontend conforme o painel crescer.

## 14. Referências de comportamento oficial

- Gerador de Links: https://www.mercadolivre.com.br/l/afiliados-gere-seus-links
- Primeiros passos: https://www.mercadolivre.com.br/l/afiliados-primeiros-passos
- Etiquetas: https://www.mercadolivre.com.br/l/organize-seus-links
- Páginas não permitidas: https://www.mercadolivre.com.br/l/afiliados-paginas-nao-permitidas

Esses materiais são referências de interface e regras do programa; mudanças no portal podem exigir atualizar o procedimento assistido e as validações.
