/**
 * Brasil API Provider
 *
 * Centraliza todas as chamadas para a Brasil API, incluindo:
 * - Busca de cidades (CPTEC)
 * - Previsão do tempo (CPTEC)
 * - Consulta de CEP
 */

import type { Env } from "../main.ts";

// ===== TIPOS =====

export interface BrasilApiConfig {
  baseUrl: string;
  citySearchPath: string;
  weatherForecastPath: string;
  zipcodeLookupPath: string;
  timeout: number;
}

export interface CitySearchResult {
  id: number;
  nome: string;
  estado: string;
}

export interface WeatherForecastResult {
  cidade: string;
  estado: string;
  atualizado_em: string;
  clima: Array<{
    data: string;
    condition: string;
    condicao_desc: string;
    min: number;
    max: number;
    indice_uv: number;
  }>;
}

export interface ZipCodeResult {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
}

// ===== CONFIGURAÇÃO =====

export function loadBrasilApiConfig(env: Env): BrasilApiConfig {
  return {
    baseUrl: String(env.BRASIL_API_BASE_URL || "https://brasilapi.com.br/api"),
    citySearchPath: String(env.BRASIL_API_CITY_SEARCH || "/cptec/v1/cidade"),
    weatherForecastPath: String(
      env.BRASIL_API_WEATHER_FORECAST || "/cptec/v1/clima/previsao"
    ),
    zipcodeLookupPath: String(env.BRASIL_API_ZIPCODE_LOOKUP || "/cep/v1"),
    timeout: 30000, // 30 segundos
  };
}

// ===== FUNÇÕES UTILITÁRIAS =====

async function makeRequest<T>(
  url: string,
  config: BrasilApiConfig,
  errorMessage: string
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(url, {
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
        throw new Error("Recurso não encontrado");
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `Timeout: ${errorMessage} demorou mais que ${config.timeout / 1000} segundos`
      );
    }

    if (error instanceof Error) {
      throw new Error(`${errorMessage}: ${error.message}`);
    }

    throw new Error("Erro interno do servidor");
  }
}

// ===== FUNÇÕES PRINCIPAIS =====

/**
 * Busca cidades através do nome
 */
export async function searchCity(
  cityName: string,
  config: BrasilApiConfig
): Promise<CitySearchResult[]> {
  const url = `${config.baseUrl}${config.citySearchPath}/${encodeURIComponent(cityName)}`;

  console.log(`🔍 Buscando cidade: ${cityName}`);

  const result = await makeRequest<CitySearchResult[]>(
    url,
    config,
    "Erro na busca de cidades"
  );

  console.log(`✅ Encontradas ${result.length} cidades para "${cityName}"`);
  return result;
}

/**
 * Busca previsão do tempo para uma cidade
 */
export async function forecast(
  cityCode: number,
  config: BrasilApiConfig
): Promise<WeatherForecastResult> {
  const url = `${config.baseUrl}${config.weatherForecastPath}/${cityCode}`;

  console.log(`🌤️ Buscando previsão para cidade ID: ${cityCode}`);

  const result = await makeRequest<WeatherForecastResult>(
    url,
    config,
    "Erro na consulta de previsão do tempo"
  );

  // Validar dados obrigatórios
  if (!result.cidade || !result.estado || !result.clima) {
    throw new Error("Dados incompletos da API de previsão do tempo");
  }

  console.log(`✅ Previsão obtida para ${result.cidade}, ${result.estado}`);
  return result;
}

/**
 * Busca informações de endereço através do CEP
 */
export async function postcode(
  zipcode: string,
  config: BrasilApiConfig
): Promise<ZipCodeResult> {
  const url = `${config.baseUrl}${config.zipcodeLookupPath}/${zipcode}`;

  console.log(`📍 Buscando CEP: ${zipcode}`);

  const result = await makeRequest<ZipCodeResult>(
    url,
    config,
    "Erro na consulta do CEP"
  );

  // Validar dados obrigatórios
  if (!result.cep || !result.state || !result.city) {
    throw new Error("Dados incompletos da API");
  }

  console.log(
    `✅ CEP encontrado: ${result.cep} - ${result.city}, ${result.state}`
  );
  return result;
}

