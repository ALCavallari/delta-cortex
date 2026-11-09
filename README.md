# DELTA CORTEX — SISTEMA INTEGRADO DE GESTÃO
## DELTA S ENGENHARIA & CONSULTORIA AMBIENTAL

O **Delta CorteX** é o sistema corporativo central da **Delta S Engenharia**, empresa brasileira especializada em engenharia, estudos de viabilidade, licenciamento ambiental, supervisão de obras e monitoramento socioambiental de empreendimentos de geração de energia renovável:
- **Centrais Geradoras Hidrelétricas (CGHs)**, **Pequenas Centrais Hidrelétricas (PCHs)** e **Usinas Hidrelétricas (UHEs)**;
- **Parques Eólicos** e **Complexos Fotovoltaicos (Usinas Solares)**;
- **Biogás** e outras fontes limpas de energia.

---

## 1. OBJETIVO DO SISTEMA

Prover aos engenheiros, biólogos, gestores, técnicos de campo e consultores ambientais uma plataforma ágil, responsiva e de alta precisão para:
- Cadastro e gestão unificada de **Clientes** e empreendedores;
- Planejamento e execução de **Visitas de Acompanhamento Sistemático** de campo;
- Levantamento georreferenciado em tempo real com conversão geodésica para **Coordenadas UTM WGS84**;
- Registro padronizado de **Observações** e **Ocorrências** (classificadas por gravidade e meio ambiental: Fauna, Flora, Físico e Social);
- Captura de **Fotografias de Campo com Estampa Indelével via Canvas** (incorporando a marca Delta S, data, hora, cliente/projeto e coordenadas UTM na própria imagem);
- Visualização cartográfica e de imagens de satélite de alta resolução com plotagem imediata de marcadores persistidos localmente.

---

## 2. TECNOLOGIAS UTILIZADAS

| Camada | Tecnologia / Biblioteca | Finalidade |
|---|---|---|
| **Framework** | Next.js 16 (App Router) | Renderização híbrida, rotas modulares e otimização |
| **Biblioteca de UI** | React 19 & TypeScript | Componentização tipada e interfaces de alta performance |
| **Estilização** | Tailwind CSS v4 | Design system com a paleta oficial da Delta S Engenharia |
| **Ícones** | Lucide React | Iconografia corporativa consistente e elegante |
| **Cartografia & SIG** | Leaflet | Mapas interativos de satélite de alta resolução e camadas vetoriais |
| **Provedores de Satélite** | Esri World Imagery / MapTiler | Camada de imagens orbitais de alta definição |
| **Cálculo Geodésico** | Proj4 | Conversão precisa de Graus Decimais (WGS84) para Projeção UTM (Fuso e Hemisfério automáticos) |
| **Processamento Gráfico** | HTML5 Canvas API | Carimbo indelével e incorporação da legenda oficial sobre as fotos |
| **Geolocalização** | Web Geolocation API (`watchPosition`) | Monitoramento contínuo da posição do técnico em campo e precisão |
| **Persistência Local** | IndexedDB (`idb`) | Armazenamento desacoplado em repositórios (sem limite de 5MB do localStorage) |

---

## 3. PALETA OFICIAL DE CORES (DELTA S)

As cores oficiais extraídas da identidade visual da Delta S Engenharia foram configuradas como variáveis globais:
- **Grafite (`#333436`)**: Cor predominante de menus, cabeçalhos operacionais e títulos.
- **Azul (`#00AFF0`)**: Ações principais, botões de destaque primário, raio GPS e marcadores de Observação.
- **Verde (`#A3CA33`)**: Destaque secundário, confirmações e selos ambientais.
- **Cinza (`#97989A`)**: Bordas e textos auxiliares de apoio.
- **Branco (`#FFFFFF`)**: Fundo dos cartões e superfícies de alto contraste.

---

## 4. ESTRUTURA DO PROJETO

