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
  ACTIONS,
  TOOL_IDS,
  CitySearchRequestSchema,
  CitySearchResponseSchema,
  ZipCodeRequestSchema,
  ZipCodeResponseSchema,
  WeatherForecastRequestSchema,
  WeatherForecastResponseSchema,
  IntelligentWorkflowRequestSchema,
  IntelligentWorkflowResponseSchema,
} from "../common/index.ts";
import {
  searchCities,
  getWeatherForecast,
  getZipCodeInfo,
  searchCityAndForecast,
  postcodeAndForecast,
} from "./provider/index.ts";
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "./main.ts";
import { conversationsTable, messagesTable, todosTable } from "./schema.ts";
import { getDb } from "./db.ts";
import { eq, desc } from "drizzle-orm";

// ===== USER TOOL (REQUIRED FOR DECO DEPLOY) =====

export const createGetUserTool = (env: Env) =>
  createTool({
    id: "GET_USER",
    description: "Get the current user (public access - no login required)",
    inputSchema: z.object({}),
    outputSchema: z.object({
      id: z.string(),
      name: z.string().nullable(),
      avatar: z.string().nullable(),
      email: z.string(),
    }),
    execute: async () => {
      // Retorna um usuário público/guest já que não queremos login
      return {
        id: "guest-user",
        name: "Usuário Público",
        avatar: null,
        email: "guest@mcp-previsao.app",
      };
    },
  });

const TODO_GENERATION_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "The title of the todo",
    },
  },
  required: ["title"],
};

/**
 * This tool is declared as public and can be executed by anyone
 * that has access to your MCP server.
 */
export const createListTodosTool = (env: Env) =>
  createTool({
    id: "LIST_TODOS",
    description: "List all todos",
    inputSchema: z.object({}),
    outputSchema: z.object({
      todos: z.array(
        z.object({
          id: z.number(),
          title: z.string().nullable(),
          completed: z.boolean(),
        })
      ),
    }),
    execute: async () => {
      const db = await getDb(env);
      const todos = await db.select().from(todosTable);
      return {
        todos: todos.map((todo) => ({
          ...todo,
          completed: todo.completed === 1,
        })),
      };
    },
  });

export const createGenerateTodoWithAITool = (env: Env) =>
  createTool({
    id: "GENERATE_TODO_WITH_AI",
    description: "Generate a todo with AI",
    inputSchema: z.object({}),
    outputSchema: z.object({
      todo: z.object({
        id: z.number(),
        title: z.string().nullable(),
        completed: z.boolean(),
      }),
    }),
    execute: async () => {
      const db = await getDb(env);

      try {
        console.log("🤖 Testando IA para gerar TODO...");

        const generatedTodo =
          await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
            model: "openai:gpt-4o-mini",
            messages: [
              {
                role: "user",
                content:
                  "Generate a funny TODO title that i can add to my TODO list! Keep it short and sweet, a maximum of 10 words.",
              },
            ],
            temperature: 0.9,
            schema: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "The title of the todo",
                },
              },
              required: ["title"],
            },
          });

        console.log("✅ IA funcionou! Resposta:", generatedTodo.object);

        const generatedTodoTitle = String(generatedTodo.object?.title);

        if (!generatedTodoTitle) {
          throw new Error("Failed to generate todo");
        }

        const todo = await db
          .insert(todosTable)
          .values({
            title: generatedTodoTitle,
            completed: 0,
          })
          .returning({ id: todosTable.id });

        return {
          todo: {
            id: todo[0].id,
            title: generatedTodoTitle,
            completed: false,
          },
        };
      } catch (error) {
        console.log("❌ Erro na IA:", error);

        // Fallback para mock se a IA falhar
        const mockTodoTitles = [
          "Organizar a mesa de trabalho",
          "Aprender algo novo hoje",
          "Fazer uma pausa para o café",
          "Revisar emails importantes",
          "Planejar o fim de semana",
        ];

        const randomTitle =
          mockTodoTitles[Math.floor(Math.random() * mockTodoTitles.length)];

        const todo = await db
          .insert(todosTable)
          .values({
            title: randomTitle,
            completed: 0,
          })
          .returning({ id: todosTable.id });

        return {
          todo: {
            id: todo[0].id,
            title: randomTitle,
            completed: false,
          },
        };
      }
    },
  });

