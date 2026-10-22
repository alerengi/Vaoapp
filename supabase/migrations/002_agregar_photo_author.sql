-- =============================================================================
-- Migración 002: Atribución de autor para fotos de Google Places
-- =============================================================================
-- Google Places exige contractualmente mostrar la atribución del autor
-- (authorAttributions) junto a cualquier fotografía de su API.
-- Esta columna almacena el nombre del autor y su enlace si está disponible.
-- =============================================================================

ALTER TABLE public.restaurantes
    ADD COLUMN IF NOT EXISTS photo_author TEXT;

COMMENT ON COLUMN public.restaurantes.photo_author IS 
    'Nombre y/o enlace de atribución del autor de la foto (Google Places requirement)';
