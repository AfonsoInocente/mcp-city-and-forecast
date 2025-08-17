import { createRoute, type RootRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import {
  MessageCircle,
  Send,
  Plus,
  Loader,
  ArrowLeft,
  User,
  Bot,
} from "lucide-react";
import {
  useCreateConversation,
  useListConversations,
  useGetMessages,
  useSendMessage,
} from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConversationListProps {
  selectedId?: number;
  onSelect: (id: number) => void;
}

function ConversationList({ selectedId, onSelect }: ConversationListProps) {
  const { data: conversations } = useListConversations();
  const createConversation = useCreateConversation();

  const handleNewConversation = () => {
    createConversation.mutate(
      {},
      {
        onSuccess: (data) => {
          onSelect(data.conversation.id);
        },
      }
    );
  };

  return (
    <div className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Chat com IA
          </h2>
        </div>

        <Button
          onClick={handleNewConversation}
          disabled={createConversation.isPending}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white"
          size="sm"
        >
          {createConversation.isPending ? (
            <>
              <Loader className="w-4 h-4 animate-spin mr-2" />
              Criando...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conversa
            </>
          )}
        </Button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations?.conversations &&
        conversations.conversations.length > 0 ? (
          <div className="p-2">
            {conversations.conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={cn(
                  "w-full text-left p-3 rounded-lg mb-2 transition-colors",
                  "hover:bg-slate-700",
                  selectedId === conversation.id
                    ? "bg-slate-700 border border-slate-600"
                    : "bg-slate-800 border border-transparent"
                )}
              >
                <div className="font-medium text-white text-sm mb-1 truncate">
                  {conversation.title}
                </div>
                {conversation.lastMessage && (
                  <div className="text-xs text-slate-400 truncate">
                    {conversation.lastMessage}
                  </div>
                )}
                <div className="text-xs text-slate-500 mt-1">
                  {new Date(conversation.updatedAt).toLocaleDateString("pt-BR")}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-slate-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Nenhuma conversa ainda</p>
            <p className="text-xs mt-1">Crie uma nova conversa para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatInterfaceProps {
  conversationId: number;
  onBack: () => void;
}

function ChatInterface({ conversationId, onBack }: ChatInterfaceProps) {
  const { data: messages } = useGetMessages(conversationId);
  const sendMessage = useSendMessage();
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sendMessage.isPending) return;

    const messageToSend = inputMessage;
    setInputMessage("");

    sendMessage.mutate({
      conversationId,
      message: messageToSend,
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden p-2 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h3 className="font-semibold text-white">Conversa</h3>
            <p className="text-sm text-slate-400">
              {messages?.messages?.length || 0} mensagens
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages?.messages && messages.messages.length > 0 ? (
          messages.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={cn(
                  "max-w-[70%] p-3 rounded-lg",
                  message.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-700 text-slate-100"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <div
                  className={cn(
                    "text-xs mt-2 opacity-70",
                    message.role === "user" ? "text-blue-100" : "text-slate-400"
                  )}
                >
                  {new Date(message.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Olá! 👋</p>
              <p className="text-sm">Como posso ajudá-lo hoje?</p>
            </div>
          </div>
        )}

        {sendMessage.isPending && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-700 text-slate-100 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">Digitando...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            disabled={sendMessage.isPending}
            className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
          />
          <Button
            type="submit"
            disabled={!inputMessage.trim() || sendMessage.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function HomePage() {
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const showConversationList = !isMobileView || !selectedConversationId;
  const showChatInterface = !isMobileView || selectedConversationId;

  return (
    <div className="bg-slate-900 min-h-screen flex">
      {/* Conversation List */}
      {showConversationList && (
        <ConversationList
          selectedId={selectedConversationId || undefined}
          onSelect={setSelectedConversationId}
        />
      )}

      {/* Chat Interface */}
      {showChatInterface && selectedConversationId ? (
        <div className="flex-1 flex flex-col">
          <ChatInterface
            conversationId={selectedConversationId}
            onBack={() => setSelectedConversationId(null)}
          />
        </div>
      ) : (
        !isMobileView && (
          <div className="flex-1 flex items-center justify-center bg-slate-900">
            <div className="text-center text-slate-400">
              <MessageCircle className="w-20 h-20 mx-auto mb-6 opacity-50" />
              <h2 className="text-2xl font-semibold mb-2">Chat com IA</h2>
              <p className="text-lg mb-4">
                Selecione uma conversa ou crie uma nova
              </p>
              <p className="text-sm">
                Converse com a inteligência artificial e tire suas dúvidas
              </p>
            </div>
          </div>
        )
      )}
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/",
    component: HomePage,
    getParentRoute: () => parentRoute,
  });
