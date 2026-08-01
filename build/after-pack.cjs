const path = require('node:path')
const {
  flipFuses,
  FuseVersion,
  FuseV1Options,
} = require('@electron/fuses')

function getElectronBinaryPath(context) {
  const productFilename = context.packager.appInfo.productFilename

  if (context.electronPlatformName === 'darwin') {
    return path.join(
      context.appOutDir,
      `${productFilename}.app`,
      'Contents',
      'MacOS',
      productFilename,
    )
  }

  if (context.electronPlatformName === 'win32') {
    return path.join(context.appOutDir, `${productFilename}.exe`)
  }

  return path.join(context.appOutDir, productFilename)
}

function createFuseConfig(context) {
  return {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: context.electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    // This requires a separately generated browser_v8_context_snapshot.bin.
    // Keep it disabled because BlinkFlow uses Electron's standard snapshot.
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    // BlinkFlow loads its packaged renderer and assets through file://.
    // Electron requires these privileges for that renderer architecture.
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
    [FuseV1Options.WasmTrapHandlers]: true,
  }
}

async function lockElectronFuses(context) {
  await flipFuses(
    getElectronBinaryPath(context),
    createFuseConfig(context),
  )
}

module.exports = lockElectronFuses
module.exports.createFuseConfig = createFuseConfig
