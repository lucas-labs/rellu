import { ZodObject } from 'zod';
import { ConfigFileSchema } from '../src/action/config/schema';
import * as fs from 'fs';
import * as path from 'path';

const makeJsonSchemaFromZod = (zodSchema: ZodObject): object => {
  const schema = zodSchema.toJSONSchema({
    reused: 'inline',
    unrepresentable: 'throw',
    cycles: 'throw',
    io: 'input',
  });

  // add an optional $schema property to the properties of the root schema to allow referencing the schema in config files
  if (schema && typeof schema === 'object' && 'properties' in schema) {
    (schema as any).properties.$schema = {
      type: 'string',
      description:
        'The $schema property is optional and can be used to reference the schema in config files',
    };
  }

  // add allowTrailingCommas: true to the root schema to allow trailing commas in config files
  if (schema && typeof schema === 'object') {
    (schema as any).allowTrailingCommas = true;
  }

  return schema;
};

const configJsonSchema = makeJsonSchemaFromZod(ConfigFileSchema);

// output schemas to dist/schemas

const outputDir = path.resolve(__dirname, '../dist/schemas');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  path.join(outputDir, 'config-schema.json'),
  JSON.stringify(configJsonSchema, null, 2),
);
