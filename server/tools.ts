/**
 * This is where you define your tools.
 *
 * Tools are the functions that will be available on your
 * MCP server. They can be called from any other Deco app
 * or from your front-end code via typed RPC. This is the
 * recommended way to build your Web App.
 *
 * @see https://docs.deco.page/en/guides/creating-tools/
 */

import {
  extractZipCode,
  isContextualWeatherQuery,
  hasWeatherKeyword,
  extractBestCityName,
  extractCityAndState,
  WEATHER_QUERY_PATTERNS,
} from "../common/index.ts";
import { createPrivateTool, createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "./main.ts";
import { conversationsTable, messagesTable } from "./schema.ts";
import { getDb } from "./db.ts";
import { eq, desc } from "drizzle-orm";

// ===== CITY SEARCH & ZIPCODE TOOLS =====

export const createCitySearchTool = (env: Env) =>
  createTool({
    id: "SEARCH_LOCALITY",
    description:
      "Busca localidades (cidades) através do nome usando a API CPTEC da Brasil API",
    inputSchema: z.object({
      cityName: z
        .string()
        .min(2, "Nome da cidade deve ter pelo menos 2 caracteres"),
    }),
    outputSchema: z.object({
      locations: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
          state: z.string(),
        })
      ),
    }),
    execute: async ({ context }) => {
      const { cityName } = context;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

        const baseUrl =
          env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api";
        const citySearchPath = env.BRASIL_API_CITY_SEARCH || "/cptec/v1/cidade";

        const response = await fetch(
          `${baseUrl}${citySearchPath}/${encodeURIComponent(cityName)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
              "User-Agent": "Deco-MCP-Server/1.0",
            },
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `API Error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();

        return {
          locations: data.map((localidade: any) => ({
            id: localidade.id,
            name: localidade.nome,
            state: localidade.estado,
          })),
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Timeout: A consulta demorou mais que 30 segundos");
        }

        if (error instanceof Error) {
          throw new Error(`Erro na busca de cidades: ${error.message}`);
        }

        throw new Error("Erro interno do servidor");
      }
    },
  });

export const createWeatherForecastTool = (env: Env) =>
  createTool({
    id: "WEATHER_FORECAST",
    description:
      "Consulta previsão do tempo para uma cidade usando a API CPTEC da Brasil API",
    inputSchema: z.object({
      cityCode: z
        .number()
        .min(1, "Código da cidade deve ser um número positivo"),
    }),
    outputSchema: z.object({
      city: z.string(),
      state: z.string(),
      updatedAt: z.string(),
      weather: z.array(
        z.object({
          date: z.string(),
          condition: z.string(),
          conditionDescription: z.string(),
          minimum: z.number(),
          maximum: z.number(),
          uvIndex: z.number(),
        })
      ),
    }),
    execute: async ({ context }) => {
      const { cityCode } = context;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

        const baseUrl =
          env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api";
        const weatherPath =
          env.BRASIL_API_WEATHER_FORECAST || "/cptec/v1/clima/previsao";

        const response = await fetch(`${baseUrl}${weatherPath}/${cityCode}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Deco-MCP-Server/1.0",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("Cidade não encontrada para previsão do tempo");
          }
          throw new Error(
            `API Error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();

        if (!data.cidade || !data.estado || !data.clima) {
          throw new Error("Dados incompletos da API de previsão do tempo");
        }

        return {
          city: data.cidade,
          state: data.estado,
          updatedAt: data.atualizado_em || "Não informado",
          weather: data.clima.map((item: any) => ({
            date: item.data || "Não informado",
            condition: item.condition || "Não informado",
            conditionDescription: item.condicao_desc || "Não informado",
            minimum: item.min || 0,
            maximum: item.max || 0,
            uvIndex: item.indice_uv || 0,
          })),
        };
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          throw new Error("Timeout: A consulta demorou mais que 30 segundos");
        }

        if (error instanceof Error) {
          throw new Error(
            `Erro na consulta de previsão do tempo: ${error.message}`
          );
        }

        throw new Error("Erro interno do servidor");
      }
    },
  });

