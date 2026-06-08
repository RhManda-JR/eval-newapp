# NewApp — Lancement et connexion GLPI

## Prérequis

- **Node.js** 20+ (22 recommandé)
- **npm**
- Une instance **GLPI** accessible (locale ou distante), API REST activée

## Lancer le projet (développement)

```bash
cd newapp
npm install
npm run dev
```

Cela démarre en parallèle :

| Service | URL | Rôle |
|---|---|---|
| Frontend (Vite) | http://localhost:5173 | Interface React |
| API (Express) | http://localhost:3001 | Backend + sync GLPI |

Le frontend proxyfie `/api` vers le port `3001` (voir `vite.config.ts`).

### Accès à l'application

| Zone | URL | Accès |
|---|---|---|
| Front office | http://localhost:5173/ | Parc, création de tickets |
| Backoffice | http://localhost:5173/backoffice/entree | Code par défaut : `JUIN26` |

### Autres commandes utiles

```bash
npm run dev:client    # Frontend seul
npm run dev:server    # API seule
npm run build         # Build production (tsc + vite)
npm run start:server  # API sans watch (après build)
npm run typecheck     # Vérification TypeScript
```

### Production (aperçu)

```bash
npm run build
npm run start:server   # API sur le port 3001 (ou PORT=xxxx)
npm run preview        # Frontend buildé (port Vite preview)
```

Variable d'environnement optionnelle : `PORT` (défaut `3001` pour l'API).

### Données locales

- Base SQLite : `server/data/newapp.db`
- Images importées : `server/data/images/`

---

## Connexion d'un autre GLPI

NewApp n'est pas lié à une instance GLPI précise. Il communique via l'**API REST** de GLPI. Vous pouvez brancher un autre serveur GLPI en changeant la configuration.

## Paramètres requis

| Paramètre | Description | Exemple |
|---|---|---|
| `glpi_url` | URL publique de GLPI (avec `/public`) | `http://autre-serveur/glpi/public` |
| `glpi_user` | Utilisateur API | `glpi` |
| `glpi_password` | Mot de passe API | `glpi` |

Ces valeurs sont stockées dans la base SQLite de NewApp (`server/data/newapp.db`, table `settings`).

### Modifier la configuration

Via l'API backoffice (authentification requise) :

```http
PUT /api/settings
Content-Type: application/json

{
  "glpi_url": "http://autre-serveur/glpi/public",
  "glpi_user": "mon_utilisateur",
  "glpi_password": "mon_mot_de_passe"
}
```

Vérifier la connexion : le dashboard backoffice affiche **Connecté** ou **Hors ligne** (`GET /api/glpi/status`).

## Conditions pour que ça fonctionne

1. **API REST activée** sur l'autre GLPI.
2. **Compte avec droits suffisants** : lecture/écriture sur le parc (Computer, Monitor, Printer), les tickets, les coûts et les documents.
3. **GLPI 10 ou 11** recommandé (version testée avec NewApp).
4. **Accessibilité réseau** : le serveur NewApp doit pouvoir joindre l'URL GLPI (réseau, DNS, pare-feu, proxy).
5. **Types de documents images autorisés** : PNG et JPG doivent être uploadables dans GLPI (`glpi_documenttypes`, `is_uploadable = 1` — activé par défaut).

## Changement de GLPI : procédure recommandée

Le cache local de NewApp (`assets_mirror`, images liées, tickets suivis, etc.) contient les **IDs de l'ancien GLPI**. En branchant une autre instance :

1. Modifier `glpi_url`, `glpi_user` et `glpi_password`.
2. Vérifier que le dashboard affiche **Connecté**.
3. Lancer un **Reset** dans le backoffice (ou au minimum une resynchronisation).
4. Réimporter les fichiers CSV et le ZIP images.

Sans cette étape, NewApp peut tenter de lier des images ou des données à de mauvais équipements.

## Import des images

- Les images du ZIP sont associées aux équipements par **nom de fichier** (`PC-ADM-001.png` → équipement `PC-ADM-001`).
- Importer le **Parc CSV** (Feuille-1) avant ou en même temps que le ZIP images.
- Les images apparaissent dans GLPI sur la fiche de l'équipement, onglet **Documents**.

## Fichiers concernés dans NewApp

| Fichier | Rôle |
|---|---|
| `server/glpi.ts` | Client API GLPI (session, parc, tickets, documents) |
| `server/import-service.ts` | Import CSV/ZIP et envoi des images vers GLPI |
| `server/db.ts` | Stockage des paramètres et miroir local |
| `server/index.ts` | Endpoints `/api/settings` et `/api/glpi/status` |

Aucune modification du code source GLPI n'est nécessaire.