// ===== FUNÇÕES CONVENCIONAIS (mantém compatibilidade) =====

/**
 * Busca cidades - versão convencional
 */
export async function searchCities(
  cityName: string,
  env: Env
): Promise<CitySearchResult[]> {
  const config = loadBrasilApiConfig(env);
  return searchCity(cityName, config);
}

/**
 * Busca previsão do tempo - versão convencional
 */
export async function getWeatherForecast(
  cityCode: number,
  env: Env
): Promise<WeatherForecastResult> {
  const config = loadBrasilApiConfig(env);
  return forecast(cityCode, config);
}

/**
 * Busca CEP - versão convencional
 */
export async function getZipCodeInfo(
  zipcode: string,
  env: Env
): Promise<ZipCodeResult> {
  const config = loadBrasilApiConfig(env);
  return postcode(zipcode, config);
}

// ===== FUNÇÕES ESPECIALIZADAS =====

/**
 * Busca cidade e retorna previsão do tempo diretamente
 */
export async function searchCityAndForecast(
  cityName: string,
  stateName?: string,
  env?: Env,
  config?: BrasilApiConfig
): Promise<{
  cities: CitySearchResult[];
  weather?: WeatherForecastResult;
  multipleCities: boolean;
}> {
  const finalConfig = config || (env ? loadBrasilApiConfig(env) : undefined);
  if (!finalConfig) {
    throw new Error("Configuração necessária para searchCityAndForecast");
  }

  // Buscar cidades
  const cities = await searchCity(cityName, finalConfig);

  if (cities.length === 0) {
    return {
      cities: [],
      multipleCities: false,
    };
  }

  // Filtrar por estado se especificado
  let filteredCities = cities;
  if (stateName && cities.length > 0) {
    filteredCities = cities.filter(
      (city) =>
        city.estado === stateName ||
        city.estado.toLowerCase() === stateName.toLowerCase()
    );
  }

  // Se múltiplas cidades e sem estado especificado
  if (filteredCities.length > 1 && !stateName) {
    return {
      cities: filteredCities,
      multipleCities: true,
    };
  }

  // Se cidade única, buscar previsão
  if (filteredCities.length === 1) {
    try {
      const weather = await forecast(filteredCities[0].id, finalConfig);
      return {
        cities: filteredCities,
        weather,
        multipleCities: false,
      };
    } catch (error) {
      console.log(`⚠️ Erro ao buscar previsão para ${cityName}:`, error);
      return {
        cities: filteredCities,
        multipleCities: false,
      };
    }
  }

  return {
    cities: filteredCities,
    multipleCities: false,
  };
}

/**
 * Busca CEP e retorna previsão do tempo para a cidade
 */
export async function postcodeAndForecast(
  zipcode: string,
  env?: Env,
  config?: BrasilApiConfig
): Promise<{
  zipcode: ZipCodeResult;
  weather?: WeatherForecastResult;
}> {
  const finalConfig = config || (env ? loadBrasilApiConfig(env) : undefined);
  if (!finalConfig) {
    throw new Error("Configuração necessária para postcodeAndForecast");
  }

  // Buscar CEP
  const zipcodeData = await postcode(zipcode, finalConfig);

  try {
    // Buscar previsão para a cidade do CEP
    const cityResult = await searchCityAndForecast(
      zipcodeData.city,
      zipcodeData.state,
      undefined,
      finalConfig
    );

    return {
      zipcode: zipcodeData,
      weather: cityResult.weather,
    };
  } catch (error) {
    console.log(`⚠️ Erro ao buscar previsão para cidade do CEP:`, error);
    return {
      zipcode: zipcodeData,
    };
  }
}
