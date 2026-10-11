# barre-progression

Mod Claude Code : une barre de progression au-dessus du champ de saisie, pour savoir à tout moment où en est Claude.

```
████████░░░░░░░░░░░░ 40 % · étape 3/5
▶ Correction du collecteur · ensuite : Reprise d'historique
   dernière action : recherche web · 12 actions ce tour
```

- Construite à partir de la liste d'étapes de Claude (TaskCreate / TaskUpdate, ou TodoWrite).
- Ajoute une consigne à Claude : tenir une liste d'étapes pour toute demande de plus de deux étapes.
- Sans liste d'étapes, affiche « ⏳ En cours » et la dernière action, sans faux pourcentage.
- Résumé court aussi dans la ligne d'état.
- S'affiche dans le terminal et l'app de bureau (pas sur mobile).

Limite : la barre reflète la liste d'étapes, pas le travail réel. Une étape ajoutée en cours de route fait reculer le pourcentage.

## Installation

Dans un terminal, lancer `claude`, puis :

```
/plugin install barre-progression --marketplace cloepe7/barre-progression
```

Répondre `y` pour ajouter la source, puis choisir la portée « user » (Entrée). Le mod est actif dans toutes les sessions Claude Code lancées ensuite depuis cet ordinateur.

## Vérifier

```
claude plugin validate .
claude plugin test .
```
