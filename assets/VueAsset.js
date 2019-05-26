const md5 = require('parcel-bundler/src/utils/md5');
const VueAsset = require('parcel-bundler/src/assets/VueAsset')

class CustomVueAsset extends VueAsset {

  async generate() {
    if (this.ast == null) return []
    let parts = await super.generate()
    let descriptor = this.ast;
    // console.log(descriptor)
    this.customBlocks =[]

    if (descriptor.customBlocks) {
      for(let block of descriptor.customBlocks) {
        if (block.attrs.lang == null) {
          block.attrs.lang = 'txt'
        }
        if (block.attrs.target == null) {
          block.attrs.target = 'node'
        }
        parts.push({
          type: block.attrs.lang,
          value: block.content
        })
        this.customBlocks.push(block)
      }
    }
    return parts;
  }


  async postProcess(generated) {
    let result = [];
    if (this.ast == null) return [{type: 'js', value: ''}]
    let hasScoped = this.ast.styles.some(s => s.scoped);
    let id = md5(this.name).slice(-6);
    let scopeId = hasScoped ? `data-v-${id}` : null;
    let optsVar = '$' + id;

    // Generate JS output.
    let js = this.ast.script ? generated[0].value : '';
    let supplemental = '';
    // TODO: make it possible to process this code with the normal scope hoister
    if (this.options.scopeHoist) {
      optsVar = `$${t.toIdentifier(this.id)}$export$default`;

      if (!js.includes(optsVar)) {
        optsVar = `$${t.toIdentifier(this.id)}$exports`;
        if (!js.includes(optsVar)) {
          supplemental += `
            var ${optsVar} = {};
          `;

          this.cacheData.isCommonJS = true;
        }
      }
    } else {
      supplemental += `
        var ${optsVar} = exports.default || module.exports;
      `;
    }

    supplemental += `
      if (typeof ${optsVar} === 'function') {
        ${optsVar} = ${optsVar}.options;
      }
    `;
    supplemental += this.compileTemplate(generated, scopeId, optsVar);
    supplemental += this.compileCSSModules(generated, optsVar);
    supplemental += this.compileHMR(generated, optsVar);
    supplemental += this.compileCustomBlocks(generated, scopeId, optsVar);
    
    if (this.options.minify && !this.options.scopeHoist) {
      let {code, error} = minify(supplemental, {toplevel: true});
      if (error) {
        throw error;
      }

      supplemental = code;
      if (supplemental) {
        supplemental = `\n(function(){${supplemental}})();`;
      }
    }
    js += supplemental;

    if (js) {
      result.push({
        type: 'js',
        value: js,
        map: this.options.sourceMaps && this.ast.script && generated[0].map
      });
    }

    let css = this.compileStyle(generated, scopeId);
    if (css) {
      result.push({
        type: 'css',
        value: css
      });
    }

    return result;
  }

  compileCustomBlocks(generated, scopeId, optsVar) {
    let result = ''
    let i = 0;
    result += `${optsVar}.__id = '${optsVar}';`
    for(let block of generated.slice(1)) {
      if (block.type === 'js') {
        let customBlock = this.customBlocks[i++]
        if (this.options.target === customBlock.attrs.target || customBlock.attrs.target === 'both') {
          if (customBlock.attrs.lang === 'txt') {
            block.value = `let exports = '${customBlock.content.trim()}';`
          }
          else if (block.value.indexOf('module.exports =') + 1) {
            block.value = block.value.replace('module.exports =', 'exports =')
          } else {
            block.value = `let exports = {}; ${block.value}`
          }
          let code = `(function() { ${block.value}; return exports;})();`
          result += `${optsVar}.${customBlock.type} = ${code}`;
        }
      }
    }
    return result
  }

}

module.exports = CustomVueAsset;
