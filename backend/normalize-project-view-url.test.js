const { normalizeProjectViewUrl } = require('./services/productionService.js');

describe('normalizeProjectViewUrl', () => {
    test('returns null for "/"', () => {
        expect(normalizeProjectViewUrl('/')).toBeNull();
    });

    test('returns null for absolute origin root "http://localhost:3001/"', () => {
        expect(normalizeProjectViewUrl('http://localhost:3001/')).toBeNull();
    });

    test('keeps relative /api/gallery path', () => {
        expect(normalizeProjectViewUrl('/api/gallery/image?url=abc')).toBe('/api/gallery/image?url=abc');
    });

    test('adds leading slash for "api/gallery/..."', () => {
        expect(normalizeProjectViewUrl('api/gallery/image?url=abc')).toBe('/api/gallery/image?url=abc');
    });

    test('normalizes absolute localhost url to relative /api/gallery/...', () => {
        expect(normalizeProjectViewUrl('http://localhost:3001/api/gallery/image?url=abc'))
            .toBe('/api/gallery/image?url=abc');
    });

    test('normalizes absolute https url to relative /api/gallery/...', () => {
        expect(normalizeProjectViewUrl('https://example.com/api/gallery/image?url=abc'))
            .toBe('/api/gallery/image?url=abc');
    });

    test('returns original value for non-gallery absolute urls', () => {
        expect(normalizeProjectViewUrl('https://example.com/some/path?x=1'))
            .toBe('https://example.com/some/path?x=1');
    });

    test('returns original value for non-gallery relative urls', () => {
        expect(normalizeProjectViewUrl('/images/foo.jpg'))
            .toBe('/images/foo.jpg');
    });

    test('returns same value for non-string inputs', () => {
        expect(normalizeProjectViewUrl(123)).toBe(123);
        expect(normalizeProjectViewUrl({ a: 1 })).toEqual({ a: 1 });
        expect(normalizeProjectViewUrl(null)).toBeNull();
        expect(normalizeProjectViewUrl(undefined)).toBeUndefined();
    });

    test('trims whitespace before processing', () => {
        expect(normalizeProjectViewUrl('  http://localhost:3001/api/gallery/image?url=abc  '))
            .toBe('/api/gallery/image?url=abc');
    });
});
