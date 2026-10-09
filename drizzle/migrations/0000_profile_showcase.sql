ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS featured_badges text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_featured_max3 CHECK (coalesce(array_length(featured_badges,1),0) <= 3);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_title_len CHECK (title IS NULL OR length(title) <= 40);