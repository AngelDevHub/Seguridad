export interface ApiResponse<T> {
  success: boolean;
  opCode: number;
  timestamp: string;
  data: T;
  error?: { message: string };
}

export interface LoginApiResponse {
  access_token: string;
  expires_in: string;
  user: {
    id: string;
    nombre_completo: string;
    username: string;
    email: string;
  };
  permissions: string[];
}

