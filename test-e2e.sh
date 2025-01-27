#!/usr/bin/env sh

if [ "$1" = "local" ]
then
  onlyChangedArg="--onlyChanged"
elif [ "$1" = "ci" ]
then
  onlyChangedArg=""
else
  echo "Argument must be either 'ci' or 'local'"
  exit 1;
fi

pnpm "jest:$1" --runInBand --projects \
  "apps/rest-api/test/jest-e2e.json" \
  || exit 1