export const createToggleTodoTool = (env: Env) =>
  createTool({
    id: "TOGGLE_TODO",
    description: "Toggle a todo's completion status",
    inputSchema: z.object({
      id: z.number(),
    }),
    outputSchema: z.object({
      todo: z.object({
        id: z.number(),
        title: z.string().nullable(),
        completed: z.boolean(),
      }),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // First get the current todo
      const currentTodo = await db
        .select()
        .from(todosTable)
        .where(eq(todosTable.id, context.id))
        .limit(1);

      if (currentTodo.length === 0) {
        throw new Error("Todo not found");
      }

      // Toggle the completed status
      const newCompletedStatus = currentTodo[0].completed === 1 ? 0 : 1;

      const updatedTodo = await db
        .update(todosTable)
        .set({ completed: newCompletedStatus })
        .where(eq(todosTable.id, context.id))
        .returning();

      return {
        todo: {
          id: updatedTodo[0].id,
          title: updatedTodo[0].title,
          completed: updatedTodo[0].completed === 1,
        },
      };
    },
  });

export const createDeleteTodoTool = (env: Env) =>
  createTool({
    id: "DELETE_TODO",
    description: "Delete a todo",
    inputSchema: z.object({
      id: z.number(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedId: z.number(),
    }),
    execute: async ({ context }) => {
      const db = await getDb(env);

      // First check if the todo exists
      const existingTodo = await db
        .select()
        .from(todosTable)
        .where(eq(todosTable.id, context.id))
        .limit(1);

      if (existingTodo.length === 0) {
        throw new Error("Todo not found");
      }

      // Delete the todo
      await db.delete(todosTable).where(eq(todosTable.id, context.id));

      return {
        success: true,
        deletedId: context.id,
      };
    },
  });

// ===== CITY SEARCH & ZIPCODE TOOLS =====

export const createCitySearchTool = (env: Env) =>
  createTool({
    id: TOOL_IDS.CITY_SEARCH,
    description:
      "Busca localidades (cidades) através do nome usando a API CPTEC da Brasil API",
    inputSchema: CitySearchRequestSchema,
    outputSchema: CitySearchResponseSchema,
    execute: async ({ context }) => {
      const { cityName } = context;

      try {
        const cities = await searchCities(cityName, env);

        return {
          locations: cities.map((localidade) => ({
            id: localidade.id,
            name: localidade.nome,
            state: localidade.estado,
          })),
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Erro na busca de cidades: ${error.message}`);
        }

        throw new Error("Erro interno do servidor");
      }
    },
  });

export const createWeatherForecastTool = (env: Env) =>
  createTool({
    id: TOOL_IDS.WEATHER_FORECAST,
    description:
      "Consulta previsão do tempo para uma cidade usando a API CPTEC da Brasil API",
    inputSchema: WeatherForecastRequestSchema,
    outputSchema: WeatherForecastResponseSchema,
    execute: async ({ context }) => {
      const { cityCode } = context;

      try {
        const data = await getWeatherForecast(cityCode, env);

        return {
          city: data.cidade,
          state: data.estado,
          updatedAt: data.atualizado_em || "Não informado",
          weather: data.clima.map((item) => ({
            date: item.data || "Não informado",
            condition: item.condition || "Não informado",
            conditionDescription: item.condicao_desc || "Não informado",
            minimum: item.min || 0,
            maximum: item.max || 0,
            uvIndex: item.indice_uv || 0,
          })),
        };
      } catch (error) {
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
    id: TOOL_IDS.ZIP_CODE_LOOKUP,
    description:
      "Consulta informações de endereço através do CEP usando a Brasil API",
    inputSchema: ZipCodeRequestSchema,
    outputSchema: ZipCodeResponseSchema,
    execute: async ({ context }) => {
      const { zipcode } = context;

      try {
        const data = await getZipCodeInfo(zipcode, env);

        return {
          zipcode: data.cep,
          state: data.state,
          city: data.city,
          neighborhood: data.neighborhood || "Não Informado",
          street: data.street || "Não Informado",
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Erro na consulta do CEP: ${error.message}`);
        }

        throw new Error("Erro interno do servidor");
      }
    },
  });

// ===== SISTEMA INTELIGENTE TOOL =====

export const createSistemaInteligenteTool = (env: Env) =>
  createTool({
    id: "SISTEMA_INTELIGENTE",
    description:
      "Sistema inteligente para consulta de CEP e previsão do tempo com contexto melhorado",
    inputSchema: IntelligentWorkflowRequestSchema,
    outputSchema: IntelligentWorkflowResponseSchema,
    execute: async ({ context }) => {
      const { userInput } = context;

      console.log("🧠 Sistema Inteligente - Input:", userInput);

      // Análise da entrada do usuário
      const inputMessage = userInput.toLowerCase();
      let initialMessage = "";
      let finalMessage = "";
      let executedAction = "";
      let action = "";
      let zipCodeData: any = undefined;
      let weatherData: any = undefined;
      let citiesFound:
        | { id: number; name: string; state: string }[]
        | undefined = undefined;

      // Primeiro, tenta usar IA para interpretar a intenção do usuário
      let aiInterpretation = null;
      try {
        if (env.DECO_CHAT_WORKSPACE_API?.AI_GENERATE_OBJECT) {
          console.log("🤖 Usando IA para interpretar entrada do usuário...");

          const aiPromise = env.DECO_CHAT_WORKSPACE_API.AI_GENERATE_OBJECT({
            model: "openai:gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Você é um assistente especializado em interpretar consultas sobre CEP e previsão do tempo em português brasileiro.

Analise a entrada do usuário e identifique:
1. Se é uma consulta de CEP (ex: "CEP 12345678", "endereço do cep 12345-678")
2. Se é uma consulta de previsão do tempo (ex: "tempo em São Paulo", "previsão", "clima em Ibitinga")
3. Se é uma consulta combinada (ex: "CEP 12345678 e previsão")
4. Se menciona uma cidade específica (extraia o nome completo)
5. Se é uma consulta contextual (ex: "previsão", "tempo", "clima" sem especificar onde)

Considere variações como:
- "previsão tabatinga" → cidade: "Tabatinga"
- "clima ibitinga" → cidade: "Ibitinga"
- "tempo são paulo sp" → cidade: "São Paulo", estado: "SP"
- "temperatura rio de janeiro" → cidade: "Rio de Janeiro"
- "sao paulo" = "São Paulo"
- "sp" pode ser "São Paulo" dependendo do contexto
- "capital paulista" = "São Paulo"
- "cidade maravilhosa" = "Rio de Janeiro"
- "previsão" sem cidade = consulta contextual`,
              },
              {
                role: "user",
                content: userInput,
              },
            ],
            schema: {
              type: "object",
              properties: {
                tipo: {
                  type: "string",
                  enum: ["CEP", "CLIMA", "CEP_E_CLIMA", "CONTEXTUAL", "OUTROS"],
                  description: "Tipo da consulta identificada",
                },
                cidade: {
                  type: "string",
                  description: "Nome da cidade extraído e normalizado",
                },
                estado: {
                  type: "string",
                  description: "Estado extraído se mencionado",
                },
                contextual: {
                  type: "boolean",
                  description:
                    "Se é uma consulta que precisa de contexto anterior",
                },
              },
              required: ["tipo", "contextual"],
            },
            temperature: 0.1,
          });

          // Timeout de 15 segundos (aumentado de 10 para 15)
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("AI timeout")), 15000);
          });

          console.log("🤖 Aguardando resposta da IA...");
          aiInterpretation = (await Promise.race([
            aiPromise,
            timeoutPromise,
          ])) as any;
          console.log("🤖 IA Interpretação:", aiInterpretation?.object);
        } else {
          console.log(
            "⚠️ Integração de IA não disponível, usando análise tradicional"
          );
        }
      } catch (error) {
        console.log(
          "⚠️ Erro na interpretação por IA, usando análise tradicional:",
          error instanceof Error ? error.message : "Erro desconhecido"
        );

        // Log adicional para debug
        if (error instanceof Error) {
          console.log("🔍 Detalhes do erro:", {
            name: error.name,
            message: error.message,
            stack: error.stack?.split("\n")[0], // Primeira linha do stack
          });
        }
      }

      // Análise tradicional como fallback
      const extractedZipCode = extractZipCode(userInput);
      const hasWeatherRequest = hasWeatherKeyword(userInput);
      const isContextualQuery = isContextualWeatherQuery(userInput);

      console.log("🔍 Análise tradicional:", {
        extractedZipCode,
        hasWeatherRequest,
        isContextualQuery,
        userInput,
        inputMessage,
      });

      // Usa interpretação da IA se disponível, senão usa análise tradicional
      const interpretation = aiInterpretation?.object || {
        tipo: extractedZipCode
          ? hasWeatherRequest
            ? "CEP_E_CLIMA"
            : "CEP"
          : hasWeatherRequest
            ? "CLIMA"
            : "OUTROS",
        cep: extractedZipCode,
        cidade: null,
        estado: null,
        contextual: isContextualQuery,
      };

      console.log("🎯 Interpretação final:", interpretation);

      try {
        // Cenário 1: CEP + Weather na mesma mensagem
        if (
          interpretation.tipo === "CEP_E_CLIMA" ||
          (extractedZipCode && hasWeatherRequest)
        ) {
          try {
            const cepToUse = interpretation.cep || extractedZipCode;
            const result = await postcodeAndForecast(cepToUse, env);

            if (result.zipcode) {
              zipCodeData = {
                zipcode: result.zipcode.cep,
                state: result.zipcode.state,
                city: result.zipcode.city,
                neighborhood: result.zipcode.neighborhood || "Não informado",
                street: result.zipcode.street || "Não informado",
              };

              if (result.weather) {
                weatherData = {
                  city: result.weather.cidade,
                  state: result.weather.estado,
                  updatedAt: result.weather.atualizado_em || "Não informado",
                  weather: result.weather.clima.map((day) => ({
                    date: day.data || "Não informado",
                    condition: day.condition || "Não informado",
                    conditionDescription: day.condicao_desc || "Não informado",
                    minimum: day.min || 0,
                    maximum: day.max || 0,
                    uvIndex: day.indice_uv || 0,
                  })),
                };

                action = ACTIONS.CONSULT_ZIP_CODE_AND_WEATHER;
                executedAction = "Consulta de CEP e previsão do tempo";
                initialMessage =
                  "✅ Consultei tanto o CEP quanto a previsão do tempo!";
                finalMessage = "Dados obtidos com sucesso da Brasil API.";
              }
            }
          } catch (error) {
            action = ACTIONS.OUT_OF_SCOPE;
            executedAction = "Erro na consulta";
            initialMessage = `❌ Erro ao consultar CEP e previsão: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
            finalMessage = "Tente novamente ou consulte um CEP válido.";
          }
        }
        // Cenário 2: Apenas CEP
        else if (interpretation.tipo === "CEP" || extractedZipCode) {
          const cepToUse = interpretation.cep || extractedZipCode;
          try {
            const data = await getZipCodeInfo(cepToUse, env);
            zipCodeData = {
              zipcode: data.cep,
              state: data.state,
              city: data.city,
              neighborhood: data.neighborhood || "Não informado",
              street: data.street || "Não informado",
            };

            action = ACTIONS.CONSULT_ZIP_CODE;
            executedAction = "Consulta de CEP";
            initialMessage = "✅ Encontrei as informações do CEP!";
            finalMessage = "Dados obtidos da Brasil API.";
          } catch (error) {
            action = ACTIONS.OUT_OF_SCOPE;
            executedAction = "Erro na consulta de CEP";
            initialMessage = `❌ Erro ao consultar o CEP: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
            finalMessage = "Verifique se o CEP está correto e tente novamente.";
          }
        }
        // Cenário 3: Apenas previsão do tempo (incluindo consultas contextuais enriquecidas)
        else if (interpretation.tipo === "CLIMA" || hasWeatherRequest) {
          // Usa cidade da IA se disponível, senão usa extração tradicional
          let cityName = interpretation.cidade;
          let stateName = interpretation.estado;

          if (!cityName) {
            const cityAndState = extractCityAndState(userInput);
            if (cityAndState) {
              cityName = cityAndState.city;
              stateName = cityAndState.state;
            } else {
              cityName = extractBestCityName(userInput);
            }
          }

          console.log("🔍 Processando consulta de clima:", {
            aiCity: interpretation.cidade,
            aiState: interpretation.estado,
            extractedCity: cityName,
            extractedState: stateName,
            originalInput: userInput,
          });

          if (cityName) {
            try {
              const result = await searchCityAndForecast(
                cityName,
                stateName,
                env
              );

              if (result.cities.length > 0) {
                // Múltiplas cidades encontradas
                if (result.multipleCities) {
                  citiesFound = result.cities.map((city) => ({
                    id: city.id,
                    name: city.nome,
                    state: city.estado,
                  }));

                  action = ACTIONS.MULTIPLE_CITIES;
                  executedAction = "Múltiplas cidades encontradas";
                  initialMessage = `🏙️ Encontrei várias cidades chamadas "${cityName}". Qual você deseja?`;
                  finalMessage =
                    "Por favor, seja mais específico ou mencione o estado.";
                } else if (result.weather) {
                  // Cidade única com previsão
                  weatherData = {
                    city: result.weather.cidade,
                    state: result.weather.estado,
                    updatedAt: result.weather.atualizado_em || "Não informado",
                    weather: result.weather.clima.map((day) => ({
                      date: day.data || "Não informado",
                      condition: day.condition || "Não informado",
                      conditionDescription:
                        day.condicao_desc || "Não informado",
                      minimum: day.min || 0,
                      maximum: day.max || 0,
                      uvIndex: day.indice_uv || 0,
                    })),
                  };

                  action = ACTIONS.CONSULT_WEATHER_DIRECT;
                  executedAction = "Consulta de previsão do tempo";
                  initialMessage = "🌤️ Encontrei a previsão do tempo!";
                  finalMessage = "Dados obtidos da API CPTEC/Brasil API.";
                } else {
                  // Cidade encontrada mas sem previsão
                  action = ACTIONS.CITY_NOT_FOUND;
                  executedAction = "Cidade não encontrada";
                  initialMessage = `❌ Não encontrei a cidade "${cityName}" na base de dados do CPTEC.`;
                  finalMessage =
                    "🔍 Tente com: nome completo da cidade, incluir o estado (ex: 'São Paulo/SP') ou verificar a grafia.";
                }
              } else {
                action = ACTIONS.CITY_NOT_FOUND;
                executedAction = "Cidade não encontrada";
                initialMessage = `❌ Não encontrei a cidade "${cityName}" na base de dados do CPTEC.`;
                finalMessage =
                  "🔍 Tente com: nome completo da cidade, incluir o estado (ex: 'São Paulo/SP') ou verificar a grafia.";
              }
            } catch (error) {
              action = ACTIONS.OUT_OF_SCOPE;
              executedAction = "Erro na consulta de clima";
              initialMessage = `❌ Erro ao consultar previsão do tempo: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
              finalMessage = "Tente novamente ou verifique o nome da cidade.";
            }
          } else {
            action = ACTIONS.REQUEST_LOCATION;
            executedAction = "Solicitação de localização";
            initialMessage =
              "🌤️ Para consultar a previsão do tempo, preciso saber a cidade.";
            finalMessage =
              "Por favor, informe o nome da cidade (ex: 'São Paulo', 'Rio de Janeiro').";
          }
        }
        // Cenário 4: Consulta contextual pura (sem cidade específica)
        else if (
          interpretation.tipo === "CONTEXTUAL" ||
          interpretation.contextual ||
          isContextualQuery ||
          (hasWeatherRequest &&
            !extractCityAndState(userInput) &&
            !extractBestCityName(userInput))
        ) {
          // Se a entrada foi enriquecida pelo frontend (contém cidade), processa como clima
          const cityAndState = extractCityAndState(userInput);
          let cityName = null;

          if (cityAndState) {
            cityName = cityAndState.city;
          } else {
            cityName = extractBestCityName(userInput);
          }

          if (cityName) {
            // Entrada foi enriquecida, processa como consulta de clima
            try {
              const result = await searchCityAndForecast(
                cityName,
                undefined,
                env
              );

              if (result.cities.length > 0 && result.weather) {
                weatherData = {
                  city: result.weather.cidade,
                  state: result.weather.estado,
                  updatedAt: result.weather.atualizado_em || "Não informado",
                  weather: result.weather.clima.map((day) => ({
                    date: day.data || "Não informado",
                    condition: day.condition || "Não informado",
                    conditionDescription: day.condicao_desc || "Não informado",
                    minimum: day.min || 0,
                    maximum: day.max || 0,
                    uvIndex: day.indice_uv || 0,
                  })),
                };

                action = ACTIONS.CONSULT_WEATHER_DIRECT;
                executedAction = "Consulta de previsão com contexto";
                initialMessage =
                  "🌤️ Usando o contexto anterior, encontrei a previsão do tempo!";
                finalMessage = "Dados obtidos da API CPTEC/Brasil API.";
              }
            } catch (error) {
              action = ACTIONS.OUT_OF_SCOPE;
              executedAction = "Erro na consulta contextual";
              initialMessage = `❌ Erro ao processar consulta contextual: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
              finalMessage = "Tente ser mais específico sobre a cidade.";
            }
          } else {
            // Entrada não foi enriquecida, mas é uma consulta de clima
            // Vamos tentar usar o contexto da conversa anterior
            action = ACTIONS.CONTEXT_QUERY;
            executedAction = "Consulta contextual detectada";
            initialMessage =
              "🔍 Detectei que você quer saber sobre previsão do tempo, mas não especificou a cidade.";
            finalMessage =
              "💡 Dica: Você pode perguntar 'previsão' após consultar um CEP, ou especificar a cidade diretamente (ex: 'tempo em São Paulo').";
          }
        }
        // Cenário 5: Fora do escopo
        else {
          action = ACTIONS.OUT_OF_SCOPE;
          executedAction = "Consulta fora do escopo";
          initialMessage =
            "🤔 Não consegui identificar uma consulta de CEP ou previsão do tempo.";
          finalMessage =
            "Tente algo como: 'CEP 01310100', 'Tempo em São Paulo' ou 'Previsão em Tabatinga'.";
        }
      } catch (error) {
        action = ACTIONS.OUT_OF_SCOPE;
        executedAction = "Erro interno";
        initialMessage = "❌ Ocorreu um erro interno.";
        finalMessage = "Tente novamente em alguns instantes.";
      }

      return {
        initialMessage,
        executedAction,
        finalMessage,
        action,
        zipCodeData,
        weatherData,
        citiesFound,
      };
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
        const hasWeatherRequest = hasWeatherKeyword(context.message);

        // Scenario 1: CEP + Weather in same message
        if (extractedZipCode && hasWeatherRequest) {
          try {
            const result = await postcodeAndForecast(extractedZipCode, env);

            if (result.zipcode && result.weather) {
              aiContent = `📍 **Informações do CEP ${result.zipcode.cep}:**

🏘️ **Endereço:**
- **Logradouro:** ${result.zipcode.street || "Não informado"}
- **Bairro:** ${result.zipcode.neighborhood || "Não informado"}
- **Cidade:** ${result.zipcode.city}
- **Estado:** ${result.zipcode.state}

🌤️ **Previsão do Tempo para ${result.weather.cidade}, ${result.weather.estado}**

📅 **Última atualização:** ${result.weather.atualizado_em || "Não informado"}

📊 **Previsão dos próximos dias:**

${result.weather.clima
  .map(
    (day, index) =>
      `**${index === 0 ? "Hoje" : `Dia ${day.data || "N/A"}`}:**
🌡️ Min: ${day.min || 0}°C | Max: ${day.max || 0}°C
🌤️ ${day.condicao_desc || day.condition || "Não informado"}
☀️ Índice UV: ${day.indice_uv || 0}`
  )
  .join("\n\n")}

✅ Dados obtidos da API CPTEC/Brasil API`;
              toolUsed = true;
            }
          } catch (error) {
            aiContent = `❌ Erro ao consultar CEP e previsão: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
            toolUsed = true;
          }
        }
        // Scenario 2: Only CEP
        else if (
          extractedZipCode ||
          inputMessage.includes("cep") ||
          inputMessage.includes("código postal") ||
          inputMessage.includes("endereço")
        ) {
          if (extractedZipCode) {
            try {
              const data = await getZipCodeInfo(extractedZipCode, env);
              aiContent = `📍 **Informações do CEP ${data.cep}:**

🏘️ **Endereço:**
- **Logradouro:** ${data.street || "Não informado"}
- **Bairro:** ${data.neighborhood || "Não informado"}
- **Cidade:** ${data.city}
- **Estado:** ${data.state}

✅ Dados obtidos da Brasil API`;
              toolUsed = true;
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
        // Scenario 3: Only Weather
        else if (hasWeatherRequest) {
          // Enhanced city extraction with multiple patterns
          let cityName: string | undefined = undefined;
          let stateName: string | undefined = undefined;
          let useContext = false;

          // Extract city and state using utilities
          const cityAndState = extractCityAndState(context.message);
          if (cityAndState) {
            cityName = cityAndState.city;
            stateName = cityAndState.state;
          } else {
            // Extract city name using utility
            const extractedCity = extractBestCityName(context.message);
            cityName = extractedCity || undefined;
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
              const result = await searchCityAndForecast(
                cityName,
                stateName,
                env
              );

              if (result.cities.length > 0) {
                // Check if multiple cities found
                if (result.multipleCities) {
                  const cityList = result.cities
                    .map(
                      (city, index) =>
                        `${index + 1}. **${city.nome}** - ${city.estado}`
                    )
                    .join("\n");

                  aiContent = `🏙️ **Encontrei várias cidades chamadas "${cityName}":**

${cityList}

Por favor, seja mais específico ou mencione o estado. Por exemplo: "${cityName}, SP" ou "tempo em ${cityName} São Paulo".`;
                  toolUsed = true;
                } else if (result.weather) {
                  // Single city found with weather
                  const contextNote = useContext
                    ? `\n\n💡 *Usando contexto da consulta anterior (${lastCityContext?.city}, ${lastCityContext?.state})*`
                    : "";

                  aiContent = `🌤️ **Previsão do Tempo para ${result.weather.cidade}, ${result.weather.estado}**${contextNote}

📅 **Última atualização:** ${result.weather.atualizado_em || "Não informado"}

📊 **Previsão dos próximos dias:**

${result.weather.clima
  .map(
    (day, index) =>
      `**${index === 0 ? "Hoje" : `Dia ${day.data || "N/A"}`}:**
🌡️ Min: ${day.min || 0}°C | Max: ${day.max || 0}°C
🌤️ ${day.condicao_desc || day.condition || "Não informado"}
☀️ Índice UV: ${day.indice_uv || 0}`
  )
  .join("\n\n")}

✅ Dados obtidos da API CPTEC/Brasil API`;
                  toolUsed = true;
                } else {
                  aiContent = `❌ Não foi possível encontrar dados de previsão do tempo para "${cityName}". Tente com o nome completo da cidade.`;
                  toolUsed = true;
                }
              } else {
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
              const cities = await searchCities(cityName, env);
              if (cities.length > 0) {
                aiContent = `🏙️ **Cidades encontradas para "${cityName}":**

${cities
  .map((city) => `📍 **${city.nome}** - ${city.estado} (ID: ${city.id})`)
  .join("\n")}

💡 Você pode usar qualquer uma dessas cidades para consultar a previsão do tempo!`;
                toolUsed = true;
              } else {
                aiContent = `❌ Nenhuma cidade encontrada com o nome "${cityName}".`;
                toolUsed = true;
              }
            } catch (error) {
              aiContent = `❌ Erro ao buscar cidades: ${error instanceof Error ? error.message : "Erro desconhecido"}`;
              toolUsed = true;
            }
          }
        }

        // If no specific tool was used, generate a general AI response
        if (!toolUsed) {
          try {
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
          } catch (error) {
            console.log("⚠️ Erro na IA GENERATE:", error);
            aiContent =
              "Olá! Como posso ajudá-lo com informações sobre CEPs, cidades ou previsão do tempo?";
          }
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
  // User Tool (required for Deco deploy)
  createGetUserTool,
  createListTodosTool,
  createGenerateTodoWithAITool,
  createToggleTodoTool,
  createDeleteTodoTool,
  // City Search & ZipCode Tools
  createCitySearchTool,
  createWeatherForecastTool,
  createZipCodeLookupTool,
  // Sistema Inteligente
  createSistemaInteligenteTool,
  // Chat Tools
  createCreateConversationTool,
  createListConversationsTool,
  createSendMessageTool,
  createGetMessagesTool,
];
