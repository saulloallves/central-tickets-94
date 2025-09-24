// TypeScript utility to handle unknown error types safely
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'Unknown error';
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  if (error && typeof error === 'object' && 'stack' in error) {
    return String((error as any).stack);
  }
  return undefined;
}

export function getErrorResponse(error: unknown): any {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as any).response;
  }
  return null;
}