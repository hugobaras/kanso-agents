-- Plans Portail (produit autonome) : essai + deux offres payantes.
alter table subscriptions drop constraint if exists subscriptions_plan_check;
alter table subscriptions add constraint subscriptions_plan_check
  check (plan in ('trial', 'essentiel', 'cabinet', 'expert', 'portail_trial', 'portail_essentiel', 'portail_cabinet'));
