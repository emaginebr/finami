<!--
Sync Impact Report
==================
Version change: 1.1.0 → 2.0.0
Bump rationale: MAJOR — o Princípio VI foi redefinido de forma incompatível (Basic
Authentication → JWT Bearer, nova chave de armazenamento). Também há um princípio novo (IX),
que sozinho seria MINOR.

Princípios modificados:
  - VI. Autenticação e Segurança — esquema Basic → JWT Bearer (`Authorization: Bearer`),
    handler customizado → JwtBearer do ASP.NET Core, login Google por ID token, chave de
    localStorage "login-with-metamask:auth" → "finami:auth", regras do segredo JWT e
    expiração de sessão no frontend.

Seções adicionadas:
  - IX. Acessibilidade (WCAG 2.1 AA)
  - Variáveis de ambiente: `Jwt__Secret`, `Google__ClientId` (backend) e
    `VITE_GOOGLE_CLIENT_ID` (frontend).
  - Item de acessibilidade no "Checklist de Contribuição".

Seções removidas: nenhuma

Templates e artefatos:
  - ✅ .specify/templates/plan-template.md — "Constitution Check" é preenchido
       dinamicamente; nenhuma alteração necessária.
  - ✅ .specify/templates/spec-template.md — sem conflito.
  - ✅ .specify/templates/tasks-template.md — sem conflito (nota do Princípio VIII mantida).
  - ✅ .specify/templates/checklist-template.md — sem conflito.
  - ⚠ .specify/templates/commands/*.md — diretório inexistente; nada a verificar.
  - ✅ specs/001-finami-backend-core/plan.md — a violação "JWT em vez de Basic Auth" do
       Complexity Tracking deixa de existir (registrado como resolvido).
  - ⚠ specs/002-finami-frontend-mobile/plan.md — plano ainda em elaboração; deve aplicar
       os Princípios VI (finami:auth), VIII e IX ao ser concluído.

Follow-up TODOs: nenhum pendente.
-->

# Finami Constitution

Padrões obrigatórios de stack tecnológica, convenções de código e arquitetura que devem ser
seguidos por todos os contribuidores do projeto Finami.

## Core Principles

### I. Skills de Arquitetura Obrigatórias

Para implementação de novas entidades e funcionalidades, as seguintes skills **DEVEM** ser
utilizadas:

| Skill | Quando usar | Invocação |
|---|---|---|
| **dotnet-architecture** | Criar/modificar entidades, services, repositories, DTOs, migrations, DI no backend | `/dotnet-architecture` |
| **react-architecture** | Criar Types, Service, Context, Hook e registrar Provider no frontend | `/react-architecture` |

Estas skills cobrem em detalhe:

- Estrutura de projetos e fluxo de dependência (Clean Architecture backend).
- Regras de repositórios genéricos, mapeamento manual, DI centralizado.
- Configuração de DbContext, Fluent API e migrações via `dotnet ef`.
- Padrões de arquivos frontend (Types, Services, Contexts, Hooks).
- Provider chain e registro de novos providers.
- Tratamento de erros no frontend (`handleError`, `clearError`, loading state).
- Nomeação de DTOs (`Info`, `InsertInfo`, `Result`) e chaves em português
  (`sucesso`, `mensagem`, `erros`).

Esses padrões **NÃO DEVEM** ser reimplementados manualmente — siga as skills.

**Racional**: garante uniformidade estrutural entre entidades e evita divergência de padrões.

### II. Stack Tecnológica Fixa

**Backend**

| Tecnologia | Versão | Finalidade |
|---|---|---|
| .NET | 8.0 | Runtime e framework principal |
| Entity Framework Core | 9.x | ORM e migrações |
| PostgreSQL | Latest | Banco de dados relacional |
| Swashbuckle | 8.x | Swagger / OpenAPI |

**Frontend**

| Tecnologia | Versão | Finalidade |
|---|---|---|
| React | 18.x | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| React Router | 6.x | Roteamento SPA |
| Vite | 6.x | Build toolchain |
| Tailwind CSS | 4.x | Estilização utility-first (layout, grid e componentes) |
| i18next | 25.x | Internacionalização |
| Axios | 1.x | HTTP client (legado) |
| Fetch API | Nativo | HTTP client (novos serviços) |

**Regras de Stack**

- Vite é o bundler obrigatório — **NÃO** usar CRA, Webpack manual ou outros bundlers.
- Tailwind CSS é o framework de estilização obrigatório — **NÃO** usar Bootstrap,
  React-Bootstrap, Material UI ou outros frameworks CSS de componentes.
- EF Core é o único ORM permitido — **NÃO** introduzir ORMs alternativos (Dapper, etc.).
- Context API é o padrão de estado — **NÃO** adicionar Redux, Zustand, MobX ou similares.
- **NÃO** executar comandos `docker` ou `docker compose` no ambiente local — Docker não está
  acessível.
- Novos serviços HTTP no frontend **DEVEM** usar Fetch API; Axios é restrito a código legado.

**Racional**: uma stack fechada reduz custo de manutenção e mantém as skills aplicáveis.

### III. Case Sensitivity de Diretórios (Inviolável)

| Diretório | Casing | Motivo |
|---|---|---|
| `Contexts/` | Uppercase C | Compatibilidade Docker/Linux |
| `Services/` | Uppercase S | Compatibilidade Docker/Linux |
| `hooks/` | Lowercase h | Convenção React |
| `types/` | Lowercase t | Convenção TypeScript |

Todos os imports **DEVEM** corresponder exatamente ao casing no disco.

**Racional**: builds em Linux/containers falham com imports de casing divergente, mesmo que
funcionem no Windows.

### IV. Convenções de Código

**Backend (.NET)**

| Elemento | Convenção | Exemplo |
|---|---|---|
| Namespaces | PascalCase, file-scoped | `namespace Finami.Domain.Services;` |
| Classes / Interfaces | PascalCase | `CampaignService`, `ICampaignRepository` |
| Métodos | PascalCase | `GetById()`, `MapToDto()` |
| Propriedades | PascalCase | `CampaignId`, `CreatedAt` |
| Campos privados | _camelCase | `_repository`, `_context` |
| Constantes | UPPER_CASE | `BUCKET_NAME` |

**Frontend (TypeScript/React)**

| Elemento | Convenção | Exemplo |
|---|---|---|
| Componentes | PascalCase | `LoginPage`, `CampaignCard` |
| Interfaces | PascalCase | `CampaignContextType` |
| Variáveis / Funções | camelCase | `getHeaders`, `loadCampaigns` |
| Constantes | UPPER_CASE | `AUTH_STORAGE_KEY` |
| Tipos | `interface` (não `type`) | `interface CampaignInfo {}` |
| Funções | Arrow functions | `const fn = () => {}` |
| Variáveis | `const` por padrão | `const campaigns = []` |

**JSON Property Names**

- Backend: `[JsonPropertyName("camelCase")]` **DEVE** estar em todas as propriedades de DTOs.
- Frontend: acesso direto via camelCase nos tipos TypeScript.

### V. Convenções de Banco de Dados (PostgreSQL)

| Elemento | Convenção | Exemplo |
|---|---|---|
| Tabelas | snake_case plural | `campaigns`, `campaign_entries` |
| Colunas | snake_case | `campaign_id`, `created_at` |
| Primary Keys | `{entidade}_id`, bigint identity | `campaign_id bigint PK` |
| Constraint PK | `{tabela}_pkey` | `campaigns_pkey` |
| Foreign Keys | `fk_{pai}_{filho}` | `fk_campaign_entry` |
| Delete behavior | `ClientSetNull` | Nunca Cascade |
| Timestamps | `timestamp without time zone` | Sem timezone |
| Strings | `varchar` com MaxLength | `varchar(260)` |
| Booleans | `boolean` com default | `DEFAULT true` |
| Status/Enums | `integer` | `DEFAULT 1` |

Configuração de DbContext, Fluent API e comandos de migração são detalhados na skill
`dotnet-architecture`.

**Racional**: `ClientSetNull` evita exclusões em cascata acidentais; snake_case é idiomático
no PostgreSQL.

### VI. Autenticação e Segurança

| Aspecto | Padrão |
|---|---|
| Esquema | JWT Bearer (HMAC-SHA256) |
| Header | `Authorization: Bearer {token}` |
| Emissão | `POST /api/auth/login` (email e senha) e `POST /api/auth/google` (ID token do Google validado no backend) |
| Handler | `JwtBearer` do ASP.NET Core, configurado no DI (`Finami.Application`) |
| Storage (frontend) | localStorage key `"finami:auth"` (token, expiração e dados do usuário) |
| Proteção de rotas | Atributo `[Authorize]` nos controllers; rotas internas do frontend protegidas |

- Tokens **NUNCA** são armazenados em cookies — usar localStorage com a chave `finami:auth`.
- O segredo de assinatura (`Jwt__Secret`) **DEVE** ter pelo menos 32 bytes e vir de variável de
  ambiente; a API **NÃO DEVE** iniciar sem ele.
- Senhas **DEVEM** ser guardadas apenas como hash (`PasswordHasher`); hashes **NUNCA** saem em DTOs.
- O frontend **DEVE** descartar o token expirado ou rejeitado (401) e voltar para a tela de
  entrada.
- Connection strings e secrets **NUNCA** são expostos no frontend.
- Controllers com dados sensíveis **DEVEM** ter `[Authorize]`; apenas cadastro e login são
  anônimos.
- CORS `AllowAnyOrigin` é permitido **apenas** em Development.

**Racional**: JWT dispensa sessão no servidor, permite o login Google sem guardar senha e
expira sozinho; a chave própria evita colisão com dados de outros apps no mesmo domínio.

### VII. Tratamento de Erros no Backend

Controllers **DEVEM** capturar exceções e retornar status 500 com a mensagem:

```csharp
try { /* lógica */ }
catch (Exception ex) { return StatusCode(500, ex.Message); }
```

Tratamento de erros no frontend (`handleError`, `clearError`, loading state) é coberto pela
skill `react-architecture`.

### VIII. Agentes Especializados Obrigatórios

O desenvolvimento **DEVE** ser executado pelos agentes especializados da área correspondente
(definidos em `.claude/agents/`):

| Agente | Papel | Responsável por |
|---|---|---|
| **frontend-react-developer** | Desenvolvedor frontend | Todo código React/TypeScript em `frontend/`: tipos, services, contexts, hooks, páginas, componentes, i18n, testes de frontend |
| **dotnet-senior-developer** | Desenvolvedor backend | Todo código .NET em `backend/`: entidades, services, repositórios, migrations, controllers, DI, testes de backend |
| **ux-designer** | Designer de layout | Direção visual, design tokens (cores, tipografia, espaçamento), mockups, especificação de componentes, logotipos e ícones |

- Cada tarefa de implementação **DEVE** ser atribuída a exatamente um desses agentes, conforme
  a área do código ou artefato que ela produz.
- Funcionalidades com interface nova **DEVEM** passar primeiro pelo `ux-designer` (tokens,
  layout e especificação de componentes) antes da implementação pelo
  `frontend-react-developer`.
- O `ux-designer` **NÃO** escreve código `.tsx`; o `frontend-react-developer` **NÃO** altera
  código .NET; o `dotnet-senior-developer` **NÃO** altera código de frontend.
- Mudanças que atravessam frontend e backend (ex.: novo endpoint consumido por uma tela)
  **DEVEM** ser divididas em tarefas separadas, uma por agente, com o contrato da API
  definido antes.
- Os agentes **DEVEM** seguir as skills do Princípio I; a escolha do agente não dispensa as
  skills de arquitetura.

**Racional**: cada agente carrega as convenções e skills da sua área; separar
responsabilidades evita que padrões de uma camada vazem para outra e mantém o design
consistente entre telas.

### IX. Acessibilidade (WCAG 2.1 AA)

Toda interface **DEVE** atender ao nível AA das WCAG 2.1. Em especial:

- **Contraste**: texto normal com no mínimo 4,5:1 e texto grande/ícones com no mínimo 3:1 sobre o
  fundo; os design tokens **DEVEM** ser validados contra essas razões.
- **Alvos de toque**: no mínimo 44×44 px para todo elemento clicável.
- **Rótulos**: todo campo de formulário **DEVE** ter `<label>` associado; botões só com ícone
  **DEVEM** ter `aria-label`; imagens informativas **DEVEM** ter `alt`.
- **Teclado**: toda ação **DEVE** ser executável pelo teclado, com foco sempre visível e ordem
  de foco lógica; modais e folhas **DEVEM** prender o foco e fechar com `Esc`.
- **Semântica**: usar elementos nativos (`button`, `a`, `nav`, `main`, `h1`…`h3`) antes de
  ARIA; o documento **DEVE** declarar `lang="pt-BR"`.
- **Cor**: informação **NÃO DEVE** depender só da cor (ex.: valores negativos levam sinal "−",
  além da cor).
- **Movimento**: animações **DEVEM** respeitar `prefers-reduced-motion`.
- **Feedback**: mensagens de sucesso e erro **DEVEM** ser anunciadas a leitores de tela
  (`aria-live`) e erros de campo **DEVEM** ficar ligados ao campo (`aria-describedby`).
- **Zoom**: o layout **DEVE** continuar usável com texto ampliado a 200% e **NÃO DEVE**
  bloquear o zoom do navegador.

**Racional**: o Finami é usado por famílias inteiras, incluindo crianças, idosos e pessoas com
deficiência; acessibilidade tratada desde o design custa menos que corrigir depois.

## Variáveis de Ambiente

**Backend**

| Variável | Obrigatória | Descrição |
|---|---|---|
| `ConnectionStrings__FinamiContext` | Sim | Connection string PostgreSQL |
| `ASPNETCORE_ENVIRONMENT` | Sim | Development, Docker, Production |
| `Jwt__Secret` | Sim | Chave HMAC do JWT, com pelo menos 32 bytes |
| `Google__ClientId` | Para login Google | OAuth Client ID usado para validar o ID token |

**Frontend**

| Variável | Obrigatória | Descrição |
|---|---|---|
| `VITE_API_URL` | Sim | URL base da API backend |
| `VITE_SITE_BASENAME` | Não | Base path do React Router |
| `VITE_GOOGLE_CLIENT_ID` | Para login Google | OAuth Client ID público (mesmo do backend) |

Variáveis de frontend **DEVEM** usar o prefixo `VITE_` e ser acessadas via
`import.meta.env.VITE_*`. **NÃO** usar `REACT_APP_`.

## Fluxo de Desenvolvimento e Checklist de Contribuição

Antes de submeter qualquer código, verifique:

- [ ] Utilizou a skill `dotnet-architecture` para novas entidades backend.
- [ ] Utilizou a skill `react-architecture` para novas entidades frontend.
- [ ] Tabelas e colunas seguem snake_case no PostgreSQL.
- [ ] Imports respeitam o casing exato dos diretórios.
- [ ] Variáveis de ambiente frontend usam prefixo `VITE_`.
- [ ] Controllers com dados sensíveis possuem `[Authorize]`.
- [ ] Cada tarefa foi executada pelo agente da sua área (`frontend-react-developer`,
      `dotnet-senior-developer` ou `ux-designer`), conforme o Princípio VIII.
- [ ] Telas novas atendem ao Princípio IX (contraste, rótulos, teclado, alvos de 44 px).
- [ ] Token salvo apenas em localStorage, na chave `finami:auth`.

## Governance

- Esta constituição prevalece sobre quaisquer outras práticas do projeto. Em conflito com uma
  skill, prevalece a constituição e a skill deve ser corrigida.
- Emendas exigem: alteração documentada neste arquivo, atualização do Sync Impact Report e
  propagação para os templates em `.specify/templates/`.
- Versionamento semântico:
  - **MAJOR**: remoção ou redefinição incompatível de princípios.
  - **MINOR**: novo princípio/seção ou expansão material de regras.
  - **PATCH**: esclarecimentos, redação e correções sem efeito semântico.
- Todo plano (`/speckit.plan`) **DEVE** passar pelo "Constitution Check"; violações exigem
  justificativa explícita na seção "Complexity Tracking".
- Revisões de código **DEVEM** verificar o checklist de contribuição acima.

**Version**: 2.0.0 | **Ratified**: 2026-04-02 | **Last Amended**: 2026-11-01
