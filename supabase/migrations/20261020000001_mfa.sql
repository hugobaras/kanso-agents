-- Double authentification (TOTP) : secret chiffré, codes de secours hachés, anti-rejeu.
alter table users
  add column if not exists totp_secret_enc text,
  add column if not exists totp_enabled_at timestamptz,
  add column if not exists totp_last_step bigint,
  add column if not exists totp_recovery_hashes text[] not null default '{}';

-- Jeton court entre le mot de passe (ou lien e-mail) et le code.
alter table auth_tokens drop constraint if exists auth_tokens_purpose_check;
alter table auth_tokens add constraint auth_tokens_purpose_check check (purpose in ('magic', 'verify', 'reset', 'mfa'));
