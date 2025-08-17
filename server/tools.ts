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
import { createPrivateTool, createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "./main.ts";
import { conversationsTable, messagesTable } from "./schema.ts";
import { getDb } from "./db.ts";
import { eq, desc } from "drizzle-orm";

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

      // Generate AI response
      const aiResponse = await env.DECO_CHAT_WORKSPACE_API.AI_GENERATE({
        model: "openai:gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente prestativo e amigável. Responda em português de forma clara e útil.",
          },
          ...aiMessages,
        ],
        temperature: 0.7,
        maxTokens: 1000,
      });

      const aiContent =
        aiResponse.text || "Desculpe, não consegui gerar uma resposta.";

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
  createCreateConversationTool,
  createListConversationsTool,
  createSendMessageTool,
  createGetMessagesTool,
];
