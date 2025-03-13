#!/usr/bin/env node

'use strict';

const fs = require('fs');
const https = require('https');
const jsdom = require("jsdom");
const path = require('path');
const stableStringify = require('json-stable-stringify'); // so we can sort the output data dictionary by tag (JS doesn't enforce object key order); helps with diffs
const parseDataDictionary = require('./parse-data-dictionary.js');
const parseIODs = require('./parse-iods.js');
const spacesPerTab = 0;  // Change this to 4 to prettify the output

function parseXML(rawData) {
    // Hack: strip out the default namespace so we don't have to include a bunch of fake namespaces in our XPath queries
    // Also replace zero-width spaces with empty string
    const cleanedData = rawData.replace('xmlns="http://docbook.org/ns/docbook"', '').replace(/​/g, '');
    return new jsdom.JSDOM(cleanedData, { contentType: 'text/xml' }).window.document;
}

function requestXML(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                try {
                    //console.log(rawData.length);
                    resolve(parseXML(rawData));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (e) => {
            reject(e);
        });
    });
}

console.log('Downloading data dictionary and IOD specifications...');

/* Uncomment this if you already have a data dictionary (since parsing it is the slowest part)
Promise.all([requestXML('https://dicom.nema.org/medical/dicom/current/source/docbook/part03/part03.xml'),
             JSON.parse(fs.readFileSync('data-dictionary.json', 'utf8'))])
.then(([part3Contents, dataDictionary]) => {
*/

Promise.all([requestXML('https://dicom.nema.org/medical/dicom/current/source/docbook/part03/part03.xml'),
             requestXML('https://dicom.nema.org/medical/dicom/current/source/docbook/part06/part06.xml')])
.then(([part3Contents, part6Contents]) => {
    
    console.log('Parsing data dictionary...');
    const dataDictionary = parseDataDictionary(parseXML(part6Contents));
    fs.writeFileSync('data-dictionary.json', stableStringify(dataDictionary, {space: spacesPerTab}), 'utf8');
    console.log('Wrote data dictionary.');

    console.log('Parsing IODs...');
    const IODNames = process.argv.slice(2);
    const IODs = parseIODs(part3Contents, dataDictionary, IODNames);
    console.log('Parsed IODs.');

    fs.writeFileSync('IODs.json', JSON.stringify(IODs, null, spacesPerTab), 'utf8');
    console.log('Wrote IODs.');
})
.catch((e) => console.error(e.toString()));
