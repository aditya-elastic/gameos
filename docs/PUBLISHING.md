# Publishing Game OS CLI

## npm

```bash
npm ci
npm run check
npm run homebrew:audit
npm run homebrew:update -- 0.6.0 --check
npm pack --dry-run
npm pack
npm install -g ./gameos-*.tgz
gameos doctor
npm publish
```

Use npm trusted publishing from GitHub Actions for provenance-backed releases. Configure the npm package trusted publisher for:

- package: `gameos`
- owner: `aditya-elastic`
- repository: `gameos`
- workflow: `.github/workflows/release.yml`

The release workflow has `id-token: write`, runs `npm run check`, proves the packed tarball installs, blocks duplicate versions, then runs `npm publish`. Current npm trusted publishing generates provenance automatically when configured for the package and workflow.

Fallback: add an `NPM_TOKEN` repository secret with publish rights. The workflow will use it when present. Local manual publishing requires npm OTP when 2FA is enabled:

```bash
npm publish --otp <one-time-code>
```

The public package is `gameos`, which installs the `gameos` binary.

## Homebrew

The Homebrew formula lives at `Formula/gameos.rb` in this repo and should be copied to the tap repo at `github.com/aditya-elastic/homebrew-gameos`.

`Formula/gameos.rb` must track the latest version already published on npm. Do not update it to the local package version until the npm tarball exists. Run:

```bash
npm run homebrew:audit
```

If the audit reports `pendingFormulaUpdate`, publish that npm version first, then update the formula URL/SHA with the deterministic updater.

After npm publish, update the tap formula:

```bash
VERSION="$(node -p "require('./package.json').version")"
npm run homebrew:update -- "$VERSION"
npm run homebrew:update -- "$VERSION" --check
npm run homebrew:audit
brew tap aditya-elastic/gameos
brew install gameos
brew test gameos
brew audit --strict gameos
```

The formula URL should point at the published npm tarball for the same version.
