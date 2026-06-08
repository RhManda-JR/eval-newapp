# NewApp

Application web de gestion de parc informatique et de tickets, connectée à **GLPI** via son API REST.

- **Front office** : consultation du parc et création de tickets
- **Backoffice** : import de données (CSV/ZIP), synchronisation GLPI, suivi des tickets et des coûts

## Prérequis

| Outil | Version |
|---|---|
| [Node.js](https://nodejs.org/) | 20+ (22 recommandé) |
| npm | fourni avec Node.js |
| GLPI | 10 ou 11, API REST activée |

> **Windows** : `better-sqlite3` compile un module natif. Si `npm install` échoue, installez [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) avec la charge de travail **Développement Desktop en C++**.

> **Important** : `better-sqlite3` doit être compilé avec **la même version de Node.js** que celle utilisée pour lancer l'app. Après un changement de version Node, arrêtez `npm run dev` puis exécutez :
>
> ```bash
> npm run rebuild:native
> ```

## Installation

```bash
git clone <url-du-depot> newapp
cd newapp
npm install
```

Au premier lancement, la base SQLite et les paramètres par défaut sont créés automatiquement dans `server/data/`.

## Lancement (développement)

```bash
npm run dev
```

Cette commande démarre en parallèle le frontend et l'API :

| Service | URL | Rôle |
|---|---|---|
| Frontend (Vite) | http://localhost:5173 | Interface React |
| API (Express) | http://localhost:3001 | Backend + sync GLPI |

Le frontend redirige les requêtes `/api` vers le port `3001` (voir `vite.config.ts`).

### Accès à l'application

| Zone | URL | Accès |
|---|---|---|
| Front office | http://localhost:5173/ | Parc, création de tickets |
| Backoffice | http://localhost:5173/backoffice/entree | Code par défaut : `JUIN26` |

### Commandes utiles

```bash
npm run dev:client    # Frontend seul (port 5173)
npm run dev:server    # API seule (port 3001)
npm run build         # Build production (tsc + vite)
npm run preview       # Aperçu du frontend buildé
npm run start:server  # API sans mode watch
npm run typecheck     # Vérification TypeScript
npm run lint          # ESLint
npm run format        # Prettier
```

## Lancement (production)

```bash
npm run build
npm run start:server   # API sur le port 3001
npm run preview        # Frontend buildé (port Vite preview)
```

Variable d'environnement optionnelle : `PORT` (défaut `3001` pour l'API).

```bash
# Exemple : API sur le port 4000
PORT=4000 npm run start:server
```

## Configuration GLPI

Par défaut, NewApp tente de se connecter à :

| Paramètre | Valeur par défaut |
|---|---|
| URL GLPI | `http://127.0.0.1/glpi/public` |
| Utilisateur | `glpi` |
| Mot de passe | `glpi` |

Ces paramètres sont modifiables depuis le backoffice ou via l'API (`PUT /api/settings`). Pour brancher une autre instance GLPI, consulter le guide détaillé :

→ **[GLPI-CONNEXION.md](./GLPI-CONNEXION.md)**

## Données locales

| Chemin | Contenu |
|---|---|
| `server/data/newapp.db` | Base SQLite (paramètres, miroir du parc, logs d'import) |
| `server/data/images/` | Images importées depuis les ZIP |

## Stack technique

- **Frontend** : React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui
- **Backend** : Express 5, better-sqlite3
- **Intégration** : API REST GLPI
