import * as vscode from "vscode";
import { performGet } from "./RESTClient";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import {
  VSCODE_ASSETS_URL,
  isCodeServer,
  BACKGROUND_ASSETS_URL,
  isWSL,
  workbenchDirectory,
  WALLPAPER_ASSETS_URL,
} from "./ENV";
import { DokiStickers } from "./StickerService";
import { Sticker } from "./extension";

export const attemptToUpdateSticker = async (
  context: vscode.ExtensionContext,
  currentSticker: Sticker
): Promise<DokiStickers> => {
  const remoteStickerUrl = `${VSCODE_ASSETS_URL}${stickerPathToUrl(
    currentSticker
  )}`;
  const remoteWallpaperUrl = `${WALLPAPER_ASSETS_URL}${wallpaperPathToUrl(
    currentSticker
  )}`;
  const remoteBackgroundUrl = `${BACKGROUND_ASSETS_URL}${wallpaperPathToUrl(
    currentSticker
  )}`;
  if (isCodeServer()) {
    return {
      stickerDataURL: remoteStickerUrl,
      backgroundImageURL: remoteBackgroundUrl,
      wallpaperImageURL: remoteWallpaperUrl,
      backgroundAnchoring: currentSticker.anchoring,
    };
  }

  const localStickerPath = resolveLocalStickerPath(currentSticker, context);
  const localWallpaperPath = resolveLocalWallpaperPath(currentSticker, context);
  const localBackgroundPath = resolveLocalBackgroundPath(
    currentSticker,
    context
  );
  await Promise.all([
    attemptToUpdateAsset(remoteStickerUrl, localStickerPath, context),
    attemptToUpdateAsset(remoteWallpaperUrl, localWallpaperPath, context),
    attemptToUpdateAsset(remoteBackgroundUrl, localBackgroundPath, context),
  ]);

  return {
    stickerDataURL: createCssDokiAssetUrl(localStickerPath),
    backgroundImageURL: createCssDokiAssetUrl(localBackgroundPath),
    wallpaperImageURL: createCssDokiAssetUrl(localWallpaperPath),
    backgroundAnchoring: currentSticker.anchoring,
  };
};

async function attemptToUpdateAsset(
  remoteStickerUrl: string,
  localStickerPath: string,
  context: vscode.ExtensionContext
) {
  if (hasCheckedToday(remoteStickerUrl, context)) { return false; }

  if (await shouldDownloadNewAsset(remoteStickerUrl, localStickerPath)) {
    await installAsset(remoteStickerUrl, localStickerPath);
  }
}

const fetchRemoteChecksum = async (remoteAssetUrl: string) => {
  const checksumUrl = `${remoteAssetUrl}.checksum.txt`;
  console.log(`Fetching resource checksum: ${checksumUrl}`);
  const checkSumInputStream = await performGet(checksumUrl);
  return checkSumInputStream.setEncoding("utf8").read();
};

const resolveLocalStickerPath = (
  currentSticker: Sticker,
  context: vscode.ExtensionContext
): string => {
  const safeStickerPath = stickerPathToUrl(currentSticker);
  return path.join(getStoragePath(context), "stickers", safeStickerPath);
};

function getWSLStoragePath(): string {
  const appDataDirectory = "AppData";
  const userAppDataIndex = workbenchDirectory.indexOf(appDataDirectory);
  if (userAppDataIndex > -1) {
    const windowsGlobalStorageDirectory = path.resolve(
      workbenchDirectory.substring(
        0,
        userAppDataIndex + appDataDirectory.length
      ),
      "Roaming",
      "Code",
      "User",
      "globalStorage",
      "unthrottled.doki-theme"
    );
    try {
      if (!fs.existsSync(windowsGlobalStorageDirectory)) {
        fs.mkdirSync(windowsGlobalStorageDirectory, { recursive: true });
      }
      return windowsGlobalStorageDirectory;
    } catch (e) {
      console.error("Unable to create roaming directory", e);
    }
  }
  throw Error("Unable to set up WSL asset directory!");
}

