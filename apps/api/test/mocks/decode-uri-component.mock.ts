function decodeUriComponent(encodedURI: string): string {
  if (typeof encodedURI !== 'string') {
    throw new TypeError(
      'Expected `encodedURI` to be of type `string`, got `' +
        typeof encodedURI +
        '`',
    );
  }
  try {
    return decodeURIComponent(encodedURI);
  } catch {
    return encodedURI;
  }
}

export default decodeUriComponent;
module.exports = decodeUriComponent;
module.exports.default = decodeUriComponent;
