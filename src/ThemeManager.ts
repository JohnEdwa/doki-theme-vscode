import * as vscode from "vscode";
import { DokiSticker, DokiTheme, StickerType } from "./DokiTheme";
import {
  InstallStatus,
  installStickers,
  installWallPaper,
  removeStickers,
} from "./StickerService";
import { VSCodeGlobals } from "./VSCodeGlobals";
import { StatusBarComponent } from "./StatusBar";
import {
  showStickerInstallationSupportWindow,
  showStickerRemovalSupportWindow,
} from "./SupportService";
import DokiThemeDefinitions from "./DokiThemeDefinitions";
import { DokiThemeDefinition, Sticker } from "./extension";

export const ACTIVE_THEME = "doki.theme.active";

export const ACTIVE_STICKER = "doki.sticker.active";

const FIRST_TIME_STICKER_INSTALL = "doki.sticker.first.install";

const createCulturedInstall = (themeId: string): string =>
  `doki.cultured.${themeId}`;

const CULTURED_STICKER_INSTALL = createCulturedInstall(
  "ea9a13f6-fa7f-46a4-ba6e-6cefe1f55160_test"
);

function isFirstTimeInstalling(context: vscode.ExtensionContext) {
  return !context.globalState.get(FIRST_TIME_STICKER_INSTALL);
}

async function conditionalInstall(
  storageKey: string,
  actionText: string,
  messageBody: string,
  installAsset: () => Promise<InstallStatus>,
  context: vscode.ExtensionContext
): Promise<InstallStatus> {
  const result = await vscode.window.showWarningMessage(
    messageBody,
    {
      modal: true,
    },
    {
      title: actionText,
      isCloseAffordance: false,
    }
  );

  if (result && result.title === actionText) {
    context.globalState.update(storageKey, true);
    return installAsset();
  } else {
    return InstallStatus.NOT_INSTALLED;
  }
}

async function attemptToInstallAsset(
  context: vscode.ExtensionContext,
  sticker: Sticker,
  installAsset: () => Promise<InstallStatus>
): Promise<InstallStatus> {
  if (isCultured(context, sticker)) {
    const storageKey = CULTURED_STICKER_INSTALL;
    const actionText = "Yes, Please!";
    const messageBody = `You are about to install sexually suggestive content. Are you sure you want to continue? I won't show you this message again in the future if you choose to install.`;
    return conditionalInstall(
      storageKey,
      actionText,
      messageBody,
      installAsset,
      context
    );
  } else if (isFirstTimeInstalling(context)) {
    const actionText = "Install Theme Assets";
    const messageBody = `Installing theme assets requires me to corrupt VS-Code by modifying CSS. You will have to use the "Remove Sticker/Background" command to restore VS Code back to supported status before unistalling. I won't show you this message again in the future if you choose to install.`;
    return conditionalInstall(
      FIRST_TIME_STICKER_INSTALL,
      actionText,
      messageBody,
      installAsset,
      context
    );
  } else {
    return installAsset();
  }
}

