/**
 * Utilidad de validación y acceso seguro a variables de entorno de Vao.
 * Previene la fuga de secretos del servidor y valida la presencia de variables requeridas.
 */

export interface PublicEnv {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
}

export interface ServerEnv extends PublicEnv {
  SUPABASE_SERVICE_ROLE_KEY: string;
  GOOGLE_PLACES_API_KEY: string;
}

export function validatePublicEnv(env: Record<string, string | undefined>): {
  isValid: boolean;
  missing: string[];
} {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];

  const missing = required.filter((key) => !env[key] || env[key]?.trim() === '');

  return {
    isValid: missing.length === 0,
    missing,
  };
}

export function validateServerEnv(env: Record<string, string | undefined>): {
  isValid: boolean;
  missing: string[];
} {
  const publicValidation = validatePublicEnv(env);
  const requiredServer = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_PLACES_API_KEY',
  ];

  const missingServer = requiredServer.filter(
    (key) => !env[key] || env[key]?.trim() === ''
  );

  const missing = [...publicValidation.missing, ...missingServer];

  return {
    isValid: missing.length === 0,
    missing,
  };
}