export const createZipCodeLookupTool = (env: Env) =>
  createTool({
    id: "CONSULT_ZIP_CODE",
    description:
      "Consulta informações de endereço através do CEP usando a Brasil API",
    inputSchema: z.object({
      zipcode: z.string().transform((val) => {
        const cleaned = val.replace(/\D/g, "");
        if (cleaned.length !== 8) {
          throw new Error("CEP deve conter exatamente 8 dígitos numéricos");
        }
        return cleaned;
      }),
    }),
    outputSchema: z.object({
      zipcode: z.string(),
      state: z.string(),
      city: z.string(),
      neighborhood: z.string(),
      street: z.string(),
    }),
    execute: async ({ context }) => {
      const { zipcode } = context;

      try {
        const baseUrl =
          env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api";
        const zipcodePath = env.BRASIL_API_ZIPCODE_LOOKUP || "/cep/v1";

        const response = await fetch(`${baseUrl}${zipcodePath}/${zipcode}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "User-Agent": "Deco-MCP-Server/1.0",
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error("CEP não encontrado");
          }
          throw new Error(
            `API Error: ${response.status} ${response.statusText}`
          );
        }

        const data = await response.json();

        // Validar se todos os campos obrigatórios estão presentes
        if (!data.cep || !data.state || !data.city) {
          throw new Error("Dados incompletos da API");
        }

        const result = {
          zipcode: data.cep,
          state: data.state,
          city: data.city,
          neighborhood: data.neighborhood || "Não Informado",
          street: data.street || "Não Informado",
        };

        return result;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Erro na consulta do CEP: ${error.message}`);
        }

        throw new Error("Erro interno do servidor");
      }
    },
  });

// ===== CHAT TOOLS =====

