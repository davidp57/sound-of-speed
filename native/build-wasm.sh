#!/usr/bin/env bash
# Compile le coeur d'engine-sim en WebAssembly, et fait tourner la sonde.
#
# Meme liste de fichiers que la compilation native, meme sources, meme patchs :
# seule la chaine de compilation change. C'est ce qui permet de comparer les
# deux chiffres sans se demander si l'on mesure la meme chose.
#
# La sonde tourne sous Node, qui emploie le meme moteur WebAssembly que Chrome.
# Ce n'est pas le navigateur de la voiture, mais c'est le meme compilateur, et
# cela evite de dependre d'un navigateur pour obtenir un ordre de grandeur.
#
# Prealables : node prepare.mjs, et emsdk installe dans ~/emsdk
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$HERE/.work/engine-sim"
SOLVER="$WORK/dependencies/submodules/simple-2d-constraint-solver"
BUILD="$HERE/.build/wasm"

if [ ! -d "$WORK" ]; then
    echo "Sources absentes. Lancer d'abord : node $HERE/prepare.mjs" >&2
    exit 1
fi

EMSDK="${EMSDK:-$HOME/emsdk}"
export PATH="$EMSDK:$EMSDK/upstream/emscripten:$PATH"
if ! command -v em++ >/dev/null; then
    echo "em++ introuvable. Installer emsdk, ou donner EMSDK=<chemin>." >&2
    exit 1
fi

mkdir -p "$BUILD"

mapfile -t CORE < <(
    sed -n '/add_library(engine-sim STATIC/,/^)/p' "$WORK/CMakeLists.txt" \
    | grep -o 'src/[a-z_0-9]*\.cpp'
)

SOURCES=()
for f in "${CORE[@]}"; do SOURCES+=("$WORK/$f"); done
for f in "$SOLVER"/src/*.cpp; do SOURCES+=("$f"); done
SOURCES+=("$HERE/probe.cpp")

INCLUDES="-I$WORK/include -I$WORK/dependencies/submodules -I$SOLVER/include"
# -O2 comme la compilation native : comparer deux niveaux d'optimisation
# differents ne dirait rien du surcout de WebAssembly.
CXXFLAGS="-std=c++17 -O2 -DNDEBUG -w"

echo "Compilation de ${#SOURCES[@]} fichiers en WebAssembly"
em++ $CXXFLAGS $INCLUDES "${SOURCES[@]}" \
    -sENVIRONMENT=node,web \
    -sALLOW_MEMORY_GROWTH \
    -sINITIAL_MEMORY=134217728 \
    -sMODULARIZE -sEXPORT_ES6 \
    -sEXPORTED_RUNTIME_METHODS=callMain,ccall,cwrap \
    -sEXPORTED_FUNCTIONS=_main,_bench_create,_bench_dispose,_bench_simulate,_bench_synthesize,_bench_run,_bench_rpm,_bench_impulse_samples \
    -sINVOKE_RUN=0 \
    -o "$BUILD/probe.mjs"

echo "Produit : $BUILD/probe.wasm ($(stat -c%s "$BUILD/probe.wasm" 2>/dev/null || stat -f%z "$BUILD/probe.wasm") octets)"
echo

cat > "$BUILD/run.mjs" <<'EOF'
import init from './probe.mjs'
const M = await init({ noInitialRun: true })
M.callMain([process.argv[2] ?? '1.0'])
EOF

node "$BUILD/run.mjs" "${1:-1.0}"
