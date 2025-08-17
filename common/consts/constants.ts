// Action constants for the intelligent system
export const ACTIONS = {
  // ZIP code related actions
  CONSULT_ZIP_CODE: "CONSULT_ZIP_CODE",
  CONSULT_ZIP_CODE_AND_WEATHER: "CONSULT_ZIP_CODE_AND_WEATHER",

  // Weather related actions
  CONSULT_WEATHER_DIRECT: "CONSULT_WEATHER_DIRECT",

  // Request actions
  REQUEST_ZIP_CODE: "REQUEST_ZIP_CODE",
  REQUEST_LOCATION: "REQUEST_LOCATION",

  // Special cases
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  MULTIPLE_CITIES: "MULTIPLE_CITIES",
  CITY_NOT_FOUND: "CITY_NOT_FOUND",
} as const;

export type ActionType = (typeof ACTIONS)[keyof typeof ACTIONS];

// Query type constants for the intelligent system
export const QUERY_TYPES = {
  ZIP_CODE: "ZIP_CODE",
  FORECAST: "FORECAST",
  ZIP_CODE_AND_FORECAST: "ZIP_CODE_AND_FORECAST",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
} as const;

export type QueryType = (typeof QUERY_TYPES)[keyof typeof QUERY_TYPES];

// Tool ID constants for the MCP server
export const TOOL_IDS = {
  // Core tools
  INTELLIGENT_DECISOR: "INTELLIGENT_DECISOR",
  ZIP_CODE_LOOKUP: "CONSULT_ZIP_CODE", // Uses ACTIONS.CONSULT_ZIP_CODE
  
  // Data analysis and AI tools
  DATA_ANALYSIS: "ANALYZE_DATA_WITH_AI",
  AI_TEST: "AI_TEST",
  
  // Location and weather tools
  CITY_SEARCH: "SEARCH_LOCALITY",
  WEATHER_FORECAST: "WEATHER_FORECAST",
} as const;

export type ToolId = (typeof TOOL_IDS)[keyof typeof TOOL_IDS];

// Context constants for maintaining conversation state
export const CONTEXT_TYPES = {
  CITY: "CITY",
  CEP: "CEP", 
  WEATHER: "WEATHER",
  MULTIPLE_CITIES: "MULTIPLE_CITIES",
} as const;

export type ContextType = (typeof CONTEXT_TYPES)[keyof typeof CONTEXT_TYPES];

// Weather query patterns for intelligent detection
export const WEATHER_QUERY_PATTERNS = [
  // Direct weather queries without city
  "previsão",
  "previsao", 
  "tempo",
  "clima",
  "temperatura",
  "qual a previsão",
  "qual o tempo",
  "qual o clima",
  "como está o tempo",
  "como está o clima",
  "qual a temperatura",
  "vai chover",
  "vai fazer sol",
  "como vai estar",
  "como tá",
  "como está",
  "está chovendo",
  "está fazendo sol",
  "tá chovendo",
  "tá fazendo sol",
] as const;
