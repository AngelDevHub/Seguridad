// src/app/core/models/api.model.ts
// Esquema JSON universal del ERP:
//   { statusCode, intOpCode, timestamp, data }      ← éxito
//   { statusCode, intOpCode, timestamp, error }     ← error

export interface ApiResponse<T> {
  statusCode: number;
  intOpCode: number;
  timestamp: string;
  data: T;
  error?: { message: string };
}

/**
 * Respuesta del endpoint POST /auth/login.
 * NOTA: el JWT ya no viene en el body — está en la cookie HttpOnly 'erp_token'.
 * Solo retorna el perfil del usuario y sus permisos.
 */
export interface LoginApiResponse {
  expires_in: string;
  user: {
    id: string;
    nombre_completo: string;
    username: string;
    email: string;
  };
  permissions: string[];
}