async function attemptToInstallSticker(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<InstallStatus> {
  return attemptToInstallAsset(context, sticker, () =>
    performStickerInstall(sticker, context)
  );
}

async function attemptToInstallWallpaper(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<InstallStatus> {
  return attemptToInstallAsset(context, sticker, () =>
    performWallpaperInstall(sticker, context)
  );
}

function getInstallStatus(installResult: boolean) {
  return installResult ? InstallStatus.INSTALLED : InstallStatus.FAILURE;
}

async function performStickerInstall(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<InstallStatus> {
  const installResult = await installStickers(sticker, context);
  return getInstallStatus(installResult);
}

async function performWallpaperInstall(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<InstallStatus> {
  const installResult = await installWallPaper(sticker, context);
  return getInstallStatus(installResult);
}

export function activateThemeSticker(
  dokiTheme: DokiTheme,
  currentSticker: DokiSticker,
  context: vscode.ExtensionContext
) {
  return activateThemeAsset(
    dokiTheme,
    currentSticker,
    context,
    "Sticker",
    (sticker) => attemptToInstallSticker(sticker, context)
  );
}

export function activateThemeWallpaper(
  dokiTheme: DokiTheme,
  currentSticker: DokiSticker,
  context: vscode.ExtensionContext
) {
  return activateThemeAsset(
    dokiTheme,
    currentSticker,
    context,
    "Wallpaper",
    (sticker) => attemptToInstallWallpaper(sticker, context)
  );
}

export function activateThemeAsset(
  dokiTheme: DokiTheme,
  currentSticker: DokiSticker,
  context: vscode.ExtensionContext,
  assetType: string,
  installer: (sticker: Sticker) => Promise<InstallStatus>
) {
  vscode.window.showInformationMessage(
    `Please wait, installing ${dokiTheme.name}'s ${assetType}.`
  );
  installer(currentSticker.sticker).then((didInstall) => {
    if (didInstall === InstallStatus.INSTALLED) {
      VSCodeGlobals.globalState.update(ACTIVE_THEME, dokiTheme.id);
      VSCodeGlobals.globalState.update(ACTIVE_STICKER, currentSticker.type);
      StatusBarComponent.setText(dokiTheme.displayName);
      vscode.window
        .showInformationMessage(
          `${dokiTheme.name}'s ${assetType} installed!\n Please restart your VSCode`,
          { title: "Restart VSCode" }
        )
        .then((item) => {
          if (item) {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        });
    } else if (didInstall === InstallStatus.FAILURE) {
      showStickerInstallationSupportWindow(context);
      vscode.window.showErrorMessage(
        `Unable to install ${dokiTheme.name}, please see active tab for more information.`
      );
    }
  });
}

// :(
export function uninstallImages(context: vscode.ExtensionContext) {
  const stickersRemoved = removeStickers();
  if (
    stickersRemoved === InstallStatus.INSTALLED ||
    stickersRemoved === InstallStatus.NOT_INSTALLED
  ) {
    vscode.window
      .showInformationMessage(
        `Removed Images. Please restart your restored IDE`,
        { title: "Restart VSCode" }
      )
      .then((item) => {
        if (item) {
          vscode.commands.executeCommand("workbench.action.reloadWindow");
        }
      });
  } else if (stickersRemoved === InstallStatus.FAILURE) {
    showStickerRemovalSupportWindow(context);
    vscode.window.showErrorMessage(
      `Unable to remove stickers/background, please see active tab for more information.`
    );
  }
}

export const getCurrentThemeAndSticker = (): {
  theme: DokiTheme;
  sticker: DokiSticker;
} => {
  const currentThemeId = VSCodeGlobals.globalState.get(ACTIVE_THEME);
  const dokiThemeDefinition =
    DokiThemeDefinitions.find(
      (dokiDefinition) =>
        dokiDefinition.themeDefinition.information.id === currentThemeId
    ) || DokiThemeDefinitions[0];
  const currentStickerType =
    (VSCodeGlobals.globalState.get(ACTIVE_STICKER) as StickerType) ||
    StickerType.DEFAULT;
  return {
    theme: new DokiTheme(dokiThemeDefinition.themeDefinition),
    sticker: {
      type: currentStickerType,
      sticker: getSticker(
        dokiThemeDefinition.themeDefinition,
        currentStickerType
      ),
    },
  };
};

export function getSticker(
  dokiThemeDefinition: DokiThemeDefinition,
  stickerType: StickerType
) {
  const defaultSticker = dokiThemeDefinition.stickers.default;
  return StickerType.SECONDARY === stickerType
    ? dokiThemeDefinition.stickers.secondary || defaultSticker
    : defaultSticker;
}
function isCultured(
  context: vscode.ExtensionContext,
  sticker: Sticker
): boolean {
  return (
    sticker.name.indexOf("rias_onyx_spicy.png") > -1 &&
    !context.globalState.get(CULTURED_STICKER_INSTALL)
  );
}
