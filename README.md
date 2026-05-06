# GeoCreuse Desktop

Application desktop de sauvegarde locale pour GeoCreuse.  
Disponible sur **Windows** et **Linux**, sans installation préalable requise.

---

## Télécharger l'application

Rendez-vous sur la page des releases du projet :

| Système | Fichier | Lien direct |
|---|---|---|
| Windows | `GeoCreuse_LocalSave_Windows.zip` | **[Télécharger](https://github.com/alliahbrown/Geocreuse_Localsave/actions/runs/25119050315/artifacts/6711554973)** |
| Linux | `GeoCreuse_LocalSave_Linux.zip` | **[Télécharger](https://gitlab.com/leptitbraquet/geocreuse_localsave/-/jobs/artifacts/v2.0.0/raw/dist/GeoCreuse_LocalSave_Linux.zip?job=build-linux)** |

---

## Installation

### Windows

1. Télécharger `GeoCreuse_LocalSave_Windows.zip`
2. Faire un clic droit → **Extraire tout**
3. Ouvrir le dossier extrait
4. Double-cliquer sur `geocreuse-desktop.exe`

> Si Windows affiche un avertissement de sécurité ("Windows a protégé votre ordinateur"), cliquer sur **Informations complémentaires** puis **Exécuter quand même**.

### Linux

1. Télécharger `GeoCreuse_LocalSave_Linux.zip`
2. Extraire le fichier `.AppImage` :
   ```bash
   unzip GeoCreuse_LocalSave_Linux.zip
   ```
3. Rendre le fichier exécutable :
   ```bash
   chmod +x GeoCreuse_LocalSave_Linux.AppImage
   ```
4. Lancer l'application :
   ```bash
   ./GeoCreuse_LocalSave_Linux.AppImage
   ```

---

## Fonctionnalités

- **Synchronisation** avec l'API `sauvegarde.leptitbraquet.fr` (manuelle ou automatique au démarrage)
- **Affichage** des résultats, athlètes et segments dans des tableaux dynamiques
- **Export** des données en CSV ou JSON
- **Sauvegarde automatique** à intervalle configurable (CSV ou JSON)
- **Indicateur réseau** en temps réel (en ligne / hors ligne)
- **Suppression** des données par table ou globale
- Stockage local dans une base **SQLite** via `sql.js`

---

## Architecture CI/CD

Le projet est hébergé sur **GitLab** (source principale) et mirroré sur **GitHub**.  
Les deux plateformes participent au build et à la release :

| Plateforme | Rôle |
|---|---|
| GitLab CI | Build Linux + publication de la release GitLab |
| GitHub Actions | Build Windows (artifact `.exe`) |
| GitHub | Miroir du code, déclenche le build Windows sur chaque tag |

### Déclenchement

Un push de tag (ex: `v1.2.0`) suffit à tout lancer :

1. **GitLab** compile le `.AppImage`, le zippe et publie la release
2. GitLab pousse automatiquement le tag et le code sur **GitHub** (job `mirror-to-github`)
3. **GitHub Actions** compile le `.exe` Windows (artifact disponible 30 jours)

---

## Pour les développeurs

### Prérequis

- Node.js 20+
- npm

### Lancer en développement

```bash
npm install
npm start
```

### Variable d'environnement requise

L'application utilise une clé secrète pour s'authentifier auprès de l'API.

En développement, créer un fichier `.env` à la racine du projet :

```
API_SECRET_KEY=$API_SECRET_KEY$
```

> ⚠️ Ne jamais committer ce fichier. Il doit être listé dans `.gitignore`.

En production, la clé est injectée automatiquement par la CI/CD au moment du build :

- **GitLab** : variable secrète `API_SECRET_KEY` à définir dans  
  *Settings → CI/CD → Variables*
- **GitHub** : secret `API_SECRET_KEY` à définir dans  
  *Settings → Secrets and variables → Actions*

### Miroir GitLab → GitHub

Le job `mirror-to-github` pousse automatiquement le code sur GitHub à chaque tag ou push sur `main`.  
Il nécessite un token GitHub stocké comme variable secrète dans GitLab :

- **GitLab** : variable `TOKEN` à définir dans *Settings → CI/CD → Variables*  
  (token GitHub avec les droits `repo`)

### Créer une release

```bash
git tag v1.0.0
git push && git push --tags
```

GitLab build automatiquement la version Linux et publie la release.  
Le tag est ensuite mirroré sur GitHub qui build la version Windows.

### Structure du projet

```
├── main.js          # Processus principal Electron (IPC, fenêtre, sync, export)
├── preload.js       # Pont sécurisé entre le renderer et le main
├── renderer.js      # Logique de l'interface (tableaux, sync, export, autosave)
├── db.js            # Base de données SQLite locale (sql.js)
├── sync.js          # Appels API et synchronisation des données
├── index.html       # Interface utilisateur
├── .env             # Clé API locale (ne pas committer)
└── .gitlab-ci.yml   # Pipeline CI/CD GitLab
```