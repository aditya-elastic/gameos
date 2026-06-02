# Publishing Game OS CLI

## npm

```bash
npm ci
npm run check
npm pack --dry-run
npm pack
npm install -g ./gameos-*.tgz
gameos doctor
npm publish
```

Use npm trusted publishing from GitHub Actions for provenance-backed releases with `npm publish --provenance`. Local manual publishing cannot generate provenance, so use plain `npm publish` when publishing from a maintainer shell. The public package is `gameos`, which installs the `gameos` binary.

## Homebrew

The Homebrew formula lives at `Formula/gameos.rb` in this repo and should be copied to the tap repo at `github.com/aditya-elastic/homebrew-gameos`.

Release checklist:

```bash
npm pack
shasum -a 256 gameos-*.tgz
brew tap aditya-elastic/gameos
brew install gameos
brew install aditya-elastic/gameos/gameos@0.1.0
brew test gameos
brew audit --strict gameos
```

The formula URL should point at the published npm tarball for the same version.
