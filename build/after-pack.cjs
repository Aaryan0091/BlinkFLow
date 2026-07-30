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

module.exports = async function lockElectronFuses(context) {
  await flipFuses(getElectronBinaryPath(context), {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: context.electronPlatformName === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: true,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.WasmTrapHandlers]: true,
  })
}
