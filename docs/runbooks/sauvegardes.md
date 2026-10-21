# Sauvegardes et restauration

## Ce qui est sauvegardé

| Donnée | Où | Comment |
|---|---|---|
| Base PostgreSQL (comptes, espaces, demandes, dossiers, métadonnées des pièces) | `scripts/backup-db.sh` | `pg_dump` chiffré AES-256 (clé `KANSO_BACKUP_KEY`), chaque nuit via le service `backup` de `infra/docker/compose.prod.yml` |
| Pièces du Portail et documents (déjà chiffrés par cabinet) | Stockage objet OVH (S3) | Activer le **versioning** du bucket et une règle d'expiration des anciennes versions (30 jours) dans l'espace client OVH |
| `KANSO_MASTER_KEY` et `KANSO_BACKUP_KEY` | Gestionnaire de mots de passe des associés | **Jamais sur le serveur seul** : sans la clé maître, les pièces sont illisibles ; sans la clé de sauvegarde, les dumps aussi |

Rétention locale : 30 jours (`KANSO_BACKUP_KEEP_DAYS`). Copie hors serveur : `KANSO_BACKUP_S3_URI` (bucket distinct de celui des pièces, idéalement dans une autre région OVH).

## Vérifier que la restauration fonctionne (chaque mois)

```bash
docker compose -f infra/docker/compose.prod.yml --env-file .env.prod run --rm backup sh /repo/scripts/check-backup.sh
```

Le script sauvegarde, restaure dans une base temporaire, compare le nombre de lignes des tables principales puis supprime la base temporaire. Il doit finir par « Restauration vérifiée. ».

## Restaurer après un incident

1. Créer une base **vide** (`create database kanso_restore`). Le script refuse toute base qui contient déjà des tables.
2. Restaurer :
   ```bash
   TARGET_DATABASE_URL=postgres://…/kanso_restore KANSO_BACKUP_KEY=… sh scripts/restore-db.sh /backups/kanso-AAAAMMJJ-HHMMSS.dump.enc
   ```
3. Arrêter `inbound-api` et `document-worker`, pointer `DATABASE_URL` vers `kanso_restore`, appliquer les migrations (`sh scripts/apply-migrations.sh`), redémarrer.
4. Prévenir les cabinets si des données ont été perdues entre la dernière sauvegarde et l'incident (voir `incident.md`, obligation de notification RGPD).

Perte de données maximale : 24 h (une sauvegarde par nuit). Pour moins, passer à une base managée avec restauration à un instant donné (PITR).
