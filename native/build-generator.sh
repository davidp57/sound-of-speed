#!/usr/bin/env bash
# Compile le banc hors ligne qui enregistre une banque.
#
# Meme chaine et memes options que build-native.sh : ce qui compile pour la
# sonde compile pour le generateur, seul le fichier de tete change.
#
# Prealable : node prepare.mjs
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$HERE/.work/engine-sim"
SOLVER="$WORK/dependencies/submodules/simple-2d-constraint-solver"
BUILD="$HERE/.build"

if [ ! -d "$WORK" ]; then
    echo "Sources absentes. Lancer d'abord : node $HERE/prepare.mjs" >&2
    exit 1
fi

CXX="${CXX:-g++}"
CXXFLAGS="${CXXFLAGS:--std=c++17 -O2 -DNDEBUG -w}"
INCLUDES="-I$WORK/include -I$WORK/dependencies/submodules -I$SOLVER/include"

mkdir -p "$BUILD"

# La liste des .cpp du coeur se relit dans le CMakeLists plutot que de se
# recopier ici : une liste figee se desynchroniserait de la revision epinglee.
mapfile -t CORE < <(
    sed -n '/add_library(engine-sim STATIC/,/^)/p' "$WORK/CMakeLists.txt" \
    | grep -o 'src/[a-z_0-9]*\.cpp'
)

SOURCES=()
for f in "${CORE[@]}"; do SOURCES+=("$WORK/$f"); done
for f in "$SOLVER"/src/*.cpp; do SOURCES+=("$f"); done
SOURCES+=("$HERE/generator.cpp")

echo "Compilation de ${#SOURCES[@]} fichiers ($CXX, $CXXFLAGS)"

OBJECTS=()
failed=0
for src in "${SOURCES[@]}"; do
    # Meme convention de nommage que la sonde : les objets du coeur sont donc
    # partages entre les deux binaires, et la seconde compilation est rapide.
    obj="$BUILD/$(echo "$src" | md5sum | cut -c1-8)-$(basename "$src" .cpp).o"
    if [ ! -f "$obj" ] || [ "$src" -nt "$obj" ]; then
        if ! "$CXX" $CXXFLAGS $INCLUDES -c "$src" -o "$obj"; then
            echo "ECHEC : $src" >&2
            failed=1
        fi
    fi
    OBJECTS+=("$obj")
done

if [ "$failed" -ne 0 ]; then
    echo "Compilation en echec." >&2
    exit 1
fi

"$CXX" "${OBJECTS[@]}" -o "$BUILD/generate-bank.exe"
echo "Produit : $BUILD/generate-bank.exe"
