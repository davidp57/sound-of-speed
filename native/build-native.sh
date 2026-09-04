#!/usr/bin/env bash
# Compile le coeur d'engine-sim en natif, avec g++, et produit la sonde.
#
# Sert de preuve que la preparation marche : si ca compile et que ca tourne
# ici, le passage a Emscripten ne portera plus que sur la chaine de
# compilation, pas sur les sources.
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

# Les 41 .cpp du coeur, tels que le CMakeLists d'engine-sim les declare dans
# add_library(engine-sim STATIC ...). On les relit plutot que de les recopier :
# une liste figee ici se desynchroniserait de la revision epinglee.
mapfile -t CORE < <(
    sed -n '/add_library(engine-sim STATIC/,/^)/p' "$WORK/CMakeLists.txt" \
    | grep -o 'src/[a-z_0-9]*\.cpp'
)

SOURCES=()
for f in "${CORE[@]}"; do SOURCES+=("$WORK/$f"); done
for f in "$SOLVER"/src/*.cpp; do SOURCES+=("$f"); done
SOURCES+=("$HERE/probe.cpp")

echo "Compilation de ${#SOURCES[@]} fichiers ($CXX, $CXXFLAGS)"

OBJECTS=()
failed=0
for src in "${SOURCES[@]}"; do
    obj="$BUILD/$(echo "$src" | md5sum | cut -c1-8)-$(basename "$src" .cpp).o"
    if ! "$CXX" $CXXFLAGS $INCLUDES -c "$src" -o "$obj"; then
        echo "ECHEC : $src" >&2
        failed=1
    fi
    OBJECTS+=("$obj")
done

if [ "$failed" -ne 0 ]; then
    echo "Compilation en echec." >&2
    exit 1
fi

"$CXX" "${OBJECTS[@]}" -o "$BUILD/probe.exe"
echo "Produit : $BUILD/probe.exe"
echo
"$BUILD/probe.exe" "${1:-1.0}"
