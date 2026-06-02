# Publishing Game OS CLI

## npm

```bash
npm ci
npm run check
npm run homebrew:audit
npm pack --dry-run
npm pack
npm install -g ./gameos-*.tgz
gameos doctor
npm publish
```

Use npm trusted publishing from GitHub Actions for provenance-backed releases. The release workflow has `id-token: write`, runs `npm run check`, proves the packed tarball installs, blocks duplicate versions, then runs `npm publish`. Current npm trusted publishing generates provenance automatically when configured for the package and workflow. Local manual publishing cannot generate trusted-publisher provenance, so use it only as a fallback.

The public package is `gameos`, which installs the `gameos` binary.

## Homebrew

The Homebrew formula lives at `Formula/gameos.rb` in this repo and should be copied to the tap repo at `github.com/aditya-elastic/homebrew-gameos`.

`Formula/gameos.rb` must track the latest version already published on npm. Do not update it to the local package version until the npm tarball exists. Run:

```bash
npm run homebrew:audit
```

If the audit reports `pendingFormulaUpdate`, publish that npm version first, then update the formula URL/SHA.

After npm publish, update the tap formula:

```bash
VERSION="$(node -p "require('./package.json').version")"
TARBALL_URL="$(npm view "gameos@$VERSION" dist.tarball)"
SHA256="$(curl -L "$TARBALL_URL" | shasum -a 256 | awk '{print $1}')"
echo "$TARBALL_URL"
echo "$SHA256"
brew tap aditya-elastic/gameos
brew install gameos
brew install aditya-elastic/gameos/gameos@"$VERSION"
brew test gameos
brew audit --strict gameos
```

The formula URL should point at the published npm tarball for the same version.
