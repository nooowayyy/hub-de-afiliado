# Afiliado Hub — Mercado Livre + WhatsApp

Aplicação local que reúne os dois projetos enviados em um único painel. Ela pesquisa produtos no Mercado Livre, mantém a sessão de navegação neste computador, conduz a geração do link de afiliado pelo portal oficial e prepara uma oferta para envio ao WhatsApp.

> **Importante sobre os links de afiliado:** o código original do conversor montava uma URL acrescentando `?allocatorId=...`. Não havia evidência de que esse parâmetro gerasse atribuição de comissão. O fluxo atual não inventa parâmetros: a conversão é concluída pelo **Gerador de Links oficial do Mercado Livre**, com a etiqueta da conta, e o link resultante é confirmado no painel.

## O que foi integrado

- **Extrator:** pesquisa por termo no Mercado Livre, abre o navegador persistente, lê título/preço/link dos cards e exibe os resultados no painel.
- **Conversor:** abre o Gerador de Links oficial na mesma sessão do navegador. O usuário cola o produto, escolhe sua etiqueta, gera o link e o confirma no painel.
- **WhatsApp:** conecta via QR Code exibido como imagem na interface; a sessão é persistida; os grupos podem ser carregados no painel.
- **Ofertas:** permite preencher título, preço, cupom e link confirmado, e enviar para um grupo selecionado.
- **Persistência:** banco local e perfis de sessão ficam em `data/`.

O projeto foi unificado em Node.js. O extrator original em Python/Playwright foi migrado para Playwright no Node para que a sessão de navegação e o conversor compartilhem o mesmo contexto de navegador.

## Requisitos

- Windows 10/11, macOS ou Linux.
- Node.js **20 ou superior** (inclui npm).
- Conexão com a internet.
- Conta do Mercado Livre com acesso ao Programa de Afiliados e Criadores para gerar links comissionados.
- WhatsApp no celular para parear a sessão, caso queira usar o envio.

## Instalação

1. Extraia o ZIP para uma pasta que você tenha permissão para gravar.
2. Abra um terminal nessa pasta (`afiliado-hub`).
3. Instale as dependências:

   ```bash
   npm install
   ```

4. Instale o Chromium usado pelo Playwright:

   ```bash
   npm run setup:browser
   ```

5. Inicie o painel:

   ```bash
   npm start
   ```

6. Abra no navegador: **http://localhost:3000**.

Para desenvolvimento, `npm run dev` reinicia o servidor quando arquivos de código mudam.

## Como usar

### 1. Pesquisar e extrair produtos

1. No bloco **Pesquisa de produtos**, digite o termo e escolha a quantidade (de 1 a 50).
2. Clique em **Abrir pesquisa no navegador**.
3. Uma janela do Chromium será aberta em uma pesquisa do Mercado Livre.
4. Na primeira execução, faça login manualmente, se necessário. Se o site solicitar uma verificação de segurança, resolva-a diretamente na página oficial. O painel não tenta resolver CAPTCHA nem esconder automação.
5. Quando os resultados estiverem visíveis, volte ao painel e clique em **Capturar produtos**.
6. Os produtos encontrados aparecem em cartões com título, preço e link. Use **Copiar link** ou **Preparar afiliado**.

A sessão do navegador fica em `data/mercado-livre-profile`. Em execuções futuras, o navegador reutiliza o perfil salvo. Não é necessário autenticar novamente enquanto o Mercado Livre mantiver a sessão válida. Se a plataforma solicitar novo login, faça-o manualmente.

### 2. Gerar o link oficial de afiliado

1. Informe a **etiqueta** da sua conta no campo do conversor. O Mercado Livre documenta etiquetas com até 30 caracteres, em letras minúsculas e números, sem espaços ou caracteres especiais.
2. Clique em **Preparar afiliado** no cartão de um produto (ou informe a URL no conversor e clique em **Preparar link oficial**).
3. O Gerador de Links oficial será aberto em outra aba da mesma janela persistente do Mercado Livre.
4. No Gerador, cole a URL original do produto, selecione a etiqueta escolhida e clique para gerar o link.
5. Copie o link que o Mercado Livre apresentar e cole em **Link gerado pelo Mercado Livre** no painel.
6. Clique em **Confirmar link gerado**. A conversão é salva e o cartão passa a mostrar que há um link oficial confirmado.

**A etiqueta não é um `allocatorId` a ser acrescentado manualmente à URL.** Ela é selecionada dentro do fluxo oficial. O painel salva o link que você recebeu do Mercado Livre e associa a URL original à etiqueta informada.

Links de busca, páginas gerais e páginas sem produto específico não são aceitos pelo conversor. Use o endereço de uma página individual de produto.

### 3. Conectar o WhatsApp

1. Clique em **Conectar WhatsApp**.
2. Se for necessário parear, o QR Code será mostrado como imagem no cartão de conexão.
3. No celular, abra WhatsApp → **Aparelhos conectados** → **Conectar um aparelho** e leia o QR.
4. Quando o painel mostrar **CONECTADO**, clique em **Carregar grupos** e escolha o grupo desejado.

A sessão é armazenada em `data/whatsapp-auth`. O QR só aparece quando o WhatsApp exigir um novo pareamento.

### 4. Enviar uma oferta

