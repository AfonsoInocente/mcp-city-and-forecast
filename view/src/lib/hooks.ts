import { client } from "./rpc";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { TOOL_IDS } from "../../../common/index.ts";

// ===== CITY SEARCH & ZIPCODE HOOKS =====

export const useCitySearch = () => {
  return useMutation({
    mutationFn: (cityName: string) =>
      (client as any)[TOOL_IDS.CITY_SEARCH]({ cityName }),
  });
};

export const useZipCodeLookup = () => {
  return useMutation({
    mutationFn: (zipcode: string) =>
      (client as any)[TOOL_IDS.ZIP_CODE_LOOKUP]({ zipcode }),
  });
};

export const useWeatherForecast = () => {
  return useMutation({
    mutationFn: (cityCode: number) =>
      (client as any)[TOOL_IDS.WEATHER_FORECAST]({ cityCode }),
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
