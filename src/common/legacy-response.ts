export interface LegacyResponse<T = unknown> {
  success: boolean;
  result?: T | null;
  message: string;
  statusCode: string;
}

export function legacySuccess<T>(result: T, message = ''): LegacyResponse<T> {
  return {
    success: true,
    result,
    message,
    statusCode: '200',
  };
}

export function legacyError(
  message = '',
  statusCode = 500,
): LegacyResponse<null> {
  return {
    success: false,
    message,
    statusCode: String(statusCode),
  };
}
