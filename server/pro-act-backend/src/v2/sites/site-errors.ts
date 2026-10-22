import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

/** 409 `SITE_NAME_EXISTS`: site names are unique per plant (case-insensitive). */
export function siteNameTaken(name: string): ConflictException {
  const message = `A site named "${name}" already exists in this plant. Choose another name.`;
  return new ConflictException({
    code: 'SITE_NAME_EXISTS',
    message,
    fieldErrors: [{ field: 'name', message }],
  });
}

/** 404 for a site outside the acting plant (no existence leak). */
export function siteNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'NOT_FOUND',
    message: 'The site was not found',
  });
}

/** 422 `SITE_NOT_IN_PLANT`: a unit's `siteId` names no site of the acting plant. */
export function siteNotInPlant(): UnprocessableEntityException {
  const message = 'The site is not a site of this plant';
  return new UnprocessableEntityException({
    code: 'SITE_NOT_IN_PLANT',
    message: [message],
    fieldErrors: [{ field: 'siteId', message }],
  });
}

/** 403 `ORGANIZATION_NOT_ALLOWED`: an organization administrator acting in another organization's plant. */
export function siteWriteNotAllowed(): ForbiddenException {
  return new ForbiddenException({
    code: 'ORGANIZATION_NOT_ALLOWED',
    message: 'Only an administrator of this plant can change its sites',
  });
}
