insert into public.agencies (slug, name)
values
  ('furiver', 'Furiver Tour & Travel'),
  ('crisenix', 'Crisenix Grupo Turístico')
on conflict (slug) do update
set name = excluded.name;
