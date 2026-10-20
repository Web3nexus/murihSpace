/** Fields the UI reads from a caught error. Always present; empty when the error had none. */
export interface ApiErrorShape {
  message: string;
  response: {
    status: number;
    data: { message: string; error: string; errors: unknown };
  };
}

interface RawApiError {
  message?: unknown;
  response?: {
    status?: unknown;
    data?: { message?: unknown; error?: unknown; errors?: unknown };
  };
}

/** Narrow an unknown caught value (axios-style or plain Error) to the fields the UI reads. */
export function asApiError(err: unknown): ApiErrorShape {
  const src: RawApiError = typeof err === "object" && err !== null ? (err as RawApiError) : {};
  const data = src.response?.data;
  return {
    message: typeof src.message === "string" ? src.message : "",
    response: {
      status: typeof src.response?.status === "number" ? src.response.status : 0,
      data: {
        message: typeof data?.message === "string" ? data.message : "",
        error: typeof data?.error === "string" ? data.error : "",
        errors: data?.errors,
      },
    },
  };
}
