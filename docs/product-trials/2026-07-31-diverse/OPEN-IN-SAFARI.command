#!/bin/zsh

set -eu

gallery_directory="$(cd -- "$(dirname -- "$0")" && pwd)"

open -a Safari \
  "$gallery_directory/GALLERY.html" \
  "$gallery_directory/UML-GALLERY.html"