```text
Delta CorteX/
├── public/
│   ├── logo-delta-s.png       # Logomarca oficial fornecida da Delta S
│   └── logo-delta-s.jpg
├── src/
│   ├── app/
│   │   ├── page.tsx           # Tela de login com Supabase Auth
│   │   ├── dashboard/page.tsx # Menu Principal (6 Módulos Corporativos)
│   │   ├── clientes/page.tsx  # Módulo de Gestão de Clientes (Tabela, Filtros, Busca)
│   │   ├── acompanhamento/
│   │   │   ├── page.tsx       # Dashboard de Acompanhamento Sistemático
│   │   │   └── visita/[id]/   # Ferramenta Operacional de Visita com Mapa de Satélite
│   │   ├── modulos/[slug]/    # Módulos em desenvolvimento (Corpo Técnico, Projetos, etc.)
│   │   ├── globals.css        # Tema oficial Delta S, Tailwind CSS e estilos SIG
│   │   └── layout.tsx         # Layout raiz com metadados e viewport mobile
│   ├── components/
│   │   ├── Header.tsx         # Cabeçalho unificado com a marca oficial
│   │   ├── ModuleCard.tsx     # Cartões interativos do Menu Principal
│   │   ├── ClientModal.tsx    # Modal de cadastro/edição de clientes com validações
│   │   ├── ClientDetailsModal.tsx # Modal de visualização completa do cliente
│   │   ├── NewVisitModal.tsx  # Modal de abertura de Nova Visita
│   │   ├── FieldRecordModal.tsx # Formulário de Observação/Ocorrência com foto e UTM
│   │   └── Map/
│   │       ├── LeafletMap.tsx # Mapa Leaflet com satélite Esri e marcadores
│   │       └── MarkerDetailsModal.tsx # Detalhes do ponto e lightbox de fotos
│   ├── hooks/
│   │   └── useGeolocation.ts  # Hook de GPS contínuo e encerramento de watchPosition
│   ├── services/
│   │   ├── storage.ts         # Camada de repositórios IndexedDB desacoplada
│   │   ├── utm.ts             # Conversão geodésica WGS84 -> UTM com Proj4
│   │   ├── photoStamper.ts    # Carimbo indelével Canvas nas fotos de campo
│   │   └── validation.ts      # Validações reais de CPF, CNPJ, e-mail e máscaras
│   └── types/
│       └── index.ts           # Interfaces e tipos de dados TypeScript
├── package.json
├── tsconfig.json
└── README.md
```

---

## 5. COMO EXECUTAR O PROJETO LOCALMENTE

### Pré-requisitos
- **Node.js** v18 ou superior (testado com Node v24).
- **NPM** instalado.

### Passo 1: Instalação das dependências
Caso já não estejam instaladas no diretório:
```bash
npm install
```

### Passo 2: Inicializar o servidor de desenvolvimento
```bash
npm run dev
```

