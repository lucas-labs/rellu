import { expect, mock, test } from 'bun:test';
import { loadConfig } from 'tests/mock/core.mock';

test('config accepts custom changelog mapping and section order', async () => {
  try {
    const { config } = await loadConfig({
      queryKey: 'config-changelog-custom-inputs',
      config: {
        changelog: {
          categoryMap: {
            feat: 'Enhancements',
            fix: 'Maintenance',
            docs: 'Guides',
          },
          sectionOrder: ['Maintenance', 'Enhancements', 'Guides', 'Other'],
        },
      },
    });

    expect(config.changelog.categoryMap.feat).toBe('Enhancements');
    expect(config.changelog.categoryMap.fix).toBe('Maintenance');
    expect(config.changelog.categoryMap.docs).toBe('Guides');
    expect(config.changelog.sectionOrder).toEqual([
      'Maintenance',
      'Enhancements',
      'Guides',
      'Other',
    ]);
  } finally {
    mock.restore();
  }
});
