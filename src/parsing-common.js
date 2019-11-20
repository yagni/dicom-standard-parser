module.exports.nsResolver = function (prefix) {
  var ns = {
    xl: 'http://www.w3.org/1999/xlink',
    xml: 'http://www.w3.org/XML/1998/namespace'
  };

  return ns[prefix] || 'http://docbook.org/ns/docbook';
}