export const createCreateConversationTool = (env: Env) =>
  createTool({
    id: "CREATE_CONVERSATION",
    description: "Create a new chat conversation",
    inputSchema: z.object({
      title: z.string().optional(),
    }),
    outputSchema: z.object({
      conversation: z.object({
        id: z.number(),
        title: z.string(),
        createdAt: z.date(),
      }),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);
      const now = new Date();

      const conversation = await db
        .insert(conversationsTable)
        .values({
          title: context.title || "Nova Conversa",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        conversation: {
          id: conversation[0].id,
          title: conversation[0].title,
          createdAt: conversation[0].createdAt,
        },
      };
    },
  });

export const createListConversationsTool = (env: Env) =>
  createTool({
    id: "LIST_CONVERSATIONS",
    description: "List all conversations",
    inputSchema: z.object({}),
    outputSchema: z.object({
      conversations: z.array(
        z.object({
          id: z.number(),
          title: z.string(),
          createdAt: z.date(),
          updatedAt: z.date(),
          lastMessage: z.string().nullable(),
        })
      ),
    }),
    execute: async () => {
      const db = await getDb(env);

      // Get all conversations
      const conversations = await db
        .select({
          id: conversationsTable.id,
          title: conversationsTable.title,
          createdAt: conversationsTable.createdAt,
          updatedAt: conversationsTable.updatedAt,
        })
        .from(conversationsTable)
        .orderBy(desc(conversationsTable.updatedAt));

      // Get last message for each conversation
      const conversationsWithMessages = await Promise.all(
        conversations.map(async (conversation) => {
          const lastMessage = await db
            .select({ content: messagesTable.content })
            .from(messagesTable)
            .where(eq(messagesTable.conversationId, conversation.id))
            .orderBy(desc(messagesTable.createdAt))
            .limit(1);

          return {
            ...conversation,
            lastMessage: lastMessage[0]?.content || null,
          };
        })
      );

      return { conversations: conversationsWithMessages };
    },
  });

export const createSendMessageTool = (env: Env) =>
  createTool({
    id: "SEND_MESSAGE",
    description: "Send a message to AI and get response",
    inputSchema: z.object({
      conversationId: z.number(),
      message: z.string(),
    }),
    outputSchema: z.object({
      userMessage: z.object({
        id: z.number(),
        content: z.string(),
        role: z.string(),
        createdAt: z.date(),
      }),
      aiResponse: z.object({
        id: z.number(),
        content: z.string(),
        role: z.string(),
        createdAt: z.date(),
      }),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // Verify conversation exists
      const conversation = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, context.conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error("Conversation not found");
      }

      // Save user message
      const userMessage = await db
        .insert(messagesTable)
        .values({
          conversationId: context.conversationId,
          role: "user",
          content: context.message,
          createdAt: new Date(),
        })
        .returning();

      // Get conversation history for context
      const messageHistory = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, context.conversationId))
        .orderBy(messagesTable.createdAt)
        .limit(10); // Last 10 messages for context

      // Prepare messages for AI
      const aiMessages = messageHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      // Analyze the message to determine what tool to use
      const inputMessage = context.message.toLowerCase();
      let aiContent = "";
      let toolUsed = false;

      // Check for recent city context from conversation history
      let lastCityContext = null;
      for (let i = messageHistory.length - 1; i >= 0; i--) {
        const msg = messageHistory[i];
        if (
          msg.role === "assistant" &&
          msg.content.includes("📍 **Informações do CEP")
        ) {
          // Extract city from CEP response
          const cityMatch = msg.content.match(/- \*\*Cidade:\*\* ([^\n]+)/);
          const stateMatch = msg.content.match(/- \*\*Estado:\*\* ([^\n]+)/);
          if (cityMatch && stateMatch) {
            lastCityContext = {
              city: cityMatch[1].trim(),
              state: stateMatch[1].trim(),
            };
            break;
          }
        } else if (
          msg.role === "assistant" &&
          msg.content.includes("🌤️ **Previsão do Tempo para")
        ) {
          // Extract city from weather response
          const cityMatch = msg.content.match(
            /🌤️ \*\*Previsão do Tempo para ([^,]+), ([^*]+)\*\*/
          );
          if (cityMatch) {
            lastCityContext = {
              city: cityMatch[1].trim(),
              state: cityMatch[2].trim(),
            };
            break;
          }
        }
      }

      try {
        // Check for CEP pattern (8 digits)
        const extractedZipCode = extractZipCode(context.message);
        if (
          extractedZipCode ||
          inputMessage.includes("cep") ||
          inputMessage.includes("código postal") ||
          inputMessage.includes("endereço")
        ) {
          if (extractedZipCode) {
            try {
              const response = await fetch(
                `${env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api"}${env.BRASIL_API_ZIPCODE_LOOKUP || "/cep/v1"}/${extractedZipCode}`
              );
              if (response.ok) {
                const data = await response.json();
                aiContent = `📍 **Informações do CEP ${data.cep}:**

🏘️ **Endereço:**
- **Logradouro:** ${data.street || "Não informado"}
- **Bairro:** ${data.neighborhood || "Não informado"}
- **Cidade:** ${data.city}
- **Estado:** ${data.state}

✅ Dados obtidos da Brasil API`;
                toolUsed = true;
              }
            } catch (error) {
              aiContent = `❌ Erro ao consultar o CEP: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
              toolUsed = true;
            }
          } else {
            aiContent =
              "🔍 Para consultar um CEP, por favor informe um CEP válido com 8 dígitos (ex: 01310-100 ou 01310100).";
            toolUsed = true;
          }
        }
        // Check for weather/climate queries
        else if (hasWeatherKeyword(context.message)) {
          // Enhanced city extraction with multiple patterns
          let cityName = null;
          let stateName = null;
          let useContext = false;

          // Extract city and state using utilities
          const cityAndState = extractCityAndState(context.message);
          if (cityAndState) {
            cityName = cityAndState.city;
            stateName = cityAndState.state;
          } else {
            // Extract city name using utility
            cityName = extractBestCityName(context.message);
          }

          // If no city found in message, check context
          if (
            !cityName &&
            lastCityContext &&
            isContextualWeatherQuery(context.message)
          ) {
            // User is asking about weather without specifying city, use context
            cityName = lastCityContext.city;
            useContext = true;
          }

          if (cityName) {
            try {
              // First, search for the city
              const cityResponse = await fetch(
                `${env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api"}${env.BRASIL_API_CITY_SEARCH || "/cptec/v1/cidade"}/${encodeURIComponent(cityName)}`
              );
              if (cityResponse.ok) {
                let cities = await cityResponse.json();

                // If state was specified, filter cities by state
                if (stateName && cities.length > 0) {
                  const filteredCities = cities.filter(
                    (city: any) =>
                      city.estado === stateName ||
                      city.estado === stateName.toLowerCase()
                  );
                  if (filteredCities.length > 0) {
                    cities = filteredCities;
                  }
                }

                if (cities.length > 0) {
                  // Check if multiple cities found
                  if (cities.length > 1 && !stateName) {
                    const cityList = cities
                      .slice(0, 5) // Limit to first 5 cities
                      .map(
                        (city: any, index: number) =>
                          `${index + 1}. **${city.nome}** - ${city.estado}`
                      )
                      .join("\n");

                    aiContent = `🏙️ **Encontrei várias cidades chamadas "${cityName}":**

${cityList}

Por favor, seja mais específico ou mencione o estado. Por exemplo: "${cityName}, SP" ou "tempo em ${cityName} São Paulo".`;
                    toolUsed = true;
                  } else {
                    // Single city found - proceed with weather
                    const city = cities[0];
                    // Get weather forecast
                    const weatherResponse = await fetch(
                      `${env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api"}${env.BRASIL_API_WEATHER_FORECAST || "/cptec/v1/clima/previsao"}/${city.id}`
                    );
                    if (weatherResponse.ok) {
                      const weatherData = await weatherResponse.json();
                      const contextNote = useContext
                        ? `\n\n💡 *Usando contexto da consulta anterior (${lastCityContext?.city}, ${lastCityContext?.state})*`
                        : "";

                      aiContent = `🌤️ **Previsão do Tempo para ${weatherData.cidade}, ${weatherData.estado}**${contextNote}

📅 **Última atualização:** ${weatherData.atualizado_em || "Não informado"}

📊 **Previsão dos próximos dias:**

${weatherData.clima
  .map(
    (day: any, index: number) =>
      `**${index === 0 ? "Hoje" : `Dia ${day.data || "N/A"}`}:**
🌡️ Min: ${day.min || 0}°C | Max: ${day.max || 0}°C
🌤️ ${day.condicao_desc || day.condition || "Não informado"}
☀️ Índice UV: ${day.indice_uv || 0}`
  )
  .join("\n\n")}

✅ Dados obtidos da API CPTEC/Brasil API`;
                      toolUsed = true;
                    }
                  }
                }
              }
              if (!toolUsed) {
                aiContent = `❌ Não foi possível encontrar dados de previsão do tempo para "${cityName}". Tente com o nome completo da cidade.`;
                toolUsed = true;
              }
            } catch (error) {
              aiContent = `❌ Erro ao consultar previsão do tempo: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
              toolUsed = true;
            }
          } else {
            if (lastCityContext) {
              aiContent = `🌤️ Não consegui entender sua pergunta sobre previsão do tempo. 

💡 **Dica:** Com base na consulta anterior (${lastCityContext.city}, ${lastCityContext.state}), você pode perguntar:
- "qual a previsão?"
- "como está o tempo?"
- "qual o clima?"

Ou especifique outra cidade: "tempo em São Paulo"`;
            } else {
              aiContent =
                "🌤️ Para consultar a previsão do tempo, informe o nome da cidade (ex: 'Qual o tempo em São Paulo?' ou 'Previsão para Rio de Janeiro').";
            }
            toolUsed = true;
          }
        }
        // Check for city search queries
        else if (
          inputMessage.includes("busca") ||
          inputMessage.includes("procura") ||
          inputMessage.includes("cidade") ||
          inputMessage.includes("localidade")
        ) {
          const cityMatches = context.message.match(
            /(?:busca|procura|cidade).*?([a-záàãâäéèêëíìîïóòõôöúùûüç\s]+?)(?:\?|$|\.)/i
          );
          if (cityMatches) {
            const cityName = cityMatches[1].trim();
            try {
              const response = await fetch(
                `${env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api"}${env.BRASIL_API_CITY_SEARCH || "/cptec/v1/cidade"}/${encodeURIComponent(cityName)}`
              );
              if (response.ok) {
                const cities = await response.json();
                if (cities.length > 0) {
                  aiContent = `🏙️ **Cidades encontradas para "${cityName}":**

${cities
  .map((city: any) => `📍 **${city.nome}** - ${city.estado} (ID: ${city.id})`)
  .join("\n")}

💡 Você pode usar qualquer uma dessas cidades para consultar a previsão do tempo!`;
                  toolUsed = true;
                } else {
                  aiContent = `❌ Nenhuma cidade encontrada com o nome "${cityName}".`;
                  toolUsed = true;
                }
              }
            } catch (error) {
              aiContent = `❌ Erro ao buscar cidades: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
              toolUsed = true;
            }
          }
        }

        // If no specific tool was used, generate a general AI response
        if (!toolUsed) {
          const aiResponse = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE({
            model: "openai:gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Você é um assistente prestativo especializado em informações sobre CEPs, localidades e previsão do tempo do Brasil. 

Você pode ajudar com:
🔍 **Consultas de CEP** - Digite um CEP (ex: 01310-100)
🏙️ **Busca de cidades** - Use "busca cidade São Paulo" ou "procura cidade Rio"  
🌤️ **Previsão do tempo** - Use "tempo em São Paulo" ou "clima para Rio de Janeiro"

Responda de forma amigável e suggira como o usuário pode usar essas funcionalidades.`,
              },
              ...aiMessages,
            ],
            temperature: 0.7,
            maxTokens: 500,
          });

          aiContent =
            aiResponse.text ||
            "Olá! Como posso ajudá-lo com informações sobre CEPs, cidades ou previsão do tempo?";
        }
      } catch (error) {
        aiContent = "❌ Ocorreu um erro interno. Tente novamente.";
      }

      // Save AI response
      const aiMessageRecord = await db
        .insert(messagesTable)
        .values({
          conversationId: context.conversationId,
          role: "assistant",
          content: aiContent,
          createdAt: new Date(),
        })
        .returning();

      // Update conversation timestamp
      await db
        .update(conversationsTable)
        .set({ updatedAt: new Date() })
        .where(eq(conversationsTable.id, context.conversationId));

      return {
        userMessage: {
          id: userMessage[0].id,
          content: userMessage[0].content,
          role: userMessage[0].role,
          createdAt: userMessage[0].createdAt,
        },
        aiResponse: {
          id: aiMessageRecord[0].id,
          content: aiMessageRecord[0].content,
          role: aiMessageRecord[0].role,
          createdAt: aiMessageRecord[0].createdAt,
        },
      };
    },
  });

export const createGetMessagesTool = (env: Env) =>
  createTool({
    id: "GET_MESSAGES",
    description: "Get messages from a conversation",
    inputSchema: z.object({
      conversationId: z.number(),
    }),
    outputSchema: z.object({
      messages: z.array(
        z.object({
          id: z.number(),
          content: z.string(),
          role: z.string(),
          createdAt: z.date(),
        })
      ),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // Verify conversation exists
      const conversation = await db
        .select()
        .from(conversationsTable)
        .where(eq(conversationsTable.id, context.conversationId))
        .limit(1);

      if (conversation.length === 0) {
        throw new Error("Conversation not found");
      }

      // Get messages
      const messages = await db
        .select()
        .from(messagesTable)
        .where(eq(messagesTable.conversationId, context.conversationId))
        .orderBy(messagesTable.createdAt);

      return { messages };
    },
  });

export const tools = [
  // City Search & ZipCode Tools
  createCitySearchTool,
  createWeatherForecastTool,
  createZipCodeLookupTool,
  // Chat Tools
  createCreateConversationTool,
  createListConversationsTool,
  createSendMessageTool,
  createGetMessagesTool,
];
