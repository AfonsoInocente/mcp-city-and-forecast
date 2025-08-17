// API Response types
export interface IntelligentDecision {
  action: string;
  friendlyMessage: string;
  extractedZipCode?: string;
  extractedCity?: string;
  foundCities?: Array<{
    id: number;
    name: string;
    state: string;
  }>;
}

// Weather forecast response type (converted from BrasilAPI Portuguese fields)
export interface WeatherForecastResponse {
  city: string; // converted from 'cidade'
  state: string; // converted from 'estado'
  updatedAt: string; // converted from 'atualizado_em'
  weather: Array<{
    date: string; // converted from 'data'
    condition: string;
    conditionDescription: string; // converted from 'condicao_desc'
    minimum: number; // converted from 'min'
    maximum: number; // converted from 'max'
    uvIndex: number; // converted from 'indice_uv'
  }>;
}
