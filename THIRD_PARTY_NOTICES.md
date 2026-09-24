# Third-party notices

Application code is licensed under the [MIT license](LICENSE). The bundled fonts
have separate SIL Open Font License 1.1 terms; the application's MIT license does
not replace them.

| Font | Bundled asset | Copyright | Full license |
|---|---|---|---|
| Inter | `fonts/inter-latin.woff2` | Copyright (c) 2016 The Inter Project Authors | [Inter OFL](public/licenses/Inter-OFL.txt) |
| JetBrains Mono | `fonts/jetbrains-mono-latin.woff2` | Copyright 2020 The JetBrains Mono Project Authors | [JetBrains Mono OFL](public/licenses/JetBrainsMono-OFL.txt) |

License files were fetched unchanged on September 19, 2026 from the upstream
[Inter license](https://raw.githubusercontent.com/rsms/inter/master/LICENSE.txt)
and [JetBrains Mono license](https://raw.githubusercontent.com/JetBrains/JetBrainsMono/master/OFL.txt).
Each includes the full upstream copyright notice and OFL text. Vite copies
`public/licenses/` into `licenses/` in both build outputs; retain that directory
when distributing either build.

The Nightmare puzzle bank draws from Gordon Royle's published 49,158-puzzle
17-clue catalogue. The solver follows Peter Norvig's constraint-propagation
approach. These acknowledgments do not assert that third-party material is
relicensed under the application's MIT license.

The optional API's runtime packages carry their own licenses in the installed
packages. The frontend has no runtime package dependencies; its build and test
tools have their own licenses.
