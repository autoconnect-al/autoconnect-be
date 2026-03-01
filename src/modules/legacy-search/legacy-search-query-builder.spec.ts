import { LegacySearchQueryBuilder } from './legacy-search-query-builder';

describe('LegacySearchQueryBuilder', () => {
  let builder: LegacySearchQueryBuilder;

  beforeEach(() => {
    builder = new LegacySearchQueryBuilder();
  });

  it('buildWhere applies keyword korea clause', () => {
    const built = builder.buildWhere({
      type: 'car',
      keyword: 'korea',
      searchTerms: [],
    });

    expect(built.whereSql).toContain('(cleanedCaption LIKE ? OR accountName LIKE ?)');
    expect(built.params).toEqual(expect.arrayContaining(['%korea%', '%korea%']));
  });

  it('buildWhere applies okazion/oferte pricing formula', () => {
    const built = builder.buildWhere({
      type: 'car',
      keyword: 'okazion,oferte',
      searchTerms: [],
    });

    expect(built.whereSql).toContain('((price - minPrice) / (maxPrice - price) < 0.25)');
    expect(built.whereSql).toContain('minPrice > 1');
    expect(built.whereSql).toContain('maxPrice > 1');
  });

  it('buildWhere normalizes generalSearch tokens', () => {
    const built = builder.buildWhere({
      type: 'car',
      generalSearch: 'Benc Seria 5',
      searchTerms: [],
    });

    expect(built.params).toEqual(expect.arrayContaining(['%benz%']));
    expect(built.whereSql).toContain('cleanedCaption LIKE ?');
  });

  it('buildWhere supports vendorAccountName and omits default vendor filter', () => {
    const built = builder.buildWhere({
      type: 'car',
      searchTerms: [{ key: 'vendorAccountName', value: 'autokorea.al' }],
    });

    expect(built.whereSql).toContain('accountName = ?');
    expect(built.whereSql).not.toContain('vendorId != 1');
    expect(built.params).toEqual(expect.arrayContaining(['autokorea.al']));
  });

  it('buildSortAndPagination uses safe defaults and allowed sort map', () => {
    const built = builder.buildSortAndPagination({
      sortTerms: [{ key: 'unknown_key', order: 'bad' }],
      maxResults: 0,
      page: -1,
    });

    expect(built.orderSql).toBe('ORDER BY renewedTime DESC');
    expect(built.limit).toBe(24);
    expect(built.offset).toBe(0);
  });

  it('buildWhere uses variant matching when resolved model is a variant', () => {
    const built = builder.buildWhere(
      {
        type: 'car',
        searchTerms: [
          { key: 'make1', value: 'BMW' },
          { key: 'model1', value: 'X5' },
        ],
      },
      { model: 'X5', isVariant: true },
    );

    expect(built.whereSql).toContain(
      '(variant LIKE ? OR variant LIKE ? OR variant LIKE ?)',
    );
    expect(built.whereSql).not.toContain('model = ?');
    expect(built.params).toEqual(
      expect.arrayContaining(['BMW', '% X5 %', 'X5%', '%X5']),
    );
  });

  it('buildWhere keeps model equality for "(all)" input even when model is variant', () => {
    const built = builder.buildWhere(
      {
        type: 'car',
        searchTerms: [
          { key: 'make1', value: 'BMW' },
          { key: 'model1', value: 'X5 (all)' },
        ],
      },
      { model: 'X5 (all)', isVariant: true },
    );

    expect(built.whereSql).toContain('model = ?');
    expect(built.whereSql).not.toContain('variant LIKE');
    expect(built.params).toEqual(expect.arrayContaining(['X5']));
  });

  it('parseFilter + parseCsvValues + extractRegistrationFrom handle invalid inputs safely', () => {
    expect(builder.parseFilter(undefined)).toBeNull();
    expect(builder.parseFilter('not-json')).toBeNull();
    expect(builder.parseCsvValues("1,2,, ,3")).toEqual(['1', '2', '3']);
    expect(builder.extractRegistrationFrom({ from: '2020' })).toBe(2020);
    expect(builder.extractRegistrationFrom({ from: '' })).toBeNull();
    expect(builder.extractRegistrationFrom(null)).toBeNull();
  });
});
