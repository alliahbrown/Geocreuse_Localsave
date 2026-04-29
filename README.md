# GeoCreuse Desktop

Application desktop de sauvegarde locale pour GeoCreuse.  
Disponible sur **Windows** et **Linux**, sans installation requise.

---

## Télécharger l'application

Rendez-vous sur la page des releases du projet :


**[Télécharger la dernière version](../../releases/latest)**
ne pas pubkier git 


| Système | Fichier à télécharger |
|---|---|
| Windows | `GeoCreuse_LocalSave_Windows.zip` |
| Linux | `GeoCreuse_LocalSave_Linux.zip` |

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

<!-- ## Problèmes fréquents

**L'application ne se lance pas sur Linux**  
Certaines distributions nécessitent FUSE. Installer avec :
```bash
sudo apt install libfuse2   # Ubuntu/Debian
sudo dnf install fuse       # Fedora
```

**Windows bloque le lancement**  
L'exécutable n'est pas signé. C'est normal pour une application interne. Voir la procédure ci-dessus (Informations complémentaires → Exécuter quand même).

--- -->

## Pour les dev
### Prérequis

- Node.js 20+
- npm

### Lancer en développement

```bash
npm install
npm start
```

### Créer une release

```bash
git tag v1.0.0
git push && git push --tags
```

La CI/CD GitLab buildait automatiquement les versions Windows et Linux et les publie sur la page Releases.