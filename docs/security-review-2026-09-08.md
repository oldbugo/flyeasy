# FlyEasy dependency review — 8 September 2026

Reviewed the installed lockfile with `npm audit --json`, relevant application code, and upstream advisories. This is a dependency triage, not an exploitation test or a complete security audit. No dependency versions were changed.

## Findings

The audit reports **27 affected dependency packages: 1 critical, 23 high, 1 moderate, 2 low**. These are package-level counts; transitive findings can propagate to multiple parent packages. They do not mean 27 independently exploitable application flaws.

| Priority | Installed package | Assessment and remediation |
| --- | --- | --- |
| First | Next.js 16.1.6 | FlyEasy uses App Router and Server Actions. The null-origin CSRF bypass and Server Action denial-of-service advisories are relevant attack surfaces. Localhost binding reduces network exposure but is not a substitute for patching browser-origin issues. Upgrade to a patched stable 16.x release covering the full current audit, align eslint-config-next, and rerun build and UI/search checks. |
| First | Electron 41.0.2 | This is the shipped desktop runtime despite being a devDependency. The preload exposes a Promise-returning contextBridge function. The context-isolation advisory requires untrusted content in that window; ordinary local UI loading alone does not demonstrate exploitation. Update to a patched 41.x release covering all current advisories, then verify desktop startup, preload and packaging. |
| Next | Drizzle ORM 0.33.0 | SQL-identifier escaping is affected before 0.45.2. The inspected queries use static schema columns; no sql.identifier or dynamic .as calls were found. Schema sql.raw calls build fixed enum constraints. Exploitability was not established. Upgrade to at least 0.45.2 with migration/query verification; npm flags this as outside the declared compatible range. |
| Next | tar 7.5.13 (critical) | Reached through @electron/rebuild, node-gyp, cacache and app-builder-lib. Malicious archive processing can exhaust resources. This is build/install tooling, not an observed flight-search input path. Update the build dependency tree; 7.5.19 fixes the critical advisory alone, but the current audit also flags later issues through 7.5.20. |
| Next | electron-builder 26.8.1 and related helpers | Includes archive handling and redirect credential-leak advisories. The AppImage-specific issue does not directly apply to the configured Windows NSIS target. Upgrade the compatible build toolchain before producing another release. |
| Next | sharp 0.34.5; PostCSS 8.5.8 and Next's nested PostCSS | Image-parser and CSS/source-map issues. No next/image import was found in app source, reducing the obvious image input surface; this does not establish that every route is unreachable. Update along with Next and the CSS toolchain. |

Remaining flagged packages: @babel/core, @humanfs/node, @xmldom/xmldom, brace-expansion, browserslist, builder-util, builder-util-runtime, dmg-builder, electron-builder-squirrel-windows, electron-publish, extract-zip, flatted, form-data, ip-address, js-yaml, nanoid, picomatch, postcss-selector-parser, tmp. Most are transitive build/lint/packaging dependencies; review the resulting lockfile and audit after compatible updates. npm reports fixes available for all flagged packages; this does not guarantee one update command will resolve all findings without compatibility work.

## Evidence and limits

- `src/desktop/main/main.mjs`: packaged server binds to 127.0.0.1; BrowserWindow uses contextIsolation true and nodeIntegration false.
- `src/desktop/preload/preload.mjs`: quitApp wraps ipcRenderer.invoke.
- `src/app/**/actions.ts`: Server Actions are used by the application.
- The development server script uses Next defaults; the server used for this test was explicitly bound to 127.0.0.1.
- No exploit payloads were executed. Vulnerability upgrades were not part of this review.

## Sources

- [Next.js Server Actions CSRF advisory](https://github.com/advisories/GHSA-mq59-m269-xvcx)
- [Next.js Server Actions denial of service](https://github.com/advisories/GHSA-m99w-x7hq-7vfj)
- [Electron context isolation advisory](https://github.com/advisories/GHSA-h7rp-cf8h-j98x)
- [Drizzle identifier escaping advisory](https://github.com/advisories/GHSA-gpj5-g38j-94v9)
- [node-tar critical decompression advisory](https://github.com/advisories/GHSA-23hp-3jrh-7fpw)
- [Build helper credential redirect advisory](https://github.com/advisories/GHSA-p2f4-r6v6-j797)
