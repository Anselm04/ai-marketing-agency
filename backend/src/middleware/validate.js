export function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [key, config] of Object.entries(schema)) {
      const value = req.body[key];
      if (config.required && (value === undefined || value === null || value === '')) {
        errors.push(`${key} is required`);
        continue;
      }
      if (value !== undefined && config.type) {
        if (config.type === 'number' && typeof value !== 'number') {
          errors.push(`${key} must be a number`);
        }
        if (config.type === 'string' && typeof value !== 'string') {
          errors.push(`${key} must be a string`);
        }
        if (config.type === 'array' && !Array.isArray(value)) {
          errors.push(`${key} must be an array`);
        }
      }
      if (value !== undefined && config.enum && !config.enum.includes(value)) {
        errors.push(`${key} must be one of: ${config.enum.join(', ')}`);
      }
      if (value !== undefined && config.minLength && String(value).length < config.minLength) {
        errors.push(`${key} must be at least ${config.minLength} characters`);
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const errors = [];
    for (const [key, config] of Object.entries(schema)) {
      const value = req.query[key];
      if (config.required && !value) {
        errors.push(`${key} is required`);
      }
      if (value && config.enum && !config.enum.includes(value)) {
        errors.push(`${key} must be one of: ${config.enum.join(', ')}`);
      }
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', errors });
    }
    next();
  };
}
