export function validateCourseRights(manifest = {}, now = new Date()) {
  const errors = [];
  if (manifest.confirmedOwnership !== true) errors.push('Content ownership must be confirmed.');
  if (manifest.commercialUseAllowed !== true) errors.push('Commercial-use rights must be confirmed.');

  if (manifest.expiresAt) {
    const expiresAt = new Date(manifest.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      errors.push('Rights expiry date is invalid.');
    } else if (expiresAt <= now) {
      errors.push('Content rights have expired.');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function courseRightsError(manifest = {}, now = new Date()) {
  const result = validateCourseRights(manifest, now);
  if (result.valid) return null;
  return {
    error: 'Course processing is blocked until current content rights are verified.',
    details: result.errors,
    code: 'course_rights_invalid',
  };
}
