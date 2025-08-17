import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, MapPin, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { useSistemaInteligente } from "../lib/hooks";
import { ACTIONS } from "../../../common/index";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  data?: {
    type: "zipCode" | "weather";
    data: any;
  };
  options?: Array<{
    id: string;
    text: string;
    value: string;
    cityId?: number;
  }>;
}

export function SimpleChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content:
        "Olá. Eu sou um Chat Inteligente onde você pode consultar CEPs e saber mais sobre a Previsão do Tempo das cidades que quiser.",
      role: "assistant",
      timestamp: new Date(),
    },
    {
      id: "2",
      content:
        'Comece dizendo algo como: "Endereço do CEP 14.940-000" ou, "Como está o Tempo em São Paulo/SP?" ou "CEP 14940000 e Previsão".',
      role: "assistant",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sistemaInteligente = useSistemaInteligente();

  // Scroll automático para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Foca no input automaticamente
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Adiciona mensagem à lista
  const addMessage = (
    text: string,
    isUser: boolean,
    data?: any,
    options?: Array<{
      id: string;
      text: string;
      value: string;
      cityId?: number;
    }>
  ) => {
    const newMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: text,
      role: isUser ? "user" : "assistant",
      timestamp: new Date(),
      data,
      options,
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  // Processa resposta do sistema inteligente
  const processAIResponse = (response: any) => {
    // Mensagem inicial
    addMessage(response.initialMessage, false);

    // Se tem dados de CEP, adiciona como mensagem separada
    if (response.zipCodeData) {
      const zipCodeMessage = `📍 **Endereço:**\n• CEP: ${response.zipCodeData.zipcode}\n• Rua: ${response.zipCodeData.street}\n• Bairro: ${response.zipCodeData.neighborhood}\n• Cidade: ${response.zipCodeData.city}\n• Estado: ${response.zipCodeData.state}`;
      addMessage(zipCodeMessage, false, {
        type: "zipCode",
        data: response.zipCodeData,
      });
    }

    // Se tem dados de clima, adiciona como mensagem separada
    if (response.weatherData && response.weatherData.weather?.length > 0) {
      const weatherMessage = `🌤️ **Previsão do Tempo:**\n${response.weatherData.weather
        .map(
          (day: any) =>
            `📅 ${new Date(day.date).toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}: ${day.conditionDescription} (${day.minimum}°C a ${day.maximum}°C)`
        )
        .join("\n")}`;
      addMessage(weatherMessage, false, {
        type: "weather",
        data: response.weatherData,
      });
    }

    // Se há múltiplas cidades, adiciona opções
    if (response.action === ACTIONS.MULTIPLE_CITIES && response.citiesFound) {
      const options = response.citiesFound.map((city: any) => ({
        id: city.id.toString(),
        text: `${city.name}/${city.state}`,
        value: city.name,
        cityId: city.id,
      }));

      addMessage("Escolha uma cidade:", false, undefined, options);
    }

    // Mensagem final (se diferente da inicial)
    if (response.finalMessage !== response.initialMessage) {
      addMessage(response.finalMessage, false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || sistemaInteligente.isPending) return;

    const userInput = inputValue.trim();
    setInputValue("");

    // Adiciona mensagem do usuário
    addMessage(userInput, true);

    try {
      // Chama o sistema inteligente
      const response = await sistemaInteligente.mutateAsync({
        userInput,
      });

      // Processa a resposta
      processAIResponse(response);
    } catch (error: any) {
      console.error("Erro no sistema:", error);
      addMessage(
        `❌ ${error.message || "Erro ao processar sua consulta. Tente novamente."}`,
        false
      );
    }
  };

  // Lida com clique em opções (múltiplas cidades)
  const handleOptionClick = async (option: {
    id: string;
    text: string;
    value: string;
    cityId?: number;
  }) => {
    console.log("🎯 Opção selecionada:", option);

    // Adiciona a seleção do usuário como mensagem
    addMessage(`Escolhi: ${option.text}`, true);

    try {
      // Usa o sistema inteligente para processar a seleção da cidade
      const response = await sistemaInteligente.mutateAsync({
        userInput: `previsão do tempo em ${option.value}`,
      });

      // Processa a resposta
      processAIResponse(response);
    } catch (error: any) {
      console.error("Erro ao processar opção:", error);
      addMessage(
        `❌ ${error.message || "Erro ao processar sua seleção. Tente novamente."}`,
        false
      );
    }
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === "user";

    return (
      <div
        key={message.id}
        className={`flex ${isUser ? "justify-end" : "justify-start"} mb-6`}
      >
        <div
          className={`flex max-w-[80%] ${isUser ? "flex-row-reverse" : "flex-row"} items-start gap-3`}
        >
          {/* Avatar */}
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              isUser ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            {isUser ? (
              <User className="w-5 h-5" />
            ) : (
              <Bot className="w-5 h-5" />
            )}
          </div>

          {/* Message Bubble */}
          <div
            className={`px-4 py-3 rounded-2xl ${
              isUser
                ? "bg-blue-600 text-white rounded-br-md"
                : "bg-gray-100 text-gray-800 rounded-bl-md"
            }`}
          >
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {message.content}
            </div>

            {/* Renderizar dados estruturados se existirem */}
            {message.data?.type === "zipCode" && (
              <div className="mt-3 p-3 bg-white rounded border">
                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">CEP:</span>
                    <span>{message.data.data.zipcode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Cidade:</span>
                    <span>{message.data.data.city}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Estado:</span>
                    <span>{message.data.data.state}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Bairro:</span>
                    <span>{message.data.data.neighborhood}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">Rua:</span>
                    <span>{message.data.data.street}</span>
                  </div>
                </div>
              </div>
            )}

            {message.data?.type === "weather" &&
              message.data.data.weather &&
              message.data.data.weather.length > 0 && (
                <div className="mt-3 p-3 bg-white rounded border">
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {message.data.data.weather
                      .slice(0, 3)
                      .map((day: any, index: number) => (
                        <div
                          key={index}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded"
                        >
                          <span className="font-medium">
                            {new Date(day.date).toLocaleDateString("pt-BR", {
                              weekday: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-xs">
                            {day.conditionDescription}
                          </span>
                          <span className="font-bold">
                            {day.minimum}° - {day.maximum}°
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Renderizar opções clicáveis se existirem */}
            {message.options && message.options.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-xs text-gray-600 mb-2">
                  Escolha uma opção:
                </div>
                <div className="max-h-64 overflow-y-auto pr-2 space-y-2">
                  {message.options.map((option) => (
                    <Button
                      key={option.id}
                      variant="outline"
                      size="sm"
                      className="justify-start text-left h-auto py-2 px-3 w-full"
                      onClick={() => handleOptionClick(option)}
                      disabled={sistemaInteligente.isPending}
                    >
                      <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
                      <span className="text-sm">{option.text}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div
              className={`text-xs mt-2 ${
                isUser ? "text-blue-100" : "text-gray-500"
              }`}
            >
              {message.timestamp.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bot className="w-6 h-6" />
            Chat Inteligente - CEP & Previsão do Tempo
          </h1>
          <p className="text-blue-100 text-sm mt-1">
            Consulte CEPs e previsão do tempo de forma natural
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-4">
          {messages.map(renderMessage)}

          {/* Typing Indicator */}
          {sistemaInteligente.isPending && (
            <div className="flex justify-start mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-gray-700" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-gray-100">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-gray-600">Analisando...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ex: CEP 14940000, Como está o tempo em São Paulo?, etc..."
              disabled={sistemaInteligente.isPending}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              disabled={!inputValue.trim() || sistemaInteligente.isPending}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