Abra o navegador em: [http://localhost:3000](http://localhost:3000)

---

## 6. CONFIGURAÇÃO DO PROVEDOR DE SATÉLITE

O sistema já vem integrado nativamente com o provedor **Esri World Imagery** de alta resolução, que funciona imediatamente em qualquer domínio ou localhost sem necessidade de chave prévia.

Caso deseje utilizar o provedor **MapTiler Satellite**, basta criar um arquivo `.env.local` na raiz com sua chave pública:
```env
NEXT_PUBLIC_MAPTILER_KEY=sua_chave_maptiler_aqui
```

---

## 7. ESCOPO IMPLEMENTADO VS. DEMONSTRATIVO (ETAPA 1)

### Funções 100% Implementadas e Funcionais
- **Login**: Acesso com e-mail e senha pelo Supabase Auth, com sessão validada no servidor.
- **Menu Principal**: Navegação completa entre os 6 módulos do Delta CorteX com identidade visual coesa.
- **Módulo Clientes**:
  - Cadastro completo de Pessoa Física e Jurídica;
  - Máscaras automáticas (CPF/CNPJ, Telefone, CEP);
  - Validação real de dígitos verificadores de CPF e CNPJ;
  - Validação de e-mail e verificação de duplicidade de documento;
  - Busca textual em tempo real (nome, razão social, CPF/CNPJ, responsável);
  - Filtros por Tipo (PF/PJ) e Estado da Federação (UF);
  - Ordenação alfabética (A-Z, Z-A) e cronológica de cadastro;
  - Edição de clientes cadastrados;
  - Layout adaptado: Tabela no Desktop e Cards otimizados no Mobile.
- **Módulo Acompanhamento Sistemático**:
  - Dashboard operacional com contadores reais (total, em andamento, concluídas);
  - Listagem das visitas salvas no dispositivo com status, data e executor;
  - Modal **Nova Visita**:
    - Seleção de Motivo (*Visita Sistemática* operacional; *Mon. Fauna* e *Mon. Flora* com indicação de etapas futuras);
    - Repositório local de profissionais técnicos com inclusão de novos nomes na interface;
    - Seleção pesquisável de clientes cadastrados;
    - Campo opcional de identificação de projeto;
    - Geração automática de código da visita ou identificação personalizada.
- **Ferramenta de Visita Sistemática (Mapa de Satélite)**:
  - Mapa de tela cheia com alternador entre Satélite de Alta Resolução e Mapa Vetorial;
  - Geolocalização em tempo real com `navigator.geolocation.watchPosition`;
  - Círculo de precisão e marcador pulsante para a posição atual;
  - Botão de recentralização "Minha Localização";
  - Botão flutuante ergonômico no canto inferior direito com ícone de exclamação;
  - Modal de Registro de Campo com fixação imediata das coordenadas capturadas;
  - Distinção clara entre **Observação** (azul) e **Ocorrência** (vermelha/laranja);
  - Campo condicional de **Gravidade** (*Leve*, *Grave*, *Gravíssima*), obrigatório apenas para Ocorrências;
  - **Conversão Automática para Coordenadas UTM WGS84** (Zona, Hemisfério, Easting e Northing calculados via Proj4);
  - **Captura e Processamento de Fotografias com Carimbo Canvas**:
    - Legenda com cabeçalho "DELTA S ENGENHARIA", data, hora, cliente/projeto e coordenadas UTM;
    - Visualizador de miniaturas com lightbox para fotos ampliadas;
    - Suporte a múltiplas fotos no mesmo ponto.
  - Marcadores persistidos no mapa com clique para abertura de painel com histórico e fotos.

### Funções Demonstrativas / Em Desenvolvimento
- **Corpo Técnico, Projetos, Contratos e Financeiro**: Módulos navegáveis que apresentam telas organizadas com indicação de "Módulo em desenvolvimento" e escopo detalhado de implementação para as próximas etapas.
- **Persistência**: Armazenamento estritamente local (IndexedDB no navegador), sem envio para servidores remotos.

---

## 8. ARMAZENAMENTO TEMPORÁRIO (INDEXEDDB)

Os dados são armazenados na base `delta_cortex_local_db` do navegador, organizada em 5 Object Stores:
1. `clientes`: Registros completos com índices por nome e documento.
2. `profissionais`: Técnicos demonstrativos e nomes adicionados em campo.
3. `visitas`: Visitas de acompanhamento com identificador, cliente, projeto, executor e status.
4. `registros_campo`: Observações e ocorrências com coordenadas geográficas e UTM.
5. `fotografias`: Imagens processadas via Canvas com carimbo gráfico incorporado.

> **Aviso de Privacidade**: Os dados permanecem disponíveis após atualizar a página, desde que o navegador preserve seu armazenamento local. Por se tratar de uma versão demonstrativa local, não insira dados sensíveis ou confidenciais de clientes reais.

---

## 9. MODELOS DE DADOS E MIGRAÇÃO FUTURA PARA O SUPABASE

A camada de serviços (`src/services/storage.ts`) foi desenvolvida seguindo o padrão **Repository**, separando a lógica de negócio dos componentes visuais. Quando for implementado o backend com Supabase/PostgreSQL, a migração envolverá apenas a substituição das chamadas do IndexedDB pelo client do `@supabase/supabase-js`, mantendo as telas e regras de negócio 100% intactas.

### Mapeamento sugerido para tabelas PostgreSQL:
- `clientes` -> `tb_clientes (id uuid, tipo_pessoa varchar, nome_razao varchar, cpf_cnpj varchar, ...)`
- `profissionais` -> `tb_profissionais (id uuid, nome varchar, registro_prof varchar, ...)`
- `visitas` -> `tb_visitas (id uuid, cliente_id uuid references tb_clientes, identificacao varchar, ...)`
- `registros_campo` -> `tb_registros_campo (id uuid, visita_id uuid references tb_visitas, tipo varchar, meio varchar, geom geometry(Point, 4326), utm_easting numeric, utm_northing numeric, ...)`
- `fotografias` -> `tb_fotografias (id uuid, registro_campo_id uuid references tb_registros_campo, storage_path text, ...)` (com envio das imagens para o Supabase Storage Bucket).

---

## 10. INSTRUÇÕES PARA TESTES

### Teste no Computador (Desktop)
1. Inicie a aplicação com `npm run dev` e acerte a URL `http://localhost:3000`.
2. Na tela inicial, informe o e-mail e a senha de uma conta provisionada no Supabase e clique em **Entrar**.
3. Acesse **Clientes**, clique em **+ Novo Cliente** e cadastre um cliente PJ (com CNPJ e dados completos).
4. Utilize a barra de pesquisa e filtros por Estado para testar a busca e ordenação.
5. Acesse **Acompanhamento Sistemático**, clique em **+ Nova Visita**, selecione o cliente cadastrado e clique em **Iniciar**.
6. Autorize a permissão de localização do navegador (ou simule coordenadas no DevTools > Sensors).
7. Clique no botão redondo flutuante com ícone de exclamação no canto inferior direito.
8. Crie uma **Observação** (Meio Flora) e anexe uma foto: verifique a estampa Canvas indelével com a legenda oficial Delta S e coordenadas UTM.
9. Crie uma **Ocorrência** (Meio Físico, Gravidade Grave): verifique o marcador vermelho plotado no mapa.
10. Clique nos marcadores para inspecionar os detalhes e ampliar as fotos no lightbox.
11. Recarregue a página (F5) e confirme que todos os dados continuam persistidos.

### Teste no Celular (Dispositivo Móvel)
1. Conecte o celular na mesma rede Wi-Fi do computador.
2. Inicie o Next.js aceitando conexões da rede local: `npx next dev -H 0.0.0.0`.
3. No celular, acerte o IP da máquina (ex: `http://192.168.1.XX:3000`).
4. Autorize a câmera e o GPS no celular para vivenciar a experiência mobile-first de campo.

## Autenticação Supabase

Configure estas variáveis no arquivo local `.env.local` ou `.env` ignorado pelo Git e nos ambientes correspondentes da Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` — URL do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — chave publicável do mesmo projeto.

No Supabase Auth, mantenha o cadastro público desativado e provisione as contas autorizadas. Confira se as URLs de redirecionamento incluem `https://delta-cortex.vercel.app/auth/callback` e o endereço local usado no desenvolvimento, por exemplo `http://127.0.0.1:3000/auth/callback`. Com o modelo padrão de e-mail e PKCE, abra o link no mesmo navegador que solicitou a recuperação. Se houver um modelo personalizado, o callback aceita também o token de recuperação no formato `token_hash` com `type=recovery`. Configure SMTP no Supabase se necessário para o envio aos usuários.

O login protege a entrada da aplicação. Os módulos locais continuam no IndexedDB, por navegador e origem, compartilhados entre contas que usam o mesmo perfil de navegador.

## Clientes no Supabase

Clientes usa exclusivamente `public.clientes` no Supabase em desenvolvimento e produção. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` em `.env.local` e na Vercel. A tela indica a fonte e apresenta erros de configuração, conexão ou permissão. Os clientes anteriores permanecem no IndexedDB.

Projetos, Corpo Técnico e Trabalho de Campo continuam locais. Projetos e visitas mantêm seus vínculos históricos. Novos vínculos exigem um contratante ativo no cadastro local até a migração de Projetos.

O serviço consulta `public.acessos_usuarios` pelo `user_id` da sessão verificada, exige `ativo = true` e interpreta `papel` como `admin`, `editor` ou `leitor`. Admin e editor podem gravar, e leitor pode consultar. A interface reflete o papel, enquanto as políticas RLS existentes autorizam as operações no banco. A exclusão atualiza `excluido_em` e exige a confirmação de uma linha afetada.

| Frontend | `public.clientes` |
| --- | --- |
| `tipoPessoa`, `nomeRazaoSocial`, `cpfCnpj` | `tipo_pessoa`, `nome_razao_social`, `cpf_cnpj` |
| `inscricaoEstadual` | `inscricao_estadual` |
| `criadoEm`, `atualizadoEm`, `deletedAt` | `criado_em`, `atualizado_em`, `excluido_em` |
| `id`, `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `estado`, `telefone`, `email`, `responsavel`, `cargo` | Mesmos nomes |

IDs continuam em texto. Datas mantêm o horário informado pelo banco. Campos opcionais nulos são apresentados vazios no formulário. A listagem percorre páginas por ID, e a restrição documental do banco cobre gravações concorrentes. Esta integração utiliza as tabelas e as políticas já existentes. O SQL original, quando disponível, deve ficar como documentação histórica e não como migration pendente.

Para validar, entre com uma conta autorizada, confirme a indicação Supabase, cadastre um cliente de teste, recarregue, pesquise pelo documento, edite e confirme a exclusão lógica. Teste também um documento duplicado, uma conta leitora e uma conta inativa. Use dados de teste e confirme os papéis e a política de exclusão no banco. Ao migrar Projetos, preserve os IDs de clientes e mapeie os vínculos locais.
