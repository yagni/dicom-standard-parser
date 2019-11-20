const parsingCommon = require('./parsing-common.js');
const sortKeys = require('./sort-keys.js');
const nsResolver = parsingCommon.nsResolver;
const XPathResult = require('jsdom/lib/jsdom/living/index.js').XPathResult;

const ENUMERATED_VALUES = 'Enumerated Values';
const DEFINED_TERMS = 'Defined Terms';

function cacheSectionNodes(helper) {
  const nodes = helper.xmlDoc.evaluate(`//section`, helper.xmlDoc.documentElement, nsResolver, XPathResult.ANY_TYPE, null);
  let sectionNode;
  while (sectionNode = nodes.iterateNext()) {
    helper.sectionNodes[sectionNode.attributes['xml:id'].nodeValue] = sectionNode;
  }
}
function cacheTableRows(helper) {
  const tableNodes = helper.xmlDoc.evaluate(`//table`, helper.xmlDoc.documentElement, nsResolver, XPathResult.ANY_TYPE, null);
  let tableNode;
  while (tableNode = tableNodes.iterateNext()) {
    helper.tableRows[tableNode.attributes['xml:id'].nodeValue] = helper.xmlDoc.evaluate(`./tbody/tr`, tableNode, nsResolver, XPathResult.ANY_TYPE, null);
  }
}
function getCell(helper, path, rowNode) {
  let cellNode = helper.xmlDoc.evaluate(path, rowNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
  // Typo in the standard (some <td> are <th>)
  if (cellNode == null)
    cellNode = helper.xmlDoc.evaluate(path.replace('td', 'th'), rowNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
  return cellNode;
}
function getDepth (name) {
  const depthMatch = name.match(/^(>)+/);


  return (depthMatch || [''])[0];
}
function getMacro (helper, elementNode, name) {
  const tableIdNode = helper.xmlDoc.evaluate('.//xref/@linkend', elementNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

  if (!name.includes('Include') || tableIdNode == null) {
    return undefined;
  }
  const tableId = tableIdNode.textContent;

  if (tableId.substr(0, 5) !== 'table') {
    return undefined;
  }

  if (helper.macros[tableId] !== undefined) {
    return helper.macros[tableId];
  }

  return (helper.macros[tableId] = parseAttributes(helper, helper.tableRows[tableId]));
}
function getModule(helper, sectionLabel) {
  if (helper.modules[sectionLabel] !== undefined) {
    return helper.modules[sectionLabel];
  }

  return (helper.modules[sectionLabel] = parseModule(helper, sectionLabel));
}
function getNumberOfItemsTag(helper, descriptionNode) {
  /**** These phrases reference other fields to get their item count:
    The number of Items shall be identical to the value of
    The number of Items shall be equal to
    The number of Items shall be equal to the value of
    The number of Items shall match the value of
    The number of Items shall equal the value of
    The number of Items in the Sequence is given by 
    The number of Items in this Sequence shall equal the value of 
    Number of Items in the Sequence shall be equal to the 
    The number of Items included in this Sequence shall equal the value of
    Shall have the same number of Items as the value of 
  */
  const paraNode = helper.xmlDoc.evaluate('./para[contains(translate(., \'ABCDEFGHIJKLMNOPQRSTUVWXYZ\', \'abcdefghijklmnopqrstuvwxyz\'),\'number of items\')]', descriptionNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();
  if (paraNode == null) return undefined;
  descriptionText = paraNode.textContent.trim();
  descriptionMatch = descriptionText.match(/^.*number of items.*(equal to the|equal to|value of|given by)[^\(]+\(([0-9A-Fx]{4}),([0-9A-Fx]{4})\)/i);

  if (descriptionMatch == null || descriptionMatch.length < 4)
    return undefined;

  return { tag: (descriptionMatch[2].trim().toUpperCase() + descriptionMatch[3].trim().toUpperCase()) };
}
function getNumericNumberOfItems(helper, tag, descriptionNode) {
  let xPathResult = helper.xmlDoc.evaluate('./para[contains(translate(., \'ABCDEFGHIJKLMNOPQRSTUVWXYZ\', \'abcdefghijklmnopqrstuvwxyz\'),\'in this sequence\')]', descriptionNode, nsResolver, XPathResult.ANY_TYPE, null);
  let invalidDescription;
  while(paraNode = xPathResult.iterateNext()) {
    let descriptionText = paraNode.textContent.trim();
    let descriptionMatch = descriptionText.match(/^(?:[^\.]*\.)*([^\.]*in this sequence)/i);

    /*
      No more than one Item shall be included in this Sequence.
      One or more Items are permitted in this Sequence.
      One or more Items may be present in this Sequence.
      One or more Items shall be included in this Sequence.
      One or more Items shall be present in this Sequence.
      One or two Items shall be included in this Sequence.
      One, two, or three Items shall be included in this Sequence.
      Only a single Item is permitted in this Sequence.
      Only a single Item shall be included in this Sequence.
      Only a single Item shall beincludedin this Sequence.
      Only a single Item single Item is permitted in this Sequence.
      Only one Item shall be included in this Sequence.
      Only one Item shall be present in this Sequence.
      Only one or two Items are permitted in this Sequence.
      Only two Items shall be included in this Sequence.
      Two Items shall be included in this Sequence.
      Two or more Items shall be included in this Sequence.
      Zero or more Items may be included in this Sequence.
      Zero or more Items shall be included in this Sequence.
      Zero or one Item shall be included in this Sequence.
      Zero or one Itemshall be included in this Sequence.
    */

    /* TODO:
      A single item shall be present
      One or more Items shall be present.
      Only one Item shall be included in the Sequence.
      Only one Item shall be permitted.
    */
        
    let start;
    const description = descriptionMatch[1].trim().toLowerCase();

    if (description.includes('single') || description.startsWith('one') || description.startsWith('only one')) {
      start = 1;
    } else if (description.startsWith('only two') || description.startsWith('two')) {
      start = 2;
    } else if (description.startsWith('zero')) {
      start = 0;
    } else {
      invalidDescription = `Invalid number of item start on tag ${tag}, description text: ${description}`;
      continue;
    }

    let end = start; // default to exactly the number of items specified in the start

    if (description.includes('or more')) {
      end = undefined;
    } else if (description.includes('or one')) {
      end = 1;
    } else if (description.includes('or two')) {
      end = 2;
    } else if (description.includes('or three')) {
      end = 3;
    }

    return { min: start, max: end };
  }

  if (invalidDescription)
    console.log(invalidDescription);

  return undefined;
}

function getNumberOfItemsAllowed(helper, tag, descriptionNode) {
  let numberOfItems = getNumberOfItemsTag(helper, descriptionNode);

  if (numberOfItems == undefined) {
    numberOfItems = getNumericNumberOfItems(helper, tag, descriptionNode);
  }

  if (numberOfItems == undefined) {
    console.log(`Could not find number of items allowed for tag ${tag}`);

    return undefined;
  }

  return numberOfItems;
}

function getSection (helper, sectionLabel) {
  return helper.sectionNodes[sectionLabel];
}

function isSequence (attribute) {
  return attribute.vr === 'SQ';
}

function mergeDepthTrees (receivingTree, otherTree) {
  for (const otherDepth in otherTree) {
    if (otherTree.hasOwnProperty(otherDepth)) {
      if (receivingTree[otherDepth] === undefined) {
        receivingTree[otherDepth] = otherTree[otherDepth];
      } else {
        // TODO: If already found, use type = min(receivingTree.type, otherTree.type)
        //console.log(`already had ${otherDepth}`);
        receivingTree[otherDepth] = receivingTree[otherDepth].concat(otherTree[otherDepth]);
      }
    }
  }
}
function parseAttribute (helper, rowNode, name) {
  // Description is our canary: if it doesn't exist, it means there's something special in this row
  let descriptionNode = getCell(helper, './td[position() = 4]', rowNode);

  if (descriptionNode === null) {
    if (name !== 'BASIC CODED ENTRY ATTRIBUTES' && name !== 'ENHANCED ENCODING MODE') // these two are just headers within a couple of macros; no need to report on them
      console.log(`Couldn't parse attribute ${name} in table ${rowNode.parentNode.parentNode.attributes['xml:id'].textContent}`);
    return undefined;
  }

  const depth = getDepth(name);
  let tagNode = getCell(helper, './td[position() = 2]/para', rowNode);
  let tag = tagNode.textContent.trim();

  if (tag !== tag.replace(' ', ',')) {
    console.log(`Fixed ${tag}`);
  }
  tag = tag.replace(' ', ',');
  const tagElements = (/\((.+),(.+)\)/).exec(tag);
  tag = tagElements[1] + tagElements[2];
  const type = getCell(helper, './td[position() = 3]/para', rowNode).textContent.trim();
  const dictionaryEntry = helper.dataDictionary[tag];
  if (dictionaryEntry === undefined) throw new Error(`Tag ${tag} was not in the dictionary.`);
  const attribute = { tag,
    type,
    depth,
    vr: dictionaryEntry.vr,
    vm: dictionaryEntry.vm };

  parseAttributeDescription(helper, attribute, descriptionNode);

  return attribute;
}
function parseAttributeDescription (helper, attribute, descriptionNode) {
  if (attribute.vr === 'SQ') {
    // Look at description to know how many items are permitted
    attribute.itemCount = getNumberOfItemsAllowed(helper, attribute.tag, descriptionNode);
  } else {
    // Most things are in paras, but defined terms and enumerated values are in variablelist
    attribute.enumeratedValues = parseValueList(helper, ENUMERATED_VALUES, descriptionNode);
    attribute.definedTerms = parseValueList(helper, DEFINED_TERMS, descriptionNode);

    if (attribute.enumeratedValues === undefined) {
      // Else if contains "See Section xyz", search in that section for enumerated values or defined terms (if defined terms, set flag to allow custom)
      attribute.enumeratedValues = parseReferencedValueList(helper, ENUMERATED_VALUES, descriptionNode);
    }

    if (attribute.definedTerms === undefined) {
      // Else if contains "See Section xyz", search in that section for enumerated values or defined terms (if defined terms, set flag to allow custom)
      attribute.definedTerms = parseReferencedValueList(helper, DEFINED_TERMS, descriptionNode);
    }
  }
}

/*
  parseAttributeNode
    parseSequence
      parseAttributeNode (returns a macro)
      parseAttributeNode
      parseAttributeNode (returns ???)
        parseSequence (returns sequence attribute and top-level macro)
          parseAttributeNode
          parseAttributeNode (returns a macro for the top level)
*/
// Returns {depth1: [attributes], depth2: [attributes]}
function parseAttributeNode (helper, attributeNode, attributeIterator) {
  const name = getCell(helper, './td[position() = 1]/para', attributeNode).textContent.trim();
  const macro = getMacro(helper, attributeNode, name);

  if (macro !== undefined) {
    return { [getDepth(name)]: macro };
  }

  const attribute = parseAttribute(helper, attributeNode, name);

  if (attribute === undefined) {
    return {};
  }
  const returnedAttributes = { [attribute.depth]: [attribute] };

  if (isSequence(attribute)) {
    // Ugly, but we can't iterate backwards and we can't know the sequence is done until
    // we get to the next element, so we just pass it up out of parseSequence
    const nextDepth = parseSequence(helper, attribute, name, attributeIterator);

    if (nextDepth !== null) {
      mergeDepthTrees(returnedAttributes, nextDepth);
    }
  }

  return returnedAttributes;
}
function parseAttributes (helper, attributeIterator) {
  let attributes = [];

  for (let attributeNode = attributeIterator.iterateNext(); attributeNode !== null; attributeNode = attributeIterator.iterateNext()) {
    const parsedAttributes = parseAttributeNode(helper, attributeNode, attributeIterator);

    if (Object.keys(parsedAttributes).length > 1) {
      throw new Error('Should not have multiple depths at the top level!');
    }
    attributes = attributes.concat(parsedAttributes[''] || []); // we should be at the topmost depth
  }

  return attributes;
}

/*
<variablelist spacing="compact">
  <title>Defined Terms:</title>
  <varlistentry>
    <term>DCMR</term>
    <listitem>
      <para xml:id="para_5e375f95-6035-4d13-bcd8-7e6ab7633e8b">DICOM Content Mapping Resource</para>
    </listitem>
  </varlistentry>
  <varlistentry>
    <term>SDM</term>
    <listitem>
      <para xml:id="para_08ef5599-8566-4d22-9314-a944e5be2432">SNOMED DICOM Microglossary (Retired)</para>
    </listitem>
  </varlistentry>
</variablelist>
 */

// TODO: Make this work on ImageType (C.7.6.1.1.2) and Modality (C.7.3.1.1.1)
function parseValueList (helper, type, descriptionNode) {
  /* <variablelist spacing="compact">
      <title>Enumerated Values:</title>
      <varlistentry>
        <term>SOME VALUE</term>
        <listitem>
          <para xml:id="para_2f528f70-1725-4ded-9179-d1aaad75d753">Text description of term.</para>
        </listitem>
      </varlistentry>
    </variablelist>
  */
  const titleNode = helper.xmlDoc.evaluate('./variablelist/title', descriptionNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext();

  if (titleNode === null || !titleNode.textContent.trim().startsWith(type)) {
    return undefined;
  }
  const enumeratedValueIterator = helper.xmlDoc.evaluate('./variablelist/varlistentry/term', descriptionNode, nsResolver, XPathResult.ANY_TYPE, null);
  const enumeratedValues = [];

  for (let enumeratedValueNode = enumeratedValueIterator.iterateNext(); enumeratedValueNode !== null; enumeratedValueNode = enumeratedValueIterator.iterateNext()) {
    enumeratedValues.push(enumeratedValueNode.textContent.trim());
  }

  return enumeratedValues;
}
function parseModule (helper, sectionLabel) {
  const moduleSection = getSection(helper, sectionLabel);
  const elementIterator = helper.xmlDoc.evaluate('./table[position() = 1]/tbody/tr', moduleSection, nsResolver, XPathResult.ANY_TYPE, null);


  return parseAttributes(helper, elementIterator); // a module is just a collection of elements
}
function parseReferencedValueList (helper, type, descriptionNode) {
  // Case-insensitive search for "see "
  const referencedSectionIterator = helper.xmlDoc.evaluate('./para[contains(translate(., \'ABCDEFGHIJKLMNOPQRSTUVWXYZ\', \'abcdefghijklmnopqrstuvwxyz\'),\'see \')]/xref/@linkend', descriptionNode, nsResolver, XPathResult.ANY_TYPE, null);

  for (let sectionReferenceNode = referencedSectionIterator.iterateNext(); sectionReferenceNode !== null; sectionReferenceNode = referencedSectionIterator.iterateNext()) {
    const sectionId = sectionReferenceNode.textContent.trim();

    if (sectionId.startsWith('note') || sectionId.startsWith('figure') || sectionId.startsWith('biblio')) {
      continue;
    }
    const section = getSection(helper, sectionId);

    if (section == null) {
      console.log(`Cannot find section ${sectionId}`);
      continue;
    }
    const enumeratedValues = parseValueList(helper, type, section);

    if (enumeratedValues !== undefined) {
      return enumeratedValues;
    }
  }

  return undefined;
}

function parseSequence (helper, sequenceAttribute, name, attributeIterator) {
  const itemDepth = `${sequenceAttribute.depth}>`;

  sequenceAttribute.itemAttributes = [];
  for (let attributeNode = attributeIterator.iterateNext(); attributeNode !== null; attributeNode = attributeIterator.iterateNext()) {
    const attributes = parseAttributeNode(helper, attributeNode, attributeIterator);
    const itemAttributes = (attributes[itemDepth] || []);

    sequenceAttribute.itemAttributes = sequenceAttribute.itemAttributes.concat(itemAttributes);
    delete attributes[itemDepth];
    const followingDepths = Object.keys(attributes).filter((attribute) => attribute.length < itemDepth.length);

    if (followingDepths.length > 0) {
      return attributes;
    }
  }

  return undefined;
}

module.exports = function (xmlDoc, dataDictionary, IODs) {
  const helper = { xmlDoc,
    dataDictionary,
    modules: {},
    macros: {},
    tableRows: {},
    sectionNodes: {} };

  console.log('Caching table rows...');
  cacheTableRows(helper);
  console.log('Caching sections...');
  cacheSectionNodes(helper);

  const iodIterator = xmlDoc.evaluate('/book/chapter[@label=\'A\']//table[caption[contains(.,\'IOD Modules\')]]', xmlDoc.documentElement, nsResolver, XPathResult.ANY_TYPE, null);
  const output = {iods: {}, modules: {}};

  for (let iodNode = iodIterator.iterateNext(); iodNode !== null; iodNode = iodIterator.iterateNext()) {
    const caption = xmlDoc.evaluate('./caption', iodNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
    const name = caption.replace(' IOD Modules', '');
    if (IODs && IODs.length > 0 && !IODs.includes(name)) continue;
    console.log(`Parsing IOD ${name}...`);
    const IOD = { name, modules: [] };
    const moduleIterator = xmlDoc.evaluate('./tbody/tr', iodNode, nsResolver, XPathResult.ANY_TYPE, null);

    for (let moduleNode = moduleIterator.iterateNext(); moduleNode !== null; moduleNode = moduleIterator.iterateNext()) {
      // Old way: const section = xmlDoc.evaluate('./td/para/xref/@linkend', moduleNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
      const section = xmlDoc.evaluate('./td//xref/@linkend', moduleNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
      const name = xmlDoc.evaluate('./td[last() - 2]/para/text()', moduleNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
      //console.log(`Parsing module ${name}...`);
      const usage = xmlDoc.evaluate('./td[last()]/para/text()', moduleNode, nsResolver, XPathResult.ANY_TYPE, null).iterateNext().textContent;
      const attributes = getModule(helper, section);

      output.modules[name] = attributes;

      IOD.modules.push({ name, usage: usage[0] }); // Strip off any conditional verbiage on the usage
    }
    output.iods[name] = IOD;
  }

  if (IODs.length > 0 && Object.keys(output.iods).length != IODs.length) {
    const outputIODNames = Object.keys(output.iods);
    throw new Error(`IODs ${IODs.filter((iodName) => !outputIODNames.includes(iodName)).join(', ')} were not found in part 3 of the standard!`);
  }

  output.iods = sortKeys(output.iods);
  output.modules = sortKeys(output.modules);

  return output;
}
