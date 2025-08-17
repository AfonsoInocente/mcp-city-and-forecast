export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export interface ValidationError {
  field: string;
  message: string;
}
