# 10 — L'écran du compte : le lieu unique où tout se passe

**Statut :** ✅ fait — 13 septembre 2026

**Bloqué par :** [05 — Un jeton, deux rendus](05-relier-un-appareil-par-un-code.md).

## Ce qu'il faut obtenir

Un onglet **Compte**, à côté d'Étalonnage. Tout ce qui touche à l'identité y vit,
et nulle part ailleurs : ce que porte cet appareil, comment en relier un autre,
comment arriver depuis un autre.

C'est l'écran qui rend le chemin normal praticable : **la voiture donne un code,
le poste de travail le reçoit**. Et c'est sur le poste de travail, clavier sous
les doigts, que les tickets suivants feront un vrai compte.

## Ce qu'il porte

- **L'état du compte** : le sien, ce qu'il ouvre, et la mise en garde tant qu'il
  n'y a ni adresse ni mot de passe.
- **Donner un code** : le code à scanner et le code court, deux rendus du même
  jeton, avec ce qu'il reste de validité.
- **Recevoir un code** : un champ où recopier huit caractères, et ce qui arrive
  quand on se trompe.
- **Se connecter avec une adresse** — le champ existe dès maintenant, même si
  rien ne permet encore d'en avoir une : c'est le [ticket 11](11-un-vrai-compte.md)
  qui la donne, et un écran qui n'aurait pas prévu la place serait à refaire.

Ce qui est aujourd'hui dans l'écran de configuration **déménage** : le bloc « Le
compte de cet appareil » et le bouton « Relier un appareil… ». Configuration garde
un renvoi d'une ligne.

## Ce à quoi il faut faire attention

- **Rien ne s'affiche au premier lancement.** Tranché le 13 septembre 2026 : une
  fenêtre qui demanderait de choisir au démarrage serait l'écran d'inscription que
  ce lot supprime, et elle tomberait au moment où l'on veut juste rouler. L'onglet
  existe, on y va quand on veut.
- **La bannière escamotable**, elle, a désormais lieu d'être : deux voies existent,
  et elle les rappelle **une fois**.
- **Un onglet de plus dans une barre qui se replie déjà.** Elle a été faite pour
  ça, mais il faut le vérifier sur une largeur de téléphone, pas seulement au
  bureau.
- **Hors réseau, l'écran ne ment pas.** Donner un code demande le serveur ;
  recevoir un code aussi. Les deux le disent au lieu d'attendre.
- **Le ticket 06 décidera s'il se montre au volant.** Ici, l'onglet est toujours
  là.

## Critères d'acceptation

- [x] Un onglet Compte existe, et la barre tient sur une largeur de téléphone
- [x] Il donne un code à scanner et un code court, avec leur validité restante
- [x] Il reçoit un code court, et dit ce qui ne va pas quand il est faux
- [x] Le bloc du compte a quitté l'écran de configuration, qui y renvoie
- [x] Une bannière escamotable rappelle l'écran, une fois
- [x] Hors réseau, l'écran dit ce qu'il ne peut pas faire

## Ce qui a été fait, et ce qui a été mesuré

`src/ui/AccountView.vue` porte les trois sections — ce que porte cet appareil,
donner un code, rejoindre un compte — plus la place de la connexion par adresse,
qui dit qu'elle n'existe pas encore. L'écran de configuration garde deux lignes
de renvoi.

**Mesuré à 375 pixels** : la barre se replie sur deux lignes, l'onglet Compte
tient, et rien ne déborde en largeur (`scrollWidth` 375 pour un `clientWidth` de
375).

**Hors réseau, les deux sens le disent** — vérifié en coupant `fetch` dans la
page : « Sans réseau, il n'y a pas de code à afficher » d'un côté, « le code se
vérifie sur le serveur » de l'autre.

**Le rappel n'est pas une bannière des deux voies**, faute de seconde voie : il
annonce l'écran. Il paraît à la **deuxième ouverture** — au premier lancement on
veut rouler, pas lire — jamais pendant que l'aide est ouverte, et se ferme
définitivement au premier clic. Deux clés de stockage : le compte des ouvertures,
et le fait qu'il ait été montré.
