import * as vscode from "vscode";
import fs from "fs";
import {editorCss, editorCssCopy} from "./ENV";
import {attemptToUpdateSticker} from "./StickerUpdateService";
import {Sticker} from "./extension";

export enum InstallStatus {
  INSTALLED,
  NOT_INSTALLED,
  FAILURE,
}

const stickerComment = "/* Stickers */";
const wallpaperComment = "/* Background Image */";

const getStickerIndex = (currentCss: string) => currentCss.indexOf(stickerComment);
const getWallpaperIndex = (currentCss: string) => currentCss.indexOf(wallpaperComment);


function buildWallpaperCss({
                             backgroundImageURL: backgroundUrl,
                             wallpaperImageURL: wallpaperURL,
                             backgroundAnchoring,
                           }: DokiStickers): string {
  return `${wallpaperComment}
  [id="workbench.parts.editor"] .split-view-view .editor-container .editor-instance>.monaco-editor .overflow-guard>.monaco-scrollable-element>.monaco-editor-background{background: none;}


  [id="workbench.parts.editor"] .split-view-view .editor-container .editor-instance>.monaco-editor  .overflow-guard>.monaco-scrollable-element::before,
  .overflow-guard,
  .monaco-select-box, 
  .minimap-decorations-layer,
  .xterm-cursor-layer,
  .monaco-workbench .part.editor>.content .editor-group-container>.title .tabs-breadcrumbs .breadcrumbs-control,
  .ref-tree, /* find usages */
  .head, /* find usages */
  .monaco-workbench .part.editor>.content .editor-group-container>.title .editor-actions,  
  .welcomePageFocusElement, /* welcome screen */
  .editor-group-container > .editor-container, /* Extension container */
  .terminal-outer-container, /* Terminal outer edge */
  /* glass explorer/sidebar/panel*/
  .activitybar,
  .sidebar,
  .panel,
  .tabs
  {
    background-image: url('${wallpaperURL}') !important;
    background-position: ${backgroundAnchoring} !important;
    background-attachment: fixed !important;
    background-repeat: no-repeat !important;
    background-size: cover !important;
  }

  /* Output panel*/
  .monaco-workbench .part.panel > .content .monaco-editor .monaco-editor-background,
  .overflow-guard > .margin > .margin-view-overlays, 
  .overflow-guard > .margin,
  .lines-content.monaco-editor-background, /* source control diff editor */
  /* Common Glass item transparency */
  .monaco-list,
  .monaco-list-rows,
  .monaco-list-row,
  /* Glass notifications */
  .notifications-toasts,
  .notification-toast-container,
  .notifications-list-container,
  .notification-list-item,
  .notification-list-item-buttons-container,
  .quick-input-list /* Glass quick task */
  {
    background-color: transparent !important;
  }


  /* For the "Show All Commands" etc text on the blank page. */
  .watermark > .watermark-box 
  {
    backdrop-filter: blur(5px) !important;
    background-color: rgba(44, 51, 51, 0.5) !important;
  }

  /* Global UI Glass Blur*/ 
  .settings-header,
  .settings-editor,
  .extension-editor,
  /* glass explorer/sidebar/panel*/
  .activitybar > .content,
  .sidebar > .content,
  .sidebar > .composite.title,
  .tabs-and-actions-container,
  .tabs-breadcrumbs > .breadcrumbs-control > .monaco-scrollable-element > .monaco-breadcrumbs
  {
    backdrop-filter: blur(3px) !important;
  }

  /* Setting page buttons */
  .setting-item-control > .monaco-select-box,
  .setting-item-control > .monaco-inputbox,
  .setting-list-new-row > .monaco-button
  {
    backdrop-filter: blur(3px) !important;
    background-color: rgba(45, 56, 57, 0.5) !important;
  }

  /* Glass notifications */  
  .notification-toast {
    backdrop-filter: blur(2px) !important;
    background-color: #53b0b45A !important;
  }

  .notification-list-item-buttons-container > .monaco-text-button,
  .quick-input-box > .monaco-inputbox	{
    backdrop-filter: blur(2px) !important;
    background-color: rgba(50, 55, 55, 0.5) !important;
  }

  /* Glass quick task */
  .quick-input-widget {
    backdrop-filter: blur(2px) !important;
    background-color: #53b0b45A !important;
  }

  /* glass explorer/sidebar/panel*/
  .pane > .pane-header {
    backdrop-filter: blur(3px) !important;
    background-color: rgba(41, 48, 48, 0.5) !important;
  }

  .tabs-container > .tab	 {		
    background-color: rgba(47, 54, 53, 0.5) !important;
  }



  .monaco-breadcrumbs {
    background-color: #00000000 !important;
  }

  [id="workbench.view.explorer"] .monaco-list-rows,
  [id="workbench.view.explorer"] .pane-header,
  [id="workbench.view.explorer"] .monaco-pane-view,
  [id="workbench.view.explorer"] .split-view-view,
  [id="workbench.view.explorer"] .monaco-tl-twistie,
  [id="workbench.view.explorer"] .monaco-icon-label-container,
  .explorer-folders-view > .monaco-list > .monaco-scrollable-element > .monaco-list-rows,
  .show-file-icons > .monaco-list > .monaco-scrollable-element > .monaco-list-rows,
  .extensions-list > .monaco-list > .monaco-scrollable-element > .monaco-list-rows
  {
    background-color: #00000000 !important;
    background-image: none !important;
    border: none !important;
  }

  .monaco-icon-label-container {
    background: none !important;
  }

  .monaco-workbench .part.editor > .content {
    background-image: url('${backgroundUrl}') !important;
    background-position: ${backgroundAnchoring};
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-size: cover;
    content:'';
    z-index:9001;
    width:100%;
    height:100%;
    opacity:1;
}
  `;
}

