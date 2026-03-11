import { existsSync, type PathLike, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { parse, type ParseError } from 'jsonc-parser/lib/esm/main.js';
import { log } from '@/utils/logger';
import { ConfigFileSchema, type ConfigFile } from './schema';

const load = (path: string): ConfigFile => {
  const absulutePath = resolve(path);
  if (!existsSync(absulutePath)) {
    throw new Error(`Config file not found at path: ${absulutePath}`);
  }
  // check extension is .json
  const ext = extname(absulutePath).toLowerCase();
  if (ext !== '.json' && ext !== '.jsonc') {
    throw new Error(`Unsupported config file format: ${ext}. Use .json config file instead.`);
  }
  const rawData = readFileSync(absulutePath, 'utf-8');
  try {
    const errors: ParseError[] = [];
    const configObject = parse(rawData, errors, { allowTrailingComma: true });
    if (errors.length > 0) {
      log.warn(`Config file at path ${absulutePath} has parsing errors:`);
      errors.forEach((error) => {
        log.warn(`  - ${JSON.stringify(error)}`);
      });
    }

    return ConfigFileSchema.parse(configObject);
  } catch (e) {
    throw new Error(
      `Failed to parse config file at path: ${absulutePath}. Error: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
};

const configFileLoader = {
  load,
};

export default configFileLoader;
