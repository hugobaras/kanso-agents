-- Boîte d'envoi de dev : e-mails transactionnels capturés quand aucun SMTP n'est configuré.
create table if not exists mail_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  subject text not null,
  template text not null,
  html text not null,
  text_body text not null,
  transport text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_mail_outbox_created on mail_outbox (created_at desc);
alter table mail_outbox enable row level security;
