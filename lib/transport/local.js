'use strict';

const fs       = require('fs');
const path     = require('path');

const AbstractTransport = require('./abstract');

class LocalTransport extends AbstractTransport {
  constructor(options) {
    super(options);
    if (!this.options.outPath) {
      this.options.outPath = 'dist/publish';
    }
  }

  /**
   * Upload file to a hosting and get its url
   * @abstract
   * @param {string} filePath
   * @param {object} build
   * @return {Promise<string>} File url
   */
  uploadFile(filePath, build) {
    const outPath = this.getOutFilePath(filePath, build);
    return copyFile(filePath, outPath)
      .then(() => this.getFileUrl(filePath, build));
  }

  /**
   * Save updates.json to a hosting
   * @return {Promise<string>} Url to updates.json
   */
  pushUpdatesJson(data) {
    const outPath = path.join(this.options.outPath, 'updates.json');
    mkdirp(this.options.outPath);

    fs.writeFileSync(outPath, JSON.stringify(data, null, '  '));
    return Promise.resolve();
  }

  /**
   * @return {Promise<Array<string>>}
   */
  fetchBuildsList() {
    let builds;
    try {
      builds = fs.readdirSync(this.options.outPath)
        .filter(file => {
          const stat = fs.statSync(path.join(this.options.outPath, file));
          return stat.isDirectory();
        });
    } catch (e) {
      builds = [];
    }

    return Promise.resolve(builds);
  }

  /**
   * @return {Promise}
   */
  removeBuild(build) {
    const buildId = this.getBuildId(build);
    rmDir(path.join(this.options.outPath, buildId));
    return Promise.resolve();
  }

  getOutFilePath(localFilePath, build) {
    localFilePath = path.basename(localFilePath);
    return path.posix.join(
      this.options.outPath,
      this.getBuildId(build),
      this.normalizeFileName(localFilePath)
    );
  }

  getFileUrl(localFilePath, build) {
    let url = this.options.remoteUrl;
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }

    return [
      url,
      this.getBuildId(build),
      this.normalizeFileName(localFilePath)
    ].join('/');
  }
}

module.exports = LocalTransport;

function mkdirp(dirPath) {
  dirPath.split('/').forEach((dir, index, splits) => {
    const parent = splits.slice(0, index).join('/');
    const dirPath = path.resolve(parent, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath);
    }
  });
}

function copyFile(source, target) {
  mkdirp(path.dirname(target));
  return new Promise(function(resolve, reject) {
    const readStream = fs.createReadStream(source);
    readStream.on('error', rejectCleanup);
    const writeStream = fs.createWriteStream(target);
    writeStream.on('error', rejectCleanup);
    function rejectCleanup(err) {
      readStream.destroy();
      writeStream.end();
      reject(err);
    }
    writeStream.on('finish', resolve);
    readStream.pipe(writeStream);
  });
}

function rmDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  fs.readdirSync(dirPath)
    .map(f => path.join(dirPath, f))
    .forEach((file) => {
      fs.lstatSync(file).isDirectory() ? rmDir(file) : fs.unlinkSync(file);
    });
  fs.rmdirSync(dirPath);
}