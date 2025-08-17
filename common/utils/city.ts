/**
 * Utilitários para validação e extração de nomes de cidade
 */

import { NON_CITY_WORDS } from "../consts/index.ts";

/**
 * Verifica se uma string parece ser um nome de cidade válido
 */
export const isValidCityName = (input: string): boolean => {
  const trimmedInput = input.trim();

  // Deve ter pelo menos 2 caracteres
  if (trimmedInput.length < 2) {
    return false;
  }

  // Deve conter apenas letras, espaços e alguns caracteres especiais
  if (!/^[A-Za-zÀ-ÿ\s\-']+$/.test(trimmedInput)) {
    return false;
  }

  // Não deve conter palavras que não são cidades
  const words = trimmedInput.toLowerCase().split(/\s+/);
  const hasNonCityWords = words.some((word) =>
    (NON_CITY_WORDS as readonly string[]).includes(word)
  );

  return !hasNonCityWords;
};

/**
 * Extrai possíveis nomes de cidade de uma string
 */
export const extractPossibleCityNames = (input: string): string[] => {
  const words = input.split(/\s+/);
  const possibleCities: string[] = [];

  // Procura por sequências de palavras que podem ser nomes de cidade
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j <= words.length; j++) {
      const candidate = words.slice(i, j).join(" ").trim();
      if (isValidCityName(candidate)) {
        possibleCities.push(candidate);
      }
    }
  }

  return possibleCities;
};

/**
 * Extrai o nome de cidade mais provável de uma string
 * Retorna o nome mais longo que seja válido
 */
export const extractBestCityName = (input: string): string | null => {
  // Primeiro, tenta padrões específicos de busca de cidade
  const cityPatterns = [
    // Padrão: "clima em [cidade]" ou "tempo em [cidade]"
    /(?:clima|tempo)\s+(?:em|para|de|do|da)\s+([A-Za-zÀ-ÿ\s]+?)(?:\?|\.|$|,)/i,
    // Padrão: "previsao em [cidade]" ou "previsão em [cidade]"
    /(?:previsao|previsão)\s+(?:em|para|de|do|da)\s+([A-Za-zÀ-ÿ\s]+?)(?:\?|\.|$|,)/i,
    // Padrão: "previsao [cidade]" (sem preposição) - captura cidade completa
    /(?:previsao|previsão)\s+([A-Za-zÀ-ÿ\s]+?)(?:\?|\.|$|,)/i,
    // Padrão: "tempo [cidade]" (sem preposição) - captura cidade completa
    /(?:tempo|clima)\s+([A-Za-zÀ-ÿ\s]+?)(?:\?|\.|$|,)/i,
    // Padrão: "em [cidade]" (deve ser o último para não interferir)
    /(?:em|para|de|do|da)\s+([A-Za-zÀ-ÿ\s]+?)(?:\?|\.|$|,)/i,
  ];

  for (const pattern of cityPatterns) {
    const match = input.match(pattern);
    if (match && match[1]) {
      const extractedCity = match[1].trim();
      // Remove pontuação e limpa a cidade
      const cleanCity = extractedCity.replace(/[?!.,;:]/g, "").trim();

      if (cleanCity.length >= 2 && isValidCityName(cleanCity)) {
        console.log("🔍 City extracted using pattern:", cleanCity);
        return cleanCity;
      }
    }
  }

  // Fallback: usa a lógica original
  const possibleCities = extractPossibleCityNames(input);
  if (possibleCities.length === 0) {
    return null;
  }

  // Filtra cidades que não contêm palavras-chave de CEP
  const filteredCities = possibleCities.filter((city) => {
    const lowerCity = city.toLowerCase();
    return (
      !lowerCity.includes("cep") &&
      !lowerCity.includes("zip") &&
      !lowerCity.includes("postal") &&
      !lowerCity.includes("code")
    );
  });

  if (filteredCities.length === 0) {
    return null;
  }

  // Retorna o nome mais longo (mais específico)
  return filteredCities.sort((a, b) => b.length - a.length)[0];
};

/**
 * Limpa um nome de cidade removendo palavras desnecessárias
 */
export const cleanCityName = (input: string): string => {
  const words = input.split(/\s+/);
  const cleanedWords = words.filter((word) => {
    const lowerWord = word.toLowerCase();
    return !(NON_CITY_WORDS as readonly string[]).includes(lowerWord);
  });

  return cleanedWords.join(" ").trim();
};

/**
 * Extrai cidade e estado de uma string (formato: "Cidade, UF" ou "Cidade UF")
 */
export const extractCityAndState = (
  input: string
): { city: string; state: string } | null => {
  // Padrão para detectar cidade, estado - melhorado para capturar casos como "previsao em Ibitinga, SP"
  const cityStatePatterns = [
    // Padrão: "previsao em Cidade, UF" ou "tempo em Cidade, UF" ou "temperatura em Cidade, UF"
    /(?:previsao|previsão|tempo|clima|temperatura)\s+(?:em|para|de|do|da)\s+([A-Za-zÀ-ÿ\s]+?)(?:,\s*|\s+)([A-Z]{2})(?:\?|$|\.)/i,
    // Padrão padrão: "Cidade, UF" ou "Cidade UF"
    /([A-Za-zÀ-ÿ\s]+?)(?:,\s*|\s+)([A-Z]{2})(?:\?|$|\.)/i,
  ];

  for (const pattern of cityStatePatterns) {
    const match = input.match(pattern);
    if (match) {
      const city = match[1].trim();
      const state = match[2].toUpperCase();

      // Remove pontuação da cidade
      const cleanCity = city.replace(/[?!.,;:]/g, "").trim();

      if (cleanCity.length >= 2 && isValidCityName(cleanCity)) {
        console.log("🔍 City and State extracted:", { city: cleanCity, state });
        return { city: cleanCity, state };
      }
    }
  }

  return null;
};
