const { cleanArticles, cleanText } = require('../src/cleaner');

test('cleanText removes extra whitespace and trims', () => {
    const raw = '  Hello \n\n\n   World\t\t';
    const out = cleanText(raw);
    expect(out).toContain('Hello');
    expect(out).toContain('World');
});

test('cleanArticles removes duplicates and normalizes', () => {
    const items = [
        { asset: 'forex', title: 'Test', text: 'Some text', link: 'a'},
        { asset: 'forex', title: 'test', text: 'Some text', link: 'b'},
        { asset: 'crypto', title: 'Unique', text: 'Other', link: 'c'},
    ];
    const out = cleanArticles(items);
    expect(out.length).toBeGreaterThanOrEqual(2);
    const titles = out.map(x => x.title.toLowerCase());
    expect(titles).toContain('test');
    expect(titles).toContain('unique');
});
