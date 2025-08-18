# 🌤️ MCP CEP e Previsão do Tempo

> **Assistente Inteligente para Consultas de CEP e Previsão Meteorológica**

Um sistema MCP (Model Context Protocol) completo que combina consultas de CEP e Previsão do Tempo através de uma interface de chat conversacional inteligente. O sistema utiliza a [Deco](https://deco.chat/) com suas Tools, Workflows e AI_GENERATE_OBJECT + Fallback para entender a intenção do usuário e fornecer informações precisas sobre endereços e condições meteorológicas.

## ✨ Funcionalidades

### 📍 **Consulta de CEPs**

- Busca completa de endereços por CEP
- Informações detalhadas: rua, bairro, cidade, estado
- Validação automática de CEPs
- Interface estruturada para visualização dos dados

### 🌤️ **Previsão do Tempo**

- Previsão meteorológica para qualquer cidade brasileira
- Dados de temperatura (mínima e máxima)
- Condições climáticas detalhadas
- Índice UV
- Interface visual com cards organizados

### 🤖 **Sistema Inteligente**

- Análise de intenções usando IA (GPT-4o-mini)
- Entendimento de linguagem natural
- Resolução automática de ambiguidades (múltiplas cidades)
- Interface de seleção com scroll para opções

### 🦾 **Sistema de fallback robusto**

- Análise manual com regex e padrões
- Detecção automática de CEPs e cidades
- Validação via APIs externas
- Tratamento gracioso de erros de rede

### 💬 **Chat Conversacional**

- Interface moderna e responsiva
- Histórico de conversas
- Feedback visual em tempo real
- Tratamento de erros amigável

## 🛠️ Tecnologias

### **APIs e Serviços**

- **Brasil API** - Consulta de CEPs
- **CPTEC/INPE** - Previsão meteorológica
- **OpenAI GPT-4o-mini** - Análise de intenções

### **Stack Técnica**

- **🤖 MCP Server**: Servidor baseado em Cloudflare Workers com tools e workflows tipados
- **⚛️ React Frontend**: App React moderno com Vite, TanStack Router e Tailwind CSS
- **🎨 UI Components**: Componentes shadcn/ui pré-configurados para desenvolvimento rápido
- **🔧 Type Safety**: Suporte completo ao TypeScript com tipos de cliente RPC auto-gerados
- **🚀 Hot Reload**: Desenvolvimento ao vivo com rebuild automático para frontend e backend
- **☁️ Ready to Deploy**: Deploy com um comando para Cloudflare Workers

## 🚀 Quick Start

### Pré-requisitos

- Node.js ≥18.0.0
- npm ≥8.0.0
- Deno ≥2.0.0
- [Deco CLI](https://deco.chat): `deno install -Ar -g -n deco jsr:@deco/cli`
- Conta no [deco.chat](https://deco.chat)

### Setup

```bash
# Clone o repositório
git clone <repository-url>
cd mcp-previsao

# Instale as dependências
npm install

#Entre na sua conta da DECO:
deco login

# Configure o projeto
npm run configure

#Siga as opções:
- Enter app name: mcp-city-and-forecast
- Select a workspace: [SEU-WORKSPACE]
- Would you like to configure your IDE to use this project? Yes
- Select your preferred IDE: Cursor (recomendo o Cursor)
- Select integrations [Selecione a opção de AI Tool]

# Inicie o servidor de desenvolvimento
npm run dev
```

O servidor iniciará em `http://localhost:8787` servindo tanto os endpoints MCP quanto o frontend React.

## 🎯 Como Usar

### **Exemplos de Consultas**

O sistema entende consultas em linguagem natural:

#### **CEP**

```
"CEP 01310-100"
"Quero saber o endereço do CEP 20040-007"
"14910001"
```

#### **Previsão do Tempo**

```
"Previsão do tempo em São Paulo"
"Como está o clima em Rio de Janeiro?"
"Tempo em Belo Horizonte"
"previsao ibitinga"
```

#### **CEP + Previsão**

```
"CEP 01310-100 com previsão do tempo"
"Quero o endereço e clima do CEP 20040-007"
"14940454 previsao"
"clima 14910004"
```

### **Interface de Seleção**

Quando há múltiplas cidades com o mesmo nome, o sistema apresenta uma lista scrollável de opções para seleção.

### **Fluxo de Dados**

1. **Entrada do usuário** → Interface de chat
2. **Análise de intenção** → IA (GPT-4o-mini)
3. **Processamento** → Tools MCP específicas
4. **Resposta estruturada** → Interface organizada

## 🛠️ Development Workflow

- **`npm run dev`** - Inicia desenvolvimento com hot reload
- **`npm run gen`** - Gera tipos para integrações externas
- **`npm run gen:self`** - Gera tipos para suas próprias tools/workflows
- **`npm run deploy`** - Deploy para produção

## 🔗 Frontend ↔ Server Communication

O template inclui um cliente RPC totalmente tipado que conecta seu frontend React ao servidor MCP:

```typescript
// Chamadas tipadas para suas tools e workflows do servidor
const result = await client.SISTEMA_INTELIGENTE({ userInput: "CEP 01310-100" });
const citySearch = await client.CITY_SEARCH({ cityName: "São Paulo" });
```

## 🔧 Configuração

### **Variáveis de Ambiente**

- `DECO_CHAT_WORKSPACE_API` - API do workspace Deco
- `DECO_CHAT_API` - API global do Deco
- Configurações de integração no dashboard deco.chat

### **APIs Externas**

- **Brasil API**: Consulta de CEPs (gratuita)
- **CPTEC/INPE**: Previsão meteorológica (gratuita)
- **OpenAI**: Análise de intenções (requer API key)

## 📊 Funcionalidades Técnicas

### **Sistema de Decisão Inteligente**

- Análise automática de intenções
- Extração de CEPs e cidades
- Resolução de ambiguidades
- Tratamento de erros robusto

### **Interface Responsiva**

- Design mobile-first
- Componentes reutilizáveis
- Estados de loading e erro
- Feedback visual em tempo real

### **Performance**

- Cache inteligente com TanStack Query
- Lazy loading de componentes
- Otimização de bundle
- CDN global (Cloudflare)

## 🐛 Tratamento de Erros

O sistema inclui tratamento robusto de erros:

- **CEP inválido**: Validação e sugestões
- **Cidade não encontrada**: Busca por alternativas
- **API indisponível**: Fallbacks e retry
- **Timeout**: Tratamento gracioso
- **Erros de rede**: Mensagens amigáveis

## 📖 Learn More

Este template foi construído para deploy primariamente na plataforma [Deco](https://deco.chat/about) que pode ser encontrada no repositório [deco-cx/chat](https://github.com/deco-cx/chat).

Documentação pode ser encontrada em [https://docs.deco.page](https://docs.deco.page)

## 👨‍💻 Autor

**Afonso Inocente**

- GitHub: [@afonsoinocente](https://github.com/afonsoinocente)
- LinkedIn: [Afonso Inocente](https://linkedin.com/in/afonsoinocente)

**⭐ Se este projeto foi útil, considere dar uma estrela no repositório!**

---

**Pronto para construir seu próximo servidor MCP com um frontend bonito? [Comece agora!](https://deco.chat)**
