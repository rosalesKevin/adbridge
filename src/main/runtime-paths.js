'use strict';

const fs = require('node:fs');
const path = require('node:path');

function getToolCandidates({ toolName, execPath, resourcesPath, devBaseDir }) {
  const exeDir = path.dirname(execPath);

  return [
    path.join(exeDir, 'scrcpy', toolName),
    path.join(resourcesPath, 'scrcpy', toolName),
    path.join(devBaseDir, toolName)
  ];
}

function resolveToolPath({
  toolName,
  execPath,
  resourcesPath,
  devBaseDir,
  existsSync = fs.existsSync
}) {
  return getToolCandidates({ toolName, execPath, resourcesPath, devBaseDir }).find(existsSync) || null;
}

function buildMissingToolMessage({ toolName, expectedPath }) {
  return `${toolName} not found at: ${expectedPath}\n\nRun ADBridge from the extracted release folder and keep ADBridge.exe and the scrcpy folder together. If antivirus quarantined the file, restore it into the extracted app folder.`;
}

module.exports = {
  getToolCandidates,
  resolveToolPath,
  buildMissingToolMessage
};
