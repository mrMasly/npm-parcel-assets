
const Asset = require('parcel-bundler/src/Asset');
const localRequire = require('parcel-bundler/src/utils/localRequire');
const path = require('path');

class SlmAsset extends Asset {
  constructor(name, options) {
    super(name, options);
    this.type = 'html';
    this.hmrPageReload = true;
  }

  async generate() {
    const slm = await localRequire('slm', this.name);
    const config =
      (await this.getConfig(['.slmrc', '.slmrc.js', 'slm.config.js'])) || {};

    const compiled = slm.compile(this.contents, {
      compileDebug: false,
      filename: this.name,
      basedir: path.dirname(this.name),
      pretty: config.pretty || false,
      templateName: path.basename(this.basename, path.extname(this.basename)),
      filters: config.filters,
      filterOptions: config.filterOptions,
      filterAliases: config.filterAliases
    });

    if (compiled.dependencies) {
      for (let item of compiled.dependencies) {
        this.addDependency(item, {
          includedInParent: true
        });
      }
    }
    return compiled(config.locals);
  }
}

module.exports = SlmAsset;
