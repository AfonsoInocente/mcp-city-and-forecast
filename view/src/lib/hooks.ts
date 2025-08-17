import { client } from "./rpc-logged";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { FailedToFetchUserError } from "@/components/logged-provider";
import { toast } from "sonner";

/**
 * This hook will throw an error if the user is not logged in.
 * You can safely use it inside routes that are protected by the `LoggedProvider`.
 */
export const useUser = () => {
  return useSuspenseQuery({
    queryKey: ["user"],
    queryFn: () =>
      client.GET_USER(
        {},
        {
          handleResponse: (res: Response) => {
            if (res.status === 401) {
              throw new FailedToFetchUserError(
                "Failed to fetch user",
                globalThis.location.href
              );
            }

            return res.json();
          },
        }
      ),
    retry: false,
  });
};

/**
 * This hook will return null if the user is not logged in.
 * You can safely use it inside routes that are not protected by the `LoggedProvider`.
 * Good for pages that are public, for example.
 */
export const useOptionalUser = () => {
  return useSuspenseQuery({
    queryKey: ["user"],
    queryFn: () =>
      client.GET_USER(
        {},
        {
          handleResponse: async (res: Response) => {
            if (res.status === 401) {
              return null;
            }
            return res.json();
          },
        }
      ),
    retry: false,
  });
};

// ===== CHAT HOOKS =====

export const useCreateConversation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { title?: string }) =>
      client.CREATE_CONVERSATION(params),
    onSuccess: (data) => {
      // Add new conversation to the list
      queryClient.setQueryData(["conversations"], (old: any) => {
        if (!old?.conversations)
          return {
            conversations: [{ ...data.conversation, lastMessage: null }],
          };
        return {
          ...old,
          conversations: [
            { ...data.conversation, lastMessage: null },
            ...old.conversations,
          ],
        };
      });
      toast.success("Nova conversa criada!");
    },
  });
};

export const useListConversations = () => {
  return useSuspenseQuery({
    queryKey: ["conversations"],
    queryFn: () => client.LIST_CONVERSATIONS({}),
    retry: false,
  });
};

export const useGetMessages = (conversationId: number) => {
  return useSuspenseQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => client.GET_MESSAGES({ conversationId }),
    retry: false,
  });
};

export const useSendMessage = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { conversationId: number; message: string }) =>
      client.SEND_MESSAGE(params),
    onSuccess: (data, variables) => {
      // Add new messages to the conversation
      queryClient.setQueryData(
        ["messages", variables.conversationId],
        (old: any) => {
          if (!old?.messages)
            return { messages: [data.userMessage, data.aiResponse] };
          return {
            ...old,
            messages: [...old.messages, data.userMessage, data.aiResponse],
          };
        }
      );

      // Update conversations list with last message
      queryClient.setQueryData(["conversations"], (old: any) => {
        if (!old?.conversations) return old;
        return {
          ...old,
          conversations: old.conversations.map((conv: any) =>
            conv.id === variables.conversationId
              ? {
                  ...conv,
                  lastMessage: data.aiResponse.content,
                  updatedAt: data.aiResponse.createdAt,
                }
              : conv
          ),
        };
      });
    },
  });
};
