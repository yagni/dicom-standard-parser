const parsingCommon = require('./parsing-common.js');
const nsResolver = parsingCommon.nsResolver;

const sortKeys = require('./sort-keys.js');

function parseDictionaryElements (xmlDoc, elements, rowIterator) {
  for (let rowNode = rowIterator.iterateNext(); rowNode !== null; rowNode = rowIterator.iterateNext()) {
    const tag = xmlDoc.evaluate('./td[position() = 1]/para', rowNode, nsResolver, parsingCommon.ANY_TYPE, null).iterateNext().textContent.trim();
    const name = xmlDoc.evaluate('./td[position() = 3]/para', rowNode, nsResolver, parsingCommon.ANY_TYPE, null).iterateNext().textContent.trim();
    let vr = xmlDoc.evaluate('./td[position() = 4]/para', rowNode, nsResolver, parsingCommon.ANY_TYPE, null).iterateNext().textContent.trim().split(" or ");
    if (vr.length === 1) vr = vr[0];

    // TODO: Convert "1-n or 1" as ["1-n", "1"]
    const vm = xmlDoc.evaluate('./td[position() = 5]/para', rowNode, nsResolver, parsingCommon.ANY_TYPE, null).iterateNext().textContent.trim();

    // TODO: Add retired flag for retired elements

    const tagElements = (/\((.+),(.+)\)/).exec(tag);

    elements[tagElements[1] + tagElements[2]] = { name, vr, vm };
  }
}

module.exports = function (xmlDoc) {
  const elements = {};
  ['6', '7', '8', '9'].forEach((section) => {
    const elementIterator = xmlDoc.evaluate(`/book/chapter[@label='${section}']/table/tbody/tr`, xmlDoc.documentElement, nsResolver, parsingCommon.ANY_TYPE, null);
    parseDictionaryElements(xmlDoc, elements, elementIterator);
  });

  // TODO: Parse UIDs

  return sortKeys(elements);
}
