const path = require('node:path');

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') {
    return;
  }

  const { rcedit } = await import('rcedit');
  const { appInfo } = context.packager;
  const exePath = path.join(context.appOutDir, `${appInfo.productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'assets', 'icon.ico');

  const versionStrings = {
    FileDescription: appInfo.productName,
    ProductName: appInfo.productName,
    OriginalFilename: `${appInfo.productFilename}.exe`
  };

  if (appInfo.companyName) {
    versionStrings.CompanyName = appInfo.companyName;
  }

  if (appInfo.copyright) {
    versionStrings.LegalCopyright = appInfo.copyright;
  }

  await rcedit(exePath, {
    icon: iconPath,
    'file-version': appInfo.shortVersion || appInfo.buildVersion,
    'product-version': appInfo.shortVersionWindows || appInfo.getVersionInWeirdWindowsForm(),
    'requested-execution-level': 'asInvoker',
    'version-string': versionStrings
  });
};
