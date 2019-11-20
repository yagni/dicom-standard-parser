function sortKeys(template) {
	const sorted = {};

	const keys = Object.keys(template);
	keys.sort();

	for (let key of keys) {
		const attribute = template[key];
		sorted[key] = attribute;
		if (attribute.vr === "SQ" && (attribute.Value instanceof Array)) {
			const items = [];
			for (let item of attribute.Value) {
				items.push(sortKeys(item));
			}
			attribute.Value = items;
		}
	}

	return sorted;
}

module.exports = sortKeys;