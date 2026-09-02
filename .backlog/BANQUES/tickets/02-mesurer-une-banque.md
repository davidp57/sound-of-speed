# 02 — Un script qui mesure une banque

**Statut :** ⬜ prêt

**Bloqué par :** aucun, peut démarrer tout de suite

## Ce qu'il faut obtenir

`npm run banque <dossier>` imprime, pour chaque fichier d'une banque, de quoi
remplir un profil : les **régimes d'ancrage** candidats et le **gain** à écrire.

C'est le ticket qui fait gagner une soirée. Le lot RELIEF a établi que la
compensation doit vivre dans le gain de chaque couche, au déficit près — mesuré
sur `procar`, 9,6 dB pour la prise « pied levé » basse et 6,5 dB pour la haute.
Ces deux nombres ont été relevés à la main. Sans outil, chaque banque nouvelle
demande le même relevé, et l'oreille s'y trompe : un écart de 3 dB ne s'entend
pas comme un écart, il s'entend comme un mauvais réglage ailleurs.

Ce que le script doit rendre, fichier par fichier :

- la **durée**, la fréquence d'échantillonnage, le nombre de canaux ;
- le **niveau efficace**, et l'écart en décibels avec la prise la plus forte de
  la banque — d'où le gain proposé ;
- les **régimes d'ancrage candidats**, classés, avec leur score relatif ;
- la **discontinuité de boucle**, pour repérer une prise qui claquera.

Le script mesure, il ne décide pas : l'analyse rend plusieurs candidats parce
que l'ambiguïté d'octave n'est pas tranchable par un critère spectral, et il ne
prétendra pas le contraire. C'est un humain qui recopie, à l'oreille s'il n'est
pas d'accord.

Les gains sont **relatifs à la prise la plus forte** de la banque : c'est
l'écart entre les couches qui compte, le niveau d'ensemble étant réglé par le
volume général et le relief.

L'analyse existe déjà et est couverte : `analyzeSample` rend ancrages, raccord
et timbre. `ffmpeg` est déjà l'outil du dépôt. Le script assemble, il n'invente
pas d'algorithme.

## Critères d'acceptation

- [ ] `npm run banque <dossier>` fonctionne sur un dossier local passé en
      argument — aucun échantillon n'entre dans le dépôt
- [ ] Il imprime, par fichier : durée, format, niveau, écart en dB, gain
      proposé, ancrages candidats, discontinuité de boucle
- [ ] Le gain proposé de la prise la plus forte vaut 1
- [ ] Lancé sur la banque livrée, il retrouve les valeurs connues : ancrages
      autour de 3128 et 8150 tr/min pour les prises en charge, écarts de 9,6 et
      6,5 dB pour les prises pied levé
- [ ] Un fichier illisible est signalé et n'interrompt pas le relevé
- [ ] Un dossier vide ou absent donne un message clair, pas une trace
