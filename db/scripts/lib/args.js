// db/scripts/lib/args.js
// Minimal, dependency-free CLI parser for the ops scripts. Supports boolean flags
// (--apply), valued flags (--months 3 / --by=total), and a --help screen.
'use strict';

function parse(argv = process.argv.slice(2)) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) { flags[a.slice(2, eq)] = a.slice(eq + 1); continue; }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { flags[key] = next; i++; }
      else flags[key] = true;
    } else positional.push(a);
  }
  return {
    positional,
    has: (k) => k in flags,
    get: (k, d) => (k in flags ? String(flags[k]) : d),
    int: (k, d) => (k in flags ? parseInt(String(flags[k]), 10) : d),
    bool: (k) => flags[k] === true || flags[k] === 'true',
    all: flags,
  };
}

function helpAndExit(text) { process.stdout.write(text.trimStart() + '\n'); process.exit(0); }

module.exports = { parse, helpAndExit };
