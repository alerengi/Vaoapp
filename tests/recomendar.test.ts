import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateAspectRatioFit, CLIENT_MAX_IMAGE_BYTES } from '../lib/image-compressor';
import { SERVER_ACTION_MAX_FILE_SIZE, BUCKET_RECOMENDACIONES } from '../lib/storage';
import { guardarRecomendacion } from '../app/actions/recomendar';

// Mocks para Supabase
const mockGetUser = vi.fn();
const mockUpload = vi.fn();
const mockRemove = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        remove: mockRemove,
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'recomendaciones') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: mockMaybeSingle,
              })),
            })),
          })),
          insert: mockInsert,
          update: mockUpdate,
        };
      }
      if (table === 'platos') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: mockSingle,
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: { id: 'plato-existente-123' }, error: null })),
              })),
            })),
          })),
        };
      }
      return {
        select: mockSelect,
      };
    }),
  })),
}));

describe('Compresor y Sanitizador de Imágenes (lib/image-compressor.ts)', () => {
  it('el límite máximo de tamaño del cliente es exactamente 3 MB (seguro para Vercel)', () => {
    expect(CLIENT_MAX_IMAGE_BYTES).toBe(3 * 1024 * 1024);
  });

  it('el límite máximo de la Server Action en servidor es 3.5 MB', () => {
    expect(SERVER_ACTION_MAX_FILE_SIZE).toBe(3.5 * 1024 * 1024);
  });

  it('calcula correctamente el escalado proporcional manteniendo la relación de aspecto', () => {
    // Imagen horizontal 3200x1800 (16:9) debe escalar a 1600x900 con max 1600
    const resH = calculateAspectRatioFit(3200, 1800, 1600);
    expect(resH.width).toBe(1600);
    expect(resH.height).toBe(900);

    // Imagen vertical 2000x4000 (1:2) debe escalar a 800x1600
    const resV = calculateAspectRatioFit(2000, 4000, 1600);
    expect(resV.width).toBe(800);
    expect(resV.height).toBe(1600);

    // Imagen menor a 1600px no se altera
    const resSmall = calculateAspectRatioFit(800, 600, 1600);
    expect(resSmall.width).toBe(800);
    expect(resSmall.height).toBe(600);
  });
});

describe('Server Action guardarRecomendacion · Validaciones y Seguridad', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rechaza con NO_AUTENTICADO si el usuario no ha iniciado sesión', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: new Error('Sin sesión') });

    const formData = new FormData();
    formData.append('restaurante_id', '11111111-2222-3333-4444-555555555555');

    const res = await guardarRecomendacion(formData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.codigo).toBe('NO_AUTENTICADO');
    }
  });

  it('rechaza si falta el restaurante_id', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: '00000000-1111-2222-3333-444444444444' } },
      error: null,
    });

    const formData = new FormData();
    const res = await guardarRecomendacion(formData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.codigo).toBe('RESTAURANTE_REQUERIDO');
    }
  });

  it('rechaza calificaciones inválidas (menores a 1 o mayores a 5)', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: '00000000-1111-2222-3333-444444444444' } },
      error: null,
    });

    const formData = new FormData();
    formData.append('restaurante_id', '11111111-2222-3333-4444-555555555555');
    formData.append('calificacion', '6'); // fuera de rango

    const res = await guardarRecomendacion(formData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.codigo).toBe('CALIFICACION_INVALIDA');
    }
  });

  it('rechaza comentarios que exceden los 280 caracteres', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: '00000000-1111-2222-3333-444444444444' } },
      error: null,
    });

    const formData = new FormData();
    formData.append('restaurante_id', '11111111-2222-3333-4444-555555555555');
    formData.append('calificacion', '5');
    formData.append('comentario', 'a'.repeat(281));

    const res = await guardarRecomendacion(formData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.codigo).toBe('COMENTARIO_MUY_LARGO');
    }
  });

  it('rechaza si es una recomendación nueva y no se adjunta foto', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: '00000000-1111-2222-3333-444444444444' } },
      error: null,
    });

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const formData = new FormData();
    formData.append('restaurante_id', '11111111-2222-3333-4444-555555555555');
    formData.append('plato_id', '22222222-3333-4444-5555-666666666666');
    formData.append('calificacion', '5');

    const res = await guardarRecomendacion(formData);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.codigo).toBe('FOTO_REQUERIDA');
    }
  });

  it('efectúa rollback (borra la foto recién subida) si la base de datos falla al insertar', async () => {
    const userId = '00000000-1111-2222-3333-444444444444';
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: userId } },
      error: null,
    });

    // Sin recomendación previa
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    // Subida a Storage exitosa
    mockUpload.mockResolvedValueOnce({ error: null });

    // Inserción en base de datos falla
    mockInsert.mockReturnValueOnce({
      select: vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({
            data: null,
            error: new Error('Error simulado en base de datos'),
          })
        ),
      })),
    });

    // Foto JPEG simulada válida
    const fakeJpeg = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])],
      'test.jpg',
      { type: 'image/jpeg' }
    );

    const formData = new FormData();
    formData.append('restaurante_id', '11111111-2222-3333-4444-555555555555');
    formData.append('plato_id', '22222222-3333-4444-5555-666666666666');
    formData.append('calificacion', '5');
    formData.append('foto', fakeJpeg);

    const res = await guardarRecomendacion(formData);

    expect(res.ok).toBe(false);
    // Debe haber invocado remove para limpiar la foto subida
    expect(mockRemove).toHaveBeenCalledTimes(1);
    expect(mockRemove).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining(`${userId}/`)])
    );
  });
});