1. No cartão do produto, clique em **Usar na oferta** após confirmar o link oficial.
2. Confira o grupo, título, URL original e URL de afiliado.
3. Preencha preço, parcelamento, cupom e imagem, se desejar.
4. Clique em **Enviar oferta para o grupo selecionado**.

O envio exige que o link de afiliado esteja confirmado e associado à URL original no banco local. Isso evita publicar um link não validado pelo fluxo do painel. Use apenas em grupos e contextos nos quais você tenha autorização para compartilhar mensagens; evite mensagens repetitivas ou não solicitadas.

## Arquivos e pastas

```text
afiliado-hub/
├── public/
│   └── index.html                 # Interface web
├── src/
│   ├── modules/
│   │   ├── extractor/             # Pesquisa e extração Mercado Livre
│   │   ├── converter/             # Fluxo de link oficial de afiliado
│   │   ├── whatsapp/              # Pareamento, grupos e envio
│   │   └── offers/                # Regras de publicação e histórico
│   ├── storage/                  # Inicialização do banco local
│   ├── config.js
│   └── server.js                 # Composição dos módulos/rotas
├── data/                         # Dados e sessões persistentes (não compartilhar)
├── package.json
├── README.md
└── BIBLIA_RECONSTRUCAO.md
```

## Dados locais e privacidade

A pasta `data/` contém:

- `mercado-livre-profile/`: perfil do navegador do Mercado Livre (cookies e sessão).
- `whatsapp-auth/`: credenciais/sessão local do WhatsApp Web.
- `affiliate-links.db`: links originais, etiquetas e links de afiliado confirmados.
- `history.db`: histórico de ofertas enviadas.
- `settings.db`: reservado para configurações futuras.

**Não envie nem publique a pasta `data/`.** Ela pode conter material de autenticação das suas contas. O servidor escuta em `127.0.0.1`, para que o painel não seja exposto diretamente à rede local.

## Comandos úteis

```bash
npm start              # inicia o painel
npm run dev            # modo desenvolvimento com reinício automático
npm run setup:browser  # instala o Chromium do Playwright
npm run check          # executa validações locais básicas
```

Para reiniciar: encerre o processo com `Ctrl+C` e execute `npm start` novamente. Não apague `data/` se quiser preservar as sessões.

A porta padrão é `3000`. Para alterar, defina a variável de ambiente `PORT` antes de iniciar. `DATA_DIR` também pode apontar para outro diretório de dados; por padrão, é `./data`.

## Solução de problemas

| Sintoma | O que fazer |
|---|---|
| `playwright` não encontra o Chromium | Execute `npm run setup:browser` novamente. |
| A pesquisa abriu, mas não há produtos | Aguarde a página carregar, confirme que está na lista de resultados e clique novamente em **Capturar produtos**. Mudanças de layout do Mercado Livre podem exigir atualização dos seletores em `src/modules/extractor/service.js`. |
| Mercado Livre pediu login ou verificação | Complete a etapa manualmente no navegador aberto. Não use automação para contornar a tela de segurança. |
| Gerador de Links não abriu | Abra o endereço oficial `https://www.mercadolivre.com.br/l/afiliados-gerar-link` no navegador do perfil persistente e repita a preparação no painel. |
| Link não é aceito pelo conversor | Confirme se é uma URL de produto individual e se o link colado foi gerado pelo portal oficial. |
| WhatsApp não mostra QR | Consulte o status, aguarde a inicialização e tente conectar novamente. Se persistir, feche o painel e reinicie `npm start`. |
| Sessão do WhatsApp ficou inválida | Desconecte e conecte novamente. Se necessário, feche o servidor e remova somente `data/whatsapp-auth` para forçar novo pareamento. Isso apaga a sessão local do WhatsApp. |
| Porta 3000 ocupada | Encerre o outro processo que usa a porta ou defina `PORT=3001` no ambiente antes de iniciar. |

## Limitações conhecidas

- O extrator lê os cards atualmente renderizados na página. Ele não percorre automaticamente várias páginas nem garante encontrar produtos que a página não carregou.
- O site pode alterar os seletores HTML. Nesse caso, ajuste os seletores centralizados no serviço do extrator.
- A geração final do link de afiliado depende do fluxo oficial e da conta do usuário. O painel não simula uma API privada nem altera parâmetros da URL para fingir rastreamento.
- A conexão do WhatsApp usa WhatsApp Web por biblioteca de terceiros, não a API oficial WhatsApp Business. Mudanças do WhatsApp Web podem afetar a compatibilidade.
- O projeto está focado em Mercado Livre. Os outros marketplaces mencionados no conversor original não foram ativados nesta versão.

## Referências oficiais do Mercado Livre

- [Como gerar links de afiliado](https://www.mercadolivre.com.br/l/afiliados-gere-seus-links)
- [Primeiros passos no Programa de Afiliados](https://www.mercadolivre.com.br/l/afiliados-primeiros-passos)
- [Como criar etiquetas](https://www.mercadolivre.com.br/l/organize-seus-links)
- [Páginas para as quais não é permitido criar links](https://www.mercadolivre.com.br/l/afiliados-paginas-nao-permitidas)

---

**Versão:** 2.0.0  
**Escopo:** pesquisa Mercado Livre → geração oficial do link de afiliado → oferta WhatsApp.
