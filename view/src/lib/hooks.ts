import { client } from "./rpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

// ===== CITY SEARCH & ZIPCODE HOOKS =====

export const useCitySearch = () => {
  return useMutation({
    mutationFn: (cityName: string) => client.SEARCH_LOCALITY({ cityName }),
  });
};

export const useZipCodeLookup = () => {
  return useMutation({
    mutationFn: (zipcode: string) => client.CONSULT_ZIP_CODE({ zipcode }),
  });
};

export const useWeatherForecast = () => {
  return useMutation({
    mutationFn: (cityCode: number) => client.WEATHER_FORECAST({ cityCode }),
  });
};

// ===== SISTEMA INTELIGENTE HOOK =====

export const useSistemaInteligente = () => {
  return useMutation({
    mutationFn: (params: { userInput: string }) =>
      client.SISTEMA_INTELIGENTE(params),
    onError: (error) => {
      console.error("Erro no sistema inteligente:", error);
      toast.error("Erro ao processar consulta. Tente novamente.");
    },
  });
};