function getStoragePath(context: vscode.ExtensionContext) {
  return isWSL() ? getWSLStoragePath() : context.globalStoragePath;
}

const resolveLocalWallpaperPath = (
  currentSticker: Sticker,
  context: vscode.ExtensionContext
): string => {
  const safeStickerPath = wallpaperPathToUrl(currentSticker);
  return path.join(getStoragePath(context), "wallpapers", safeStickerPath);
};
const resolveLocalBackgroundPath = (
  currentSticker: Sticker,
  context: vscode.ExtensionContext
): string => {
  const safeStickerPath = wallpaperPathToUrl(currentSticker);
  return path.join(getStoragePath(context), "backgrounds", safeStickerPath);
};

const createCssDokiAssetUrl = (localAssetPath: string): string => {
  return `file://${cleanPathToUrl(localAssetPath)}`;
};

function cleanPathToUrl(stickerPath: string) {
  const scrubbedUrl = stickerPath.replace(/\\/g, "/");
  return isWSL() ? scrubbedUrl.replace("/mnt/c", "c:") : scrubbedUrl;
}

function stickerPathToUrl(currentSticker: Sticker) {
  const stickerPath = currentSticker.path;
  return cleanPathToUrl(stickerPath);
}

function wallpaperPathToUrl(currentSticker: Sticker) {
  const stickerPath = `/${currentSticker.name}`;
  return cleanPathToUrl(stickerPath);
}

function createChecksum(data: Buffer | string): string {
  return crypto.createHash("md5").update(data).digest("hex");
}

const calculateFileChecksum = (filePath: string): string => {
  const fileRead = fs.readFileSync(filePath);
  return createChecksum(fileRead);
};

const fetchLocalChecksum = async (localSticker: string) => {
  return fs.existsSync(localSticker)
    ? calculateFileChecksum(localSticker)
    : "File not downloaded, bruv.";
};

const shouldDownloadNewAsset = async (
  remoteAssetUrl: string,
  localStickerPath: string
): Promise<boolean> => {
  try {
    const remoteChecksum = await fetchRemoteChecksum(remoteAssetUrl);
    const localChecksum = await fetchLocalChecksum(localStickerPath);
    return remoteChecksum !== localChecksum;
  } catch (e) {
    console.error("Unable to check for updates", e);
    return false;
  }
};

const downloadRemoteAsset = async (
  remoteAssetUrl: string,
  localDestination: string
) => {
  const parentDirectory = path.dirname(localDestination);
  if (!fs.existsSync(parentDirectory)) {
    fs.mkdirSync(parentDirectory, { recursive: true });
  }
  console.log(`Downloading remote asset: ${remoteAssetUrl}`);
  const stickerInputStream = await performGet(remoteAssetUrl);
  console.log("Remote asset Downloaded!");
  fs.writeFileSync(localDestination, stickerInputStream.read());
};

async function installAsset(
  remoteAssetUrl: string,
  localAssetPath: string
): Promise<boolean> {
  try {
    await downloadRemoteAsset(remoteAssetUrl, localAssetPath);
    return true;
  } catch (e) {
    console.error(`Unable to install asset ${remoteAssetUrl}!`, e);
  }
  return false;
}

const DAY_IN_MILLIS = 24 * 60 * 60 * 1000;

function hasCheckedToday(
  remoteAssetUrl: string,
  context: vscode.ExtensionContext
): boolean {
  const assetCheckKey = `check.${remoteAssetUrl}`;
  const checkDate = context.globalState.get(assetCheckKey) as number | undefined;
  const meow = new Date().valueOf();
  if(!checkDate) {
    context.globalState.update(assetCheckKey, meow);
    return false;
  } else if ((meow - checkDate) >= DAY_IN_MILLIS) {
    context.globalState.update(assetCheckKey, meow);
    return false;
  } else {
    return true;
  }
}
