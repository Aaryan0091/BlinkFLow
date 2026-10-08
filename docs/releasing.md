# Releasing BlinkFlow

BlinkFlow uses semantic versions in the form `MAJOR.MINOR.PATCH`:

- Increase **PATCH** for compatible fixes.
- Increase **MINOR** for compatible new features.
- Increase **MAJOR** for incompatible behavior or data-format changes.

The Git tag must match the version in `package.json`, prefixed with `v`. For
example, package version `1.1.0` uses tag `v1.1.0`.

## Release checklist

1. Confirm the working tree is clean and the intended commit is on `main`.
2. Update `version` in `package.json` and `package-lock.json` with:

   ```bash
   npm version 1.1.0 --no-git-tag-version
   ```

3. Run the complete verification suite:

   ```bash
   npm ci
   npm run check
   npm run test:native-overlays
   npm run audit:production
   ```

4. Commit the version change.
5. Create and push the matching tag:

   ```bash
   git tag v1.1.0
   git push origin main
   git push origin v1.1.0
   ```

6. The release workflow builds macOS, Windows, and Linux installers and creates
   a draft GitHub Release.
7. Download every artifact from the draft and manually test it on its target
   operating system.
8. Review the generated release notes and file names, then publish the draft.

## Expected files

- macOS: `BlinkFlow-<version>-mac-arm64.dmg` and `.zip`
- Windows: `BlinkFlow-<version>-win-x64.exe`
- Linux: `BlinkFlow-<version>-linux-x86_64.AppImage` and
  `BlinkFlow-<version>-linux-amd64.deb`

## Signing status

The workflow currently creates unsigned packages. Before presenting BlinkFlow
as a broadly trusted production download, configure:

- Apple Developer ID signing and notarization for macOS
- An Authenticode code-signing certificate for Windows

Keep signing certificates, passwords, and notarization credentials in GitHub
Actions secrets. Never store them in source files or commit them to Git.

## Failed releases

If packaging fails, do not reuse the version tag for a different commit. Fix
the problem, increase the patch version, and create a new tag. A draft Release
can be deleted safely before it is published.