function buildStickerCss({
                           stickerDataURL: stickerUrl,
                         }: DokiStickers): string {
  const style =
    "content:'';pointer-events:none;position:absolute;z-index:9001;width:100%;height:100%;background-position:100% 97%;background-repeat:no-repeat;opacity:1;";
  return `
  ${stickerComment}
  body > .monaco-workbench > .monaco-grid-view > .monaco-grid-branch-node > .monaco-split-view2 > .split-view-container::after,
  body > .monaco-workbench > .monaco-grid-view > .monaco-grid-branch-node > .monaco-split-view2 > .monaco-scrollable-element > .split-view-container::after
  {background-image: url('${stickerUrl}');${style}}

  .notifications-toasts {
    z-index: 9002 !important;
  }
`;
}

function buildCSSWithStickers(dokiStickers: DokiStickers): string {
  return `${getStickerScrubbedCSS()}${buildStickerCss(dokiStickers)}`;
}

function buildCSSWithWallpaper(dokiStickers: DokiStickers): string {
  return `${getWallpaperScrubbedCSS()}${buildWallpaperCss(dokiStickers)}`;
}

function installEditorStyles(styles: string) {
  fs.writeFileSync(editorCss, styles, "utf-8");
}

function canWrite(): boolean {
  try {
    fs.accessSync(editorCss, fs.constants.W_OK);
    return true;
  } catch (error) {
    return false;
  }
}

export interface DokiStickers {
  stickerDataURL: string;
  backgroundImageURL: string;
  wallpaperImageURL: string;
  backgroundAnchoring: string;
}

export async function installStickers(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<boolean> {
  return installStyles(
    sticker,
    context,
    stickersAndWallpaper => buildCSSWithStickers(stickersAndWallpaper));
}

export async function installWallPaper(
  sticker: Sticker,
  context: vscode.ExtensionContext
): Promise<boolean> {
  return installStyles(
    sticker,
    context,
    stickersAndWallpaper => buildCSSWithWallpaper(stickersAndWallpaper));
}

async function installStyles(
  sticker: Sticker,
  context: vscode.ExtensionContext,
  cssDecorator: (assets: DokiStickers) => string
): Promise<boolean> {
  if (canWrite()) {
    try {
      const stickersAndWallpaper = await attemptToUpdateSticker(
        context,
        sticker
      );
      const stickerStyles = cssDecorator(stickersAndWallpaper);
      installEditorStyles(stickerStyles);
      return true;
    } catch (e) {
      console.error("Unable to install sticker!", e);
    }
  }

  return false;
}

function getScrubbedCSS() {
  const currentCss = fs.readFileSync(editorCss, "utf-8");
  const stickerIndex = getStickerIndex(currentCss);
  const trimmedCss = trimCss(currentCss, stickerIndex);
  return trimCss(trimmedCss, getWallpaperIndex(trimmedCss));
}

function scrubCssOfAsset(getAssetOneIndex: (currentCss: string) => number,
                         getAssetToRemoveIndex: (currentCss: string) => number) {
  const currentCss = fs.readFileSync(editorCss, "utf-8");
  const otherAssetIndex = getAssetOneIndex(currentCss);
  const assetToRemoveIndex = getAssetToRemoveIndex(currentCss);
  if (otherAssetIndex < 0) {
    return trimCss(currentCss, assetToRemoveIndex);
  } else if (assetToRemoveIndex > -1) {
    return currentCss.substring(0, assetToRemoveIndex) + (
      assetToRemoveIndex < otherAssetIndex ?
        '\n' + currentCss.substring(otherAssetIndex, currentCss.length) :
        ''
    );
  }
  return currentCss;
}

function getWallpaperScrubbedCSS() {
  return scrubCssOfAsset(
    getStickerIndex,
    getWallpaperIndex,
  );
}
function getStickerScrubbedCSS() {
  return scrubCssOfAsset(
    getWallpaperIndex,
    getStickerIndex,
  );
}

function trimCss(currentCss: string, index: number): string {
  if (index >= 0) {
    return currentCss.substr(0, index).trim();
  }
  return currentCss;
}

const scrubCSSFile = () => {
  const scrubbedCSS = getScrubbedCSS();
  fs.writeFileSync(editorCss, scrubbedCSS, "utf-8");
};

// :(
export function removeStickers(): InstallStatus {
  if (canWrite()) {
    try {
      if (fs.existsSync(editorCssCopy)) {
        fs.unlinkSync(editorCssCopy);
        scrubCSSFile();
        return InstallStatus.INSTALLED;
      }
      scrubCSSFile();
      return InstallStatus.NOT_INSTALLED;
    } catch (e) {
      console.error("Unable to remove stickers!", e);
      return InstallStatus.FAILURE;
    }
  }

  return InstallStatus.FAILURE;
}
